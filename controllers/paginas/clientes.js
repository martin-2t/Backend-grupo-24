// Páginas de clientes. Renderiza vistas; las reglas viven en los models.
import * as clientesModel from '../../models/clientes.js';
import * as entradasModel from '../../models/entradas.js';
import { volver, volverConError, enriquecerEntrada } from './comunes.js';

async function listar(req, res, next) {
  try {
    const clientes = await clientesModel.getAll();
    res.render('clientes/list', { titulo: 'Clientes', clientes });
  } catch (error) {
    next(error);
  }
}

function nuevoForm(req, res) {
  res.render('clientes/form', {
    titulo: 'Nuevo cliente',
    cliente: null,
    accion: '/panel/clientes/nuevo',
    error: null,
  });
}

async function crear(req, res, next) {
  try {
    const error = await clientesModel.validar(req.body);
    if (error) {
      return res.status(400).render('clientes/form', {
        titulo: 'Nuevo cliente',
        cliente: req.body,
        accion: '/panel/clientes/nuevo',
        error,
      });
    }

    const { nombre, apellido, email, telefono } = req.body;
    const nuevo = await clientesModel.create({ nombre, apellido, email, telefono });
    volver(res, '/panel/clientes/' + nuevo.id, 'Cliente creado correctamente.');
  } catch (error) {
    next(error);
  }
}

async function detalle(req, res, next) {
  try {
    const cliente = await clientesModel.getById(req.params.id);
    if (!cliente) return next();

    const entradas = await clientesModel.entradasDelCliente(cliente.id);
    // enriquecerEntrada puede ser async: Promise.all espera a que terminen todas
    const enriquecidas = await Promise.all(entradas.map(enriquecerEntrada));
    const { vigentes } = await entradasModel.contarPorEstado(entradas);

    res.render('clientes/detail', {
      titulo: cliente.nombre + ' ' + cliente.apellido,
      cliente,
      entradas: enriquecidas,
      vigentes,
    });
  } catch (error) {
    next(error);
  }
}

async function editarForm(req, res, next) {
  try {
    const cliente = await clientesModel.getById(req.params.id);
    if (!cliente) return next();

    res.render('clientes/form', {
      titulo: 'Editar ' + cliente.nombre + ' ' + cliente.apellido,
      cliente,
      accion: '/panel/clientes/' + cliente.id + '/editar',
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

async function actualizar(req, res, next) {
  try {
    const cliente = await clientesModel.getById(req.params.id);
    if (!cliente) return next();

    const error = await clientesModel.validar(req.body);
    if (error) {
      return res.status(400).render('clientes/form', {
        titulo: 'Editar ' + cliente.nombre + ' ' + cliente.apellido,
        cliente: { ...req.body, id: cliente.id },
        accion: '/panel/clientes/' + cliente.id + '/editar',
        error,
      });
    }

    const { nombre, apellido, email, telefono } = req.body;
    await clientesModel.update(cliente.id, { nombre, apellido, email, telefono });
    volver(res, '/panel/clientes/' + cliente.id, 'Cliente actualizado.');
  } catch (error) {
    next(error);
  }
}

async function eliminar(req, res, next) {
  try {
    const cliente = await clientesModel.getById(req.params.id);
    if (!cliente) return next();

    if (await clientesModel.tieneEntradasVigentes(cliente.id)) {
      return volverConError(
        res,
        '/panel/clientes/' + cliente.id,
        'No se puede eliminar: el cliente tiene entradas vigentes. Cancelalas primero.'
      );
    }

    await clientesModel.remove(cliente.id);
    volver(res, '/panel/clientes', 'Cliente eliminado.');
  } catch (error) {
    next(error);
  }
}

export { listar, nuevoForm, crear, detalle, editarForm, actualizar, eliminar };
