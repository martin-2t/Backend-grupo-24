//Tests de integración: operaciones de Entrada (acceso, crear, confirmar, cancelar,
//errores y permisos) 
import request from 'supertest';
import app from '../../app.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearEvento, crearCliente, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

//Prepara una sala, un evento, un cliente y un admin con su token
async function escenario() {
  const sala = await crearSala({ capacidad: 10 });
  const evento = await crearEvento(sala.id);
  const cliente = await crearCliente();
  const { token } = await crearUsuarioConToken({ rol: 'ADMIN' });
  return { sala, evento, cliente, token };
}

describe('Entradas: acceso y listado', () => {
  test('sin iniciar sesión, listar las entradas responde 401', async () => {
    const respuesta = await request(app).get('/entradas');

    expect(respuesta.status).toBe(401);
  });

  test('el ADMIN lista las entradas', async () => {
    const { token } = await escenario();

    const respuesta = await request(app)
      .get('/entradas')
      .set('Authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(200);
    expect(Array.isArray(respuesta.body)).toBe(true);
  });
});

//Crea una reserva con el token del admin y devuelve la respuesta de la API
function reservar({ token, evento, cliente }) {
  return request(app)
    .post('/entradas/reservar')
    .set('Authorization', `Bearer ${token}`)
    .send({ eventoId: evento.id, clienteId: cliente.id });
}

describe('Entradas: reservar, confirmar y cancelar', () => {
  test('el ADMIN crea una reserva: queda RESERVADA (201)', async () => {
    const datos = await escenario();

    const respuesta = await reservar(datos);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.estado).toBe('RESERVADA');
  });

  test('confirmar la reserva la deja VALIDA (200)', async () => {
    const datos = await escenario();
    const reserva = await reservar(datos);

    const respuesta = await request(app)
      .put(`/entradas/${reserva.body._id}/confirmar`)
      .set('Authorization', `Bearer ${datos.token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.estado).toBe('VALIDA');
  });

  test('cancelar la entrada la deja CANCELADA (200)', async () => {
    const datos = await escenario();
    const reserva = await reservar(datos);

    const respuesta = await request(app)
      .put(`/entradas/${reserva.body._id}/cancelar`)
      .set('Authorization', `Bearer ${datos.token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.estado).toBe('CANCELADA');
  });

  test('cancelar dos veces la misma entrada responde 400 con un mensaje claro', async () => {
    const datos = await escenario();
    const reserva = await reservar(datos);
    const cancelar = () =>
      request(app)
        .put(`/entradas/${reserva.body._id}/cancelar`)
        .set('Authorization', `Bearer ${datos.token}`);
    await cancelar();

    const respuesta = await cancelar();

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toMatch(/ya estaba cancelada/i);
  });
});

describe('Entradas: errores de datos', () => {
  test('un evento que no existe responde 404', async () => {
    const { cliente, token } = await escenario();

    const respuesta = await request(app)
      .post('/entradas')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventoId: '5a1e000000000000000000ff', clienteId: cliente.id });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error).toMatch(/no existe/i);
  });

  test('sin eventoId responde 400', async () => {
    const { cliente, token } = await escenario();

    const respuesta = await request(app)
      .post('/entradas')
      .set('Authorization', `Bearer ${token}`)
      .send({ clienteId: cliente.id });

    expect(respuesta.status).toBe(400);
  });
});

describe('Entradas: permisos', () => {
  test('un CLIENTE puede reservar para sí mismo (201)', async () => {
    const { evento, cliente } = await escenario();
    const { token } = await crearUsuarioConToken({ rol: 'CLIENTE', clienteId: cliente.id });

    const respuesta = await request(app)
      .post('/entradas/reservar')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventoId: evento.id, clienteId: cliente.id });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.estado).toBe('RESERVADA');
  });

  test('un EMPLEADO de otro centro no puede reservar en este evento (403)', async () => {
    const { evento, cliente } = await escenario();
    const otraSala = await crearSala({ nombre: 'Otra Sala' });
    const { token } = await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: otraSala.id });

    const respuesta = await request(app)
      .post('/entradas/reservar')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventoId: evento.id, clienteId: cliente.id });

    expect(respuesta.status).toBe(403);
  });

  test('borrar una entrada es solo del ADMIN: el EMPLEADO recibe 403 y el ADMIN 204', async () => {
    const datos = await escenario();
    const reserva = await reservar(datos);
    const { token: tokenEmpleado } = await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: datos.sala.id });
    const borrar = (token) =>
      request(app)
        .delete(`/entradas/${reserva.body._id}`)
        .set('Authorization', `Bearer ${token}`);

    const delEmpleado = await borrar(tokenEmpleado);
    const delAdmin = await borrar(datos.token);

    expect(delEmpleado.status).toBe(403);
    expect(delAdmin.status).toBe(204);
  });
});