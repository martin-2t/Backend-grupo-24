// Tests de integración de la API de usuarios: la consultan el ADMIN y el AUDITOR, y solo el
// ADMIN crea, modifica, desbloquea y elimina.
import request from 'supertest';
import app from '../../app.js';
import * as usuariosModel from '../../models/usuarios.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

const ID_INEXISTENTE = '64b000000000000000000000';

let d;
beforeEach(async () => {
  const sala = await crearSala();
  d = {
    sala,
    admin: await crearUsuarioConToken({ rol: 'ADMIN' }),
    auditor: await crearUsuarioConToken({ rol: 'AUDITOR' }),
    empleado: await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: sala.id }),
  };
});

const api = (quien, metodo, ruta, body = {}) =>
  request(app)[metodo](ruta).set('Authorization', `Bearer ${quien.token}`).send(body);
const nuevoEmpleado = (cambios = {}) => ({
  nombre: 'Cajera Nueva',
  email: 'cajera@urbanacult.com',
  password: 'clave-segura',
  rol: 'EMPLEADO',
  salaId: d.sala.id,
  ...cambios,
});

describe('Consulta', () => {
  test('el ADMIN y el AUDITOR listan y buscan usuarios; el EMPLEADO recibe 403', async () => {
    expect((await api(d.admin, 'get', '/usuarios')).body).toHaveLength(3);
    expect((await api(d.auditor, 'get', `/usuarios/${d.empleado.usuario.id}`)).body.rol).toBe('EMPLEADO');
    expect((await api(d.empleado, 'get', '/usuarios')).status).toBe(403);
  });

  test('un usuario inexistente responde 404', async () => {
    expect((await api(d.admin, 'get', `/usuarios/${ID_INEXISTENTE}`)).status).toBe(404);
  });
});

describe('Alta', () => {
  test('el ADMIN crea un empleado: el email se guarda en minúsculas y nunca sale el hash', async () => {
    const respuesta = await api(d.admin, 'post', '/usuarios', nuevoEmpleado({ email: 'Cajera@UrbanaCult.com' }));

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.email).toBe('cajera@urbanacult.com');
    expect(respuesta.body.passwordHash).toBeUndefined();
    expect(respuesta.body.salt).toBeUndefined();
  });

  test('una contraseña corta responde 400', async () => {
    const respuesta = await api(d.admin, 'post', '/usuarios', nuevoEmpleado({ password: 'corta' }));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toContain('al menos 8 caracteres');
  });

  test('un email ya usado responde 409', async () => {
    const respuesta = await api(d.admin, 'post', '/usuarios', nuevoEmpleado({ email: 'empleado@urbanacult.com' }));

    expect(respuesta.status).toBe(409);
  });

  test('un empleado con un centro que no existe responde 404', async () => {
    const respuesta = await api(d.admin, 'post', '/usuarios', nuevoEmpleado({ salaId: ID_INEXISTENTE }));

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error).toContain('no existe');
  });

  test('un REPRESENTANTE también necesita un centro, y que exista', async () => {
    const representante = (cambios) => nuevoEmpleado({ rol: 'REPRESENTANTE', email: 'gerente@urbanacult.com', ...cambios });

    const sinCentro = await api(d.admin, 'post', '/usuarios', representante({ salaId: undefined }));
    expect(sinCentro.status).toBe(400);
    expect(sinCentro.body.error).toContain('debe tener un centro asignado');

    expect((await api(d.admin, 'post', '/usuarios', representante({ salaId: ID_INEXISTENTE }))).status).toBe(404);
    expect((await api(d.admin, 'post', '/usuarios', representante())).status).toBe(201);
  });

  test('un cliente con una ficha que no existe responde 404', async () => {
    const respuesta = await api(d.admin, 'post', '/usuarios', nuevoEmpleado({ rol: 'CLIENTE', salaId: undefined, clienteId: ID_INEXISTENTE }));

    expect(respuesta.status).toBe(404);
  });

  test('un empleado sin centro o un rol inválido los rechaza el Schema con 400', async () => {
    expect((await api(d.admin, 'post', '/usuarios', nuevoEmpleado({ salaId: undefined }))).status).toBe(400);
    expect((await api(d.admin, 'post', '/usuarios', nuevoEmpleado({ rol: 'JEFE' }))).status).toBe(400);
  });

  test('el AUDITOR no crea usuarios (403)', async () => {
    expect((await api(d.auditor, 'post', '/usuarios', nuevoEmpleado())).status).toBe(403);
  });
});

