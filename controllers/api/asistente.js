// Las reglas (validación, armado del contexto, llamada a Gemini) viven en el model.
// Acá solo elegimos el código HTTP con el que responder.
//
// Igual que el resto de los controllers: try/catch y next(error) para los errores inesperados.
import * as asistenteModel from '../../models/asistente.js';

// CREATE | Una consulta al asistente. Body: { mensaje, historial? }
async function preguntar(req, res, next) {
  try {
    const { mensaje, historial } = req.body;

    const error = asistenteModel.validar({ mensaje, historial });
    if (error) {
      return res.status(400).json({ error });
    }

    const respuesta = await asistenteModel.preguntar({ mensaje, historial });
    res.status(200).json({ respuesta });
  } catch (error) {
    // Errores previstos del asistente (sin API key, Gemini caído, cuota): traen su propio código HTTP
    if (error instanceof asistenteModel.ErrorAsistente) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
}

export { preguntar };
