const entradasModel = require('../models/entradas');
const eventosModel = require('../models/eventos');
const clientesModel = require('../models/clientes');
const salasModel = require('../models/salas');

// Cuenta los lugares ya ocupados de un evento (vendidos + reservados, porque ambos ocupan cupo)
function lugaresOcupados(eventoId) {
  return entradasModel
    .getEntradasByEvento(eventoId)
    .filter((e) => e.estado === 'VALIDA' || e.estado === 'RESERVADA').length;
}

// Valida datos comunes a reserva/venta y devuelve { error, status } o { evento, sala }
function validarDisponibilidad(eventoId, clienteId) {
  const evento = eventosModel.getEventoById(eventoId);
  if (!evento) {
    return { error: 'El evento indicado no existe', status: 404 };
  }
  if (evento.estado === 'FINALIZADO' || evento.estado === 'CANCELADO') {
    return { error: 'El evento ya finalizó o fue cancelado: no admite nuevas entradas', status: 400 };
  }

  const cliente = clientesModel.getById(clienteId);
  if (!cliente) {
    return { error: 'El cliente indicado no existe', status: 404 };
  }

  const sala = salasModel.getSalaById(evento.salaId);
  const ocupados = lugaresOcupados(eventoId);
  if (ocupados >= sala.capacidad) {
    return { error: 'No quedan lugares disponibles para este evento', status: 400 };
  }

  return { evento, sala };
}

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

// Venta directa: crea la entrada ya como VALIDA
function crearVenta(req, res) {
  const { eventoId, clienteId, precio } = req.body;

  if (!eventoId || typeof eventoId !== 'number') {
    return res.status(400).json({ error: 'El campo "eventoId" es obligatorio y debe ser un número' });
  }
  if (!clienteId || typeof clienteId !== 'number') {
    return res.status(400).json({ error: 'El campo "clienteId" es obligatorio y debe ser un número' });
  }

  const chequeo = validarDisponibilidad(eventoId, clienteId);
  if (chequeo.error) {
    return res.status(chequeo.status).json({ error: chequeo.error });
  }

  const precioFinal = typeof precio === 'number' ? precio : chequeo.evento.precio;
  const nueva = entradasModel.createEntrada({ eventoId, clienteId, precio: precioFinal, estado: 'VALIDA' });
  return res.status(201).json(nueva);
}

// Reserva: crea la entrada como RESERVADA (ocupa el lugar, pero todavía no está vendida)
function crearReserva(req, res) {
  const { eventoId, clienteId } = req.body;

  if (!eventoId || typeof eventoId !== 'number') {
    return res.status(400).json({ error: 'El campo "eventoId" es obligatorio y debe ser un número' });
  }
  if (!clienteId || typeof clienteId !== 'number') {
    return res.status(400).json({ error: 'El campo "clienteId" es obligatorio y debe ser un número' });
  }

  const chequeo = validarDisponibilidad(eventoId, clienteId);
  if (chequeo.error) {
    return res.status(chequeo.status).json({ error: chequeo.error });
  }

  const nueva = entradasModel.createEntrada({
    eventoId,
    clienteId,
    precio: chequeo.evento.precio,
    estado: 'RESERVADA',
  });
  return res.status(201).json(nueva);
}

// Confirma una reserva existente, convirtiéndola en venta (RESERVADA -> VALIDA)
function confirmarReserva(req, res) {
  const entrada = entradasModel.getEntradaById(req.params.id);
  if (!entrada) {
    return res.status(404).json({ error: 'Entrada no encontrada' });
  }
  if (entrada.estado !== 'RESERVADA') {
    return res.status(400).json({ error: 'Solo se pueden confirmar entradas en estado RESERVADA' });
  }

  const actualizada = entradasModel.updateEntradaById(req.params.id, { estado: 'VALIDA' });
  return res.status(200).json(actualizada);
}

// Cancela una entrada (reservada o vendida) y libera el lugar
function cancelarEntrada(req, res) {
  const entrada = entradasModel.getEntradaById(req.params.id);
  if (!entrada) {
    return res.status(404).json({ error: 'Entrada no encontrada' });
  }
  if (entrada.estado === 'CANCELADA') {
    return res.status(400).json({ error: 'La entrada ya estaba cancelada' });
  }

  const actualizada = entradasModel.updateEntradaById(req.params.id, { estado: 'CANCELADA' });
  return res.status(200).json(actualizada);
}

// Edición de datos que no afectan el estado (por ejemplo, corregir el precio)
function updateEntrada(req, res) {
  const entrada = entradasModel.getEntradaById(req.params.id);
  if (!entrada) {
    return res.status(404).json({ error: 'Entrada no encontrada' });
  }

  const { precio } = req.body;
  if (precio !== undefined && typeof precio !== 'number') {
    return res.status(400).json({ error: 'El campo "precio" debe ser un número' });
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
  lugaresOcupados,
};
