// Páginas de consultas. Renderiza vistas; las reglas viven en los models.
const eventosModel = require('../../models/eventos');
const entradasModel = require('../../models/entradas');
const { enriquecerEvento } = require('./comunes');

async function mostrar(req, res, next) {
  try {
    const eventos = await eventosModel.getAllEventos();
    const resumen = await Promise.all(
      eventos.map(async (evento) => {
        const entradas = await entradasModel.getEntradasByEvento(evento.id);
        return {
          ...(await enriquecerEvento(evento)),
          ...(await entradasModel.contarPorEstado(entradas)),
        };
      })
    );

    res.render('consultas/index', {
      titulo: 'Consultas',
      resumen,
      proximos: await Promise.all((await eventosModel.getEventosProximos()).map(enriquecerEvento)),
      totalVendidas: resumen.reduce((acc, e) => acc + e.vendidas, 0),
      totalReservadas: resumen.reduce((acc, e) => acc + e.reservadas, 0),
    });
  } catch (error) {
    next(error);
  }
}
module.exports = { mostrar };
