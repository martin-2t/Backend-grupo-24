// Páginas de entradas. Renderiza vistas; las reglas viven en los models.
const entradasModel = require('../../models/entradas');
const eventosModel = require('../../models/eventos');
const clientesModel = require('../../models/clientes');
const { numero } = require('../../models/formatos');
const { volver, volverConError, enriquecerEvento, enriquecerEntrada } = require('./comunes');

async function listar(req, res, next) {
  try {
    const filtros = {
      evento: req.query.evento || '',
      cliente: req.query.cliente || '',
      estado: req.query.estado || '',
    };

    let entradas = await entradasModel.getAllEntradas();
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
  } catch (error) {
    next(error);
  }
}

async function datosFormularioEntrada(seleccionado) {
  return {
    eventos: await Promise.all(eventosModel.programados().map(enriquecerEvento)),
    clientes: clientesModel.getAll(),
    seleccionado: seleccionado ? String(seleccionado) : '',
  };
}

async function nuevoForm(req, res, next) {
  try {
    res.render('entradas/form', {
      titulo: 'Vender o reservar entrada',
      ...(await datosFormularioEntrada(req.query.evento)),
      valores: {},
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  try {
    // El botón que apretaron manda "accion": vender deja VALIDA, reservar deja RESERVADA
    const { eventoId, clienteId, accion } = req.body;
    const reservar = accion === 'reservar';

    async function fallar(mensaje) {
      return res.status(400).render('entradas/form', {
        titulo: 'Vender o reservar entrada',
        ...(await datosFormularioEntrada(eventoId)),
        valores: req.body,
        error: mensaje,
      });
    }

    if (isNaN(numero(eventoId))) return fallar('Elegí un evento.');
    if (isNaN(numero(clienteId))) return fallar('Elegí un cliente.');

    const chequeo = await eventosModel.validarVenta(Number(eventoId), Number(clienteId));
    if (chequeo.error) return fallar(chequeo.error);

    const nueva = await entradasModel.createEntrada({
      eventoId: Number(eventoId),
      clienteId: Number(clienteId),
      precio: chequeo.evento.precio,
      estado: reservar ? 'RESERVADA' : 'VALIDA',
    });

    volver(res, '/panel/entradas/' + nueva.id, reservar ? 'Reserva registrada.' : 'Venta registrada.');
  } catch (error) {
    next(error);
  }
}

async function detalle(req, res, next) {
  try {
    const entrada = entradasModel.getEntradaById(req.params.id);
    if (!entrada) return next();

    const evento = eventosModel.getEventoById(entrada.eventoId);
    res.render('entradas/detail', {
      titulo: 'Entrada #' + entrada.id,
      entrada: enriquecerEntrada(entrada),
      evento: evento ? await enriquecerEvento(evento) : null,
      cliente: clientesModel.getById(entrada.clienteId),
    });
  } catch (error) {
    next(error);
  }
}

async function confirmar(req, res, next) {
  try {
    const entrada = await entradasModel.getEntradaById(req.params.id);
    if (!entrada) return next();

    const impedimento = entradasModel.validarConfirmacion(entrada);
    if (impedimento) {
      return volverConError(res, '/panel/entradas/' + entrada.id, impedimento);
    }

    await entradasModel.updateEntradaById(entrada.id, { estado: 'VALIDA' });
    volver(res, '/panel/entradas/' + entrada.id, 'Reserva confirmada: la entrada quedó vendida.');
  } catch (error) {
    next(error);
  }
}

async function cancelar(req, res, next) {
  try {
    const entrada = await entradasModel.getEntradaById(req.params.id);
    if (!entrada) return next();

    const impedimento = entradasModel.validarCancelacion(entrada);
    if (impedimento) {
      return volverConError(res, '/panel/entradas/' + entrada.id, impedimento);
    }

    await entradasModel.updateEntradaById(entrada.id, { estado: 'CANCELADA' });
    volver(res, '/panel/entradas/' + entrada.id, 'Entrada cancelada: el lugar quedó liberado.');
  } catch (error) {
    next(error);
  }
}

async function actualizarPrecio(req, res, next) {
  try {
    const entrada = await entradasModel.getEntradaById(req.params.id);
    if (!entrada) return next();

    const error = entradasModel.validarPrecio(req.body.precio);
    if (error) {
      return volverConError(res, '/panel/entradas/' + entrada.id, error);
    }

    await entradasModel.updateEntradaById(entrada.id, { precio: numero(req.body.precio) });
    volver(res, '/panel/entradas/' + entrada.id, 'Precio actualizado.');
  } catch (error) {
    next(error);
  }
}
async function eliminar(req, res, next) {
  try {
    const entrada = await entradasModel.getEntradaById(req.params.id);
    if (!entrada) return next();

    await entradasModel.removeEntrada(entrada.id);
    volver(res, '/panel/entradas', 'Entrada #' + entrada.id + ' eliminada.');
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, nuevoForm, crear, detalle, confirmar, cancelar, actualizarPrecio, eliminar };
