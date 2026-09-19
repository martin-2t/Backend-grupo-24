// Las reglas de qué es un cliente válido viven en el model, así la API y el panel
// aplican exactamente las mismas. Acá solo traducimos a códigos HTTP.
const clientesModel = require('../../models/clientes');

// devuelve todos los clientes
function listar(req, res) {
  res.status(200).json(clientesModel.getAll());
}

// devuelve un cliente puntual
function obtener(req, res) {
  const cliente = clientesModel.getById(req.params.id); // req.params.id viene de la URL

  if (!cliente) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }

  res.status(200).json(cliente);
}

// crea un cliente nuevo
function crear(req, res) {
  const { nombre, apellido, email, telefono } = req.body;

  const error = clientesModel.validar({ nombre, apellido, email, telefono });
  if (error) {
    return res.status(400).json({ error });
  }

  const nuevo = clientesModel.create({ nombre, apellido, email, telefono });
  res.status(201).json(nuevo);
}

// actualiza un cliente existente
function actualizar(req, res) {
  const cliente = clientesModel.getById(req.params.id);

  if (!cliente) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }

  // El PUT es parcial, así que validamos cómo quedaría el cliente después del
  // cambio y no solo los campos que vinieron en el body
  const error = clientesModel.validar({ ...cliente, ...req.body });
  if (error) {
    return res.status(400).json({ error });
  }

  const { nombre, apellido, email, telefono } = req.body;
  const actualizado = clientesModel.update(req.params.id, { nombre, apellido, email, telefono });

  res.status(200).json(actualizado);
}

// elimina un cliente
function eliminar(req, res) {
  const cliente = clientesModel.getById(req.params.id);

  if (!cliente) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }

  // El borrado es físico: una entrada sin titular quedaría huérfana
  if (clientesModel.tieneEntradasVigentes(cliente.id)) {
    return res.status(400).json({
      error: 'El cliente tiene entradas vigentes: cancelalas antes de eliminarlo',
    });
  }

  clientesModel.remove(cliente.id);
  res.status(204).send();
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
