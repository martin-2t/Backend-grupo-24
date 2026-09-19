// 404 cuando ninguna ruta coincide. El panel es HTML y la API es JSON,
// así que respondemos distinto según de dónde venga la petición.
function notFound(req, res) {
  const ruta = req.originalUrl.split('?')[0];

  if (ruta.startsWith('/panel')) {
    return res.status(404).render('404', {
      titulo: 'Página no encontrada',
      url: ruta,
    });
  }

  res.status(404).json({ error: 'Recurso no encontrado' });
}

module.exports = notFound;
