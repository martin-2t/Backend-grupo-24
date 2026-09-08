// Importa las funciones del modelo de clientes 
const clientesModel = require('../models/clientes');

// devuelve todos los clientes
function listar(req, res) {
  res.status(200).json(clientesModel.getAll());
}

// devuelve un cliente puntual
function obtener(req, res) {
  const cliente = clientesModel.getById(req.params.id); // req.params.id viene de la URL

  if (!cliente) {
    // Si no existe, respondemos 404 (no encontrado) con un mensaje claro
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }

  res.status(200).json(cliente);
}

// crea un cliente nuevo
function crear(req, res) {
  
  const { nombre, apellido, email, telefono } = req.body;

  // Valida que el nombre exista 
  if (!nombre || typeof nombre !== 'string') {
    return res.status(400).json({ error: 'El campo "nombre" es obligatorio y debe ser texto' });
  }

  // Valida que el apellido exista 
  if (!apellido || typeof apellido !== 'string') {
    return res.status(400).json({ error: 'El campo "apellido" es obligatorio y debe ser texto' });
  }

  // Valida que el email exista
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'El campo "email" es obligatorio y debe ser un email válido' });
  }

  // Si pasó todas las validaciones, crea el cliente en el modelo
  const nuevo = clientesModel.create({ nombre, apellido, email, telefono });

  // recurso nuevo
  res.status(201).json(nuevo);
}

// actualiza un cliente existente
function actualizar(req, res) {
  const cliente = clientesModel.getById(req.params.id);

  if (!cliente) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }

  const { nombre, apellido, email, telefono } = req.body;

  // validamos que tenga formato correcto 
  if (email !== undefined && (typeof email !== 'string' || !email.includes('@'))) {
    return res.status(400).json({ error: 'El email debe tener un formato válido' });
  }

  // Actualiza solo los campos que vinieron en el body
  const actualizado = clientesModel.update(req.params.id, { nombre, apellido, email, telefono });

  res.status(200).json(actualizado);
}

// elimina un cliente
function eliminar(req, res) {
  const eliminado = clientesModel.remove(req.params.id);

  if (!eliminado) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }

  // se eliminó correctamente
  res.status(204).send();
}

// Exporta las funciones para que routes/clientes.js las use
module.exports = { listar, obtener, crear, actualizar, eliminar };