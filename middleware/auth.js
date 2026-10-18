// Autenticación y autorización sin sesiones ni tokens (indicación de la cátedra para esta
// etapa): después del login, el cliente envía el _id del usuario en el header x-usuario-id
// y el servidor lo busca en MongoDB en cada petición. Cualquiera que conozca un _id podría
// usarlo: esa limitación se resuelve más adelante con sesiones o JWT.
import * as usuariosModel from '../models/usuarios.js';

// Autenticación: ¿quién es? Deja el usuario en req.usuario para los middlewares siguientes
async function autenticar(req, res, next) {
  try {
    const id = req.get('x-usuario-id');
    if (!id) {
      return res.status(401).json({ error: 'Iniciá sesión: falta el header x-usuario-id.' });
    }

    const usuario = await usuariosModel.getById(id);
    if (!usuario) {
      return res.status(401).json({ error: 'Usuario no válido.' });
    }
    if (usuario.estado !== 'ACTIVO') {
      return res.status(403).json({ error: 'El usuario está suspendido.' });
    }
    if (usuario.estaBloqueado()) {
      return res.status(403).json({ error: 'La cuenta está bloqueada por intentos fallidos de login.' });
    }

    req.usuario = usuario;
    next();
  } catch (error) {
    next(error);
  }
}

// Autorización por rol (RBAC): ¿puede hacerlo? Se usa por ruta, después de autenticar.
// Ejemplo: router.post('/', autenticar, permitir('ADMIN'), controller)
function permitir(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Tu rol no tiene permiso para esta acción.' });
    }
    next();
  };
}

export { autenticar, permitir };
