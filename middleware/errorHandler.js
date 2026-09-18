// Middleware que captura errores no manejados y responde con un status 400
function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = errorHandler;