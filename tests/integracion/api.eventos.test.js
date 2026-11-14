// Tests de integración de la API de eventos: lectura pública, gestión del REPRESENTANTE de la
// sala (crear, editar, finalizar) y la cancelación, que también puede hacer el ADMIN y arrastra
// las entradas del evento.
import request from 'supertest';
import app from '../../app.js';
import * as entradasModel from '../../models/entradas.js';
import * as salasModel from '../../models/salas.js';
import * as eventosModel from '../../models/eventos.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearEvento, crearCliente, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

const ID_INEXISTENTE = '64b000000000000000000000';
const UN_DIA = 24 * 60 * 60 * 1000;
const EN_UN_MES = () => new Date(Date.now() + 30 * UN_DIA).toISOString();

let d;
beforeEach(async () => {
  const sala = await crearSala({ nombre: 'Centro Cultural Norte', capacidad: 20 });
  const otra = await crearSala({ nombre: 'Centro Cultural Sur' });
  d = {
    sala,
    otra,
    evento: await crearEvento(sala.id, { nombre: 'Recital de rock' }),
    admin: await crearUsuarioConToken({ rol: 'ADMIN' }),
    representante: await crearUsuarioConToken({ rol: 'REPRESENTANTE', salaId: sala.id }),
  };
});

const api = (quien, metodo, ruta, body = {}) =>
  request(app)[metodo](ruta).set('Authorization', `Bearer ${quien.token}`).send(body);
const nuevo = (cambios = {}) => ({ nombre: 'Obra de teatro', fecha: EN_UN_MES(), salaId: d.sala.id, precio: 2500, ...cambios });

describe('Lectura pública', () => {
  test('busca un evento por id; uno inexistente responde 404', async () => {
    expect((await request(app).get(`/eventos/${d.evento.id}`)).body.nombre).toBe('Recital de rock');
    expect((await request(app).get(`/eventos/${ID_INEXISTENTE}`)).status).toBe(404);
  });

  test('próximos: solo los PROGRAMADOS con fecha futura', async () => {
    await crearEvento(d.sala.id, { nombre: 'Evento que ya fue', fecha: new Date(Date.now() - UN_DIA) });
    const cancelado = await crearEvento(d.sala.id, { nombre: 'Evento cancelado' });
    await api(d.admin, 'put', `/eventos/${cancelado.id}/cancelar`);

    const respuesta = await request(app).get('/eventos/proximos');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((e) => e.nombre)).toEqual(['Recital de rock']);
  });
});

describe('Alta', () => {
  test('el REPRESENTANTE crea un evento en su sala: nace PROGRAMADO', async () => {
    const respuesta = await api(d.representante, 'post', '/eventos', nuevo({ descripcion: 'Una comedia' }));

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({ nombre: 'Obra de teatro', estado: 'PROGRAMADO', descripcion: 'Una comedia' });
  });

  test.each([
    [{ nombre: '' }, 'El nombre del evento es obligatorio.'],
    [{ nombre: 'Obr' }, 'al menos 4 caracteres'],
    [{ fecha: 'mañana' }, 'La fecha es obligatoria y debe ser válida.'],
    [{ fecha: new Date(Date.now() - UN_DIA).toISOString() }, 'posterior a este momento'],
    [{ precio: -1 }, 'mayor o igual a cero'],
    [{ precio: 'gratis' }, 'mayor o igual a cero'],
  ])('datos inválidos responden 400 con el motivo (%o)', async (cambios, motivo) => {
    const respuesta = await api(d.representante, 'post', '/eventos', nuevo(cambios));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toContain(motivo);
  });

  test('sin sala responde 400', async () => {
    const respuesta = await api(d.representante, 'post', '/eventos', nuevo({ salaId: undefined }));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toBe('Elegí una sala existente.');
  });

  test('en una sala dada de baja no se pueden crear eventos', async () => {
    await salasModel.toggleSalaById(d.sala.id);

    const respuesta = await api(d.representante, 'post', '/eventos', nuevo());

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toContain('está dada de baja');
  });
});

