// Tests de integración de los errores inesperados (por ejemplo, que se caiga la base en medio de
// una petición). Cada controller los pasa con next(error) al errorHandler: la API tiene que
// responder un 500 genérico, sin mostrar el detalle interno, y el panel la página de error.
// Se simula la caída haciendo fallar las consultas de Mongoose de un model.
import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../../app.js';
import * as salasModel from '../../models/salas.js';
import * as clientesModel from '../../models/clientes.js';
import * as eventosModel from '../../models/eventos.js';
import * as usuariosModel from '../../models/usuarios.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

const FALLA = 'conexión con MongoDB perdida';

let espias = [];
let consola;
beforeEach(() => {
  consola = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  espias.forEach((espia) => espia.mockRestore());
  espias = [];
  consola.mockRestore();
});

// Desde ahora, las búsquedas del Model fallan
function romper(Model, ...metodos) {
  for (const metodo of metodos) {
    espias.push(jest.spyOn(Model, metodo).mockImplementation(() => { throw new Error(FALLA); }));
  }
}

describe('API', () => {
  test.each([
    ['GET /salas', salasModel.Sala, ['find'], (r) => r.get('/salas')],
    ['GET /eventos/proximos', eventosModel.Evento, ['find'], (r) => r.get('/eventos/proximos')],
    ['GET /consultas/eventos-proximos', eventosModel.Evento, ['find'], (r) => r.get('/consultas/eventos-proximos')],
  ])('%s responde 500 genérico, sin el detalle de la falla', async (_, Model, metodos, pedir) => {
    romper(Model, ...metodos);

    const respuesta = await pedir(request(app));

    expect(respuesta.status).toBe(500);
    expect(respuesta.body).toEqual({ error: 'Error interno del servidor' });
    expect(consola).toHaveBeenCalled();
  });

  test('con sesión: GET /clientes responde 500 si falla la base', async () => {
    const { token } = await crearUsuarioConToken({ rol: 'ADMIN' });
    romper(clientesModel.Cliente, 'find');

    const respuesta = await request(app).get('/clientes').set('Authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(500);
    expect(JSON.stringify(respuesta.body)).not.toContain(FALLA);
  });

  test('con sesión: GET /usuarios responde 500 si falla la base', async () => {
    const { token } = await crearUsuarioConToken({ rol: 'ADMIN' });
    // La autenticación busca al usuario con findById, que sigue andando; la lista usa find
    romper(usuariosModel.Usuario, 'find');

    expect((await request(app).get('/usuarios').set('Authorization', `Bearer ${token}`)).status).toBe(500);
  });
});

describe('Panel', () => {
  test('una falla de la base muestra la página de error en HTML', async () => {
    const sala = await crearSala();
    const { token } = await crearUsuarioConToken({ rol: 'ADMIN' });
    romper(eventosModel.Evento, 'find');

    const respuesta = await request(app).get(`/panel/salas/${sala.id}`).set('Cookie', `token=${token}`);

    expect(respuesta.status).toBe(500);
    expect(respuesta.headers['content-type']).toContain('text/html');
    expect(respuesta.text).not.toContain(FALLA);
  });

  test.each(['/panel', '/panel/eventos', '/panel/clientes', '/panel/entradas', '/panel/usuarios', '/panel/consultas'])(
    '%s muestra la página de error si falla la base',
    async (ruta) => {
      const { token } = await crearUsuarioConToken({ rol: 'ADMIN' });
      romper(salasModel.Sala, 'find', 'countDocuments');
      romper(eventosModel.Evento, 'find', 'countDocuments');
      romper(clientesModel.Cliente, 'find', 'countDocuments');

      const respuesta = await request(app).get(ruta).set('Cookie', `token=${token}`);

      expect(respuesta.status).toBe(500);
    }
  );
});