describe('Edición', () => {
  const ruta = () => `/usuarios/${d.empleado.usuario.id}`;

  test('cambia el nombre y conserva lo demás', async () => {
    const respuesta = await api(d.admin, 'put', ruta(), { nombre: 'Nombre Nuevo' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ nombre: 'Nombre Nuevo', rol: 'EMPLEADO', email: 'empleado@urbanacult.com' });
  });

  test('una contraseña nueva se vuelve a hashear y sirve para ingresar', async () => {
    expect((await api(d.admin, 'put', ruta(), { password: 'otra-clave-segura' })).status).toBe(200);

    const login = await request(app).post('/auth/login').send({ email: 'empleado@urbanacult.com', password: 'otra-clave-segura' });
    expect(login.status).toBe(200);
  });

  test('una contraseña corta responde 400', async () => {
    expect((await api(d.admin, 'put', ruta(), { password: 'x' })).status).toBe(400);
  });

  test('el email de otro usuario responde 409; repetir el propio no es un conflicto', async () => {
    expect((await api(d.admin, 'put', ruta(), { email: 'auditor@urbanacult.com' })).status).toBe(409);
    expect((await api(d.admin, 'put', ruta(), { email: 'empleado@urbanacult.com' })).status).toBe(200);
  });

  test('mudarlo a un centro que no existe responde 404', async () => {
    expect((await api(d.admin, 'put', ruta(), { salaId: ID_INEXISTENTE })).status).toBe(404);
  });

  test('pasar a REPRESENTANTE a alguien sin centro responde 400', async () => {
    const respuesta = await api(d.admin, 'put', `/usuarios/${d.auditor.usuario.id}`, { rol: 'REPRESENTANTE' });

    expect(respuesta.status).toBe(400);
    expect((await usuariosModel.getById(d.auditor.usuario.id)).rol).toBe('AUDITOR');
  });

  test('un estado inválido lo rechaza el Schema (400); SUSPENDIDO deja sin acceso', async () => {
    expect((await api(d.admin, 'put', ruta(), { estado: 'DE_VACACIONES' })).status).toBe(400);

    expect((await api(d.admin, 'put', ruta(), { estado: 'SUSPENDIDO' })).body.estado).toBe('SUSPENDIDO');
    expect((await api(d.empleado, 'get', '/auth/yo')).status).toBe(403);
  });

  test('un usuario inexistente responde 404', async () => {
    expect((await api(d.admin, 'put', `/usuarios/${ID_INEXISTENTE}`, { nombre: 'X' })).status).toBe(404);
  });
});

describe('Desbloqueo', () => {
  test('el ADMIN desbloquea una cuenta bloqueada por intentos y vuelve a operar', async () => {
    await usuariosModel.Usuario.updateOne(
      { _id: d.empleado.usuario.id },
      { bloqueadoHasta: new Date(Date.now() + 60 * 60 * 1000), intentosFallidos: 0 }
    );
    expect((await api(d.empleado, 'get', '/auth/yo')).status).toBe(403);

    const respuesta = await api(d.admin, 'put', `/usuarios/${d.empleado.usuario.id}/desbloquear`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.bloqueadoHasta).toBeNull();
    expect((await api(d.empleado, 'get', '/auth/yo')).status).toBe(200);
  });

  test('un usuario inexistente responde 404', async () => {
    expect((await api(d.admin, 'put', `/usuarios/${ID_INEXISTENTE}/desbloquear`)).status).toBe(404);
  });
});

describe('Baja', () => {
  test('el ADMIN elimina a otro usuario (204)', async () => {
    expect((await api(d.admin, 'delete', `/usuarios/${d.empleado.usuario.id}`)).status).toBe(204);
    expect((await api(d.admin, 'get', `/usuarios/${d.empleado.usuario.id}`)).status).toBe(404);
  });

  test('no puede eliminarse a sí mismo (400)', async () => {
    const respuesta = await api(d.admin, 'delete', `/usuarios/${d.admin.usuario.id}`);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toContain('tu propio usuario');
  });

  test('un usuario inexistente o un id mal formado responden 404', async () => {
    expect((await api(d.admin, 'delete', `/usuarios/${ID_INEXISTENTE}`)).status).toBe(404);
    expect((await api(d.admin, 'delete', '/usuarios/abc')).status).toBe(404);
  });
});
