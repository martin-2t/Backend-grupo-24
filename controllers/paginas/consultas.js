// Páginas de consultas. Renderiza vistas; las reglas viven en los models.
const eventosModel = require('../../models/eventos');
const entradasModel = require('../../models/entradas');
const { enriquecerEvento } = require('./comunes');

async function mostrar(req, res, next) {
  try {
    const resumen = await Promise.all(
      eventosModel.getAllEventos().map(async (evento) => {
        const entradas = entradasModel.getEntradasByEvento(evento.id);
        return {
          ...(await enriquecerEvento(evento)),
          ...entradasModel.contarPorEstado(entradas),
        };
      })
    );

    res.render('consultas/index', {
      titulo: 'Consultas',
      resumen,
      proximos: await Promise.all(eventosModel.getEventosProximos().map(enriquecerEvento)),
      totalVendidas: resumen.reduce((acc, e) => acc + e.vendidas, 0),
      totalReservadas: resumen.reduce((acc, e) => acc + e.reservadas, 0),
    });
  } catch (error) {
    next(error);
  }
}
module.exports = { mostrar };
