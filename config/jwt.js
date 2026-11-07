import jwt from 'jsonwebtoken';

const NOMBRE_COOKIE = 'token';

// Las variables se leen DENTRO de las funciones: con ES Modules los import se ejecutan
// antes que dotenv.config() de index.js, y si las leyéramos arriba serían undefined.
function generarToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, rol: usuario.rol },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
  );
}

// Verifica firma (JWS) y expiración. Lanza error si el token no sirve
function verificarToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
}

// Opciones de la cookie: las mismas para guardarla y para borrarla
function opcionesCookie() {
  return {
    httpOnly: true,                                  // el JS del navegador no puede leerla
    sameSite: 'lax',                                 // frena CSRF básico
    secure: process.env.NODE_ENV === 'production',   // solo HTTPS en producción
  };
}

// La cookie dura lo mismo que el token: el vencimiento se lee del propio token (claim exp)
function guardarCookie(res, token) {
  const { exp } = jwt.decode(token);
  res.cookie(NOMBRE_COOKIE, token, {
    ...opcionesCookie(),
    maxAge: exp * 1000 - Date.now(),
  });
}

function borrarCookie(res) {
  res.clearCookie(NOMBRE_COOKIE, opcionesCookie());
}

export { generarToken, verificarToken, guardarCookie, borrarCookie, NOMBRE_COOKIE };