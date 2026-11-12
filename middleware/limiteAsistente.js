// Límite simple de consultas al asistente: cada llamada gasta cuota de Gemini.
// Se cuenta por usuario (va después de "autenticar") en una ventana de un minuto.
//
// Los contadores viven en la memoria del proceso. En Vercel cada instancia lleva su propia
// cuenta, así que el límite es aproximado: alcanza para frenar un abuso, no es una garantía exacta.
const VENTANA_MS = 60 * 1000;
const MAXIMO_POR_VENTANA = 8;

const consultas = new Map(); // clave -> { desde, cantidad }

function limitarAsistente(req, res, next) {
  const ahora = Date.now();
  const clave = req.usuario?.id ?? req.ip;

  // Se descartan las ventanas vencidas para que el Map no crezca sin parar
  for (const [k, v] of consultas) {
    if (ahora - v.desde >= VENTANA_MS) consultas.delete(k);
  }

  const actual = consultas.get(clave);
  if (!actual) {
    consultas.set(clave, { desde: ahora, cantidad: 1 });
    return next();
  }

  if (actual.cantidad >= MAXIMO_POR_VENTANA) {
    const segundos = Math.ceil((VENTANA_MS - (ahora - actual.desde)) / 1000);
    res.set('Retry-After', String(segundos));
    return res.status(429).json({
      error: `Hiciste muchas consultas seguidas. Probá de nuevo en ${segundos} segundos.`,
    });
  }

  actual.cantidad += 1;
  next();
}

export { limitarAsistente };
