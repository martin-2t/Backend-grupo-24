// Tests de integración de lo que rodea al login en la API: registro web del cliente, logout,
// /auth/yo, /auth/mis-entradas, la validación del token y las respuestas generales de la app
// (raíz, 404 y JSON mal formado). El login en sí está en auth.login.test.js.
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app.js';
import * as clientesModel from '../../models/clientes.js';
import * as entradasModel from '../../models/entradas.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearEvento, crearCliente, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

const REGISTRO = { nombre: 'Lucía', apellido: 'Pérez', email: 'lucia@mail.com', telefono: '1155556666', password: 'clave-segura' };

describe('Respuestas generales de la API', () => {
  test('la raíz describe el servicio', async () => {
    const respuesta = await request(app).get('/');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ nombre: 'Urbana Cult API', estado: 'ok', panel: '/panel' });
  });

  test('una ruta que no existe responde 404 en JSON', async () => {
    const respuesta = await request(app).get('/no-existe');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ error: 'Recurso no encontrado' });
  });

  test('un body que no es JSON válido responde 400, no 500', async () => {
    const respuesta = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toBe('El cuerpo de la petición no es un JSON válido.');
  });
});

describe('Registro web del cliente', () => {
  test('crea la ficha de cliente y un usuario CLIENTE asociado (201)', async () => {
    const respuesta = await request(app).post('/auth/registro').send(REGISTRO);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.usuario).toMatchObject({ nombre: 'Lucía Pérez', rol: 'CLIENTE', email: 'lucia@mail.com' });
    const ficha = await clientesModel.getByEmail('lucia@mail.com');
    expect(String(respuesta.body.usuario.clienteId)).toBe(ficha.id);
  });

  test('si ya compró en boletería, reutiliza su ficha en vez de duplicarla', async () => {
    const existente = await clientesModel.create({ nombre: 'Lucía', apellido: 'Pérez', email: 'lucia@mail.com' });

    const respuesta = await request(app).post('/auth/registro').send(REGISTRO);

    expect(respuesta.status).toBe(201);
    expect(String(respuesta.body.usuario.clienteId)).toBe(existente.id);
    expect(await clientesModel.contarClientes()).toBe(1);
  });

  test('con el usuario registrado ya puede iniciar sesión', async () => {
    await request(app).post('/auth/registro').send(REGISTRO);

    const login = await request(app).post('/auth/login').send({ email: REGISTRO.email, password: REGISTRO.password });

    expect(login.status).toBe(200);
  });

  test('una contraseña corta responde 400 y no crea la ficha', async () => {
    const respuesta = await request(app).post('/auth/registro').send({ ...REGISTRO, password: 'corta' });

    expect(respuesta.status).toBe(400);
    expect(await clientesModel.contarClientes()).toBe(0);
  });

  test('un email ya registrado responde 409', async () => {
    await request(app).post('/auth/registro').send(REGISTRO);

    expect((await request(app).post('/auth/registro').send(REGISTRO)).status).toBe(409);
  });

  test('datos personales inválidos responden 400 con el motivo', async () => {
    const respuesta = await request(app).post('/auth/registro').send({ ...REGISTRO, nombre: 'L1' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toContain('solo puede tener letras');
  });

  test('el email de un usuario del personal, aunque cambien las mayúsculas, responde 409 sin crear la ficha', async () => {
    await crearUsuarioConToken({ rol: 'ADMIN', email: 'lucia@mail.com' });

    const respuesta = await request(app).post('/auth/registro').send({ ...REGISTRO, email: 'LUCIA@mail.com' });

    expect(respuesta.status).toBe(409);
    expect(await clientesModel.contarClientes()).toBe(0);
  });
});

describe('Sesión', () => {
  test('/auth/yo devuelve el usuario del token, sin el hash de la contraseña', async () => {
    const { token } = await crearUsuarioConToken({ rol: 'AUDITOR' });

    const respuesta = await request(app).get('/auth/yo').set('Authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.rol).toBe('AUDITOR');
    expect(respuesta.body.passwordHash).toBeUndefined();
  });

  test('el token también se acepta desde la cookie', async () => {
    const { token } = await crearUsuarioConToken({ rol: 'AUDITOR' });

    expect((await request(app).get('/auth/yo').set('Cookie', `token=${token}`)).status).toBe(200);
  });

  test('un token con otra firma responde 401 "Token inválido."', async () => {
    const { usuario } = await crearUsuarioConToken({ rol: 'AUDITOR' });
    const falso = jwt.sign({ sub: usuario.id, rol: 'ADMIN' }, 'otro-secreto');

    const respuesta = await request(app).get('/auth/yo').set('Authorization', `Bearer ${falso}`);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error).toBe('Token inválido.');
  });

  test('un token vencido responde 401 y pide iniciar sesión de nuevo', async () => {
    const { usuario } = await crearUsuarioConToken({ rol: 'AUDITOR' });
    const vencido = jwt.sign({ sub: usuario.id, rol: usuario.rol }, process.env.JWT_SECRET, { expiresIn: -10 });

    const respuesta = await request(app).get('/auth/yo').set('Authorization', `Bearer ${vencido}`);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error).toContain('La sesión expiró');
  });

  test('el token de un usuario que ya no existe responde 401', async () => {
    const { usuario, token } = await crearUsuarioConToken({ rol: 'AUDITOR' });
    await usuario.deleteOne();

    expect((await request(app).get('/auth/yo').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  test('el logout borra la cookie del token', async () => {
    const respuesta = await request(app).post('/auth/logout');

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['set-cookie'][0]).toMatch(/^token=;.*Expires=Thu, 01 Jan 1970/);
  });
});

describe('Mis entradas (API)', () => {
  test('el cliente recibe solo sus entradas; otro rol recibe 403', async () => {
    const sala = await crearSala();
    const evento = await crearEvento(sala.id);
    const ficha = await crearCliente(1);
    const otraFicha = await crearCliente(2);
    await entradasModel.createEntrada({ eventoId: evento.id, clienteId: ficha.id, precio: 1 });
    await entradasModel.createEntrada({ eventoId: evento.id, clienteId: otraFicha.id, precio: 1 });
    const cliente = await crearUsuarioConToken({ rol: 'CLIENTE', clienteId: ficha.id });
    const auditor = await crearUsuarioConToken({ rol: 'AUDITOR' });

    const propias = await request(app).get('/auth/mis-entradas').set('Authorization', `Bearer ${cliente.token}`);

    expect(propias.status).toBe(200);
    expect(propias.body).toHaveLength(1);
    expect(String(propias.body[0].clienteId)).toBe(ficha.id);
    expect((await request(app).get('/auth/mis-entradas').set('Authorization', `Bearer ${auditor.token}`)).status).toBe(403);
  });
});

describe('Consultas públicas', () => {
  test('lugares disponibles de un evento', async () => {
    const sala = await crearSala({ capacidad: 10 });
    const evento = await crearEvento(sala.id);
    const cliente = await crearCliente();
    await entradasModel.createEntrada({ eventoId: evento.id, clienteId: cliente.id, precio: 1 });
    await entradasModel.createEntrada({ eventoId: evento.id, clienteId: cliente.id, precio: 1, estado: 'RESERVADA' });

    const respuesta = await request(app).get(`/consultas/entradas-disponibles/${evento.id}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ capacidadSala: 10, ocupados: 2, disponibles: 8 });
  });

  test('un evento inexistente responde 404, también en las ventas', async () => {
    const auditor = await crearUsuarioConToken({ rol: 'AUDITOR' });

    expect((await request(app).get('/consultas/entradas-disponibles/64b000000000000000000000')).status).toBe(404);
    expect(
      (await request(app).get('/consultas/entradas-vendidas/64b000000000000000000000').set('Authorization', `Bearer ${auditor.token}`)).status
    ).toBe(404);
  });

  test('las ventas de un evento cuentan las VALIDA y las USADA, no las reservas', async () => {
    const sala = await crearSala();
    const evento = await crearEvento(sala.id);
    const cliente = await crearCliente();
    await entradasModel.createEntrada({ eventoId: evento.id, clienteId: cliente.id, precio: 1 });
    await entradasModel.createEntrada({ eventoId: evento.id, clienteId: cliente.id, precio: 1, estado: 'RESERVADA' });
    const auditor = await crearUsuarioConToken({ rol: 'AUDITOR' });

    const respuesta = await request(app).get(`/consultas/entradas-vendidas/${evento.id}`).set('Authorization', `Bearer ${auditor.token}`);

    expect(respuesta.body).toMatchObject({ evento: 'Evento de prueba', vendidas: 1 });
  });

  test('eventos próximos', async () => {
    const sala = await crearSala();
    await crearEvento(sala.id, { nombre: 'Próximo show' });

    const respuesta = await request(app).get('/consultas/eventos-proximos');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((e) => e.nombre)).toEqual(['Próximo show']);
  });
});
