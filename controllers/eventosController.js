const eventosModel = require('../models/eventos');
const salasModel = require('../models/salas');

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

  if (!nombre || typeof nombre !== 'string') {
    return res.status(400).json({ error: 'El campo "nombre" es obligatorio y debe ser texto' });
  }
  if (!fecha || isNaN(new Date(fecha).getTime())) {
    return res.status(400).json({ error: 'El campo "fecha" es obligatorio y debe ser una fecha válida' });
  }
  if (salaId === undefined || typeof salaId !== 'number') {
    return res.status(400).json({ error: 'El campo "salaId" es obligatorio y debe ser un número' });
  }
  if (precio === undefined || typeof precio !== 'number') {
    return res.status(400).json({ error: 'El campo "precio" es obligatorio y debe ser un número' });
  }

  // Regla de negocio: cada evento pertenece a una sala que debe existir
  const sala = salasModel.getSalaById(salaId);
  if (!sala) {
    return res.status(404).json({ error: 'La sala indicada no existe' });
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

  const { nombre, descripcion, fecha, salaId, precio } = req.body;

  if (nombre !== undefined && typeof nombre !== 'string') {
    return res.status(400).json({ error: 'El campo "nombre" debe ser texto' });
  }
  if (fecha !== undefined && isNaN(new Date(fecha).getTime())) {
    return res.status(400).json({ error: 'El campo "fecha" debe ser una fecha válida' });
  }
  if (salaId !== undefined) {
    if (typeof salaId !== 'number' || !salasModel.getSalaById(salaId)) {
      return res.status(400).json({ error: 'El campo "salaId" debe corresponder a una sala existente' });
    }
  }
  if (precio !== undefined && typeof precio !== 'number') {
    return res.status(400).json({ error: 'El campo "precio" debe ser un número' });
  }

  const actualizado = eventosModel.updateEventoById(req.params.id, { nombre, descripcion, fecha, salaId, precio });
  res.status(200).json(actualizado);
}

// UPDATE | Marca el evento como finalizado (ya no admite ventas)
function finalizar(req, res) {
  const evento = eventosModel.getEventoById(req.params.id);
  if (!evento) {
    return res.status(404).json({ error: 'Evento no encontrado' });
  }
  const actualizado = eventosModel.finalizarEvento(req.params.id);
  res.status(200).json(actualizado);
}

// DELETE lógico | Cancela el evento
function cancelar(req, res) {
  const evento = eventosModel.getEventoById(req.params.id);
  if (!evento) {
    return res.status(404).json({ error: 'Evento no encontrado' });
  }
  const actualizado = eventosModel.cancelarEvento(req.params.id);
  res.status(200).json(actualizado);
}

module.exports = { listar, obtener, proximos, crear, actualizar, finalizar, cancelar };
