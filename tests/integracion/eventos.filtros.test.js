//Tests de integración: filtros de la cartelera de eventos (GET /eventos).
//La cartelera es pública,no hace falta token.
import request from 'supertest';
import app from '../../app.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearEvento } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

// Fechas en hora argentina (UTC-3), igual que las toman los filtros.
const fecha = (texto) => new Date(`${texto}-03:00`);

describe('Cartelera: listado y filtro por centro', () => {
  test('sin filtros lista todos los eventos, ordenados por fecha', async () => {
    const sala = await crearSala();
    await crearEvento(sala.id, { nombre: 'Tercero', fecha: fecha('2026-12-30T20:00:00') });
    await crearEvento(sala.id, { nombre: 'Primero', fecha: fecha('2026-12-10T20:00:00') });
    await crearEvento(sala.id, { nombre: 'Segundo', fecha: fecha('2026-12-20T20:00:00') });

    const respuesta = await request(app).get('/eventos');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((e) => e.nombre)).toEqual(['Primero', 'Segundo', 'Tercero']);
  });

  test('con salaId trae solo los eventos de ese centro', async () => {
    const salaA = await crearSala({ nombre: 'Sala A' });
    const salaB = await crearSala({ nombre: 'Sala B' });
    await crearEvento(salaA.id, { nombre: 'Evento de A' });
    await crearEvento(salaB.id, { nombre: 'Evento de B' });

    const respuesta = await request(app).get(`/eventos?salaId=${salaA.id}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((e) => e.nombre)).toEqual(['Evento de A']);
  });
});

describe('Cartelera: filtro por fechas', () => {
  test('con desde y hasta trae solo los eventos del rango', async () => {
    const sala = await crearSala();
    await crearEvento(sala.id, { nombre: 'Antes', fecha: fecha('2026-12-05T20:00:00') });
    await crearEvento(sala.id, { nombre: 'Dentro', fecha: fecha('2026-12-15T20:00:00') });
    await crearEvento(sala.id, { nombre: 'Después', fecha: fecha('2026-12-25T20:00:00') });

    const respuesta = await request(app).get('/eventos?desde=2026-12-10&hasta=2026-12-20');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((e) => e.nombre)).toEqual(['Dentro']);
  });

  test('con desde y hasta iguales trae todo ese día, de 00:00 a 23:59', async () => {
    const sala = await crearSala();
    await crearEvento(sala.id, { nombre: 'Día anterior', fecha: fecha('2026-12-09T23:30:00') });
    await crearEvento(sala.id, { nombre: 'Madrugada', fecha: fecha('2026-12-10T00:30:00') });
    await crearEvento(sala.id, { nombre: 'Noche', fecha: fecha('2026-12-10T23:30:00') });
    await crearEvento(sala.id, { nombre: 'Día siguiente', fecha: fecha('2026-12-11T00:30:00') });

    const respuesta = await request(app).get('/eventos?desde=2026-12-10&hasta=2026-12-10');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((e) => e.nombre)).toEqual(['Madrugada', 'Noche']);
  });
});

describe('Cartelera: filtros inválidos', () => {
  test('una fecha con formato inválido responde 400', async () => {
    const respuesta = await request(app).get('/eventos?desde=hola');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toMatch(/desde/i);
  });

  test('un desde posterior al hasta responde 400', async () => {
    const respuesta = await request(app).get('/eventos?desde=2026-12-20&hasta=2026-12-10');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toMatch(/posterior/i);
  });
});