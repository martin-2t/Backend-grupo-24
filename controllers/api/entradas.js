//Las reglas de venta y las transiciones de estado viven en los models. Acá solo
//chequeamos la forma del body JSON y elegimos el código HTTP.

//Cada handler es async y envuelve su trabajo en try/catch: Express 4 no atrapa solo
//los errores de una función async, así que se los pasamos con next(error) al errorHandler.
const entradasModel = require('../../models/entradas');
const eventosModel = require('../../models/eventos');
const clientesModel = require('../../models/clientes');

async function getAllEntradas(req, res, next) {
  try {
    res.status(200).json(await entradasModel.getAllEntradas());
  } catch (error) {
    next(error);
  }
}

async function getEntradaById(req, res, next) {
  try {
    const entrada = await entradasModel.getEntradaById(req.params.id);
    if (!entrada) {
      return res.status(404).json({ error: 'Entrada no encontrada' });
    }
    return res.status(200).json(entrada);
  } catch (error) {
    next(error);
  }
}

//Chequea la forma del body y que evento y cliente existan. Devuelve { error, status }
//o null si se puede seguir. Lo que no existe es 404; lo que está mal, 400.
async function chequearReferencias(eventoId, clienteId) {
  // eventoId es el _id (ObjectId) del evento en MongoDB, que viaja como texto
  if (!eventoId || typeof eventoId !== 'string') {
    return { error: 'El campo "eventoId" es obligatorio y debe ser un texto (el id del evento)', status: 400 };
  }
  // clienteId es el _id (ObjectId) del cliente en MongoDB, que viaja como texto
  if (!clienteId || typeof clienteId !== 'string') {
    return { error: 'El campo "clienteId" es obligatorio y debe ser un texto (el id del cliente)', status: 400 };
  }
  if (!(await eventosModel.getEventoById(eventoId))) {
    return { error: 'El evento indicado no existe', status: 404 };
  }
  if (!(await clientesModel.getById(clienteId))) {
    return { error: 'El cliente indicado no existe', status: 404 };
  }
  return null;
}

//Crea una entrada con el estado que corresponda, aplicando las reglas del model
async function crearEntrada(req, res, next, estado) {
  try {
    const { eventoId, clienteId, precio } = req.body;

    const referencias = await chequearReferencias(eventoId, clienteId);
    if (referencias) {
      return res.status(referencias.status).json({ error: referencias.error });
    }

    const chequeo = await eventosModel.validarVenta(eventoId, clienteId);
    if (chequeo.error) {
      return res.status(400).json({ error: chequeo.error });
    }

    //En la venta directa se puede pisar el precio; la reserva siempre toma el del evento
    const precioFinal =
      estado === 'VALIDA' && typeof precio === 'number' ? precio : chequeo.evento.precio;

    const nueva = await entradasModel.createEntrada({ eventoId, clienteId, precio: precioFinal, estado });
    return res.status(201).json(nueva);
  } catch (error) {
    next(error);
  }
}

//Venta directa: crea la entrada ya como VALIDA
function crearVenta(req, res, next) {
  return crearEntrada(req, res, next, 'VALIDA');
}

//Reserva: crea la entrada como RESERVADA (ocupa el lugar, pero todavía no está vendida)
function crearReserva(req, res, next) {
  return crearEntrada(req, res, next, 'RESERVADA');
}

//Confirma una reserva existente, convirtiéndola en venta (RESERVADA -> VALIDA)
async function confirmarReserva(req, res, next) {
  try {
    const entrada = await entradasModel.getEntradaById(req.params.id);
    if (!entrada) {
      return res.status(404).json({ error: 'Entrada no encontrada' });
    }

    const error = entradasModel.validarConfirmacion(entrada);
    if (error) {
      return res.status(400).json({ error });
    }

    return res.status(200).json(await entradasModel.updateEntradaById(req.params.id, { estado: 'VALIDA' }));
  } catch (error) {
    next(error);
  }
}

//Cancela una entrada (reservada o vendida) y libera el lugar
async function cancelarEntrada(req, res, next) {
  try {
    const entrada = await entradasModel.getEntradaById(req.params.id);
    if (!entrada) {
      return res.status(404).json({ error: 'Entrada no encontrada' });
    }

    const error = entradasModel.validarCancelacion(entrada);
    if (error) {
      return res.status(400).json({ error });
    }

    return res.status(200).json(await entradasModel.updateEntradaById(req.params.id, { estado: 'CANCELADA' }));
  } catch (error) {
    next(error);
  }
}

//Edición de datos que no afectan el estado (por ejemplo, corregir el precio)
async function updateEntrada(req, res, next) {
  try {
    const entrada = await entradasModel.getEntradaById(req.params.id);
    if (!entrada) {
      return res.status(404).json({ error: 'Entrada no encontrada' });
    }

    const { precio } = req.body;
    if (precio !== undefined) {
      const error = entradasModel.validarPrecio(precio);
      if (error) {
        return res.status(400).json({ error });
      }
    }

    const actualizada = await entradasModel.updateEntradaById(req.params.id, { precio });
    return res.status(200).json(actualizada);
  } catch (error) {
    next(error);
  }
}

async function deleteEntrada(req, res, next) {
  try {
    const eliminada = await entradasModel.removeEntrada(req.params.id);
    if (!eliminada) {
      return res.status(404).json({ error: 'Entrada no encontrada' });
    }
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllEntradas,
  getEntradaById,
  crearVenta,
  crearReserva,
  confirmarReserva,
  cancelarEntrada,
  updateEntrada,
  deleteEntrada,
};