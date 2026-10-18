// Captura los errores que los controllers pasan con next(err) y responde según el tipo,
// en HTML para el panel o en JSON para la API.
function errorHandler(err, req, res, next) {
  let status = 500;
  let mensaje = 'Error interno del servidor';

  // Mongoose: el documento no cumple las reglas del Schema
  if (err.name === 'ValidationError') {
    status = 400;
    mensaje = Object.values(err.errors)[0].message;
  }

  // Mongoose: un valor no se pudo convertir al tipo esperado (por ejemplo, un id mal formado)
  if (err.name === 'CastError') {
    status = 400;
    mensaje = 'El valor "' + err.value + '" no tiene un formato válido.';
  }

  // MongoDB: se violó un índice único (por ejemplo, un email de usuario repetido)
  if (err.code === 11000) {
    status = 409;
    mensaje = 'Ya existe un registro con ese valor: ' + JSON.stringify(err.keyValue) + '.';
  }

  // express.json(): el body no es un JSON válido. Es un error del cliente, no del servidor
  if (err.type === 'entity.parse.failed') {
    status = 400;
    mensaje = 'El cuerpo de la petición no es un JSON válido.';
  }

  if (status === 500) {
    console.error(err.stack);
  }

  const ruta = req.originalUrl.split('?')[0];
  if (ruta.startsWith('/panel')) {
    return res.status(status).render('error', { titulo: 'Error' });
  }

  res.status(status).json({ error: mensaje });
}

export default errorHandler;
