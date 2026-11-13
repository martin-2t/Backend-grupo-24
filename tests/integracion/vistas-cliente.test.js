// Tests de integración: qué ve el cliente en el panel. El panel se pensó primero para el
// personal; estos tests fijan que el cliente vea lo que le sirve (la cartelera y sus entradas)
// y no los botones ni los números de gestión.
import request from 'supertest';
import app from '../../app.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearEvento, crearCliente, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

const UN_DIA = 24 * 60 * 60 * 1000;

let d;
beforeEach(async () => {
  const sala = await crearSala();
  const cliente = await crearCliente();
  d = {
    sala,
    proximo: await crearEvento(sala.id, { nombre: 'Concierto que viene', fecha: new Date(Date.now() + 5 * UN_DIA) }),
    pasado: await crearEvento(sala.id, { nombre: 'Concierto que ya fue', fecha: new Date(Date.now() - 5 * UN_DIA) }),
    cliente: await crearUsuarioConToken({ rol: 'CLIENTE', clienteId: cliente.id }),
    representante: await crearUsuarioConToken({ rol: 'REPRESENTANTE', salaId: sala.id }),
    empleado: await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: sala.id }),
  };
});

const como = (quien, ruta) => request(app).get(ruta).set('Cookie', `token=${quien.token}`);

describe('Lista de eventos', () => {
  test('solo gerencia ve "+ Nuevo evento": ni el cliente ni el empleado', async () => {
    expect((await como(d.representante, '/panel/eventos')).text).toContain('+ Nuevo evento');
    expect((await como(d.empleado, '/panel/eventos')).text).not.toContain('+ Nuevo evento');
    expect((await como(d.cliente, '/panel/eventos')).text).not.toContain('+ Nuevo evento');
  });

  test('el cliente ve la cartelera: solo eventos por venir, con acceso a comprar', async () => {
    const pagina = (await como(d.cliente, '/panel/eventos')).text;

    expect(pagina).toContain('Concierto que viene');
    expect(pagina).not.toContain('Concierto que ya fue');
    expect(pagina).toContain('Comprar');
    expect(pagina).not.toContain('Disponibles / Capacidad');
  });

  test('el personal ve todos los eventos, y los que ya pasaron sin finalizar llevan una marca', async () => {
    const pagina = (await como(d.empleado, '/panel/eventos')).text;

    expect(pagina).toContain('Concierto que ya fue');
    expect(pagina).toContain('Ya pasó, sin finalizar');
  });
});

describe('Detalle del evento', () => {
  test('el cliente no ve los números de gestión (capacidad y ocupación), solo el precio', async () => {
    const pagina = (await como(d.cliente, `/panel/eventos/${d.proximo.id}`)).text;

    expect(pagina).not.toContain('Capacidad de sala');
    expect(pagina).not.toContain('Lugares ocupados');
    expect(pagina).toContain('Precio');
  });

  test('el personal sí los ve', async () => {
    expect((await como(d.empleado, `/panel/eventos/${d.proximo.id}`)).text).toContain('Capacidad de sala');
  });
});

describe('Salas', () => {
  test('el cliente no tiene acceso a las salas (datos de gestión) ni las ve en el menú', async () => {
    const lista = await como(d.cliente, '/panel/salas');
    expect(lista.status).toBe(302);
    expect(lista.headers.location).toMatch(/^\/panel\?error=/);

    const detalle = await como(d.cliente, `/panel/salas/${d.sala.id}`);
    expect(detalle.status).toBe(302);

    expect((await como(d.cliente, '/panel')).text).not.toContain('href="/panel/salas"');
  });

  test('el personal sigue viendo las salas', async () => {
    expect((await como(d.empleado, '/panel/salas')).status).toBe(200);
  });
});

describe('Inicio', () => {
  test('el cliente ve su inicio: saludo, cartelera próxima y Mis entradas, sin números de gestión', async () => {
    const pagina = (await como(d.cliente, '/panel')).text;

    expect(pagina).toContain('Hola, Usuario Prueba');
    expect(pagina).toContain('href="/panel/mis-entradas"');
    expect(pagina).toContain('Concierto que viene');
    expect(pagina).not.toContain('Panel general');
  });

  test('el personal sigue viendo el panel general', async () => {
    expect((await como(d.empleado, '/panel')).text).toContain('Panel general');
  });
});
