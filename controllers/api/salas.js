// Las reglas viven en los models. eventosModel entra porque la baja de una sala y
// el achique de su capacidad dependen de los eventos que tenga encima.
//
// Cada handler es async y envuelve su trabajo en try/catch: Express 4 no atrapa solo
// los errores de una función async, así que se los pasamos con next(error) al errorHandler.
const salasModel = require('../../models/salas');
const eventosModel = require('../../models/eventos');

async function getAllSalas(req, res, next) {
  try {
    res.status(200).json(await salasModel.getAllSalas());
  } catch (error) {
    next(error);
  }
}

async function getSalaById(req, res, next) {
  try {
    const salaBuscada = await salasModel.getSalaById(req.params.id);
    if (!salaBuscada) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }
    return res.status(200).json(salaBuscada);
  } catch (error) {
    next(error);
  }
}

async function getSalaByName(req, res, next) {
  try {
    const salaBuscada = await salasModel.getSalaByName(req.params.nombre);
    if (!salaBuscada) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }
    return res.status(200).json(salaBuscada);
  } catch (error) {
    next(error);
  }
}

async function createSala(req, res, next) {
  try {
    const { nombre, capacidad, direccion } = req.body;

    const error = await salasModel.validar({ nombre, capacidad, direccion });
    if (error) {
      return res.status(400).json({ error });
    }

    const nueva = await salasModel.createSala({ nombre, capacidad, direccion });
    return res.status(201).json(nueva);
  } catch (error) {
    next(error);
  }
}

async function updateSala(req, res, next) {
  try {
    const sala = await salasModel.getSalaById(req.params.id);
    if (!sala) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }

    const { nombre, capacidad, direccion } = req.body;
    const capacidadFinal = capacidad !== undefined ? capacidad : sala.capacidad;

    // El PUT es parcial: validamos cómo quedaría la sala, y que no se achique por
    // debajo de lo que ya se vendió en sus eventos. toObject() convierte el documento
    // de Mongoose en un objeto común para poder combinarlo con el body.
    const error =
      (await salasModel.validar({ ...sala.toObject(), ...req.body })) ||
      (await eventosModel.validarCapacidadDeSala(sala.id, capacidadFinal));
    if (error) {
      return res.status(400).json({ error });
    }

    const salaActualizada = await salasModel.updateSalaById(sala.id, { nombre, capacidad, direccion });
    return res.status(200).json(salaActualizada);
  } catch (error) {
    next(error);
  }
}

async function toggleSala(req, res, next) {
  try {
    const sala = await salasModel.getSalaById(req.params.id);
    if (!sala) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }

    const error = await eventosModel.validarCambioDeEstadoDeSala(sala);
    if (error) {
      return res.status(400).json({ error });
    }

    return res.status(200).json(await salasModel.toggleSalaById(sala.id));
  } catch (error) {
    next(error);
  }
}

module.exports = { getAllSalas, getSalaById, getSalaByName, createSala, updateSala, toggleSala };
