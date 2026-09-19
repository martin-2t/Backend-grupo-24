// Páginas de entradas. Renderiza vistas; las reglas viven en los models.
const entradasModel = require('../../models/entradas');
const eventosModel = require('../../models/eventos');
const clientesModel = require('../../models/clientes');
const { numero } = require('../../models/formatos');
const { volver, volverConError, enriquecerEvento, enriquecerEntrada } = require('./comunes');

function listar(req, res) {
  const filtros = {
    evento: req.query.evento || '',
    cliente: req.query.cliente || '',
    estado: req.query.estado || '',
  };

  let entradas = entradasModel.getAllEntradas();
  if (filtros.evento) entradas = entradas.filter((e) => e.eventoId === Number(filtros.evento));
  if (filtros.cliente) entradas = entradas.filter((e) => e.clienteId === Number(filtros.cliente));
  if (filtros.estado) entradas = entradas.filter((e) => e.estado === filtros.estado);

  res.render('entradas/list', {
    titulo: 'Entradas',
    entradas: entradas.map(enriquecerEntrada),
    filtros,
    eventos: eventosModel.getAllEventos(),
    clientes: clientesModel.getAll(),
    estados: ['VALIDA', 'RESERVADA', 'CANCELADA'],
  });
}

function datosFormularioEntrada(seleccionado) {
  return {
    eventos: eventosModel.programados().map(enriquecerEvento),
    clientes: clientesModel.getAll(),
    seleccionado: seleccionado ? String(seleccionado) : '',
  };
}

function nuevoForm(req, res) {
  res.render('entradas/form', {
    titulo: 'Vender o reservar entrada',
    ...datosFormularioEntrada(req.query.evento),
    valores: {},
    error: null,
  });
}

function crear(req, res) {
  // El botón que apretaron manda "accion": vender deja VALIDA, reservar deja RESERVADA
  const { eventoId, clienteId, accion } = req.body;
  const reservar = accion === 'reservar';

  function fallar(mensaje) {
    return res.status(400).render('entradas/form', {
      titulo: 'Vender o reservar entrada',
      ...datosFormularioEntrada(eventoId),
      valores: req.body,
      error: mensaje,
    });
  }

  if (isNaN(numero(eventoId))) return fallar('Elegí un evento.');
  if (isNaN(numero(clienteId))) return fallar('Elegí un cliente.');

  const chequeo = eventosModel.validarVenta(Number(eventoId), Number(clienteId));
  if (chequeo.error) return fallar(chequeo.error);

  const nueva = entradasModel.createEntrada({
    eventoId: Number(eventoId),
    clienteId: Number(clienteId),
    precio: chequeo.evento.precio,
    estado: reservar ? 'RESERVADA' : 'VALIDA',
  });

  volver(res, '/panel/entradas/' + nueva.id, reservar ? 'Reserva registrada.' : 'Venta registrada.');
}

function detalle(req, res, next) {
  const entrada = entradasModel.getEntradaById(req.params.id);
  if (!entrada) return next();

  const evento = eventosModel.getEventoById(entrada.eventoId);
  res.render('entradas/detail', {
    titulo: 'Entrada #' + entrada.id,
    entrada: enriquecerEntrada(entrada),
    evento: evento ? enriquecerEvento(evento) : null,
    cliente: clientesModel.getById(entrada.clienteId),
  });
}

function confirmar(req, res, next) {
  const entrada = entradasModel.getEntradaById(req.params.id);
  if (!entrada) return next();

  const impedimento = entradasModel.validarConfirmacion(entrada);
  if (impedimento) {
    return volverConError(res, '/panel/entradas/' + entrada.id, impedimento);
  }

  entradasModel.updateEntradaById(entrada.id, { estado: 'VALIDA' });
  volver(res, '/panel/entradas/' + entrada.id, 'Reserva confirmada: la entrada quedó vendida.');
}

function cancelar(req, res, next) {
  const entrada = entradasModel.getEntradaById(req.params.id);
  if (!entrada) return next();

  const impedimento = entradasModel.validarCancelacion(entrada);
  if (impedimento) {
    return volverConError(res, '/panel/entradas/' + entrada.id, impedimento);
  }

  entradasModel.updateEntradaById(entrada.id, { estado: 'CANCELADA' });
  volver(res, '/panel/entradas/' + entrada.id, 'Entrada cancelada: el lugar quedó liberado.');
}

function actualizarPrecio(req, res, next) {
  const entrada = entradasModel.getEntradaById(req.params.id);
  if (!entrada) return next();

  const error = entradasModel.validarPrecio(req.body.precio);
  if (error) {
    return volverConError(res, '/panel/entradas/' + entrada.id, error);
  }

  entradasModel.updateEntradaById(entrada.id, { precio: numero(req.body.precio) });
  volver(res, '/panel/entradas/' + entrada.id, 'Precio actualizado.');
}

function eliminar(req, res, next) {
  const entrada = entradasModel.getEntradaById(req.params.id);
  if (!entrada) return next();

  entradasModel.removeEntrada(entrada.id);
  volver(res, '/panel/entradas', 'Entrada #' + entrada.id + ' eliminada.');
}
module.exports = { listar, nuevoForm, crear, detalle, confirmar, cancelar, actualizarPrecio, eliminar };
