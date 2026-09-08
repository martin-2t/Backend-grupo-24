// Importacion de funciones del modelo de Salas
const salasModel = require('../models/salas');

// READ | Retorna todas las Salas
function getAllSalas(req, res){
    // Retornamos el Status Code 200 OK y la Lista
    res.status(200).json(salasModel.getAllSalas());
}

// READ | Retorna la sala con el Id enviado por parametro por el usuario
function getSalaById(req, res){
    const salaBuscada = salasModel.getSalaById(req.params.id);

    // En caso de no encontrar la sala con el ID indicado, retornar mensaje de error
    if(!salaBuscada){
      return res.status(404).json({ error: 'Sala no encontrada'});
    }

    // Retornamos el Status Code 200 OK y la Sala
    return res.status(200).json(salaBuscada);
}

// READ | Retorna la Sala con el nombre enviado por parametro por el usuario
function getSalaByName(req, res){
    const salaBuscada = salasModel.getSalaByName(req.params.nombre);

    // En caso de no encontrar la sala con el NOMBRE indicado, retornar mensaje de error
    if(!salaBuscada){
        return res.status(404).json({ error: 'Sala no encontrada'});
    }

    // Retornamos el Status Code 200 OK y la Sala
    return res.status(200).json(salaBuscada);
}

// CREATE | Crea una nueva Sala con los datos enviados por el usuario
function createSala(req, res){
    const { nombre, capacidad, direccion } = req.body;

  // Validamos que el usuario haya ingresado todos los datos obligatorios 
  if (!nombre || typeof nombre !== 'string') {
    return res.status(400).json({ error: 'El campo "nombre" es obligatorio y debe ser texto' });
  }

  if (!capacidad || typeof capacidad !== 'number') {
    return res.status(400).json({ error: 'El campo "capacidad" es obligatorio y debe ser un numero entero' });
  }

  if (!direccion || typeof direccion !== 'string' ) {
    return res.status(400).json({ error: 'El campo "direccion" es obligatorio y debe ser texto' });
  }

  // Creamos la sala
  const nuevo = salasModel.createSala({ nombre, capacidad, direccion });

  // Retornamos el Status Code Created 201 y la Sala
  return res.status(201).json(nuevo);
}

// UPDATE | Actualiza una Sala existente con los datos ingresado por el usuario
function updateSala(req, res) {
  const sala = salasModel.getSalaById(req.params.id);

  // En caso de no encontrar la sala con el ID indicado, retornar mensaje de error
  if (!sala) {
    return res.status(404).json({ error: 'Sala no encontrada' });
  }

  const { nombre, capacidad, direccion } = req.body;

  // Como el Update es parcial, solo validamos los campos que el usuario decidió enviar.
  // Si el campo no vino en el body (undefined), no lo validamos ni lo tocamos.
  if (nombre !== undefined && typeof nombre !== 'string') {
    return res.status(400).json({ error: 'El campo "nombre" debe ser texto' });
  }

  if (capacidad !== undefined && typeof capacidad !== 'number') {
    return res.status(400).json({ error: 'El campo "capacidad" debe ser un numero entero' });
  }

  if (direccion !== undefined && typeof direccion !== 'string' ) {
    return res.status(400).json({ error: 'El campo "direccion" debe ser texto' });
  }

  // Utilizamos los datos ingresados por el usuario para realizar la modificacion de la Sala
  const salaActualizada = salasModel.updateSalaById(req.params.id, {nombre, capacidad, direccion});

  // etornamos el Status Code OK 200 y la Sala actualizada
  return res.status(200).json(salaActualizada);
}

// "DELETE" | Deshabilita una Sala (Borrado lógico)
function toggleSala(req, res){
    const salaInactiva = salasModel.toggleSalaById(req.params.id);

    // En caso de no encontrar la sala con el ID indicado, retornar mensaje de error
    if (!salaInactiva) {
        return res.status(404).json({ error: 'Sala no encontrada' });
    }

    // Retornamos el Status Code 200 y la Sala Inactiva
    return res.status(200).json(salaInactiva);
}

// Exportamos las funciones de Controller para salaRoutes
module.exports = { getAllSalas, getSalaById, getSalaByName, createSala, updateSala, toggleSala }