// Autenticación y autorización con JWT: después del login, el cliente envía el token en el
// header "Authorization: Bearer <token>". El servidor verifica la firma y la vigencia del
// token y busca al usuario en MongoDB en cada petición (así un usuario suspendido o
// bloqueado pierde el acceso aunque su token siga vigente).
import jwt from 'jsonwebtoken';
import * as usuariosModel from '../models/usuarios.js';

// Autenticación: ¿quién es? Deja el usuario en req.usuario para los middlewares siguientes
async function autenticar(req, res, next) {
  try {
    const cabecera = req.get('authorization') || '';
    const [tipo, token] = cabecera.split(' ');
    if (tipo !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Iniciá sesión: falta el header Authorization: Bearer <token>.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token inválido o vencido. Volvé a iniciar sesión.' });
    }

    const usuario = await usuariosModel.getById(payload.id);
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
