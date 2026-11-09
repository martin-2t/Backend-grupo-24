// Tests de integración: reservas con vencimiento (RF-VEN-02 de Ingeniería de Software).
// Una reserva retiene su lugar RESERVA_MINUTOS mientras se confirma el pago; si no se confirma,
// vence sola y el lugar vuelve al stock. Para no esperar minutos reales, los tests "adelantan
// el reloj" poniéndole a la reserva un vencimiento en el pasado.
import request from 'supertest';
import app from '../../app.js';
import { Entrada } from '../../models/entradas.js';
import { Evento } from '../../models/eventos.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearEvento, crearCliente, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

const UN_MINUTO = 60 * 1000;

let d;
beforeEach(async () => {
  const sala = await crearSala({ capacidad: 10 });
  const evento = await crearEvento(sala.id);
  const cliente = await crearCliente();
  const { token } = await crearUsuarioConToken({ rol: 'ADMIN' });
  d = { evento, cliente, token };
});

const conToken = (peticion) => peticion.set('Authorization', `Bearer ${d.token}`);
const reservar = () =>
  conToken(request(app).post('/entradas/reservar')).send({ eventoId: d.evento.id, clienteId: d.cliente.id });
const vender = () =>
  conToken(request(app).post('/entradas')).send({ eventoId: d.evento.id, clienteId: d.cliente.id });
const consultar = (id) => conToken(request(app).get(`/entradas/${id}`));
const confirmar = (id) => conToken(request(app).put(`/entradas/${id}/confirmar`));

// "Adelanta el reloj": la reserva pasa a tener un vencimiento que ya pasó
function hacerVencer(id) {
  return Entrada.updateOne({ _id: id }, { $set: { venceEn: new Date(Date.now() - UN_MINUTO) } });
}
async function lugaresDelEvento() {
  return (await Evento.findById(d.evento.id)).lugaresOcupados;
}

describe('Reserva con vencimiento', () => {
  test('una reserva nueva vence en 10 minutos', async () => {
    const respuesta = await reservar();

    expect(respuesta.status).toBe(201);
    const faltan = new Date(respuesta.body.venceEn) - Date.now();
    expect(faltan).toBeGreaterThan(9.9 * UN_MINUTO);
    expect(faltan).toBeLessThanOrEqual(10 * UN_MINUTO);
  });

  test('el plazo se puede cambiar con RESERVA_MINUTOS', async () => {
    process.env.RESERVA_MINUTOS = '2';
    try {
      const respuesta = await reservar();
      expect(new Date(respuesta.body.venceEn) - Date.now()).toBeLessThanOrEqual(2 * UN_MINUTO);
    } finally {
      delete process.env.RESERVA_MINUTOS;
    }
  });

  test('una venta directa no tiene vencimiento', async () => {
    const respuesta = await vender();
    expect(respuesta.body.venceEn).toBeUndefined();
  });

  test('al consultarla después del plazo, la reserva figura VENCIDA y su lugar se libera', async () => {
    const { body: reserva } = await reservar();
    expect(await lugaresDelEvento()).toBe(1);

    await hacerVencer(reserva._id);
    const respuesta = await consultar(reserva._id);

    expect(respuesta.body.estado).toBe('VENCIDA');
    expect(await lugaresDelEvento()).toBe(0);
  });

  test('si las reservas vencidas llenaban la sala, sus lugares vuelven a estar a la venta', async () => {
    const reservas = [];
    for (let i = 0; i < 10; i++) reservas.push((await reservar()).body);
    expect((await vender()).status).toBe(400); // sala llena

    await Promise.all(reservas.map((r) => hacerVencer(r._id)));

    expect((await vender()).status).toBe(201);
    expect(await lugaresDelEvento()).toBe(1);
  });

  test('una reserva vencida no se puede confirmar', async () => {
    const { body: reserva } = await reservar();
    await hacerVencer(reserva._id);

    const respuesta = await confirmar(reserva._id);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toMatch(/venció/);
  });

  test('confirmada a tiempo, queda vendida y deja de tener vencimiento', async () => {
    const { body: reserva } = await reservar();

    const respuesta = await confirmar(reserva._id);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.estado).toBe('VALIDA');
    expect(respuesta.body.venceEn).toBeUndefined();
  });

  test('si varios pedidos vencen la misma reserva a la vez, su lugar se libera una sola vez', async () => {
    const reservas = [];
    for (let i = 0; i < 3; i++) reservas.push((await reservar()).body);
    await hacerVencer(reservas[0]._id);

    await Promise.all(Array.from({ length: 5 }, () => consultar(reservas[0]._id)));

    // Quedan las otras 2 reservas: si el lugar se hubiera liberado 5 veces, el contador daría 0
    expect(await lugaresDelEvento()).toBe(2);
  });
});
