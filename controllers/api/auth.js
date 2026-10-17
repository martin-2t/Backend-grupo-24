// Login y registro por API (JSON). Mismo criterio que el login de la Clase 10: se busca el
// usuario por email y se compara el hash de la contraseña. No se crean sesiones ni tokens.
const usuariosModel = require('../../models/usuarios');
const clientesModel = require('../../models/clientes');

// POST /auth/login  { email, password }
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const resultado = await usuariosModel.iniciarSesion(email, password);
    if (resultado.error) {
      return res.status(resultado.status).json({ error: resultado.error });
    }
    return res.status(200).json({
      mensaje: 'Login correcto. Enviá el _id en el header x-usuario-id para operar.',
      usuario: resultado.usuario,
    });
  } catch (error) {
    next(error);
  }
}

// POST /auth/registro  { nombre, apellido, email, telefono, password }
// Alta de un cliente que compra por la web
async function registro(req, res, next) {
  try {
    const resultado = await usuariosModel.registrarCliente(req.body);
    if (resultado.error) {
      return res.status(resultado.status).json({ error: resultado.error });
    }
    return res.status(201).json({ mensaje: 'Registro correcto.', usuario: resultado.usuario });
  } catch (error) {
    next(error);
  }
}

// GET /auth/yo: el usuario que envía el header (sirve para comprobar el login)
function yo(req, res) {
  res.status(200).json(req.usuario);
}

// GET /auth/mis-entradas: las entradas del cliente logueado
async function misEntradas(req, res, next) {
  try {
    res.status(200).json(await clientesModel.entradasDelCliente(req.usuario.clienteId));
  } catch (error) {
    next(error);
  }
}

module.exports = { login, registro, yo, misEntradas };
