// Login y registro del panel, como en la Clase 10: el login valida email y contraseña
// contra MongoDB y muestra el resultado. Sin sesiones, la página no "recuerda" al usuario.
const usuariosModel = require('../../models/usuarios');
const salasModel = require('../../models/salas');
const { volver } = require('./comunes');

// Resumen de la matriz de permisos que aplica la API, para mostrar al ingresar
const PERMISOS = {
  ADMIN: [
    'Gestionar todas las salas, eventos, entradas y clientes de la red.',
    'Dar de alta empleados y administrar los usuarios.',
  ],
  EMPLEADO: [
    'Crear y editar los eventos de su centro.',
    'Vender, reservar, confirmar y cancelar entradas de su centro (boletería).',
    'Editar los datos de su centro y consultar o cargar clientes.',
  ],
  CLIENTE: [
    'Ver la cartelera de eventos de los 25 centros.',
    'Comprar entradas para sí mismo y consultar las propias.',
  ],
};

function loginForm(req, res) {
  res.render('auth/login', { titulo: 'Ingresar', error: null, email: '' });
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const resultado = await usuariosModel.iniciarSesion(email, password);
    if (resultado.error) {
      return res.status(resultado.status).render('auth/login', {
        titulo: 'Ingresar',
        error: resultado.error,
        email,
      });
    }

    const { usuario } = resultado;
    const sala = usuario.salaId ? await salasModel.getSalaById(usuario.salaId) : null;
    res.render('auth/bienvenida', {
      titulo: 'Bienvenida',
      usuario,
      sala,
      permisos: PERMISOS[usuario.rol],
    });
  } catch (error) {
    next(error);
  }
}

function registroForm(req, res) {
  res.render('auth/registro', {
    titulo: 'Crear cuenta',
    error: null,
    valores: {},
    passwordMinimo: usuariosModel.PASSWORD_MINIMO,
  });
}

async function registro(req, res, next) {
  try {
    const resultado = await usuariosModel.registrarCliente(req.body);
    if (resultado.error) {
      return res.status(resultado.status).render('auth/registro', {
        titulo: 'Crear cuenta',
        error: resultado.error,
        valores: req.body,
        passwordMinimo: usuariosModel.PASSWORD_MINIMO,
      });
    }
    volver(res, '/panel/login', 'Cuenta creada. Ya podés ingresar.');
  } catch (error) {
    next(error);
  }
}

module.exports = { loginForm, login, registroForm, registro };
