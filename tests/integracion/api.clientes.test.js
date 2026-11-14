// Tests de integración de la API de clientes: los carga y edita el personal de los centros,
// los consultan también el ADMIN y el AUDITOR, y el borrado físico es solo del ADMIN.
import request from 'supertest';
import app from '../../app.js';
import * as entradasModel from '../../models/entradas.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearEvento, crearCliente, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

const ID_INEXISTENTE = '64b000000000000000000000';
const NUEVO = { nombre: 'Ana', apellido: 'García', email: 'ana@mail.com', telefono: '1144443333' };

let d;
beforeEach(async () => {
  const sala = await crearSala();
  d = {
    sala,
    cliente: await crearCliente(),
    admin: await crearUsuarioConToken({ rol: 'ADMIN' }),
    auditor: await crearUsuarioConToken({ rol: 'AUDITOR' }),
    empleado: await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: sala.id }),
  };
});

const api = (quien, metodo, ruta, body = {}) =>
  request(app)[metodo](ruta).set('Authorization', `Bearer ${quien.token}`).send(body);

describe('Consulta', () => {
  test('el personal, el ADMIN y el AUDITOR listan los clientes; sin sesión, 401', async () => {
    for (const quien of [d.empleado, d.admin, d.auditor]) {
      const respuesta = await api(quien, 'get', '/clientes');
      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toHaveLength(1);
    }
    expect((await request(app).get('/clientes')).status).toBe(401);
  });

  test('busca un cliente por id; uno inexistente o mal formado responde 404', async () => {
    expect((await api(d.empleado, 'get', `/clientes/${d.cliente.id}`)).body.email).toBe('cliente1@mail.com');
    expect((await api(d.empleado, 'get', `/clientes/${ID_INEXISTENTE}`)).status).toBe(404);
    expect((await api(d.empleado, 'get', '/clientes/xyz')).status).toBe(404);
  });
});

describe('Alta', () => {
  test('el EMPLEADO carga un cliente (201)', async () => {
    const respuesta = await api(d.empleado, 'post', '/clientes', NUEVO);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject(NUEVO);
  });

  test('el teléfono es opcional: vacío se guarda como "sin teléfono"', async () => {
    const respuesta = await api(d.empleado, 'post', '/clientes', { ...NUEVO, telefono: '' });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.telefono).toBeUndefined();
  });

  test('el ADMIN y el AUDITOR no cargan clientes (403)', async () => {
    expect((await api(d.admin, 'post', '/clientes', NUEVO)).status).toBe(403);
    expect((await api(d.auditor, 'post', '/clientes', NUEVO)).status).toBe(403);
  });

  test.each([
    [{ ...NUEVO, nombre: 'Ana2' }, 'El nombre solo puede tener letras'],
    [{ ...NUEVO, email: 'no-es-email' }, 'El email no tiene un formato válido.'],
    [{ ...NUEVO, telefono: '123' }, 'al menos 10 dígitos'],
    [{ ...NUEVO, telefono: '11-4444-3333' }, 'solo puede tener números'],
    [{ nombre: 'Ana', email: 'ana@mail.com' }, 'El apellido es obligatorio.'],
  ])('datos inválidos responden 400 con el motivo (%o)', async (body, motivo) => {
    const respuesta = await api(d.empleado, 'post', '/clientes', body);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toContain(motivo);
  });
});

describe('Edición', () => {
  test('actualiza parcialmente y conserva lo que no vino', async () => {
    const respuesta = await api(d.empleado, 'put', `/clientes/${d.cliente.id}`, { telefono: '1199998888' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ nombre: 'Cliente', telefono: '1199998888' });
  });

  test('un cambio inválido responde 400; un cliente inexistente, 404', async () => {
    expect((await api(d.empleado, 'put', `/clientes/${d.cliente.id}`, { email: 'mal' })).status).toBe(400);
    expect((await api(d.empleado, 'put', `/clientes/${ID_INEXISTENTE}`, { nombre: 'Otro' })).status).toBe(404);
  });
});

describe('Borrado físico', () => {
  test('el ADMIN elimina un cliente sin entradas (204) y deja de existir', async () => {
    expect((await api(d.admin, 'delete', `/clientes/${d.cliente.id}`)).status).toBe(204);
    expect((await api(d.admin, 'get', `/clientes/${d.cliente.id}`)).status).toBe(404);
  });

  test('con entradas vigentes no se puede eliminar; con todas canceladas, sí', async () => {
    const evento = await crearEvento(d.sala.id);
    const entrada = await entradasModel.createEntrada({ eventoId: evento.id, clienteId: d.cliente.id, precio: 1000 });

    const rechazo = await api(d.admin, 'delete', `/clientes/${d.cliente.id}`);
    expect(rechazo.status).toBe(400);
    expect(rechazo.body.error).toContain('entradas vigentes');

    await entradasModel.updateEntradaById(entrada.id, { estado: 'CANCELADA' });
    expect((await api(d.admin, 'delete', `/clientes/${d.cliente.id}`)).status).toBe(204);
  });

  test('un cliente inexistente responde 404 y el EMPLEADO no puede borrar (403)', async () => {
    expect((await api(d.admin, 'delete', `/clientes/${ID_INEXISTENTE}`)).status).toBe(404);
    expect((await api(d.empleado, 'delete', `/clientes/${d.cliente.id}`)).status).toBe(403);
  });
});
