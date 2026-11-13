// Tests de integración: login con Passport (estrategia local) en la API y en el panel.
// Fijan el comportamiento del login: respuestas, bloqueo tras 3 intentos fallidos y usuario
// suspendido. Si un cambio futuro en la autenticación se salteara alguna de estas reglas,
// estos tests lo detectan.
import request from 'supertest';
import app from '../../app.js';
import { Usuario } from '../../models/usuarios.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

// crearUsuarioConToken crea los usuarios con esta contraseña
const CLAVE = 'clave-de-prueba';
const EMAIL = 'empleado@urbanacult.com';

let admin;
beforeEach(async () => {
  admin = await crearUsuarioConToken({ rol: 'ADMIN' });
  await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: '5a1a00000000000000000001', email: EMAIL });
});

const loginApi = (email, password) => request(app).post('/auth/login').send({ email, password });

describe('Login por la API', () => {
  test('con las credenciales correctas devuelve el token y deja la cookie httpOnly', async () => {
    const respuesta = await loginApi(EMAIL, CLAVE);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.token).toEqual(expect.any(String));
    const cookie = respuesta.headers['set-cookie'].join(';');
    expect(cookie).toMatch(/token=/);
    expect(cookie).toMatch(/HttpOnly/);
  });

  test('el token del login sirve para operar, y el login registra el último acceso', async () => {
    const { body } = await loginApi(EMAIL, CLAVE);

    const yo = await request(app).get('/auth/yo').set('Authorization', `Bearer ${body.token}`);

    expect(yo.status).toBe(200);
    expect(yo.body.email).toBe(EMAIL);
    expect((await Usuario.findOne({ email: EMAIL })).ultimoAcceso).toBeInstanceOf(Date);
  });

  test('si falta el email o la contraseña responde 400 con un mensaje claro', async () => {
    const respuesta = await loginApi(EMAIL, '');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toBe('El email y la contraseña son obligatorios.');
  });

  test('un email que no existe responde 401, sin decir si el email existe o no', async () => {
    const respuesta = await loginApi('nadie@urbanacult.com', CLAVE);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error).toMatch(/Email o contraseña incorrectos/);
  });

  test('una contraseña incorrecta responde 401 y avisa cuántos intentos quedan', async () => {
    const respuesta = await loginApi(EMAIL, 'otra-clave');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error).toMatch(/Te quedan 2 intento/);
  });
});

describe('Bloqueo por intentos fallidos', () => {
  test('al tercer intento fallido la cuenta se bloquea, y la contraseña correcta tampoco entra', async () => {
    await loginApi(EMAIL, 'otra-clave');
    await loginApi(EMAIL, 'otra-clave');
    const tercero = await loginApi(EMAIL, 'otra-clave');

    expect(tercero.status).toBe(403);
    expect(tercero.body.error).toMatch(/bloqueada/);

    const conLaCorrecta = await loginApi(EMAIL, CLAVE);
    expect(conLaCorrecta.status).toBe(403);
    expect(conLaCorrecta.body.token).toBeUndefined();
  });

  test('después de que el ADMIN la desbloquea, la contraseña correcta vuelve a entrar', async () => {
    for (let i = 0; i < 3; i++) await loginApi(EMAIL, 'otra-clave');
    const bloqueado = await Usuario.findOne({ email: EMAIL });

    const desbloqueo = await request(app)
      .put(`/usuarios/${bloqueado.id}/desbloquear`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(desbloqueo.status).toBe(200);

    expect((await loginApi(EMAIL, CLAVE)).status).toBe(200);
  });
});

describe('Usuario suspendido', () => {
  test('no puede iniciar sesión aunque la contraseña sea correcta', async () => {
    await Usuario.updateOne({ email: EMAIL }, { $set: { estado: 'SUSPENDIDO' } });

    const respuesta = await loginApi(EMAIL, CLAVE);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error).toMatch(/suspendido/);
  });

  test('si lo suspenden con la sesión abierta, su token deja de servir', async () => {
    const { body } = await loginApi(EMAIL, CLAVE);
    await Usuario.updateOne({ email: EMAIL }, { $set: { estado: 'SUSPENDIDO' } });

    const yo = await request(app).get('/auth/yo').set('Authorization', `Bearer ${body.token}`);

    expect(yo.status).toBe(403);
  });
});

describe('Login del panel', () => {
  const loginPanel = (email, password) =>
    request(app).post('/panel/login').type('form').send({ email, password });

  test('con las credenciales correctas muestra la bienvenida y deja la cookie', async () => {
    const respuesta = await loginPanel(EMAIL, CLAVE);

    expect(respuesta.status).toBe(200);
    expect(respuesta.text).toContain('Hola, Usuario Prueba');
    expect(respuesta.headers['set-cookie'].join(';')).toMatch(/token=/);
  });

  test('con un error vuelve a mostrar el formulario con el motivo y el email cargado', async () => {
    const respuesta = await loginPanel(EMAIL, 'otra-clave');

    expect(respuesta.status).toBe(401);
    expect(respuesta.text).toContain('Te quedan 2 intento');
    expect(respuesta.text).toContain(`value="${EMAIL}"`);
    expect(respuesta.headers['set-cookie']).toBeUndefined();
  });
});