describe('Edición', () => {
  test('actualiza parcialmente: lo que no viene se conserva', async () => {
    const respuesta = await api(d.representante, 'put', `/eventos/${d.evento.id}`, { precio: 9000 });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ nombre: 'Recital de rock', precio: 9000 });
  });

  test('se puede corregir un evento que ya pasó sin que la fecha lo bloquee', async () => {
    const pasado = await crearEvento(d.sala.id, { fecha: new Date(Date.now() - UN_DIA) });

    expect((await api(d.representante, 'put', `/eventos/${pasado.id}`, { nombre: 'Nombre corregido' })).status).toBe(200);
  });

  test('un cambio inválido responde 400', async () => {
    expect((await api(d.representante, 'put', `/eventos/${d.evento.id}`, { precio: -5 })).status).toBe(400);
  });

  test('el REPRESENTANTE no puede mudar el evento a otro centro (403)', async () => {
    const respuesta = await api(d.representante, 'put', `/eventos/${d.evento.id}`, { salaId: d.otra.id });

    expect(respuesta.status).toBe(403);
  });

  // Por HTTP esta regla queda tapada por el control de centro, pero el model la sigue aplicando
  // para cualquier otro punto de entrada (por ejemplo, un script de mantenimiento)
  test('el model no deja mudar un evento a una sala donde no entra la gente que ya compró', async () => {
    const chica = await crearSala({ nombre: 'Sala Chica', capacidad: 10 });
    const cliente = await crearCliente();
    for (let i = 0; i < 12; i++) {
      await entradasModel.createEntrada({ eventoId: d.evento.id, clienteId: cliente.id, precio: 1 });
    }

    const error = await eventosModel.validar({ ...d.evento.toObject(), salaId: chica.id }, d.evento);

    expect(error).toContain('tiene capacidad 10 y este evento ya tiene 12 lugares ocupados');
  });

  test('al editar se puede conservar una sala dada de baja, pero no mudarse a una', async () => {
    const cerrada = await crearSala({ nombre: 'Sala Cerrada' });
    await salasModel.toggleSalaById(cerrada.id);
    await salasModel.toggleSalaById(d.sala.id);

    expect(await eventosModel.validar(d.evento.toObject(), d.evento)).toBeNull();
    expect(await eventosModel.validar({ ...d.evento.toObject(), salaId: cerrada.id }, d.evento)).toContain('dada de baja');
  });

  test('un evento inexistente responde 404', async () => {
    expect((await api(d.representante, 'put', `/eventos/${ID_INEXISTENTE}`, { precio: 1 })).status).toBe(404);
  });
});

describe('Finalizar', () => {
  test('pasa a FINALIZADO y una segunda vez responde 400', async () => {
    const respuesta = await api(d.representante, 'put', `/eventos/${d.evento.id}/finalizar`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.estado).toBe('FINALIZADO');

    const otraVez = await api(d.representante, 'put', `/eventos/${d.evento.id}/finalizar`);
    expect(otraVez.status).toBe(400);
    expect(otraVez.body.error).toContain('PROGRAMADO');
  });

  test('un evento finalizado ya no admite ventas', async () => {
    await api(d.representante, 'put', `/eventos/${d.evento.id}/finalizar`);
    const cliente = await crearCliente();

    const venta = await api(d.representante, 'post', '/entradas', { eventoId: d.evento.id, clienteId: cliente.id });

    expect(venta.status).toBe(400);
  });

  test('un evento inexistente responde 404', async () => {
    expect((await api(d.representante, 'put', `/eventos/${ID_INEXISTENTE}/finalizar`)).status).toBe(404);
  });
});

describe('Cancelar', () => {
  test('cancela el evento y arrastra sus entradas vigentes', async () => {
    const cliente = await crearCliente();
    const entrada = await entradasModel.createEntrada({ eventoId: d.evento.id, clienteId: cliente.id, precio: 1 });
    const reserva = await entradasModel.createEntrada({ eventoId: d.evento.id, clienteId: cliente.id, precio: 1, estado: 'RESERVADA' });

    const respuesta = await api(d.representante, 'put', `/eventos/${d.evento.id}/cancelar`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.estado).toBe('CANCELADO');
    expect((await entradasModel.getEntradaById(entrada.id)).estado).toBe('CANCELADA');
    expect((await entradasModel.getEntradaById(reserva.id)).estado).toBe('CANCELADA');
  });

  test('cancelarlo dos veces responde 400', async () => {
    await api(d.admin, 'put', `/eventos/${d.evento.id}/cancelar`);

    const otraVez = await api(d.admin, 'put', `/eventos/${d.evento.id}/cancelar`);

    expect(otraVez.status).toBe(400);
    expect(otraVez.body.error).toBe('El evento ya estaba cancelado.');
  });

  test('un evento inexistente responde 404', async () => {
    expect((await api(d.admin, 'put', `/eventos/${ID_INEXISTENTE}/cancelar`)).status).toBe(404);
  });
});
