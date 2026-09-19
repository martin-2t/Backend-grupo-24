// Las reglas viven en los models. eventosModel entra porque la baja de una sala y
// el achique de su capacidad dependen de los eventos que tenga encima.
const salasModel = require('../../models/salas');
const eventosModel = require('../../models/eventos');

function getAllSalas(req, res) {
  res.status(200).json(salasModel.getAllSalas());
}

function getSalaById(req, res) {
  const salaBuscada = salasModel.getSalaById(req.params.id);
  if (!salaBuscada) {
    return res.status(404).json({ error: 'Sala no encontrada' });
  }
  return res.status(200).json(salaBuscada);
}

function getSalaByName(req, res) {
  const salaBuscada = salasModel.getSalaByName(req.params.nombre);
  if (!salaBuscada) {
    return res.status(404).json({ error: 'Sala no encontrada' });
  }
  return res.status(200).json(salaBuscada);
}

function createSala(req, res) {
  const { nombre, capacidad, direccion } = req.body;

  const error = salasModel.validar({ nombre, capacidad, direccion });
  if (error) {
    return res.status(400).json({ error });
  }

  const nuevo = salasModel.createSala({ nombre, capacidad, direccion });
  return res.status(201).json(nuevo);
}

function updateSala(req, res) {
  const sala = salasModel.getSalaById(req.params.id);
  if (!sala) {
    return res.status(404).json({ error: 'Sala no encontrada' });
  }

  const { nombre, capacidad, direccion } = req.body;
  const capacidadFinal = capacidad !== undefined ? capacidad : sala.capacidad;

  // El PUT es parcial: validamos cómo quedaría la sala, y que no se achique por
  // debajo de lo que ya se vendió en sus eventos
  const error =
    salasModel.validar({ ...sala, ...req.body }) ||
    eventosModel.validarCapacidadDeSala(sala.id, capacidadFinal);
  if (error) {
    return res.status(400).json({ error });
  }

  const salaActualizada = salasModel.updateSalaById(req.params.id, { nombre, capacidad, direccion });
  return res.status(200).json(salaActualizada);
}

function toggleSala(req, res) {
  const sala = salasModel.getSalaById(req.params.id);
  if (!sala) {
    return res.status(404).json({ error: 'Sala no encontrada' });
  }

  const error = eventosModel.validarCambioDeEstadoDeSala(sala);
  if (error) {
    return res.status(400).json({ error });
  }

  return res.status(200).json(salasModel.toggleSalaById(sala.id));
}

module.exports = { getAllSalas, getSalaById, getSalaByName, createSala, updateSala, toggleSala };
