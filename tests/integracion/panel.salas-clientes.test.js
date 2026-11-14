// Tests de integración del panel (páginas Pug) para salas y clientes: listados, formularios,
// altas, ediciones y bajas. El panel no responde JSON: cuando una acción sale bien redirige con
// un aviso en "?ok=", cuando la impide una regla redirige con "?error=", y cuando el formulario
// tiene datos inválidos lo vuelve a mostrar con un 400 y el motivo.
import request from 'supertest';
import app from '../../app.js';
import * as salasModel from '../../models/salas.js';
import * as clientesModel from '../../models/clientes.js';
import * as entradasModel from '../../models/entradas.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearEvento, crearCliente, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

const ID_INEXISTENTE = '64b000000000000000000000';

let d;
beforeEach(async () => {
  const sala = await crearSala({ nombre: 'Centro Cultural Norte', capacidad: 20 });
  const otra = await crearSala({ nombre: 'Centro Cultural Sur' });
  d = {
    sala,
    otra,
    cliente: await crearCliente(),
    admin: await crearUsuarioConToken({ rol: 'ADMIN' }),
    auditor: await crearUsuarioConToken({ rol: 'AUDITOR' }),
    representante: await crearUsuarioConToken({ rol: 'REPRESENTANTE', salaId: sala.id }),
    empleado: await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: sala.id }),
  };
});

const ver = (quien, ruta) => request(app).get(ruta).set('Cookie', `token=${quien.token}`);
const enviar = (quien, ruta, form = {}) => request(app).post(ruta).set('Cookie', `token=${quien.token}`).type('form').send(form);
// El aviso que viaja en la redirección, ya decodificado
const aviso = (respuesta) => decodeURIComponent(respuesta.headers.location.split(/[?&](?:ok|error)=/)[1] || '');

