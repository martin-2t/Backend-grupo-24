// Tests de integración: rol AUDITOR (consulta y auditoría, RF-PLA-08 de Ingeniería de Software).
// Comprueban, contra la app completa, que ve la información interna de toda la red pero
// que cualquier intento de modificarla se rechaza, tanto en la API como en el panel.
import request from 'supertest';
import app from '../../app.js';
import * as entradasModel from '../../models/entradas.js';
import { conectar, desconectar } from '../helpers/db.js';
import { crearSala, crearEvento, crearCliente, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterAll(desconectar);

// A diferencia de los tests de sobreventa, acá los datos se crean una sola vez para todo el
// archivo: los tests solo leen o reciben un rechazo, así que nadie los modifica. Tampoco hace
// falta limpiar al final: la base en memoria de este archivo se destruye en desconectar
let datos;
beforeAll(async () => {
  const sala = await crearSala();
  const evento = await crearEvento(sala.id);
  const cliente = await crearCliente();
  const entrada = await entradasModel.createEntrada({
    eventoId: evento.id,
    clienteId: cliente.id,
    precio: 5000,
  });
  const admin = await crearUsuarioConToken({ rol: 'ADMIN' });
  const auditor = await crearUsuarioConToken({ rol: 'AUDITOR' });
  const empleado = await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: sala.id });
  datos = { sala, evento, cliente, entrada, admin, auditor, empleado };
});

describe('AUDITOR en la API', () => {
  // Cada fila es una ruta de consulta interna (las públicas, como /eventos, no hace falta probarlas)
  test.each([
    ['GET', '/clientes'],
    ['GET', '/entradas'],
    ['GET', '/consultas/entradas-vendidas'],
    ['GET', '/usuarios'],
  ])('puede consultar %s %s', async (metodo, ruta) => {
    const respuesta = await request(app)
      .get(ruta)
      .set('Authorization', `Bearer ${datos.auditor.token}`);

    expect(respuesta.status).toBe(200);
  });

  test('al listar usuarios no recibe contraseñas ni salts', async () => {
    const respuesta = await request(app)
      .get('/usuarios')
      .set('Authorization', `Bearer ${datos.auditor.token}`);

    const texto = JSON.stringify(respuesta.body);
    expect(texto).not.toMatch(/passwordHash|salt/);
  });

  // Las rutas se arman con una función porque los ids recién existen después del beforeAll
  test.each([
    ['POST', () => '/clientes'],
    ['POST', () => '/entradas'],
    ['POST', () => '/eventos'],
    ['PUT', () => `/entradas/${datos.entrada.id}/cancelar`],
    ['PUT', () => `/salas/${datos.sala.id}`],
    ['DELETE', () => `/clientes/${datos.cliente.id}`],
    ['DELETE', () => `/usuarios/${datos.admin.usuario.id}`],
  ])('no puede modificar: %s %s responde 403', async (metodo, armarRuta) => {
    const respuesta = await request(app)
      [metodo.toLowerCase()](armarRuta())
      .set('Authorization', `Bearer ${datos.auditor.token}`)
      .send({});

    expect(respuesta.status).toBe(403);
  });

  test('después de todos los intentos, la entrada sigue intacta', async () => {
    const entrada = await entradasModel.getEntradaById(datos.entrada.id);
    expect(entrada.estado).toBe('VALIDA');
  });
});

describe('AUDITOR en el panel', () => {
  // El panel lee el token de la cookie, no del header Authorization
  const comoAuditor = (peticion) => peticion.set('Cookie', `token=${datos.auditor.token}`);
  const comoEmpleado = (peticion) => peticion.set('Cookie', `token=${datos.empleado.token}`);

  test('ve la lista de clientes, sin los botones de acción', async () => {
    const respuesta = await comoAuditor(request(app).get('/panel/clientes'));

    expect(respuesta.status).toBe(200);
    expect(respuesta.text).toContain('Cliente');
    expect(respuesta.text).not.toContain('Nuevo cliente');
    expect(respuesta.text).not.toContain('Eliminar');
  });

  test('el EMPLEADO, en la misma página, sí ve los botones (control del test anterior)', async () => {
    const respuesta = await comoEmpleado(request(app).get('/panel/clientes'));
    expect(respuesta.text).toContain('Nuevo cliente');
  });

  test('si fuerza un formulario de alta, vuelve al inicio con un aviso', async () => {
    const respuesta = await comoAuditor(
      request(app).post('/panel/clientes/nuevo').type('form').send({ nombre: 'Intruso' })
    );

    expect(respuesta.status).toBe(302);
    expect(respuesta.headers.location).toMatch(/^\/panel\?error=/);
  });
});
