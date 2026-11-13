// Páginas de usuarios. ADMIN gestiona a todos; el REPRESENTANTE solo a los empleados de su centro.
// Las reglas viven en models/gestionUsuarios.js; acá se arma la vista y se elige la respuesta.
import * as usuariosModel from '../../models/usuarios.js';
import * as salasModel from '../../models/salas.js';
import * as gestion from '../../models/gestionUsuarios.js';
import { volver, volverConError } from './comunes.js';

// Datos que necesita el formulario según quién lo abre
async function datosFormulario(actor) {
  const puedeElegirSala = actor.rol === 'ADMIN';
  const salas = puedeElegirSala
    ? await salasModel.getAllSalas()
    : [await salasModel.getSalaById(actor.salaId)].filter(Boolean);
  return {
    roles: gestion.rolesCreables(actor),
    puedeElegirSala,
    salas,
    passwordMinimo: usuariosModel.PASSWORD_MINIMO,
  };
}

async function listar(req, res, next) {
  try {
    const filtros = {
      rol: req.query.rol || '',
      estado: req.query.estado || '',
      salaId: req.query.salaId || '',
    };
    // Primero lo que el usuario puede ver (el REPRESENTANTE, solo a los empleados de su centro),
    // después los filtros y el orden
    const usuarios = gestion.filtrarYOrdenar(await gestion.usuariosVisibles(req.usuario), filtros);
    const salas = await salasModel.getAllSalas();
    const nombreSala = Object.fromEntries(salas.map((s) => [s.id, s.nombre]));
    res.render('usuarios/list', {
      titulo: 'Usuarios',
      usuarios,
      nombreSala,
      filtros,
      roles: gestion.ORDEN_DE_ROLES,
      estados: gestion.ESTADOS_DE_USUARIO,
      salas,
      // Los filtros de rol y centro solo tienen sentido para quien ve a toda la red
      filtrosCompletos: ['ADMIN', 'AUDITOR'].includes(req.usuario.rol),
    });
  } catch (error) {
    next(error);
  }
}

async function nuevoForm(req, res, next) {
  try {
    res.render('usuarios/form', {
      titulo: 'Nuevo usuario',
      ...(await datosFormulario(req.usuario)),
      valores: {},
      error: null,
    });
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  // Vuelve a mostrar el formulario con lo que había cargado y el motivo del rechazo
  async function mostrarError(mensaje, status = 400) {
    return res.status(status).render('usuarios/form', {
      titulo: 'Nuevo usuario',
      ...(await datosFormulario(req.usuario)),
      valores: req.body,
      error: mensaje,
    });
  }

  try {
    const resultado = await gestion.crearPersonal(req.usuario, req.body);
    if (resultado.error) return await mostrarError(resultado.error, resultado.status);
    volver(res, '/panel/usuarios', 'Usuario "' + resultado.usuario.nombre + '" creado.');
  } catch (error) {
    if (error.name === 'ValidationError') {
      return mostrarError(Object.values(error.errors)[0].message).catch(next);
    }
    next(error);
  }
}

// Suspende a un usuario activo o reactiva a uno suspendido
async function cambiarEstado(req, res, next) {
  try {
    const objetivo = await usuariosModel.getById(req.params.id);
    if (!objetivo) return next();

    if (!gestion.puedeGestionar(req.usuario, objetivo)) {
      return volverConError(res, '/panel/usuarios', 'No podés gestionar a ese usuario.');
    }
    if (objetivo.id === req.usuario.id) {
      return volverConError(res, '/panel/usuarios', 'No podés suspender tu propia cuenta.');
    }

    const nuevoEstado = objetivo.estado === 'ACTIVO' ? 'SUSPENDIDO' : 'ACTIVO';
    await usuariosModel.update(objetivo.id, { estado: nuevoEstado });
    const accion = nuevoEstado === 'SUSPENDIDO' ? 'suspendido' : 'activado';
    volver(res, '/panel/usuarios', 'Usuario "' + objetivo.nombre + '" ' + accion + '.');
  } catch (error) {
    next(error);
  }
}

// Desbloquea una cuenta bloqueada por intentos fallidos, sin esperar a que venza el bloqueo
async function desbloquear(req, res, next) {
  try {
    const objetivo = await usuariosModel.getById(req.params.id);
    if (!objetivo) return next();

    if (!gestion.puedeGestionar(req.usuario, objetivo)) {
      return volverConError(res, '/panel/usuarios', 'No podés gestionar a ese usuario.');
    }

    await usuariosModel.desbloquear(objetivo.id);
    volver(res, '/panel/usuarios', 'Usuario "' + objetivo.nombre + '" desbloqueado.');
  } catch (error) {
    next(error);
  }
}

export { listar, nuevoForm, crear, cambiarEstado, desbloquear };