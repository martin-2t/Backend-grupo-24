// Páginas de clientes. Renderiza vistas; las reglas viven en los models.
const clientesModel = require('../../models/clientes');
const entradasModel = require('../../models/entradas');
const { volver, volverConError, enriquecerEntrada } = require('./comunes');

function listar(req, res) {
  res.render('clientes/list', { titulo: 'Clientes', clientes: clientesModel.getAll() });
}

function nuevoForm(req, res) {
  res.render('clientes/form', {
    titulo: 'Nuevo cliente',
    cliente: null,
    accion: '/panel/clientes/nuevo',
    error: null,
  });
}

function crear(req, res) {
  const error = clientesModel.validar(req.body);
  if (error) {
    return res.status(400).render('clientes/form', {
      titulo: 'Nuevo cliente',
      cliente: req.body,
      accion: '/panel/clientes/nuevo',
      error,
    });
  }

  const { nombre, apellido, email, telefono } = req.body;
  const nuevo = clientesModel.create({ nombre, apellido, email, telefono });
  volver(res, '/panel/clientes/' + nuevo.id, 'Cliente creado correctamente.');
}

function detalle(req, res, next) {
  const cliente = clientesModel.getById(req.params.id);
  if (!cliente) return next();

  const entradas = clientesModel.entradasDelCliente(cliente.id);

  res.render('clientes/detail', {
    titulo: cliente.nombre + ' ' + cliente.apellido,
    cliente,
    entradas: entradas.map(enriquecerEntrada),
    vigentes: entradasModel.contarPorEstado(entradas).vigentes,
  });
}

function editarForm(req, res, next) {
  const cliente = clientesModel.getById(req.params.id);
  if (!cliente) return next();

  res.render('clientes/form', {
    titulo: 'Editar ' + cliente.nombre + ' ' + cliente.apellido,
    cliente,
    accion: '/panel/clientes/' + cliente.id + '/editar',
    error: null,
  });
}

function actualizar(req, res, next) {
  const cliente = clientesModel.getById(req.params.id);
  if (!cliente) return next();

  const error = clientesModel.validar(req.body);
  if (error) {
    return res.status(400).render('clientes/form', {
      titulo: 'Editar ' + cliente.nombre + ' ' + cliente.apellido,
      cliente: { ...req.body, id: cliente.id },
      accion: '/panel/clientes/' + cliente.id + '/editar',
      error,
    });
  }

  const { nombre, apellido, email, telefono } = req.body;
  clientesModel.update(cliente.id, { nombre, apellido, email, telefono });
  volver(res, '/panel/clientes/' + cliente.id, 'Cliente actualizado.');
}

function eliminar(req, res, next) {
  const cliente = clientesModel.getById(req.params.id);
  if (!cliente) return next();

  if (clientesModel.tieneEntradasVigentes(cliente.id)) {
    return volverConError(
      res,
      '/panel/clientes/' + cliente.id,
      'No se puede eliminar: el cliente tiene entradas vigentes. Cancelalas primero.'
    );
  }

  clientesModel.remove(cliente.id);
  volver(res, '/panel/clientes', 'Cliente eliminado.');
}
module.exports = { listar, nuevoForm, crear, detalle, editarForm, actualizar, eliminar };
