const entradasModel = require('../../models/entradas');
const eventosModel = require('../../models/eventos');
const salasModel = require('../../models/salas');

//GET /consultas/entradas-vendidas            -> vendidas por cada evento
//GET /consultas/entradas-vendidas/:eventoId  -> vendidas de un evento puntual
async function entradasVendidas(req, res, next) {
  try {
    const { eventoId } = req.params;

    if (eventoId) {
      const evento = eventosModel.getEventoById(eventoId);
      if (!evento) {
        return res.status(404).json({ error: 'Evento no encontrado' });
      }
      const entradas = await entradasModel.getEntradasByEvento(eventoId);
      const vendidas = entradas.filter((e) => e.estado === 'VALIDA').length;
      return res.status(200).json({ eventoId: Number(eventoId), evento: evento.nombre, vendidas });
    }

    //Promise.all espera a que terminen todas las consultas, una por evento
    const resumen = await Promise.all(
      eventosModel.getAllEventos().map(async (evento) => {
        const entradas = await entradasModel.getEntradasByEvento(evento.id);
        return {
          eventoId: evento.id,
          evento: evento.nombre,
          vendidas: entradas.filter((e) => e.estado === 'VALIDA').length,
        };
      })
    );
    return res.status(200).json(resumen);
  } catch (error) {
    next(error);
  }
}
// GET /consultas/entradas-disponibles/:eventoId
async function entradasDisponibles(req, res, next) {
  try {
    const { eventoId } = req.params;
    const evento = eventosModel.getEventoById(eventoId);
    if (!evento) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    const sala = await salasModel.getSalaById(evento.salaId);
    const ocupados = await entradasModel.lugaresOcupados(eventoId);
    const disponibles = Math.max(sala.capacidad - ocupados, 0);

    return res.status(200).json({
      eventoId: Number(eventoId),
      evento: evento.nombre,
      capacidadSala: sala.capacidad,
      ocupados,
      disponibles,
    });
  } catch (error) {
    next(error);
  }
}

// GET /consultas/eventos-proximos
function eventosProximos(req, res) {
  return res.status(200).json(eventosModel.getEventosProximos());
}

module.exports = { entradasVendidas, entradasDisponibles, eventosProximos };
