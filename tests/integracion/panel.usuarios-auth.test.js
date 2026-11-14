// Tests de integración del panel para la gestión de usuarios (ADMIN a todos, REPRESENTANTE a los
// empleados de su centro), el registro y la sesión del panel, las consultas y la búsqueda manual
// del check-in.
import request from 'supertest';
import app from '../../app.js';
import * as usuariosModel from '../../models/usuarios.js';
import * as entradasModel from '../../models/entradas.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearEvento, crearCliente, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

const ID_INEXISTENTE = '64b000000000000000000000';

let d;
beforeEach(async () => {
  const sala = await crearSala({ nombre: 'Centro Cultural Norte' });
  const otra = await crearSala({ nombre: 'Centro Cultural Sur' });
  d = {
    sala,
    otra,
    admin: await crearUsuarioConToken({ rol: 'ADMIN' }),
    auditor: await crearUsuarioConToken({ rol: 'AUDITOR' }),
    representante: await crearUsuarioConToken({ rol: 'REPRESENTANTE', salaId: sala.id }),
    empleado: await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: sala.id }),
    empleadoSur: await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: otra.id, email: 'empleado.sur@urbanacult.com' }),
  };
});

const ver = (quien, ruta) => request(app).get(ruta).set('Cookie', `token=${quien.token}`);
const enviar = (quien, ruta, form = {}) => request(app).post(ruta).set('Cookie', `token=${quien.token}`).type('form').send(form);
const aviso = (respuesta) => decodeURIComponent(respuesta.headers.location.split(/[?&](?:ok|error)=/)[1] || '');
const personal = (cambios = {}) => ({
  nombre: 'Marta', apellido: 'Gómez', email: 'marta@urbanacult.com', password: 'clave-segura', rol: 'EMPLEADO', salaId: d.sala.id, ...cambios,
});

describe('Alta de personal', () => {
  test('el ADMIN abre el formulario y crea un empleado en el centro que elige', async () => {
    expect((await ver(d.admin, '/panel/usuarios/nuevo')).status).toBe(200);

    const respuesta = await enviar(d.admin, '/panel/usuarios/nuevo', personal({ salaId: d.otra.id }));

    expect(aviso(respuesta)).toBe('Usuario "Marta Gómez" creado.');
    const creado = await usuariosModel.getByEmail('marta@urbanacult.com');
    expect(String(creado.salaId)).toBe(d.otra.id);
  });

  test('el ADMIN crea un AUDITOR, que no tiene centro', async () => {
    await enviar(d.admin, '/panel/usuarios/nuevo', personal({ rol: 'AUDITOR', salaId: '' }));

    const creado = await usuariosModel.getByEmail('marta@urbanacult.com');
    expect(creado.rol).toBe('AUDITOR');
    expect(creado.salaId).toBeUndefined();
  });

  test('el REPRESENTANTE crea empleados siempre en su propio centro, aunque pida otro', async () => {
    expect((await ver(d.representante, '/panel/usuarios/nuevo')).status).toBe(200);

    await enviar(d.representante, '/panel/usuarios/nuevo', personal({ salaId: d.otra.id }));

    expect(String((await usuariosModel.getByEmail('marta@urbanacult.com')).salaId)).toBe(d.sala.id);
  });

  test.each([
    [{ rol: 'ADMIN' }, 403, 'No podés crear usuarios con ese rol.'],
    [{ apellido: '  ' }, 400, 'El nombre y el apellido son obligatorios.'],
    [{ password: 'corta' }, 400, 'al menos 8 caracteres'],
    [{ email: 'empleado@urbanacult.com' }, 409, 'Ya existe un usuario con ese email.'],
    [{ email: 'no-es-email' }, 400, 'El email no tiene un formato válido.'],
  ])('el REPRESENTANTE ve el formulario con el motivo si el alta no corresponde (%o)', async (cambios, status, motivo) => {
    const respuesta = await enviar(d.representante, '/panel/usuarios/nuevo', personal(cambios));

    expect(respuesta.status).toBe(status);
    expect(respuesta.text).toContain(motivo);
  });

  test('el ADMIN tiene que elegir un centro existente para un empleado', async () => {
    const sinCentro = await enviar(d.admin, '/panel/usuarios/nuevo', personal({ salaId: '' }));
    expect(sinCentro.status).toBe(400);
    expect(sinCentro.text).toContain('Elegí el centro del usuario.');

    const inexistente = await enviar(d.admin, '/panel/usuarios/nuevo', personal({ salaId: ID_INEXISTENTE }));
    expect(inexistente.status).toBe(404);
  });

  test('el AUDITOR ve la lista de usuarios pero no puede dar de alta', async () => {
    expect((await ver(d.auditor, '/panel/usuarios')).status).toBe(200);
    expect((await ver(d.auditor, '/panel/usuarios/nuevo')).headers.location).toMatch(/^\/panel\?error=/);
  });
});

