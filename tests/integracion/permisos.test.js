// Tests de integración: qué puede hacer cada rol (la matriz de permisos del README).
//  - ADMIN: administra la plataforma (usuarios, salas, borrados físicos) y ve toda la red. No
//    opera la boletería ni la programación de los centros, salvo cancelar un evento por fuerza mayor.
//  - REPRESENTANTE: supervisa su centro (boletería, eventos y su sala).
//  - EMPLEADO: la boletería de su centro.
// Y el personal de un centro ve solo la información de su centro (control por atributo).
import request from 'supertest';
import app from '../../app.js';
import * as entradasModel from '../../models/entradas.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearEvento, crearCliente, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

const EN_UN_MES = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

let d;
beforeEach(async () => {
  const salaA = await crearSala({ nombre: 'Centro Cultural Norte' });
  const salaB = await crearSala({ nombre: 'Centro Cultural Sur' });
  const eventoA = await crearEvento(salaA.id, { nombre: 'Evento del Norte' });
  const eventoB = await crearEvento(salaB.id, { nombre: 'Evento del Sur' });
  const cliente = await crearCliente();
  d = {
    salaA, salaB, eventoA, eventoB, cliente,
    // una entrada vendida en cada centro, con el mismo cliente
    entradaA: await entradasModel.createEntrada({ eventoId: eventoA.id, clienteId: cliente.id, precio: 5000 }),
    entradaB: await entradasModel.createEntrada({ eventoId: eventoB.id, clienteId: cliente.id, precio: 5000 }),
    admin: await crearUsuarioConToken({ rol: 'ADMIN' }),
    representanteA: await crearUsuarioConToken({ rol: 'REPRESENTANTE', salaId: salaA.id }),
    empleadoA: await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: salaA.id }),
  };
});

const api = (quien, metodo, ruta, body = {}) =>
  request(app)[metodo](ruta).set('Authorization', `Bearer ${quien.token}`).send(body);
const panel = (quien, ruta) => request(app).get(ruta).set('Cookie', `token=${quien.token}`);
const vender = (quien, evento) => api(quien, 'post', '/entradas', { eventoId: evento.id, clienteId: d.cliente.id });
const nuevoEvento = (quien, sala) =>
  api(quien, 'post', '/eventos', { nombre: 'Evento nuevo', fecha: EN_UN_MES(), salaId: sala.id, precio: 1000 });

describe('ADMIN: administra la plataforma, no opera los centros', () => {
  test('no vende, no reserva ni confirma entradas', async () => {
    expect((await vender(d.admin, d.eventoA)).status).toBe(403);
    expect((await api(d.admin, 'post', '/entradas/reservar', { eventoId: d.eventoA.id, clienteId: d.cliente.id })).status).toBe(403);
    expect((await api(d.admin, 'put', `/entradas/${d.entradaA.id}/cancelar`)).status).toBe(403);
  });

  test('no crea, edita ni finaliza eventos', async () => {
    expect((await nuevoEvento(d.admin, d.salaA)).status).toBe(403);
    expect((await api(d.admin, 'put', `/eventos/${d.eventoA.id}`, { precio: 2000 })).status).toBe(403);
    expect((await api(d.admin, 'put', `/eventos/${d.eventoA.id}/finalizar`)).status).toBe(403);
  });

  test('sí puede cancelar un evento por fuerza mayor', async () => {
    expect((await api(d.admin, 'put', `/eventos/${d.eventoA.id}/cancelar`)).status).toBe(200);
  });

  test('sí administra salas y usuarios, y hace borrados físicos', async () => {
    const sala = await api(d.admin, 'post', '/salas', { nombre: 'Centro Nuevo', direccion: 'Calle Falsa 123', capacidad: 50 });
    expect(sala.status).toBe(201);

    const usuario = await api(d.admin, 'post', '/usuarios', {
      nombre: 'Cajera Nueva', email: 'cajera.nueva@urbanacult.com', password: 'clave-segura', rol: 'EMPLEADO', salaId: d.salaA.id,
    });
    expect(usuario.status).toBe(201);

    const sinEntradas = await crearCliente(9);
    expect((await api(d.admin, 'delete', `/clientes/${sinEntradas.id}`)).status).toBe(204);
  });

  test('ve las entradas de toda la red', async () => {
    const respuesta = await api(d.admin, 'get', '/entradas');
    expect(respuesta.body).toHaveLength(2);
  });
});

