// Tests de integración de la API de salas: lectura pública, alta y baja del ADMIN, edición del
// ADMIN o del REPRESENTANTE de ese centro, y las reglas que dependen de los eventos de la sala.
import request from 'supertest';
import app from '../../app.js';
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
    admin: await crearUsuarioConToken({ rol: 'ADMIN' }),
    representante: await crearUsuarioConToken({ rol: 'REPRESENTANTE', salaId: sala.id }),
  };
});

const api = (quien, metodo, ruta, body = {}) =>
  request(app)[metodo](ruta).set('Authorization', `Bearer ${quien.token}`).send(body);

// Vende "cantidad" entradas para un evento nuevo en la sala
async function venderEnLaSala(sala, cantidad) {
  const evento = await crearEvento(sala.id);
  const cliente = await crearCliente();
  for (let i = 0; i < cantidad; i++) {
    await entradasModel.createEntrada({ eventoId: evento.id, clienteId: cliente.id, precio: 1000 });
  }
  return evento;
}

describe('Lectura pública', () => {
  test('lista todas las salas sin iniciar sesión', async () => {
    const respuesta = await request(app).get('/salas');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((s) => s.nombre).sort()).toEqual(['Centro Cultural Norte', 'Centro Cultural Sur']);
  });

  test('busca una sala por id', async () => {
    const respuesta = await request(app).get(`/salas/${d.sala.id}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.capacidad).toBe(20);
  });

  test('un id inexistente o mal formado responde 404', async () => {
    expect((await request(app).get(`/salas/${ID_INEXISTENTE}`)).status).toBe(404);
    expect((await request(app).get('/salas/no-es-un-id')).status).toBe(404);
  });

  test('busca por nombre exacto sin distinguir mayúsculas', async () => {
    const respuesta = await request(app).get('/salas/nombre/centro cultural norte');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body._id).toBe(d.sala.id);
    expect((await request(app).get('/salas/nombre/Centro')).status).toBe(404);
  });
});

describe('Alta de salas', () => {
  test('el ADMIN crea una sala, que nace ACTIVA', async () => {
    const respuesta = await api(d.admin, 'post', '/salas', { nombre: 'Centro Nuevo', direccion: 'Calle Falsa 123', capacidad: 50 });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({ nombre: 'Centro Nuevo', capacidad: 50, estado: 'ACTIVA' });
  });

  test('sin sesión responde 401 y el REPRESENTANTE recibe 403', async () => {
    const body = { nombre: 'Centro Nuevo', direccion: 'Calle Falsa 123', capacidad: 50 };

    expect((await request(app).post('/salas').send(body)).status).toBe(401);
    expect((await api(d.representante, 'post', '/salas', body)).status).toBe(403);
  });

  test.each([
    [{ direccion: 'Calle Falsa 123', capacidad: 50 }, 'El nombre de la sala es obligatorio.'],
    [{ nombre: 'Sala 33', direccion: 'Calle Falsa 123', capacidad: 50 }, 'solo puede tener letras'],
    [{ nombre: 'Centro Nuevo', direccion: 'Calle Falsa 123', capacidad: 5 }, 'no puede ser menor a 10'],
    [{ nombre: 'Centro Nuevo', direccion: 'Calle Falsa 123', capacidad: 10.5 }, 'número entero'],
    [{ nombre: 'Centro Nuevo', capacidad: 50 }, 'La dirección es obligatoria.'],
  ])('datos inválidos responden 400 con el motivo (%o)', async (body, motivo) => {
    const respuesta = await api(d.admin, 'post', '/salas', body);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toContain(motivo);
  });
});

describe('Edición de salas', () => {
  test('el ADMIN edita parcialmente: lo que no viene se conserva', async () => {
    const respuesta = await api(d.admin, 'put', `/salas/${d.sala.id}`, { capacidad: 30 });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ nombre: 'Centro Cultural Norte', capacidad: 30 });
  });

  test('el REPRESENTANTE edita su sala, pero no la de otro centro', async () => {
    expect((await api(d.representante, 'put', `/salas/${d.sala.id}`, { direccion: 'Nueva Dirección 456' })).status).toBe(200);
    expect((await api(d.representante, 'put', `/salas/${d.otra.id}`, { direccion: 'Nueva Dirección 456' })).status).toBe(403);
  });

  test('una sala inexistente responde 404', async () => {
    expect((await api(d.admin, 'put', `/salas/${ID_INEXISTENTE}`, { capacidad: 30 })).status).toBe(404);
  });

  test('un cambio inválido responde 400 y no se guarda', async () => {
    const respuesta = await api(d.admin, 'put', `/salas/${d.sala.id}`, { capacidad: 3 });

    expect(respuesta.status).toBe(400);
    expect((await request(app).get(`/salas/${d.sala.id}`)).body.capacidad).toBe(20);
  });

  test('no se puede achicar por debajo de los lugares ya vendidos de un evento programado', async () => {
    await venderEnLaSala(d.sala, 15);

    const respuesta = await api(d.admin, 'put', `/salas/${d.sala.id}`, { capacidad: 12 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toContain('15 lugares ya ocupados');
    expect((await api(d.admin, 'put', `/salas/${d.sala.id}`, { capacidad: 15 })).status).toBe(200);
  });
});

describe('Baja y alta lógica', () => {
  test('el ADMIN alterna la sala entre INACTIVA y ACTIVA', async () => {
    const baja = await api(d.admin, 'put', `/salas/dis/${d.sala.id}`);
    expect(baja.status).toBe(200);
    expect(baja.body.estado).toBe('INACTIVA');

    const alta = await api(d.admin, 'put', `/salas/dis/${d.sala.id}`);
    expect(alta.body.estado).toBe('ACTIVA');
  });

  test('una sala con eventos programados no se puede dar de baja', async () => {
    await crearEvento(d.sala.id);
    await crearEvento(d.sala.id);

    const respuesta = await api(d.admin, 'put', `/salas/dis/${d.sala.id}`);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toContain('2 eventos programados');
  });

  test('el aviso usa el singular cuando hay un solo evento', async () => {
    await crearEvento(d.sala.id);

    const respuesta = await api(d.admin, 'put', `/salas/dis/${d.sala.id}`);

    expect(respuesta.body.error).toContain('1 evento programado.');
  });

  test('una sala inexistente responde 404 y el REPRESENTANTE no puede dar de baja', async () => {
    expect((await api(d.admin, 'put', `/salas/dis/${ID_INEXISTENTE}`)).status).toBe(404);
    expect((await api(d.representante, 'put', `/salas/dis/${d.sala.id}`)).status).toBe(403);
  });
});
