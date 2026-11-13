// Tests de integración: validación de la entrada en el ingreso con QR (RF-VEN-21 de Ingeniería).
// Recorren la API y el panel completos contra un MongoDB en memoria.
import request from 'supertest';
import app from '../../app.js';
import * as entradasModel from '../../models/entradas.js';
import { Evento } from '../../models/eventos.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearEvento, crearCliente, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

// Un evento HOY en el centro A, una entrada vendida, y personal de los dos centros
let d;
beforeEach(async () => {
  const salaA = await crearSala({ nombre: 'Centro Cultural Norte' });
  const salaB = await crearSala({ nombre: 'Centro Cultural Sur' });
  const evento = await crearEvento(salaA.id, { fecha: new Date() });
  const cliente = await crearCliente();
  const entrada = await entradasModel.createEntrada({ eventoId: evento.id, clienteId: cliente.id, precio: 5000 });
  d = {
    salaA,
    evento,
    cliente,
    entrada,
    empleadoA: await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: salaA.id, email: 'cajero.norte@urbanacult.com' }),
    empleadoB: await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: salaB.id, email: 'cajero.sur@urbanacult.com' }),
    representanteA: await crearUsuarioConToken({ rol: 'REPRESENTANTE', salaId: salaA.id }),
    admin: await crearUsuarioConToken({ rol: 'ADMIN' }),
  };
});

// El escaneo por API: POST /entradas/checkin con el código del QR
function escanear(quien, codigo) {
  return request(app)
    .post('/entradas/checkin')
    .set('Authorization', `Bearer ${quien.token}`)
    .send({ codigo });
}

describe('Código del QR', () => {
  test('cada entrada nueva recibe un código aleatorio de 22 caracteres, distinto del _id', async () => {
    const otra = await entradasModel.createEntrada({ eventoId: d.evento.id, clienteId: d.cliente.id, precio: 5000 });

    expect(d.entrada.codigo).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(d.entrada.codigo).not.toBe(d.entrada.id);
    expect(otra.codigo).not.toBe(d.entrada.codigo);
  });
});

describe('Check-in por API', () => {
  test('el empleado del centro valida la entrada: queda USADA, con la hora y quién la validó', async () => {
    const respuesta = await escanear(d.empleadoA, d.entrada.codigo);

    expect(respuesta.status).toBe(200);
    const guardada = await entradasModel.getEntradaById(d.entrada.id);
    expect(guardada.estado).toBe('USADA');
    expect(guardada.usadaEn).toBeInstanceOf(Date);
    expect(String(guardada.validadaPor)).toBe(d.empleadoA.usuario.id);
  });

  test('el REPRESENTANTE del centro también puede validar', async () => {
    expect((await escanear(d.representanteA, d.entrada.codigo)).status).toBe(200);
  });

  test('un segundo escaneo de la misma entrada se rechaza con 409', async () => {
    await escanear(d.empleadoA, d.entrada.codigo);

    const segundo = await escanear(d.empleadoA, d.entrada.codigo);

    expect(segundo.status).toBe(409);
    expect(segundo.body.error).toMatch(/ya ingresó/);
  });

  test('si escanean el mismo QR cinco veces a la vez, entra una sola persona', async () => {
    const respuestas = await Promise.all(Array.from({ length: 5 }, () => escanear(d.empleadoA, d.entrada.codigo)));

    expect(respuestas.filter((r) => r.status === 200).length).toBe(1);
    expect(respuestas.filter((r) => r.status === 409).length).toBe(4);
  });

  test('el empleado de otro centro no puede validar', async () => {
    const respuesta = await escanear(d.empleadoB, d.entrada.codigo);

    expect(respuesta.status).toBe(403);
    expect((await entradasModel.getEntradaById(d.entrada.id)).estado).toBe('VALIDA');
  });

  test('el ADMIN no valida ingresos (mínimo privilegio): es una tarea del lugar', async () => {
    expect((await escanear(d.admin, d.entrada.codigo)).status).toBe(403);
  });

  test('un código que no existe responde 404', async () => {
    expect((await escanear(d.empleadoA, 'CodigoQueNoExiste00000')).status).toBe(404);
  });

  test('una reserva sin confirmar no puede ingresar', async () => {
    const reserva = await entradasModel.createEntrada({
      eventoId: d.evento.id, clienteId: d.cliente.id, precio: 5000, estado: 'RESERVADA',
    });

    const respuesta = await escanear(d.empleadoA, reserva.codigo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toMatch(/no está pagada/);
  });
});

describe('Una entrada usada', () => {
  test('sigue ocupando su lugar y ya no se puede cancelar', async () => {
    await escanear(d.empleadoA, d.entrada.codigo);

    expect((await Evento.findById(d.evento.id)).lugaresOcupados).toBe(1);
    const cancelacion = await request(app)
      .put(`/entradas/${d.entrada.id}/cancelar`)
      .set('Authorization', `Bearer ${d.empleadoA.token}`);
    expect(cancelacion.status).toBe(400);
    expect(cancelacion.body.error).toMatch(/ya se usó/);
  });

  test('sigue contando como vendida en las consultas', async () => {
    await escanear(d.empleadoA, d.entrada.codigo);

    const consulta = await request(app)
      .get(`/consultas/entradas-vendidas/${d.evento.id}`)
      .set('Authorization', `Bearer ${d.admin.token}`);
    expect(consulta.body.vendidas).toBe(1);
  });
});

describe('Check-in en el panel', () => {
  const con = (quien, peticion) => peticion.set('Cookie', `token=${quien.token}`);

  test('al abrir el QR, el empleado ve "Puede ingresar" y, al validar, "Adentro"', async () => {
    const ruta = `/panel/checkin/${d.entrada.codigo}`;

    const pagina = await con(d.empleadoA, request(app).get(ruta));
    expect(pagina.status).toBe(200);
    expect(pagina.text).toContain('Puede ingresar');

    const validacion = await con(d.empleadoA, request(app).post(ruta));
    expect(validacion.status).toBe(302);
    expect(validacion.headers.location).toMatch(new RegExp(`^${ruta}\\?ok=`));

    const despues = await con(d.empleadoA, request(app).get(validacion.headers.location));
    expect(despues.text).toContain('Adentro');
  });

  test('el ADMIN que abre el QR vuelve al inicio con un aviso', async () => {
    const pagina = await con(d.admin, request(app).get(`/panel/checkin/${d.entrada.codigo}`));

    expect(pagina.status).toBe(302);
    expect(pagina.headers.location).toMatch(/^\/panel\?error=/);
  });

  test('el detalle de la entrada muestra el QR y, al personal del centro, "Simular lectura del QR"', async () => {
    const empleado = await con(d.empleadoA, request(app).get(`/panel/entradas/${d.entrada.id}`));
    expect(empleado.text).toContain('data:image/png;base64');
    expect(empleado.text).toContain('Simular lectura del QR');

    // El ADMIN ve el QR (para imprimirlo, por ejemplo), pero no el botón: él no valida ingresos
    const admin = await con(d.admin, request(app).get(`/panel/entradas/${d.entrada.id}`));
    expect(admin.text).toContain('data:image/png;base64');
    expect(admin.text).not.toContain('Simular lectura del QR');
  });
});
