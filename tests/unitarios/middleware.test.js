// Tests unitarios de los middlewares que no dependen de la base: el manejador de errores,
// el 404, el logger y el límite de consultas al asistente. Se prueban con un req y un res
// falsos, sin levantar Express.
import { jest } from '@jest/globals';
import errorHandler from '../../middleware/errorHandler.js';
import notFound from '../../middleware/notFound.js';
import logger from '../../middleware/logger.js';
import { limitarAsistente } from '../../middleware/limiteAsistente.js';

// Un res que registra lo que se le pidió responder
function resFalso() {
  const res = { headers: {} };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.render = jest.fn(() => res);
  res.set = jest.fn((nombre, valor) => {
    res.headers[nombre] = valor;
    return res;
  });
  return res;
}

const reqApi = (cambios = {}) => ({ originalUrl: '/eventos', method: 'GET', ...cambios });
const reqPanel = (cambios = {}) => ({ originalUrl: '/panel/eventos?ok=1', method: 'GET', ...cambios });

describe('errorHandler', () => {
  let consola;
  beforeEach(() => {
    consola = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => consola.mockRestore());

  test('un ValidationError de Mongoose es un 400 con el primer mensaje del Schema', () => {
    const res = resFalso();
    const err = { name: 'ValidationError', errors: { nombre: { message: 'El nombre es obligatorio.' } } };

    errorHandler(err, reqApi(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El nombre es obligatorio.' });
    expect(consola).not.toHaveBeenCalled();
  });

  test('un CastError (id mal formado) es un 400 que muestra el valor recibido', () => {
    const res = resFalso();

    errorHandler({ name: 'CastError', value: 'abc' }, reqApi(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El valor "abc" no tiene un formato válido.' });
  });

  test('un índice único violado (código 11000) es un 409 con el valor repetido', () => {
    const res = resFalso();

    errorHandler({ code: 11000, keyValue: { email: 'a@b.com' } }, reqApi(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toContain('"email":"a@b.com"');
  });

  test('un body que no es JSON válido es un 400, no un error del servidor', () => {
    const res = resFalso();

    errorHandler({ type: 'entity.parse.failed' }, reqApi(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El cuerpo de la petición no es un JSON válido.' });
  });

  test('cualquier otro error es un 500 genérico: el detalle va a la consola, no al cliente', () => {
    const res = resFalso();
    const err = new Error('se cayó la base');

    errorHandler(err, reqApi(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    expect(consola).toHaveBeenCalledWith(err.stack);
  });

  test('en el panel responde con la página de error en vez de JSON', () => {
    const res = resFalso();

    errorHandler(new Error('falla'), reqPanel(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.render).toHaveBeenCalledWith('error', { titulo: 'Error' });
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('notFound', () => {
  test('en la API responde 404 en JSON', () => {
    const res = resFalso();

    notFound(reqApi({ originalUrl: '/no-existe' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Recurso no encontrado' });
  });

  test('en el panel muestra la página 404 con la ruta, sin el querystring', () => {
    const res = resFalso();

    notFound(reqPanel({ originalUrl: '/panel/no-existe?x=1' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.render).toHaveBeenCalledWith('404', { titulo: 'Página no encontrada', url: '/panel/no-existe' });
  });
});

describe('logger', () => {
  test('registra el método y la ruta de cada petición y deja seguir', () => {
    const consola = jest.spyOn(console, 'log').mockImplementation(() => {});
    const next = jest.fn();

    logger({ method: 'POST', originalUrl: '/entradas' }, resFalso(), next);

    expect(consola.mock.calls[0][0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T.*\] POST \/entradas$/);
    expect(next).toHaveBeenCalled();
    consola.mockRestore();
  });
});

describe('limitarAsistente', () => {
  const MAXIMO = 8;
  const UN_MINUTO = 60 * 1000;
  let reloj;
  let ahora;

  beforeEach(() => {
    ahora = 1_000_000;
    reloj = jest.spyOn(Date, 'now').mockImplementation(() => ahora);
  });
  afterEach(() => reloj.mockRestore());

  // Hace "veces" consultas como "clave" y devuelve el res de la última
  function consultar(req, veces = 1) {
    let res;
    let next;
    for (let i = 0; i < veces; i++) {
      res = resFalso();
      next = jest.fn();
      limitarAsistente(req, res, next);
    }
    return { res, next };
  }

  test(`deja pasar hasta ${MAXIMO} consultas por minuto`, () => {
    const { res, next } = consultar({ usuario: { id: 'u-pasa' } }, MAXIMO);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('la consulta siguiente responde 429 con Retry-After', () => {
    const req = { usuario: { id: 'u-frena' } };
    consultar(req, MAXIMO);
    ahora += 20 * 1000; // pasaron 20 segundos de la ventana

    const { res, next } = consultar(req);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.headers['Retry-After']).toBe('40');
    expect(res.json.mock.calls[0][0].error).toContain('40 segundos');
  });

  test('cuando vence la ventana, el usuario vuelve a tener cupo', () => {
    const req = { usuario: { id: 'u-vuelve' } };
    consultar(req, MAXIMO + 1);
    ahora += UN_MINUTO;

    const { next } = consultar(req);

    expect(next).toHaveBeenCalled();
  });

  test('cada usuario tiene su propio cupo', () => {
    consultar({ usuario: { id: 'u-gasta' } }, MAXIMO + 1);

    const { next } = consultar({ usuario: { id: 'u-otro' } });

    expect(next).toHaveBeenCalled();
  });

  test('sin usuario identificado, cuenta por IP', () => {
    consultar({ ip: '10.0.0.1' }, MAXIMO);

    expect(consultar({ ip: '10.0.0.1' }).res.status).toHaveBeenCalledWith(429);
    expect(consultar({ ip: '10.0.0.2' }).next).toHaveBeenCalled();
  });
});
