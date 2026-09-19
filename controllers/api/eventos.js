// Las reglas de qué es un evento válido, y las transiciones de su estado, viven en
// el model. Acá solo elegimos el código HTTP con el que responder.
const eventosModel = require('../../models/eventos');
const salasModel = require('../../models/salas');

// READ | Todos los eventos
function listar(req, res) {
  res.status(200).json(eventosModel.getAllEventos());
}

// READ | Un evento puntual
function obtener(req, res) {
  const evento = eventosModel.getEventoById(req.params.id);
  if (!evento) {
    return res.status(404).json({ error: 'Evento no encontrado' });
  }
  res.status(200).json(evento);
}

// READ | Próximos eventos (fecha futura y PROGRAMADO)
function proximos(req, res) {
  res.status(200).json(eventosModel.getEventosProximos());
}

// CREATE
function crear(req, res) {
  const { nombre, descripcion, fecha, salaId, precio } = req.body;

  // Una sala inexistente es un 404; el resto de las reglas son un 400
  if (salaId !== undefined && !salasModel.getSalaById(salaId)) {
    return res.status(404).json({ error: 'La sala indicada no existe' });
  }

  const error = eventosModel.validar({ nombre, fecha, salaId, precio });
  if (error) {
    return res.status(400).json({ error });
  }

  const nuevo = eventosModel.createEvento({ nombre, descripcion, fecha, salaId, precio });
  res.status(201).json(nuevo);
}

// UPDATE | Actualización parcial
function actualizar(req, res) {
  const evento = eventosModel.getEventoById(req.params.id);
  if (!evento) {
    return res.status(404).json({ error: 'Evento no encontrado' });
  }

  // Validamos cómo quedaría el evento después del cambio. Pasarle el evento actual
  // permite corregir uno que ya pasó sin que la fecha futura lo bloquee.
  const error = eventosModel.validar({ ...evento, ...req.body }, evento);
  if (error) {
    return res.status(400).json({ error });
  }

  const { nombre, descripcion, fecha, salaId, precio } = req.body;
  const actualizado = eventosModel.updateEventoById(req.params.id, { nombre, descripcion, fecha, salaId, precio });
  res.status(200).json(actualizado);
}

// UPDATE | Marca el evento como finalizado (ya no admite ventas)
function finalizar(req, res) {
  const evento = eventosModel.getEventoById(req.params.id);
  if (!evento) {
    return res.status(404).json({ error: 'Evento no encontrado' });
  }

  const error = eventosModel.validarFinalizacion(evento);
  if (error) {
    return res.status(400).json({ error });
  }

  res.status(200).json(eventosModel.finalizarEvento(req.params.id));
}

// DELETE lógico | Cancela el evento y arrastra sus entradas (lo hace el model)
function cancelar(req, res) {
  const evento = eventosModel.getEventoById(req.params.id);
  if (!evento) {
    return res.status(404).json({ error: 'Evento no encontrado' });
  }

  const error = eventosModel.validarCancelacion(evento);
  if (error) {
    return res.status(400).json({ error });
  }

  res.status(200).json(eventosModel.cancelarEvento(req.params.id));
}

module.exports = { listar, obtener, proximos, crear, actualizar, finalizar, cancelar };
