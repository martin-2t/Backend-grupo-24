// middleware que tira un 404 cuando ninguna ruta coincide con la petición
function notFound(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
}

module.exports = notFound;