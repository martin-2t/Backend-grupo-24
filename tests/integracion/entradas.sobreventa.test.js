// Tests de integración: control de sobreventa (stock único de entradas).
// Recorren la API completa con Supertest (rutas, middlewares, controllers y models)
// contra un MongoDB en memoria.
import request from 'supertest';
import app from '../../app.js';
import { Entrada } from '../../models/entradas.js';
import { Evento } from '../../models/eventos.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearEvento, crearCliente, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

// Prepara un evento en una sala de 10 lugares, un EMPLEADO de esa sala que vende en boletería y
// un ADMIN (que puede cancelar el evento por fuerza mayor, pero no vende)
async function escenario() {
  const sala = await crearSala({ capacidad: 10 });
  const evento = await crearEvento(sala.id);
  const cliente = await crearCliente();
  const { token } = await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: sala.id });
  const { token: tokenAdmin } = await crearUsuarioConToken({ rol: 'ADMIN' });

  // Una venta: POST /entradas con el token en el header Authorization
  const vender = () =>
    request(app)
      .post('/entradas')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventoId: evento.id, clienteId: cliente.id });

  return { sala, evento, cliente, token, tokenAdmin, vender };
}

// Entradas que ocupan lugar (vendidas o reservadas) en la base
function ocupadas(eventoId) {
  return Entrada.countDocuments({ eventoId, estado: { $in: ['VALIDA', 'RESERVADA'] } });
}

describe('Control de sobreventa', () => {
  test('con 30 compras simultáneas para 10 lugares, se venden exactamente 10', async () => {
    const { evento, vender } = await escenario();

    // Las 30 peticiones salen a la vez: ninguna espera a que termine la anterior
    const respuestas = await Promise.all(Array.from({ length: 30 }, vender));

    const aceptadas = respuestas.filter((r) => r.status === 201).length;
    const rechazadas = respuestas.filter((r) => r.status === 400).length;

    expect(aceptadas).toBe(10);
    expect(rechazadas).toBe(20);
    expect(await ocupadas(evento.id)).toBe(10);
  });

  test('con el evento lleno, una compra nueva se rechaza con un mensaje claro', async () => {
    const { vender } = await escenario();
    for (let i = 0; i < 10; i++) await vender();

    const respuesta = await vender();

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toMatch(/no quedan lugares/i);
  });

  test('cancelar una entrada libera su lugar para otra compra', async () => {
    const { token, vender } = await escenario();
    const vendidas = [];
    for (let i = 0; i < 10; i++) vendidas.push((await vender()).body);

    const cancelacion = await request(app)
      .put(`/entradas/${vendidas[0]._id}/cancelar`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancelacion.status).toBe(200);

    const nueva = await vender();
    expect(nueva.status).toBe(201);
  });

  test('un evento creado antes del contador (sin el campo guardado) también se protege', async () => {
    const { evento, cliente, vender } = await escenario();
    // Simula un evento viejo de la base: 7 entradas cargadas y el contador inexistente
    await Entrada.insertMany(
      Array.from({ length: 7 }, () => ({ eventoId: evento.id, clienteId: cliente.id, precio: 5000 }))
    );
    await Evento.updateOne({ _id: evento.id }, { $unset: { lugaresOcupados: '' } });

    const respuestas = await Promise.all(Array.from({ length: 10 }, vender));

    expect(respuestas.filter((r) => r.status === 201).length).toBe(3);
    expect(await ocupadas(evento.id)).toBe(10);
  });

  test('cancelar el evento devuelve todos sus lugares al stock', async () => {
    const { evento, tokenAdmin, vender } = await escenario();
    for (let i = 0; i < 4; i++) await vender();

    const cancelacion = await request(app)
      .put(`/eventos/${evento.id}/cancelar`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(cancelacion.status).toBe(200);

    const actualizado = await Evento.findById(evento.id);
    expect(actualizado.lugaresOcupados).toBe(0);
  });
});
