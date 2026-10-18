// Control de acceso por atributos (ABAC): un EMPLEADO solo opera sobre su propio centro.
// Se usa después de autenticar y permitir. ADMIN y CLIENTE no tienen esta restricción.
//
// Los "obtenedores" de abajo devuelven las salas que involucra cada petición. Usan await
// aunque algún model todavía sea sincrónico: así siguen funcionando cuando migren a Mongo.
import * as salasModel from '../models/salas.js';
import * as eventosModel from '../models/eventos.js';
import * as entradasModel from '../models/entradas.js';

// Recibe una función que, dada la petición, devuelve las salas involucradas.
// Si devuelve null, el recurso no existe: dejamos pasar y el controller responde 404.
function soloSuCentro(obtenerSalas) {
  return async (req, res, next) => {
    try {
      if (req.usuario.rol !== 'EMPLEADO') return next();

      const salas = await obtenerSalas(req);
      if (salas === null) return next();

      const ajenas = salas.filter((salaId) => String(salaId) !== String(req.usuario.salaId));
      if (ajenas.length) {
        return res.status(403).json({ error: 'Solo podés operar sobre tu propio centro.' });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

// PUT /salas/:id
async function salaDelParametro(req) {
  return (await salasModel.getSalaById(req.params.id)) ? [req.params.id] : null;
}

// POST /eventos: la sala viene en el body. Sin salaId, el controller responde 400.
async function salaDelBody(req) {
  return req.body.salaId ? [req.body.salaId] : [];
}

// PUT /eventos/:id (y finalizar/cancelar): la sala actual del evento y, si lo mudan, la nueva
async function salasDelEvento(req) {
  const evento = await eventosModel.getEventoById(req.params.id);
  if (!evento) return null;
  return req.body.salaId ? [evento.salaId, req.body.salaId] : [evento.salaId];
}

// POST /entradas y /entradas/reservar: la sala del evento al que se le vende
async function salaDelEventoDelBody(req) {
  const evento = await eventosModel.getEventoById(req.body.eventoId);
  return evento ? [evento.salaId] : null;
}

// PUT /entradas/:id (y confirmar/cancelar): entrada → evento → sala
async function salaDeLaEntrada(req) {
  const entrada = await entradasModel.getEntradaById(req.params.id);
  if (!entrada) return null;
  const evento = await eventosModel.getEventoById(entrada.eventoId);
  return evento ? [evento.salaId] : null;
}

export {
  soloSuCentro,
  salaDelParametro,
  salaDelBody,
  salasDelEvento,
  salaDelEventoDelBody,
  salaDeLaEntrada,
};
