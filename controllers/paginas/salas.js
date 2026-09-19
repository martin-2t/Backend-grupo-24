// Páginas de salas. Renderiza vistas; las reglas viven en los models.
const salasModel = require('../../models/salas');
const eventosModel = require('../../models/eventos');
const { volver, volverConError, enriquecerEvento } = require('./comunes');

function listar(req, res) {
  const busqueda = req.query.q ? String(req.query.q).trim() : '';
  let salas = salasModel.getAllSalas();
  let sinResultado = false;

  // Búsqueda exacta, igual que GET /salas/nombre/:nombre
  if (busqueda) {
    const encontrada = salasModel.getSalaByName(busqueda);
    salas = encontrada ? [encontrada] : [];
    sinResultado = !encontrada;
  }

  res.render('salas/list', { titulo: 'Salas', salas, busqueda, sinResultado });
}

function nuevoForm(req, res) {
  res.render('salas/form', {
    titulo: 'Nueva sala',
    sala: null,
    accion: '/panel/salas/nueva',
    error: null,
  });
}

function crear(req, res) {
  const error = salasModel.validar(req.body);
  if (error) {
    return res.status(400).render('salas/form', {
      titulo: 'Nueva sala',
      sala: req.body,
      accion: '/panel/salas/nueva',
      error,
    });
  }

  const { nombre, capacidad, direccion } = req.body;
  const nueva = salasModel.createSala({ nombre, capacidad: Number(capacidad), direccion });
  volver(res, '/panel/salas/' + nueva.id, 'Sala creada correctamente.');
}

function detalle(req, res, next) {
  const sala = salasModel.getSalaById(req.params.id);
  if (!sala) return next();

  const eventos = eventosModel
    .getAllEventos()
    .filter((e) => e.salaId === sala.id)
    .map(enriquecerEvento);

  res.render('salas/detail', { titulo: sala.nombre, sala, eventos });
}

function editarForm(req, res, next) {
  const sala = salasModel.getSalaById(req.params.id);
  if (!sala) return next();

  res.render('salas/form', {
    titulo: 'Editar ' + sala.nombre,
    sala,
    accion: '/panel/salas/' + sala.id + '/editar',
    error: null,
  });
}

function actualizar(req, res, next) {
  const sala = salasModel.getSalaById(req.params.id);
  if (!sala) return next();

  const error = salasModel.validar(req.body) ||
    eventosModel.validarCapacidadDeSala(sala.id, req.body.capacidad);
  if (error) {
    return res.status(400).render('salas/form', {
      titulo: 'Editar ' + sala.nombre,
      sala: { ...req.body, id: sala.id },
      accion: '/panel/salas/' + sala.id + '/editar',
      error,
    });
  }

  const { nombre, capacidad, direccion } = req.body;
  salasModel.updateSalaById(sala.id, { nombre, capacidad: Number(capacidad), direccion });
  volver(res, '/panel/salas/' + sala.id, 'Sala actualizada.');
}

// Baja o alta lógica de la sala
function cambiarEstado(req, res, next) {
  const sala = salasModel.getSalaById(req.params.id);
  if (!sala) return next();

  const impedimento = eventosModel.validarCambioDeEstadoDeSala(sala);
  if (impedimento) {
    return volverConError(res, '/panel/salas/' + sala.id, impedimento);
  }

  const actualizada = salasModel.toggleSalaById(sala.id);
  volver(res, '/panel/salas', 'La sala "' + actualizada.nombre + '" ahora está ' + actualizada.estado + '.');
}
module.exports = { listar, nuevoForm, crear, detalle, editarForm, actualizar, cambiarEstado };
