// Páginas de salas. Renderiza vistas; las reglas viven en los models.
const salasModel = require('../../models/salas');
const eventosModel = require('../../models/eventos');
const { volver, volverConError, enriquecerEvento } = require('./comunes');

async function listar(req, res, next) {
  try {
    const busqueda = req.query.q ? String(req.query.q).trim() : '';
    let salas = await salasModel.getAllSalas();
    let sinResultado = false;

    // Búsqueda exacta, igual que GET /salas/nombre/:nombre
    if (busqueda) {
      const encontrada = await salasModel.getSalaByName(busqueda);
      salas = encontrada ? [encontrada] : [];
      sinResultado = !encontrada;
    }

    res.render('salas/list', { titulo: 'Salas', salas, busqueda, sinResultado });
  } catch (error) {
    next(error);
  }
}

function nuevoForm(req, res) {
  res.render('salas/form', {
    titulo: 'Nueva sala',
    sala: null,
    accion: '/panel/salas/nueva',
    error: null,
  });
}

async function crear(req, res, next) {
  try {
    const error = await salasModel.validar(req.body);
    if (error) {
      return res.status(400).render('salas/form', {
        titulo: 'Nueva sala',
        sala: req.body,
        accion: '/panel/salas/nueva',
        error,
      });
    }

    const { nombre, capacidad, direccion } = req.body;
    const nueva = await salasModel.createSala({ nombre, capacidad: Number(capacidad), direccion });
    volver(res, '/panel/salas/' + nueva.id, 'Sala creada correctamente.');
  } catch (error) {
    next(error);
  }
}

async function detalle(req, res, next) {
  try {
    const sala = await salasModel.getSalaById(req.params.id);
    if (!sala) return next();

    // salaId es un ObjectId y sala.id es texto: comparamos los dos como texto
    const eventosDeLaSala = (await eventosModel.getAllEventos())
      .filter((e) => String(e.salaId) === sala.id);
    // enriquecerEvento es async: Promise.all espera a que terminen todos
    const eventos = await Promise.all(eventosDeLaSala.map(enriquecerEvento));

    res.render('salas/detail', { titulo: sala.nombre, sala, eventos });
  } catch (error) {
    next(error);
  }
}

async function editarForm(req, res, next) {
  try {
    const sala = await salasModel.getSalaById(req.params.id);
    if (!sala) return next();

    res.render('salas/form', {
      titulo: 'Editar ' + sala.nombre,
      sala,
      accion: '/panel/salas/' + sala.id + '/editar',
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

async function actualizar(req, res, next) {
  try {
    const sala = await salasModel.getSalaById(req.params.id);
    if (!sala) return next();

    const error =
      (await salasModel.validar(req.body)) ||
      (await eventosModel.validarCapacidadDeSala(sala.id, req.body.capacidad));
    if (error) {
      return res.status(400).render('salas/form', {
        titulo: 'Editar ' + sala.nombre,
        sala: { ...req.body, id: sala.id },
        accion: '/panel/salas/' + sala.id + '/editar',
        error,
      });
    }

    const { nombre, capacidad, direccion } = req.body;
    await salasModel.updateSalaById(sala.id, { nombre, capacidad: Number(capacidad), direccion });
    volver(res, '/panel/salas/' + sala.id, 'Sala actualizada.');
  } catch (error) {
    next(error);
  }
}

// Baja o alta lógica de la sala
async function cambiarEstado(req, res, next) {
  try {
    const sala = await salasModel.getSalaById(req.params.id);
    if (!sala) return next();

    const impedimento = await eventosModel.validarCambioDeEstadoDeSala(sala);
    if (impedimento) {
      return volverConError(res, '/panel/salas/' + sala.id, impedimento);
    }

    const actualizada = await salasModel.toggleSalaById(sala.id);
    volver(res, '/panel/salas', 'La sala "' + actualizada.nombre + '" ahora está ' + actualizada.estado + '.');
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, nuevoForm, crear, detalle, editarForm, actualizar, cambiarEstado };
