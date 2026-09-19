const entradasModel = require('../../models/entradas');
const eventosModel = require('../../models/eventos');
const salasModel = require('../../models/salas');

// GET /consultas/entradas-vendidas            -> vendidas por cada evento
// GET /consultas/entradas-vendidas/:eventoId  -> vendidas de un evento puntual
function entradasVendidas(req, res) {
  const { eventoId } = req.params;

  if (eventoId) {
    const evento = eventosModel.getEventoById(eventoId);
    if (!evento) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }
    const vendidas = entradasModel
      .getEntradasByEvento(eventoId)
      .filter((e) => e.estado === 'VALIDA').length;
    return res.status(200).json({ eventoId: Number(eventoId), evento: evento.nombre, vendidas });
  }

  const resumen = eventosModel.getAllEventos().map((evento) => ({
    eventoId: evento.id,
    evento: evento.nombre,
    vendidas: entradasModel.getEntradasByEvento(evento.id).filter((e) => e.estado === 'VALIDA').length,
  }));
  return res.status(200).json(resumen);
}

// GET /consultas/entradas-disponibles/:eventoId
function entradasDisponibles(req, res) {
  const { eventoId } = req.params;
  const evento = eventosModel.getEventoById(eventoId);
  if (!evento) {
    return res.status(404).json({ error: 'Evento no encontrado' });
  }

  const sala = salasModel.getSalaById(evento.salaId);
  const ocupados = entradasModel.lugaresOcupados(eventoId);
  const disponibles = Math.max(sala.capacidad - ocupados, 0);

  return res.status(200).json({
    eventoId: Number(eventoId),
    evento: evento.nombre,
    capacidadSala: sala.capacidad,
    ocupados,
    disponibles,
  });
}

// GET /consultas/eventos-proximos
function eventosProximos(req, res) {
  return res.status(200).json(eventosModel.getEventosProximos());
}

module.exports = { entradasVendidas, entradasDisponibles, eventosProximos };
