// Login y registro por API (JSON). Mismo criterio que el login de la Clase 10: se busca el
// usuario por email y se compara el hash de la contraseña. Si es correcto, se devuelve un token JWT
import * as usuariosModel from '../../models/usuarios.js';
import * as clientesModel from '../../models/clientes.js';
import jwt from 'jsonwebtoken';

// POST /auth/login  { email, password }
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const resultado = await usuariosModel.iniciarSesion(email, password);
    if (resultado.error) {
      return res.status(resultado.status).json({ error: resultado.error });
    }
    //este es el bloque que se reemplaza con respecto al anterior
    //el token dura 2 horas y guarda sólo el id del usuario, sin contraseña ni datos sensibles
    const token = jwt.sign({ id: resultado.usuario._id }, process.env.JWT_SECRET, { expiresIn: '2h' });
    return res.status(200).json({
      mensaje: 'Login correcto. Enviá el token en el header Authorization: Bearer <token> para operar.',
      token,
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

// GET /auth/yo: el usuario dueño del token (sirve para comprobar el login)
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

export { login, registro, yo, misEntradas };
