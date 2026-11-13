// Login y registro del panel. El login pasa por Passport (estrategia local, ver
// config/passport.js), firma un JWT y lo guarda en una cookie httpOnly: así la página
// "recuerda" al usuario entre peticiones sin guardar nada en el servidor.
import * as usuariosModel from '../../models/usuarios.js';
import * as salasModel from '../../models/salas.js';
import { generarToken, guardarCookie, borrarCookie } from '../../config/jwt.js';
import { autenticarCredenciales } from '../../config/passport.js';
import { volver } from './comunes.js';

// Resumen de la matriz de permisos que aplica la API, para mostrar al ingresar
const PERMISOS = {
  ADMIN: [
    'Administrar la plataforma: los usuarios de toda la red y las salas (alta, edición y baja).',
    'Consultar los eventos, entradas, clientes y ventas de toda la red, con las métricas de compras web.',
    'Cancelar un evento por fuerza mayor y hacer borrados físicos de datos.',
    'No opera la boletería ni la programación de los centros: eso lo hace el personal de cada centro.',
  ],
  REPRESENTANTE: [
    'Crear, editar, finalizar y cancelar los eventos de su centro, y editar los datos de su sala.',
    'Hacer todo lo que hace un cajero: vender, reservar, confirmar y cancelar entradas de su centro, y gestionar clientes.',
    'Dar de alta, suspender, activar y desbloquear a los empleados de su centro.',
    'Validar entradas en la puerta y consultar las ventas de su centro.',
  ],
  EMPLEADO: [
    'Vender, reservar, confirmar y cancelar entradas de su centro (boletería).',
    'Consultar o cargar clientes.',
    'Validar entradas en la puerta y consultar las ventas de su centro.',
  ],
  CLIENTE: [
    'Ver la cartelera de eventos de los 25 centros.',
    'Comprar entradas para sí mismo y consultar las propias.',
  ],
  AUDITOR: [
    'Consultar las salas, eventos, entradas, clientes y usuarios de toda la red.',
    'Ver las consultas de ventas.',
    'Todo en modo de solo lectura: no puede crear, modificar ni eliminar nada.',
  ],
};
function loginForm(req, res) {
  res.render('auth/login', { titulo: 'Ingresar', error: null, email: '' });
}

async function login(req, res, next) {
  try {
    const resultado = await autenticarCredenciales(req, res);
    if (resultado.error) {
      return res.status(resultado.status).render('auth/login', {
        titulo: 'Ingresar',
        error: resultado.error,
        email: req.body.email || '',
      });
    }

    const { usuario } = resultado;
    guardarCookie(res, generarToken(usuario));

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

// POST /panel/logout: borra la cookie con el token
function logout(req, res) {
  borrarCookie(res);
  volver(res, '/panel/login', 'Sesión cerrada.');
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

export { loginForm, login, logout, registroForm, registro };