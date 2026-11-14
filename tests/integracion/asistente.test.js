// Tests del asistente de cartelera (POST /asistente). La llamada a Gemini se reemplaza por un
// fetch falso: los tests no salen a internet ni gastan cuota, y así se pueden simular las
// respuestas de error de Google. La cartelera que se le manda sí sale de la base (en memoria).
import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../../app.js';
import * as entradasModel from '../../models/entradas.js';
import * as salasModel from '../../models/salas.js';
import { validar, MAX_MENSAJE } from '../../models/asistente.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearEvento, crearCliente, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

// Respuesta de Gemini con el texto dado, en el formato de generateContent
const respuestaGemini = (texto) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: texto }] } }] }),
});
const errorGemini = (status) => ({ ok: false, status, text: async () => 'detalle interno de Google' });

let fetchFalso;
let consola;
let usuario;
beforeEach(async () => {
  process.env.GEMINI_API_KEY = 'clave-de-prueba';
  fetchFalso = jest.spyOn(globalThis, 'fetch').mockResolvedValue(respuestaGemini('Hay un recital el sábado.'));
  consola = jest.spyOn(console, 'error').mockImplementation(() => {});
  usuario = await crearUsuarioConToken({ rol: 'ADMIN' });
});
afterEach(() => {
  fetchFalso.mockRestore();
  consola.mockRestore();
  delete process.env.GEMINI_API_KEY;
});

const preguntar = (body, quien = usuario) =>
  request(app).post('/asistente').set('Authorization', `Bearer ${quien.token}`).send(body);

// Lo que el asistente le mandó a Gemini en la última llamada
const enviadoAGemini = () => JSON.parse(fetchFalso.mock.calls.at(-1)[1].body);

describe('validar (antes de gastar una llamada a Gemini)', () => {
  test('acepta una pregunta con historial bien formado', () => {
    expect(validar({ mensaje: '¿Qué hay hoy?', historial: [{ rol: 'usuario', texto: 'hola' }] })).toBeNull();
  });

  test('rechaza una pregunta vacía, que no es texto o demasiado larga', () => {
    expect(validar({ mensaje: '   ' })).toBe('Escribí una pregunta.');
    expect(validar({ mensaje: 42 })).toBe('Escribí una pregunta.');
    expect(validar({ mensaje: 'a'.repeat(MAX_MENSAJE + 1) })).toContain(`${MAX_MENSAJE} caracteres`);
  });

  test('rechaza un historial que no es una lista o tiene mensajes inválidos', () => {
    expect(validar({ mensaje: 'hola', historial: 'no' })).toContain('lista de mensajes');
    expect(validar({ mensaje: 'hola', historial: [null] })).toContain('formato inválido');
    expect(validar({ mensaje: 'hola', historial: [{ rol: 'sistema', texto: 'x' }] })).toContain('formato inválido');
    expect(validar({ mensaje: 'hola', historial: [{ rol: 'usuario', texto: 'x'.repeat(2001) }] })).toContain('formato inválido');
  });
});

