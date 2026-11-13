// Autenticación con JWT: el token llega en la cookie "token" o en el header
// "Authorization: Bearer <token>". Se verifica la firma y la expiración, y después se
// busca el usuario en MongoDB para comprobar que siga activo y sin bloqueo.
import * as usuariosModel from '../models/usuarios.js';
import { verificarToken, NOMBRE_COOKIE } from '../config/jwt.js';

// El token puede venir en el header Authorization o en la cookie
function extraerToken(req) {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[NOMBRE_COOKIE] || null;
}

// Lógica común a la API y al panel. Devuelve { usuario } o { error, status }
async function resolverUsuario(req) {
  const token = extraerToken(req);
  if (!token) {
    return { error: 'Iniciá sesión: falta el token.', status: 401 };
  }

  let payload;
  try {
    payload = verificarToken(token);
  } catch (error) {
    const mensaje = error.name === 'TokenExpiredError'
      ? 'La sesión expiró. Iniciá sesión de nuevo.'
      : 'Token inválido.';
    return { error: mensaje, status: 401 };
  }

  // Se vuelve a buscar en la base: así un usuario suspendido o bloqueado
  // pierde el acceso aunque su token todavía no haya vencido
  const usuario = await usuariosModel.getById(payload.sub);
  if (!usuario) return { error: 'Usuario no válido.', status: 401 };
  if (usuario.estado !== 'ACTIVO') return { error: 'El usuario está suspendido.', status: 403 };
  if (usuario.estaBloqueado()) {
    return { error: 'La cuenta está bloqueada por intentos fallidos de login.', status: 403 };
  }
  return { usuario };
}

// API (JSON): ¿quién es? Deja el usuario en req.usuario o responde 401/403
async function autenticar(req, res, next) {
  try {
    const { usuario, error, status } = await resolverUsuario(req);
    if (!usuario) return res.status(status).json({ error });
    req.usuario = usuario;
    next();
  } catch (error) {
    next(error);
  }
}

// Panel (páginas): identifica al usuario si hay un token válido, pero no bloquea.
// Sirve para que las vistas sepan si mostrar "Ingresar" o el nombre y "Salir"
async function cargarUsuario(req, res, next) {
  try {
    const { usuario, error } = await resolverUsuario(req);
    if (usuario) {
      req.usuario = usuario;
      res.locals.usuario = usuario;
    } else {
      req.errorSesion = error;
    }
    next();
  } catch (error) {
    next(error);
  }
}

// Panel (páginas): si no hay usuario, redirige al login en vez de devolver JSON.
// Va después de cargarUsuario
function requerirLogin(req, res, next) {
  if (req.usuario) return next();
  const aviso = req.errorSesion || 'Iniciá sesión para continuar.';
  res.redirect('/panel/login?error=' + encodeURIComponent(aviso));
}

// Autorización por rol (RBAC) para la API: ¿puede hacerlo? Se usa por ruta, después de autenticar.
// Ejemplo: router.post('/', autenticar, permitir('ADMIN'), controller)
function permitir(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Tu rol no tiene permiso para esta acción.' });
    }
    next();
  };
}

// Lo mismo para el panel: en vez de un JSON 403, vuelve al inicio con un aviso.
// Va después de requerirLogin. /panel lo pueden ver todos los roles, así que no hay bucle
function permitirPagina(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.rol)) {
      return res.redirect('/panel?error=' + encodeURIComponent('Tu rol no tiene permiso para esta acción.'));
    }
    next();
  };
}

// Panel: le dice a las vistas qué puede hacer el usuario, para que muestren solo los botones
// que le sirven (el servidor igual rechaza lo que no corresponde). Las reglas de rol quedan en
// un solo lugar, en vez de repetirse en cada vista. Va después de requerirLogin
//  - operaBoleteria: vender, reservar, confirmar, cancelar entradas y cargar clientes
//    (EMPLEADO y REPRESENTANTE, en su centro).
//  - gestionaEventos: crear, editar y finalizar eventos (REPRESENTANTE, en su centro).
//  - esNegocio: ve toda la red y las métricas (ADMIN y AUDITOR).
//  - soloLectura: no modifica nada (AUDITOR).
function marcarPermisosDeVista(req, res, next) {
  const { rol } = req.usuario;
  res.locals.operaBoleteria = ['EMPLEADO', 'REPRESENTANTE'].includes(rol);
  res.locals.gestionaEventos = rol === 'REPRESENTANTE';
  res.locals.esNegocio = ['ADMIN', 'AUDITOR'].includes(rol);
  res.locals.soloLectura = usuariosModel.ROLES_SOLO_LECTURA.includes(rol);
  next();
}

export { autenticar, cargarUsuario, requerirLogin, permitir, permitirPagina, marcarPermisosDeVista };