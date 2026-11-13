// Login y registro por API (JSON). Se busca el usuario por email, se compara el hash de la
// contraseña y, si es correcta, se firma un JWT (JWS, HS256) que se envía en una cookie
// httpOnly y también en el cuerpo de la respuesta (para probar con Authorization: Bearer).
import * as usuariosModel from '../../models/usuarios.js';
import * as entradasModel from '../../models/entradas.js';
import { generarToken, guardarCookie, borrarCookie } from '../../config/jwt.js';

// POST /auth/login  { email, password }
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const resultado = await usuariosModel.iniciarSesion(email, password);
    if (resultado.error) {
      return res.status(resultado.status).json({ error: resultado.error });
    }

    const token = generarToken(resultado.usuario);
    guardarCookie(res, token);

    return res.status(200).json({
      mensaje: 'Login correcto.',
      token,
      usuario: resultado.usuario,
    });
  } catch (error) {
    next(error);
  }
}

// POST /auth/logout
function logout(req, res) {
  borrarCookie(res);
  res.status(200).json({ mensaje: 'Sesión cerrada.' });
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

// GET /auth/yo: el usuario autenticado (sirve para comprobar el login)
function yo(req, res) {
  res.status(200).json(req.usuario);
}

// GET /auth/mis-entradas: las entradas del cliente logueado
async function misEntradas(req, res, next) {
  try {
    //Solo sus entradas reales: las compras en curso o no concretadas no son entradas para él
    res.status(200).json(await entradasModel.entradasVisiblesDelCliente(req.usuario.clienteId));
  } catch (error) {
    next(error);
  }
}

export { login, logout, registro, yo, misEntradas };