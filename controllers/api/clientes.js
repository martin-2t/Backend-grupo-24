// Las reglas de qué es un cliente válido viven en el model (Schema), así la API y el panel
// aplican exactamente las mismas. Acá solo traducimos a códigos HTTP.
// Los errores de Mongoose (ValidationError, CastError) los traduce errorHandler a 400.
import * as clientesModel from '../../models/clientes.js';

// devuelve todos los clientes
async function listar(req, res, next) {
  try {
    res.status(200).json(await clientesModel.getAll());
  } catch (error) {
    next(error);
  }
}

// devuelve un cliente puntual
async function obtener(req, res, next) {
  try {
    const cliente = await clientesModel.getById(req.params.id); // req.params.id viene de la URL

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.status(200).json(cliente);
  } catch (error) {
    next(error);
  }
}

// crea un cliente nuevo
async function crear(req, res, next) {
  try {
    const { nombre, apellido, email, telefono } = req.body;
    const nuevo = await clientesModel.create({ nombre, apellido, email, telefono });
    res.status(201).json(nuevo);
  } catch (error) {
    next(error);
  }
}

// actualiza un cliente existente
async function actualizar(req, res, next) {
  try {
    const { nombre, apellido, email, telefono } = req.body;
    // El PUT es parcial: el model pisa solo lo que vino y valida el cliente completo al guardar
    const actualizado = await clientesModel.update(req.params.id, { nombre, apellido, email, telefono });

    if (!actualizado) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.status(200).json(actualizado);
  } catch (error) {
    next(error);
  }
}

// elimina un cliente
async function eliminar(req, res, next) {
  try {
    const cliente = await clientesModel.getById(req.params.id);

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // El borrado es físico: una entrada sin titular quedaría huérfana
    if (await clientesModel.tieneEntradasVigentes(cliente.id)) {
      return res.status(400).json({
        error: 'El cliente tiene entradas vigentes: cancelalas antes de eliminarlo',
      });
    }

    await clientesModel.remove(cliente.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export { listar, obtener, crear, actualizar, eliminar };
