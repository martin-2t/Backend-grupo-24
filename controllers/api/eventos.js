// Las reglas de qué es un evento válido, y las transiciones de su estado, viven en
// el model. Acá solo elegimos el código HTTP con el que responder.
//
// Cada handler es async y envuelve su trabajo en try/catch: Express 4 no atrapa solo
// los errores de una función async, así que se los pasamos con next(error) al errorHandler.
const eventosModel = require('../../models/eventos');
const salasModel = require('../../models/salas');

// READ | Todos los eventos
async function listar(req, res, next) {
  try {
    res.status(200).json(await eventosModel.getAllEventos());
  } catch (error) {
    next(error);
  }
}

// READ | Un evento puntual
async function obtener(req, res, next) {
  try {
    const evento = await eventosModel.getEventoById(req.params.id);
    if (!evento) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }
    res.status(200).json(evento);
  } catch (error) {
    next(error);
  }
}

// READ | Próximos eventos (fecha futura y PROGRAMADO)
async function proximos(req, res, next) {
  try {
    res.status(200).json(await eventosModel.getEventosProximos());
  } catch (error) {
    next(error);
  }
}

// CREATE
async function crear(req, res, next) {
  try {
    const { nombre, descripcion, fecha, salaId, precio } = req.body;

    // Una sala inexistente es un 404; el resto de las reglas son un 400
    if (salaId !== undefined && !(await salasModel.getSalaById(salaId))) {
      return res.status(404).json({ error: 'La sala indicada no existe' });
    }

    const error = await eventosModel.validar({ nombre, fecha, salaId, precio });
    if (error) {
      return res.status(400).json({ error });
    }

    const nuevo = await eventosModel.createEvento({ nombre, descripcion, fecha, salaId, precio });
    res.status(201).json(nuevo);
  } catch (error) {
    next(error);
  }
}

// UPDATE | Actualización parcial
async function actualizar(req, res, next) {
  try {
    const evento = await eventosModel.getEventoById(req.params.id);
    if (!evento) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    // Validamos cómo quedaría el evento después del cambio. Pasarle el evento actual
    // permite corregir uno que ya pasó sin que la fecha futura lo bloquee.
    // toObject() convierte el documento de Mongoose en un objeto común para poder
    // combinarlo con el body.
    const error = await eventosModel.validar({ ...evento.toObject(), ...req.body }, evento);
    if (error) {
      return res.status(400).json({ error });
    }

    const { nombre, descripcion, fecha, salaId, precio } = req.body;
    const actualizado = await eventosModel.updateEventoById(evento.id, { nombre, descripcion, fecha, salaId, precio });
    res.status(200).json(actualizado);
  } catch (error) {
    next(error);
  }
}

// UPDATE | Marca el evento como finalizado (ya no admite ventas)
async function finalizar(req, res, next) {
  try {
    const evento = await eventosModel.getEventoById(req.params.id);
    if (!evento) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    const error = eventosModel.validarFinalizacion(evento);
    if (error) {
      return res.status(400).json({ error });
    }

    res.status(200).json(await eventosModel.finalizarEvento(evento.id));
  } catch (error) {
    next(error);
  }
}

// DELETE lógico | Cancela el evento y arrastra sus entradas (lo hace el model)
async function cancelar(req, res, next) {
  try {
    const evento = await eventosModel.getEventoById(req.params.id);
    if (!evento) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    const error = eventosModel.validarCancelacion(evento);
    if (error) {
      return res.status(400).json({ error });
    }

    res.status(200).json(await eventosModel.cancelarEvento(evento.id));
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, obtener, proximos, crear, actualizar, finalizar, cancelar };
