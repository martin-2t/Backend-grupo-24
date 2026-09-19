// Captura los errores no manejados y responde 500, en HTML o en JSON según el origen.
function errorHandler(err, req, res, next) {
  console.error(err.stack);

  const ruta = req.originalUrl.split('?')[0];

  if (ruta.startsWith('/panel')) {
    return res.status(500).render('error', { titulo: 'Error interno' });
  }

  res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = errorHandler;