describe('Panel de salas', () => {
  test('el ADMIN ve la lista de todas las salas', async () => {
    const pagina = await ver(d.admin, '/panel/salas');

    expect(pagina.status).toBe(200);
    expect(pagina.text).toContain('Centro Cultural Norte');
    expect(pagina.text).toContain('Centro Cultural Sur');
  });

  test('la búsqueda por nombre es exacta y avisa si no encuentra nada', async () => {
    const encontrada = await ver(d.admin, '/panel/salas?q=centro cultural sur');
    expect(encontrada.text).toContain('Centro Cultural Sur');
    expect(encontrada.text).not.toContain('Centro Cultural Norte');

    const nada = await ver(d.admin, '/panel/salas?q=Inexistente');
    expect(nada.status).toBe(200);
    expect(nada.text).not.toContain('Centro Cultural Sur');
  });

  test('el ADMIN abre el formulario de alta y crea una sala', async () => {
    expect((await ver(d.admin, '/panel/salas/nueva')).status).toBe(200);

    const respuesta = await enviar(d.admin, '/panel/salas/nueva', { nombre: 'Centro Nuevo', direccion: 'Calle Falsa 123', capacidad: '40' });

    expect(respuesta.status).toBe(302);
    expect(aviso(respuesta)).toBe('Sala creada correctamente.');
    expect((await salasModel.getSalaByName('Centro Nuevo')).capacidad).toBe(40);
  });

  test('un alta inválida vuelve a mostrar el formulario con el motivo (400)', async () => {
    const respuesta = await enviar(d.admin, '/panel/salas/nueva', { nombre: 'Centro Nuevo', direccion: 'Calle Falsa 123', capacidad: '3' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.text).toContain('no puede ser menor a 10');
    expect(respuesta.text).toContain('Centro Nuevo');
  });

  test('el REPRESENTANTE no da de alta salas: vuelve al inicio con un aviso', async () => {
    const respuesta = await ver(d.representante, '/panel/salas/nueva');

    expect(respuesta.headers.location).toMatch(/^\/panel\?error=/);
  });

  test('el detalle muestra la sala y sus eventos', async () => {
    await crearEvento(d.sala.id, { nombre: 'Recital de tango' });

    const pagina = await ver(d.admin, `/panel/salas/${d.sala.id}`);

    expect(pagina.status).toBe(200);
    expect(pagina.text).toContain('Recital de tango');
  });

  test('una sala inexistente muestra la página 404', async () => {
    expect((await ver(d.admin, `/panel/salas/${ID_INEXISTENTE}`)).status).toBe(404);
    expect((await ver(d.admin, `/panel/salas/${ID_INEXISTENTE}/editar`)).status).toBe(404);
    expect((await enviar(d.admin, `/panel/salas/${ID_INEXISTENTE}/editar`, {})).status).toBe(404);
    expect((await enviar(d.admin, `/panel/salas/${ID_INEXISTENTE}/estado`)).status).toBe(404);
  });

  test('el REPRESENTANTE edita su sala, pero no la de otro centro', async () => {
    expect((await ver(d.representante, `/panel/salas/${d.sala.id}/editar`)).status).toBe(200);

    const ok = await enviar(d.representante, `/panel/salas/${d.sala.id}/editar`, {
      nombre: 'Centro Cultural Norte', direccion: 'Otra Dirección 99', capacidad: '25',
    });
    expect(aviso(ok)).toBe('Sala actualizada.');
    expect((await salasModel.getSalaById(d.sala.id)).capacidad).toBe(25);

    const ajena = await ver(d.representante, `/panel/salas/${d.otra.id}/editar`);
    expect(aviso(ajena)).toBe('Solo podés operar sobre tu propio centro.');
  });

  test('una edición inválida o que achica por debajo de lo vendido vuelve al formulario (400)', async () => {
    const invalida = await enviar(d.admin, `/panel/salas/${d.sala.id}/editar`, { nombre: '', direccion: 'Calle Falsa 123', capacidad: '20' });
    expect(invalida.status).toBe(400);

    const evento = await crearEvento(d.sala.id);
    for (let i = 0; i < 15; i++) {
      await entradasModel.createEntrada({ eventoId: evento.id, clienteId: d.cliente.id, precio: 1 });
    }
    const achica = await enviar(d.admin, `/panel/salas/${d.sala.id}/editar`, {
      nombre: 'Centro Cultural Norte', direccion: 'Calle Falsa 123', capacidad: '12',
    });
    expect(achica.status).toBe(400);
    expect(achica.text).toContain('15 lugares ya ocupados');
  });

  test('el ADMIN da de baja una sala libre, pero no una con eventos programados', async () => {
    const baja = await enviar(d.admin, `/panel/salas/${d.otra.id}/estado`);
    expect(aviso(baja)).toContain('ahora está INACTIVA');

    await crearEvento(d.sala.id);
    const impedida = await enviar(d.admin, `/panel/salas/${d.sala.id}/estado`);
    expect(impedida.headers.location).toContain('?error=');
    expect(aviso(impedida)).toContain('1 evento programado');
  });
});

describe('Panel de clientes', () => {
  const NUEVO = { nombre: 'Ana', apellido: 'García', email: 'ana@mail.com', telefono: '1144443333' };

  test('el personal, el ADMIN y el AUDITOR ven la lista', async () => {
    for (const quien of [d.empleado, d.admin, d.auditor]) {
      const pagina = await ver(quien, '/panel/clientes');
      expect(pagina.status).toBe(200);
      expect(pagina.text).toContain('cliente1@mail.com');
    }
  });

  test('el EMPLEADO carga un cliente', async () => {
    expect((await ver(d.empleado, '/panel/clientes/nuevo')).status).toBe(200);

    const respuesta = await enviar(d.empleado, '/panel/clientes/nuevo', NUEVO);

    expect(aviso(respuesta)).toBe('Cliente creado correctamente.');
    expect(await clientesModel.getByEmail('ana@mail.com')).not.toBeNull();
  });

  test('un alta inválida vuelve al formulario con el motivo (400)', async () => {
    const respuesta = await enviar(d.empleado, '/panel/clientes/nuevo', { ...NUEVO, email: 'mal' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.text).toContain('El email no tiene un formato válido.');
  });

  test('el detalle muestra al cliente y sus entradas', async () => {
    const evento = await crearEvento(d.sala.id, { nombre: 'Concierto de piano' });
    await entradasModel.createEntrada({ eventoId: evento.id, clienteId: d.cliente.id, precio: 1 });

    const pagina = await ver(d.empleado, `/panel/clientes/${d.cliente.id}`);

    expect(pagina.status).toBe(200);
    expect(pagina.text).toContain('Cliente Prueba');
    expect(pagina.text).toContain('Concierto de piano');
  });

  test('el EMPLEADO edita un cliente; una edición inválida vuelve al formulario', async () => {
    expect((await ver(d.empleado, `/panel/clientes/${d.cliente.id}/editar`)).status).toBe(200);

    const ok = await enviar(d.empleado, `/panel/clientes/${d.cliente.id}/editar`, { ...NUEVO, email: 'nuevo@mail.com' });
    expect(aviso(ok)).toBe('Cliente actualizado.');
    expect((await clientesModel.getById(d.cliente.id)).email).toBe('nuevo@mail.com');

    const mal = await enviar(d.empleado, `/panel/clientes/${d.cliente.id}/editar`, { ...NUEVO, telefono: '12' });
    expect(mal.status).toBe(400);
  });

  test('un cliente inexistente muestra la página 404', async () => {
    expect((await ver(d.empleado, `/panel/clientes/${ID_INEXISTENTE}`)).status).toBe(404);
    expect((await ver(d.empleado, `/panel/clientes/${ID_INEXISTENTE}/editar`)).status).toBe(404);
    expect((await enviar(d.empleado, `/panel/clientes/${ID_INEXISTENTE}/editar`, NUEVO)).status).toBe(404);
    expect((await enviar(d.admin, `/panel/clientes/${ID_INEXISTENTE}/eliminar`)).status).toBe(404);
  });

  test('el ADMIN elimina un cliente sin entradas, pero no uno con entradas vigentes', async () => {
    const evento = await crearEvento(d.sala.id);
    await entradasModel.createEntrada({ eventoId: evento.id, clienteId: d.cliente.id, precio: 1 });
    const impedido = await enviar(d.admin, `/panel/clientes/${d.cliente.id}/eliminar`);
    expect(aviso(impedido)).toContain('tiene entradas vigentes');

    const libre = await crearCliente(2);
    const ok = await enviar(d.admin, `/panel/clientes/${libre.id}/eliminar`);
    expect(aviso(ok)).toBe('Cliente eliminado.');
    expect(await clientesModel.getById(libre.id)).toBeNull();
  });

  test('el EMPLEADO no elimina clientes', async () => {
    const respuesta = await enviar(d.empleado, `/panel/clientes/${d.cliente.id}/eliminar`);

    expect(respuesta.headers.location).toMatch(/^\/panel\?error=/);
    expect(await clientesModel.getById(d.cliente.id)).not.toBeNull();
  });
});