describe('POST /asistente', () => {
  test('sin iniciar sesión responde 401 y no llama a Gemini', async () => {
    const respuesta = await request(app).post('/asistente').send({ mensaje: 'hola' });

    expect(respuesta.status).toBe(401);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  test('una pregunta inválida responde 400 sin llamar a Gemini', async () => {
    const respuesta = await preguntar({ mensaje: '' });

    expect(respuesta.status).toBe(400);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  test('responde con el texto que redactó Gemini', async () => {
    const respuesta = await preguntar({ mensaje: '¿Qué hay este finde?' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ respuesta: 'Hay un recital el sábado.' });
    expect(fetchFalso.mock.calls[0][1].headers['x-goog-api-key']).toBe('clave-de-prueba');
  });

  test('la cartelera enviada tiene solo eventos programados y futuros de salas activas', async () => {
    const sala = await crearSala({ nombre: 'Centro Norte', capacidad: 10 });
    const cerrada = await crearSala({ nombre: 'Centro Cerrado' });
    await crearEvento(sala.id, { nombre: 'Recital de jazz', descripcion: 'Trío en vivo', precio: 3000 });
    await crearEvento(sala.id, { nombre: 'Obra que ya fue', fecha: new Date(Date.now() - 24 * 60 * 60 * 1000) });
    await crearEvento(cerrada.id, { nombre: 'Evento de sala cerrada' });
    await salasModel.toggleSalaById(cerrada.id);

    await preguntar({ mensaje: '¿Qué hay?' });
    const instrucciones = enviadoAGemini().systemInstruction.parts[0].text;

    expect(instrucciones).toContain('"Recital de jazz"');
    expect(instrucciones).toContain('Sala: Centro Norte');
    expect(instrucciones).toContain('Precio: $3000');
    expect(instrucciones).toContain('Lugares disponibles: 10 de 10');
    expect(instrucciones).toContain('Descripción: Trío en vivo');
    expect(instrucciones).not.toContain('Obra que ya fue');
    expect(instrucciones).not.toContain('Evento de sala cerrada');
  });

  test('un evento sin lugares figura como AGOTADO', async () => {
    const sala = await crearSala({ capacidad: 10 });
    const evento = await crearEvento(sala.id, { nombre: 'Show lleno' });
    const cliente = await crearCliente();
    for (let i = 0; i < 10; i++) {
      await entradasModel.createEntrada({ eventoId: evento.id, clienteId: cliente.id, precio: 1 });
    }

    await preguntar({ mensaje: '¿Qué hay?' });

    expect(enviadoAGemini().systemInstruction.parts[0].text).toContain('Lugares disponibles: AGOTADO');
  });

  test('sin eventos, la cartelera lo dice en vez de quedar vacía', async () => {
    await preguntar({ mensaje: '¿Qué hay?' });

    expect(enviadoAGemini().systemInstruction.parts[0].text).toContain('No hay eventos programados por el momento.');
  });

  test('reenvía el historial, pero la conversación siempre empieza con un mensaje del usuario', async () => {
    await preguntar({
      mensaje: '¿Y el domingo?',
      historial: [
        { rol: 'asistente', texto: '¡Hola! ¿En qué te ayudo?' },
        { rol: 'usuario', texto: '¿Qué hay el sábado?' },
        { rol: 'asistente', texto: 'Un recital.' },
      ],
    });

    expect(enviadoAGemini().contents).toEqual([
      { role: 'user', parts: [{ text: '¿Qué hay el sábado?' }] },
      { role: 'model', parts: [{ text: 'Un recital.' }] },
      { role: 'user', parts: [{ text: '¿Y el domingo?' }] },
    ]);
  });

  test('si Gemini devuelve una respuesta vacía, contesta un mensaje de respaldo', async () => {
    fetchFalso.mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [] }) });

    const respuesta = await preguntar({ mensaje: 'hola' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.respuesta).toContain('No pude armar una respuesta');
  });
});

describe('Errores del asistente', () => {
  test('sin GEMINI_API_KEY responde 503 y no llama a Gemini', async () => {
    delete process.env.GEMINI_API_KEY;

    const respuesta = await preguntar({ mensaje: 'hola' });

    expect(respuesta.status).toBe(503);
    expect(respuesta.body.error).toBe('El asistente no está configurado todavía.');
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  test('si Gemini no responde (red caída o timeout) responde 502', async () => {
    fetchFalso.mockRejectedValue(new Error('timeout'));

    const respuesta = await preguntar({ mensaje: 'hola' });

    expect(respuesta.status).toBe(502);
  });

  test('si Gemini está sin cuota responde 429', async () => {
    fetchFalso.mockResolvedValue(errorGemini(429));

    const respuesta = await preguntar({ mensaje: 'hola' });

    expect(respuesta.status).toBe(429);
    expect(respuesta.body.error).toContain('muchas consultas');
  });

  test('cualquier otro error de Gemini es un 502, sin pasarle al cliente el detalle de Google', async () => {
    fetchFalso.mockResolvedValue(errorGemini(500));

    const respuesta = await preguntar({ mensaje: 'hola' });

    expect(respuesta.status).toBe(502);
    expect(JSON.stringify(respuesta.body)).not.toContain('detalle interno de Google');
  });

  test('después de 8 consultas en un minuto, la siguiente responde 429', async () => {
    const insistente = await crearUsuarioConToken({ rol: 'AUDITOR' });
    for (let i = 0; i < 8; i++) {
      expect((await preguntar({ mensaje: 'hola' }, insistente)).status).toBe(200);
    }

    const respuesta = await preguntar({ mensaje: 'hola' }, insistente);

    expect(respuesta.status).toBe(429);
    expect(respuesta.headers['retry-after']).toBeDefined();
  });
});
