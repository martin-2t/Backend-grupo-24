const salasModel = require('../models/salas');

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

  if (!nombre || typeof nombre !== 'string') {
    return res.status(400).json({ error: 'El campo "nombre" es obligatorio y debe ser texto' });
  }
  if (!capacidad || typeof capacidad !== 'number') {
    return res.status(400).json({ error: 'El campo "capacidad" es obligatorio y debe ser un numero entero' });
  }
  if (!direccion || typeof direccion !== 'string') {
    return res.status(400).json({ error: 'El campo "direccion" es obligatorio y debe ser texto' });
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

  if (nombre !== undefined && typeof nombre !== 'string') {
    return res.status(400).json({ error: 'El campo "nombre" debe ser texto' });
  }
  if (capacidad !== undefined && typeof capacidad !== 'number') {
    return res.status(400).json({ error: 'El campo "capacidad" debe ser un numero entero' });
  }
  if (direccion !== undefined && typeof direccion !== 'string') {
    return res.status(400).json({ error: 'El campo "direccion" debe ser texto' });
  }

  const salaActualizada = salasModel.updateSalaById(req.params.id, { nombre, capacidad, direccion });
  return res.status(200).json(salaActualizada);
}

function toggleSala(req, res) {
  const salaInactiva = salasModel.toggleSalaById(req.params.id);
  if (!salaInactiva) {
    return res.status(404).json({ error: 'Sala no encontrada' });
  }
  return res.status(200).json(salaInactiva);
}

module.exports = { getAllSalas, getSalaById, getSalaByName, createSala, updateSala, toggleSala };