describe('REPRESENTANTE: supervisa su centro', () => {
  test('vende y ve clientes y consultas (lo que antes no podía)', async () => {
    expect((await vender(d.representanteA, d.eventoA)).status).toBe(201);
    expect((await api(d.representanteA, 'get', '/clientes')).status).toBe(200);
    expect((await api(d.representanteA, 'get', '/consultas/entradas-vendidas')).status).toBe(200);
  });

  test('crea eventos en su centro, pero no en otro', async () => {
    expect((await nuevoEvento(d.representanteA, d.salaA)).status).toBe(201);
    expect((await nuevoEvento(d.representanteA, d.salaB)).status).toBe(403);
  });

  test('no vende en otro centro', async () => {
    expect((await vender(d.representanteA, d.eventoB)).status).toBe(403);
  });
});

describe('EMPLEADO: la boletería de su centro', () => {
  test('vende en su centro, pero no crea ni cancela eventos', async () => {
    expect((await vender(d.empleadoA, d.eventoA)).status).toBe(201);
    expect((await nuevoEvento(d.empleadoA, d.salaA)).status).toBe(403);
    expect((await api(d.empleadoA, 'put', `/eventos/${d.eventoA.id}/cancelar`)).status).toBe(403);
  });
});

describe('El personal ve solo la información de su centro', () => {
  test('en la lista de entradas solo aparecen las de su centro', async () => {
    const respuesta = await api(d.empleadoA, 'get', '/entradas');

    expect(respuesta.body).toHaveLength(1);
    expect(respuesta.body[0]._id).toBe(d.entradaA.id);
  });

  test('en las consultas solo aparecen los eventos de su centro, y uno ajeno responde 403', async () => {
    const resumen = await api(d.empleadoA, 'get', '/consultas/entradas-vendidas');
    expect(resumen.body.map((e) => e.evento)).toEqual(['Evento del Norte']);

    expect((await api(d.empleadoA, 'get', `/consultas/entradas-vendidas/${d.eventoB.id}`)).status).toBe(403);
  });

  test('en la ficha de un cliente ve sus datos, pero solo las entradas de su centro', async () => {
    const ficha = (await panel(d.empleadoA, `/panel/clientes/${d.cliente.id}`)).text;

    expect(ficha).toContain('Evento del Norte');
    expect(ficha).not.toContain('Evento del Sur');
  });
});

describe('Las vistas muestran solo los botones de cada rol', () => {
  test('el ADMIN no ve "Vender entrada" ni "+ Nuevo evento" en el panel', async () => {
    const inicio = (await panel(d.admin, '/panel')).text;
    expect(inicio).toContain('Panel general');
    expect(inicio).not.toContain('Vender entrada');
    expect(inicio).not.toContain('+ Nuevo evento');
  });

  test('el REPRESENTANTE sí los ve', async () => {
    const inicio = (await panel(d.representanteA, '/panel')).text;
    expect(inicio).toContain('Vender entrada');
    expect(inicio).toContain('+ Nuevo evento');
  });

  test('en el detalle de un evento, el ADMIN ve "Cancelar evento" pero no "Editar" ni "Vender"', async () => {
    const detalle = (await panel(d.admin, `/panel/eventos/${d.eventoA.id}`)).text;
    expect(detalle).toContain('Cancelar evento');
    expect(detalle).not.toContain(`/panel/eventos/${d.eventoA.id}/editar`);
    expect(detalle).not.toContain('Vender entrada');
  });

  test('en la ficha de un cliente, el ADMIN solo ve "Eliminar"', async () => {
    const ficha = (await panel(d.admin, `/panel/clientes/${d.cliente.id}`)).text;
    expect(ficha).toContain('Eliminar cliente');
    expect(ficha).not.toContain(`/panel/clientes/${d.cliente.id}/editar`);
  });

  test('en el menú, el personal ve "Mi centro" y el ADMIN ve "Salas"', async () => {
    expect((await panel(d.empleadoA, '/panel')).text).toContain('Mi centro');
    expect((await panel(d.admin, '/panel')).text).toContain('>Salas<');
  });
});

describe('Filtros de usuarios', () => {
  test('el ADMIN filtra por rol', async () => {
    const pagina = (await panel(d.admin, '/panel/usuarios?rol=EMPLEADO')).text;
    expect(pagina).toContain('empleado@urbanacult.com');
    expect(pagina).not.toContain('representante@urbanacult.com');
  });

  test('el REPRESENTANTE solo ve a los empleados de su centro, sin los filtros de rol y centro', async () => {
    const pagina = (await panel(d.representanteA, '/panel/usuarios')).text;
    expect(pagina).toContain('empleado@urbanacult.com');
    expect(pagina).not.toContain('admin@urbanacult.com');
    expect(pagina).not.toContain('id="rol"');
  });
});
