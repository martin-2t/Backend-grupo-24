// Las reglas de venta y las transiciones de estado viven en los models. Acá solo
// chequeamos la forma del body JSON y elegimos el código HTTP.
const entradasModel = require('../../models/entradas');
const eventosModel = require('../../models/eventos');
const clientesModel = require('../../models/clientes');

function getAllEntradas(req, res) {
  res.status(200).json(entradasModel.getAllEntradas());
}

function getEntradaById(req, res) {
  const entrada = entradasModel.getEntradaById(req.params.id);
  if (!entrada) {
    return res.status(404).json({ error: 'Entrada no encontrada' });
  }
  return res.status(200).json(entrada);
}

// Chequea la forma del body y que evento y cliente existan. Devuelve { error, status }
// o null si se puede seguir. Lo que no existe es 404; lo que está mal, 400.
function chequearReferencias(eventoId, clienteId) {
  if (!eventoId || typeof eventoId !== 'number') {
    return { error: 'El campo "eventoId" es obligatorio y debe ser un número', status: 400 };
  }
  if (!clienteId || typeof clienteId !== 'number') {
    return { error: 'El campo "clienteId" es obligatorio y debe ser un número', status: 400 };
  }
  if (!eventosModel.getEventoById(eventoId)) {
    return { error: 'El evento indicado no existe', status: 404 };
  }
  if (!clientesModel.getById(clienteId)) {
    return { error: 'El cliente indicado no existe', status: 404 };
  }
  return null;
}

// Crea una entrada con el estado que corresponda, aplicando las reglas del model
function crearEntrada(req, res, estado) {
  const { eventoId, clienteId, precio } = req.body;

  const referencias = chequearReferencias(eventoId, clienteId);
  if (referencias) {
    return res.status(referencias.status).json({ error: referencias.error });
  }

  const chequeo = eventosModel.validarVenta(eventoId, clienteId);
  if (chequeo.error) {
    return res.status(400).json({ error: chequeo.error });
  }

  // En la venta directa se puede pisar el precio; la reserva siempre toma el del evento
  const precioFinal =
    estado === 'VALIDA' && typeof precio === 'number' ? precio : chequeo.evento.precio;

  const nueva = entradasModel.createEntrada({ eventoId, clienteId, precio: precioFinal, estado });
  return res.status(201).json(nueva);
}

// Venta directa: crea la entrada ya como VALIDA
function crearVenta(req, res) {
  return crearEntrada(req, res, 'VALIDA');
}

// Reserva: crea la entrada como RESERVADA (ocupa el lugar, pero todavía no está vendida)
function crearReserva(req, res) {
  return crearEntrada(req, res, 'RESERVADA');
}

// Confirma una reserva existente, convirtiéndola en venta (RESERVADA -> VALIDA)
function confirmarReserva(req, res) {
  const entrada = entradasModel.getEntradaById(req.params.id);
  if (!entrada) {
    return res.status(404).json({ error: 'Entrada no encontrada' });
  }

  const error = entradasModel.validarConfirmacion(entrada);
  if (error) {
    return res.status(400).json({ error });
  }

  return res.status(200).json(entradasModel.updateEntradaById(req.params.id, { estado: 'VALIDA' }));
}

// Cancela una entrada (reservada o vendida) y libera el lugar
function cancelarEntrada(req, res) {
  const entrada = entradasModel.getEntradaById(req.params.id);
  if (!entrada) {
    return res.status(404).json({ error: 'Entrada no encontrada' });
  }

  const error = entradasModel.validarCancelacion(entrada);
  if (error) {
    return res.status(400).json({ error });
  }

  return res.status(200).json(entradasModel.updateEntradaById(req.params.id, { estado: 'CANCELADA' }));
}

// Edición de datos que no afectan el estado (por ejemplo, corregir el precio)
function updateEntrada(req, res) {
  const entrada = entradasModel.getEntradaById(req.params.id);
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

  const actualizada = entradasModel.updateEntradaById(req.params.id, { precio });
  return res.status(200).json(actualizada);
}

function deleteEntrada(req, res) {
  const eliminada = entradasModel.removeEntrada(req.params.id);
  if (!eliminada) {
    return res.status(404).json({ error: 'Entrada no encontrada' });
  }
  return res.status(204).send();
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