describe('Suspender, activar y desbloquear', () => {
  test('el REPRESENTANTE suspende y reactiva a un empleado de su centro', async () => {
    const ruta = `/panel/usuarios/${d.empleado.usuario.id}/estado`;

    expect(aviso(await enviar(d.representante, ruta))).toBe('Usuario "Usuario Prueba" suspendido.');
    expect((await usuariosModel.getById(d.empleado.usuario.id)).estado).toBe('SUSPENDIDO');

    expect(aviso(await enviar(d.representante, ruta))).toBe('Usuario "Usuario Prueba" activado.');
  });

  test('el REPRESENTANTE no gestiona empleados de otro centro', async () => {
    const respuesta = await enviar(d.representante, `/panel/usuarios/${d.empleadoSur.usuario.id}/estado`);

    expect(aviso(respuesta)).toBe('No podés gestionar a ese usuario.');
    expect((await usuariosModel.getById(d.empleadoSur.usuario.id)).estado).toBe('ACTIVO');
  });

  test('nadie puede suspender su propia cuenta', async () => {
    expect(aviso(await enviar(d.admin, `/panel/usuarios/${d.admin.usuario.id}/estado`))).toBe('No podés suspender tu propia cuenta.');
  });

  test('desbloquear limpia el bloqueo por intentos', async () => {
    await usuariosModel.Usuario.updateOne({ _id: d.empleado.usuario.id }, { bloqueadoHasta: new Date(Date.now() + 60 * 60 * 1000) });

    expect(aviso(await enviar(d.representante, `/panel/usuarios/${d.empleado.usuario.id}/desbloquear`))).toContain('desbloqueado');
    expect((await usuariosModel.getById(d.empleado.usuario.id)).estaBloqueado()).toBe(false);
  });

  test('desbloquear a alguien que no gestiona avisa el motivo', async () => {
    expect(aviso(await enviar(d.representante, `/panel/usuarios/${d.empleadoSur.usuario.id}/desbloquear`))).toBe('No podés gestionar a ese usuario.');
  });

  test('un usuario inexistente muestra la página 404', async () => {
    expect((await enviar(d.admin, `/panel/usuarios/${ID_INEXISTENTE}/estado`)).status).toBe(404);
    expect((await enviar(d.admin, `/panel/usuarios/${ID_INEXISTENTE}/desbloquear`)).status).toBe(404);
  });
});

describe('Registro y sesión del panel', () => {
  const REGISTRO = { nombre: 'Lucía', apellido: 'Pérez', email: 'lucia@mail.com', telefono: '1155556666', password: 'clave-segura' };

  test('el formulario de registro y el de login son públicos', async () => {
    expect((await request(app).get('/panel/registro')).status).toBe(200);
    expect((await request(app).get('/panel/login')).status).toBe(200);
  });

  test('registrarse lleva al login con un aviso', async () => {
    const respuesta = await request(app).post('/panel/registro').type('form').send(REGISTRO);

    expect(respuesta.headers.location).toBe('/panel/login?ok=' + encodeURIComponent('Cuenta creada. Ya podés ingresar.'));
    expect((await usuariosModel.getByEmail('lucia@mail.com')).rol).toBe('CLIENTE');
  });

  test('un registro inválido vuelve al formulario con lo cargado', async () => {
    const respuesta = await request(app).post('/panel/registro').type('form').send({ ...REGISTRO, password: 'corta' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.text).toContain('al menos 8 caracteres');
    expect(respuesta.text).toContain('lucia@mail.com');
  });

  test('la bienvenida del personal muestra su centro y sus permisos', async () => {
    const respuesta = await request(app).post('/panel/login').type('form').send({ email: 'empleado@urbanacult.com', password: 'clave-de-prueba' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.text).toContain('Centro Cultural Norte');
    expect(respuesta.text).toContain('Vender, reservar, confirmar y cancelar entradas de su centro');
  });

  test('salir borra la cookie y vuelve al login', async () => {
    const respuesta = await enviar(d.empleado, '/panel/logout');

    expect(respuesta.headers.location).toMatch(/^\/panel\/login\?ok=/);
    expect(respuesta.headers['set-cookie'][0]).toMatch(/^token=;/);
  });

  test('sin sesión, una página privada redirige al login con el motivo', async () => {
    const sinToken = await request(app).get('/panel/eventos');
    expect(sinToken.headers.location).toBe('/panel/login?error=' + encodeURIComponent('Iniciá sesión: falta el token.'));

    const tokenRoto = await request(app).get('/panel/eventos').set('Cookie', 'token=roto');
    expect(aviso(tokenRoto)).toBe('Token inválido.');
  });

  test('una página del panel que no existe muestra la página 404', async () => {
    const respuesta = await ver(d.admin, '/panel/no-existe');

    expect(respuesta.status).toBe(404);
    expect(respuesta.headers['content-type']).toContain('text/html');
  });
});

describe('Consultas y check-in manual', () => {
  test('la página de consultas muestra las ventas por evento', async () => {
    const evento = await crearEvento(d.sala.id, { nombre: 'Festival de cine' });
    const cliente = await crearCliente();
    await entradasModel.createEntrada({ eventoId: evento.id, clienteId: cliente.id, precio: 1 });

    const pagina = await ver(d.auditor, '/panel/consultas');

    expect(pagina.status).toBe(200);
    expect(pagina.text).toContain('Festival de cine');
  });

  test('el formulario de check-in redirige a la entrada del código cargado', async () => {
    expect((await ver(d.empleado, '/panel/checkin')).status).toBe(200);

    const respuesta = await ver(d.empleado, '/panel/checkin?codigo=%20ABC123%20');

    expect(respuesta.headers.location).toBe('/panel/checkin/ABC123');
  });

  test('un código que no existe muestra el aviso de entrada no encontrada', async () => {
    const respuesta = await ver(d.empleado, '/panel/checkin/no-existe');

    expect(respuesta.status).toBe(404);
  });
});
