// Páginas de eventos. Renderiza vistas; las reglas viven en los models.
const eventosModel = require('../../models/eventos');
const entradasModel = require('../../models/entradas');
const { volver, volverConError, enriquecerEvento, enriquecerEntrada, salasElegibles } = require('./comunes');

async function listar(req, res, next) {
  try {
    res.render('eventos/list', {
      titulo: 'Eventos',
      eventos: await Promise.all(eventosModel.getAllEventos().map(enriquecerEvento)),
    });
  } catch (error) {
    next(error);
  }
}

async function nuevoForm(req, res, next) {
  try {
    res.render('eventos/form', {
      titulo: 'Nuevo evento',
      evento: null,
      accion: '/panel/eventos/nuevo',
      salas: await salasElegibles(),
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  try {
    const error = await eventosModel.validar(req.body);
    if (error) {
      // Devolvemos el form con lo que había cargado para no hacerle tipear todo de nuevo
      return res.status(400).render('eventos/form', {
        titulo: 'Nuevo evento',
        evento: req.body,
        accion: '/panel/eventos/nuevo',
        salas: await salasElegibles(),
        error,
      });
    }

    // salaId ya no es un número: es el ObjectId de la sala en MongoDB, como texto
    const { nombre, descripcion, fecha, salaId, precio } = req.body;
    const nuevo = eventosModel.createEvento({
      nombre,
      descripcion,
      fecha,
      salaId,
      precio: Number(precio),
    });
    volver(res, '/panel/eventos/' + nuevo.id, 'Evento creado correctamente.');
  } catch (error) {
    next(error);
  }
}

async function detalle(req, res, next) {
  try {
    const evento = eventosModel.getEventoById(req.params.id);
    if (!evento) return next();

    res.render('eventos/detail', {
      titulo: evento.nombre,
      evento: await enriquecerEvento(evento),
      entradas: entradasModel.getEntradasByEvento(evento.id).map(enriquecerEntrada),
      aArrastrar: eventosModel.entradasQueSeCancelan(evento.id).length,
    });
  } catch (error) {
    next(error);
  }
}

async function editarForm(req, res, next) {
  try {
    const evento = eventosModel.getEventoById(req.params.id);
    if (!evento) return next();

    res.render('eventos/form', {
      titulo: 'Editar ' + evento.nombre,
      evento,
      accion: '/panel/eventos/' + evento.id + '/editar',
      salas: await salasElegibles(evento.salaId),
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

async function actualizar(req, res, next) {
  try {
    const evento = eventosModel.getEventoById(req.params.id);
    if (!evento) return next();

    const error = await eventosModel.validar(req.body, evento);
    if (error) {
      return res.status(400).render('eventos/form', {
        titulo: 'Editar ' + evento.nombre,
        evento: { ...req.body, id: evento.id },
        accion: '/panel/eventos/' + evento.id + '/editar',
        salas: await salasElegibles(evento.salaId),
        error,
      });
    }

    const { nombre, descripcion, fecha, salaId, precio } = req.body;
    eventosModel.updateEventoById(evento.id, {
      nombre,
      descripcion,
      fecha,
      salaId,
      precio: Number(precio),
    });
    volver(res, '/panel/eventos/' + evento.id, 'Evento actualizado.');
  } catch (error) {
    next(error);
  }
}

function finalizar(req, res, next) {
  const evento = eventosModel.getEventoById(req.params.id);
  if (!evento) return next();

  const impedimento = eventosModel.validarFinalizacion(evento);
  if (impedimento) {
    return volverConError(res, '/panel/eventos/' + evento.id, impedimento);
  }

  eventosModel.finalizarEvento(evento.id);
  volver(res, '/panel/eventos/' + evento.id, 'Evento marcado como finalizado.');
}

function cancelar(req, res, next) {
  const evento = eventosModel.getEventoById(req.params.id);
  if (!evento) return next();

  const impedimento = eventosModel.validarCancelacion(evento);
  if (impedimento) {
    return volverConError(res, '/panel/eventos/' + evento.id, impedimento);
  }

  const arrastradas = eventosModel.entradasQueSeCancelan(evento.id).length;
  eventosModel.cancelarEvento(evento.id);

  let aviso = 'Evento cancelado.';
  if (arrastradas === 1) {
    aviso = 'Evento cancelado. También se canceló 1 entrada.';
  } else if (arrastradas > 1) {
    aviso = 'Evento cancelado. También se cancelaron ' + arrastradas + ' entradas.';
  }

  volver(res, '/panel/eventos/' + evento.id, aviso);
}
module.exports = { listar, nuevoForm, crear, detalle, editarForm, actualizar, finalizar, cancelar };
