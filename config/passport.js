// Passport con la estrategia local (Módulo 11): la comprobación del email y la contraseña vive
// en un solo lugar, y la usan tanto el login de la API como el del panel.
//
// A diferencia del ejemplo del módulo, no usamos sesiones (express-session, serializeUser):
// después del login se firma un JWT que viaja en una cookie httpOnly o en el header
// Authorization. El deploy es serverless y una sesión guardada en la memoria del servidor no
// sobrevive entre pedidos; el JWT no necesita guardar nada del lado del servidor.
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import * as usuariosModel from '../models/usuarios.js';

// Si falta el email o la contraseña, passport-local responde por su cuenta (sin llamar a la
// estrategia): este es el mensaje que da en ese caso, el mismo que usa iniciarSesion
const FALTAN_CREDENCIALES = 'El email y la contraseña son obligatorios.';

// La estrategia delega en iniciarSesion, que ya verifica la contraseña, cuenta los intentos
// fallidos, bloquea la cuenta al tercero, rechaza al usuario suspendido y registra el acceso.
// Comparar la contraseña acá por separado se saltearía todo eso.
passport.use(
  'local',
  new LocalStrategy({ usernameField: 'email', passwordField: 'password' }, async (email, password, done) => {
    try {
      const resultado = await usuariosModel.iniciarSesion(email, password);
      if (resultado.error) {
        // false: no hay usuario. El tercer parámetro llega al callback como "info"
        return done(null, false, { message: resultado.error, status: resultado.status });
      }
      return done(null, resultado.usuario);
    } catch (error) {
      return done(error);
    }
  })
);

// Autentica el email y la contraseña del body con la estrategia local. Devuelve una promesa con
// { usuario } o { error, status }, para que cada controller decida cómo responder (JSON en la
// API, el formulario con el error en el panel). session: false porque no usamos sesiones
function autenticarCredenciales(req, res) {
  return new Promise((resolve, reject) => {
    const opciones = { session: false, badRequestMessage: FALTAN_CREDENCIALES };
    passport.authenticate('local', opciones, (error, usuario, info, status) => {
      if (error) return reject(error);
      if (!usuario) {
        return resolve({
          error: info?.message || 'No se pudo iniciar sesión.',
          status: info?.status || status || 401,
        });
      }
      resolve({ usuario });
    })(req, res, reject);
  });
}

export default passport;
export { autenticarCredenciales };
