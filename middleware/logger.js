// middleware para registrar en cosola cada petición; con fecha, método y ruta
function logger(req, res, next) {
  const fecha = new Date().toISOString();

  console.log(`[${fecha}] ${req.method} ${req.originalUrl}`);

  next();
}

module.exports = logger;