// Helpers que comparten todas las páginas del panel.
const eventosModel = require('../../models/eventos');
const salasModel = require('../../models/salas');
const clientesModel = require('../../models/clientes');
const entradasModel = require('../../models/entradas');
const { SOLO_LETRAS, LARGO_MINIMO } = require('../../models/formatos');

// Sin sesiones no hay flash messages, así que los avisos viajan por querystring
function volver(res, ruta, mensaje) {
  return res.redirect(ruta + '?ok=' + encodeURIComponent(mensaje));
}

function volverConError(res, ruta, mensaje) {
  return res.redirect(ruta + '?error=' + encodeURIComponent(mensaje));
}

// Locals que necesitan todas las vistas del panel. Los límites y formatos salen de
// los models: así el pattern del input y la validación del servidor no pueden decir
// cosas distintas.
function localesComunes(req, res, next) {
  res.locals.mensaje = req.query.ok || null;
  res.locals.alerta = req.query.error || null;
  res.locals.patronLetras = SOLO_LETRAS.source;
  res.locals.patronTelefono = '[0-9]{' + clientesModel.TELEFONO_MINIMO + ',}';
  res.locals.telefonoMinimo = clientesModel.TELEFONO_MINIMO;
  res.locals.largoMinimo = LARGO_MINIMO;
  res.locals.capacidadMinima = salasModel.CAPACIDAD_MINIMA;
  next();
}

function enriquecerEvento(evento) {
  const sala = salasModel.getSalaById(evento.salaId);
  const ocupados = entradasModel.lugaresOcupados(evento.id);
  const capacidad = sala ? sala.capacidad : 0;
  return {
    ...evento,
    sala: sala ? sala.nombre : 'Sala eliminada',
    salaEstado: sala ? sala.estado : null,
    capacidad,
    ocupados,
    disponibles: Math.max(capacidad - ocupados, 0),
  };
}

function enriquecerEntrada(entrada) {
  const evento = eventosModel.getEventoById(entrada.eventoId);
  const cliente = clientesModel.getById(entrada.clienteId);
  return {
    ...entrada,
    evento: evento ? evento.nombre : 'Evento eliminado',
    cliente: cliente ? cliente.nombre + ' ' + cliente.apellido : 'Cliente eliminado',
  };
}

// Solo las salas activas, pero sin perder la del evento si la dieron de baja
function salasElegibles(salaIdActual) {
  const activas = salasModel.activas();
  if (salaIdActual === undefined || activas.some((s) => s.id === Number(salaIdActual))) {
    return activas;
  }
  const actual = salasModel.getSalaById(salaIdActual);
  return actual ? [...activas, actual] : activas;
}

module.exports = { volver, volverConError, localesComunes, enriquecerEvento, enriquecerEntrada, salasElegibles };
