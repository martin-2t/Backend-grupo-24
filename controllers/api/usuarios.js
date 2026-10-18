// Gestión de usuarios (solo ADMIN, lo controla la ruta). Las reglas viven en el model;
// acá se elige el código HTTP. Solo se toman del body los campos permitidos.
const usuariosModel = require('../../models/usuarios');

async function listar(req, res, next) {
  try {
    res.status(200).json(await usuariosModel.getAll());
  } catch (error) {
    next(error);
  }
}

async function obtener(req, res, next) {
  try {
    const usuario = await usuariosModel.getById(req.params.id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.status(200).json(usuario);
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre, email, password, rol, salaId, clienteId } = req.body;

    const errorPassword = usuariosModel.chequearPassword(password);
    if (errorPassword) {
      return res.status(400).json({ error: errorPassword });
    }
    if (email && (await usuariosModel.getByEmail(email))) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email.' });
    }
    const errorReferencia = await usuariosModel.chequearReferencias({ rol, salaId, clienteId });
    if (errorReferencia) {
      return res.status(404).json({ error: errorReferencia });
    }

    const nuevo = await usuariosModel.create({ nombre, email, password, rol, salaId, clienteId });
    res.status(201).json(nuevo);
  } catch (error) {
    next(error);
  }
}

// Actualización parcial: nombre, email, contraseña, rol, centro, ficha o estado (ACTIVO/SUSPENDIDO)
async function actualizar(req, res, next) {
  try {
    const usuario = await usuariosModel.getById(req.params.id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { nombre, email, password, rol, salaId, clienteId, estado } = req.body;

    if (password !== undefined) {
      const errorPassword = usuariosModel.chequearPassword(password);
      if (errorPassword) return res.status(400).json({ error: errorPassword });
    }
    if (email !== undefined) {
      const otro = await usuariosModel.getByEmail(email);
      if (otro && otro.id !== usuario.id) {
        return res.status(409).json({ error: 'Ya existe un usuario con ese email.' });
      }
    }
    const errorReferencia = await usuariosModel.chequearReferencias({
      rol: rol ?? usuario.rol,
      salaId: salaId ?? usuario.salaId,
      clienteId: clienteId ?? usuario.clienteId,
    });
    if (errorReferencia) {
      return res.status(404).json({ error: errorReferencia });
    }

    const actualizado = await usuariosModel.update(usuario.id, {
      nombre, email, password, rol, salaId, clienteId, estado,
    });
    res.status(200).json(actualizado);
  } catch (error) {
    next(error);
  }
}

// Desbloquea una cuenta bloqueada por intentos fallidos, sin esperar a que venza el bloqueo
async function desbloquear(req, res, next) {
  try {
    const usuario = await usuariosModel.desbloquear(req.params.id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.status(200).json(usuario);
  } catch (error) {
    next(error);
  }
}

async function eliminar(req, res, next) {
  try {
    if (req.params.id === req.usuario.id) {
      return res.status(400).json({ error: 'No podés eliminar tu propio usuario.' });
    }
    const eliminado = await usuariosModel.remove(req.params.id);
    if (!eliminado) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, obtener, crear, actualizar, desbloquear, eliminar };
