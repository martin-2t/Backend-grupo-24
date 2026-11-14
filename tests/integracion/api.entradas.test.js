// Tests de integración de la API de entradas que completan a entradas.crud.test.js: la venta en
// boletería con los datos del comprador, el precio de venta y de reserva, la compra del CLIENTE
// (siempre para sí y al precio del evento), las entradas propias y los errores de cada acción.
import request from 'supertest';
import app from '../../app.js';
import * as entradasModel from '../../models/entradas.js';
import * as eventosModel from '../../models/eventos.js';
import * as clientesModel from '../../models/clientes.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearEvento, crearCliente, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

const ID_INEXISTENTE = '64b000000000000000000000';
const COMPRADOR = { nombre: 'Pedro', apellido: 'Sosa', email: 'pedro@mail.com', telefono: '1133332222' };

let d;
beforeEach(async () => {
  const sala = await crearSala();
  const fichaCliente = await crearCliente(1);
  d = {
    sala,
    evento: await crearEvento(sala.id, { precio: 5000 }),
    cliente: await crearCliente(2),
    fichaCliente,
    empleado: await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: sala.id }),
    admin: await crearUsuarioConToken({ rol: 'ADMIN' }),
    usuarioCliente: await crearUsuarioConToken({ rol: 'CLIENTE', clienteId: fichaCliente.id }),
  };
});

const api = (quien, metodo, ruta, body = {}) =>
  request(app)[metodo](ruta).set('Authorization', `Bearer ${quien.token}`).send(body);
const vender = (body) => api(d.empleado, 'post', '/entradas', { eventoId: d.evento.id, ...body });

describe('Venta en boletería con los datos del comprador', () => {
  test('si el comprador no existe, se crea su ficha en el momento', async () => {
    const respuesta = await vender({ cliente: COMPRADOR });

    expect(respuesta.status).toBe(201);
    const nuevo = await clientesModel.getByEmail('pedro@mail.com');
    expect(String(respuesta.body.clienteId)).toBe(nuevo.id);
  });

  test('si ya existe un cliente con ese email, se usa esa ficha sin duplicarla', async () => {
    const respuesta = await vender({ cliente: { ...COMPRADOR, email: 'CLIENTE2@mail.com' } });

    expect(respuesta.status).toBe(201);
    expect(String(respuesta.body.clienteId)).toBe(d.cliente.id);
    expect(await clientesModel.contarClientes()).toBe(2);
  });

  test('datos del comprador inválidos responden 400 y no crean nada', async () => {
    const respuesta = await vender({ cliente: { ...COMPRADOR, nombre: 'P3dro' } });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toMatch(/^Datos del comprador: /);
    expect(await entradasModel.getEntradasByEvento(d.evento.id)).toHaveLength(0);
  });

  test('si viene clienteId, los datos del comprador se ignoran', async () => {
    const respuesta = await vender({ clienteId: d.cliente.id, cliente: COMPRADOR });

    expect(String(respuesta.body.clienteId)).toBe(d.cliente.id);
    expect(await clientesModel.getByEmail('pedro@mail.com')).toBeNull();
  });
});

describe('Precio', () => {
  test('en la venta directa se puede pisar el precio con un número', async () => {
    expect((await vender({ clienteId: d.cliente.id, precio: 3000 })).body.precio).toBe(3000);
  });

  test('un precio que no es número se ignora y toma el del evento', async () => {
    expect((await vender({ clienteId: d.cliente.id, precio: '3000' })).body.precio).toBe(5000);
  });

  test('la reserva siempre toma el precio del evento', async () => {
    const respuesta = await api(d.empleado, 'post', '/entradas/reservar', { eventoId: d.evento.id, clienteId: d.cliente.id, precio: 1 });

    expect(respuesta.body).toMatchObject({ estado: 'RESERVADA', precio: 5000 });
  });
});

describe('Compra del CLIENTE por la API', () => {
  test('compra para sí mismo al precio del evento, aunque mande otro cliente y otro precio', async () => {
    const respuesta = await api(d.usuarioCliente, 'post', '/entradas', { eventoId: d.evento.id, clienteId: d.cliente.id, precio: 1 });

    expect(respuesta.status).toBe(201);
    expect(String(respuesta.body.clienteId)).toBe(d.fichaCliente.id);
    expect(respuesta.body.precio).toBe(5000);
  });

  test('ve sus entradas, pero una ajena responde 403', async () => {
    const propia = await entradasModel.createEntrada({ eventoId: d.evento.id, clienteId: d.fichaCliente.id, precio: 1 });
    const ajena = await entradasModel.createEntrada({ eventoId: d.evento.id, clienteId: d.cliente.id, precio: 1 });

    expect((await api(d.usuarioCliente, 'get', `/entradas/${propia.id}`)).status).toBe(200);
    const respuesta = await api(d.usuarioCliente, 'get', `/entradas/${ajena.id}`);
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error).toBe('Esa entrada no es tuya.');
  });
});

describe('Errores de cada acción', () => {
  test('una entrada inexistente responde 404 al verla, confirmarla, cancelarla, editarla o borrarla', async () => {
    expect((await api(d.admin, 'get', `/entradas/${ID_INEXISTENTE}`)).status).toBe(404);
    expect((await api(d.empleado, 'put', `/entradas/${ID_INEXISTENTE}/confirmar`)).status).toBe(404);
    expect((await api(d.empleado, 'put', `/entradas/${ID_INEXISTENTE}/cancelar`)).status).toBe(404);
    expect((await api(d.empleado, 'put', `/entradas/${ID_INEXISTENTE}`, { precio: 1 })).status).toBe(404);
    expect((await api(d.admin, 'delete', `/entradas/${ID_INEXISTENTE}`)).status).toBe(404);
  });

  test('sin clienteId (ni datos del comprador) responde 400; un cliente inexistente, 404', async () => {
    expect((await vender({})).status).toBe(400);
    expect((await vender({ clienteId: 123 })).status).toBe(400);

    const inexistente = await vender({ clienteId: ID_INEXISTENTE });
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error).toBe('El cliente indicado no existe');
  });

  test('un evento finalizado no admite ventas (400)', async () => {
    await eventosModel.finalizarEvento(d.evento.id);

    const respuesta = await vender({ clienteId: d.cliente.id });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toContain('ya finalizó o fue cancelado');
  });

  test('confirmar una entrada que no es una reserva responde 400', async () => {
    const vendida = await entradasModel.createEntrada({ eventoId: d.evento.id, clienteId: d.cliente.id, precio: 1 });

    expect((await api(d.empleado, 'put', `/entradas/${vendida.id}/confirmar`)).status).toBe(400);
  });

  test('editar el precio: uno válido se guarda, uno negativo responde 400', async () => {
    const entrada = await entradasModel.createEntrada({ eventoId: d.evento.id, clienteId: d.cliente.id, precio: 1 });

    expect((await api(d.empleado, 'put', `/entradas/${entrada.id}`, { precio: 2000 })).body.precio).toBe(2000);
    expect((await api(d.empleado, 'put', `/entradas/${entrada.id}`, { precio: -1 })).status).toBe(400);
  });

  test('el check-in sin código responde 400', async () => {
    const respuesta = await api(d.empleado, 'post', '/entradas/checkin', {});

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toContain('"codigo" es obligatorio');
  });
});
