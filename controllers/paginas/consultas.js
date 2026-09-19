// Páginas de consultas. Renderiza vistas; las reglas viven en los models.
const eventosModel = require('../../models/eventos');
const entradasModel = require('../../models/entradas');
const { enriquecerEvento } = require('./comunes');

function mostrar(req, res) {
  const resumen = eventosModel.getAllEventos().map((evento) => {
    const entradas = entradasModel.getEntradasByEvento(evento.id);
    return {
      ...enriquecerEvento(evento),
      ...entradasModel.contarPorEstado(entradas),
    };
  });

  res.render('consultas/index', {
    titulo: 'Consultas',
    resumen,
    proximos: eventosModel.getEventosProximos().map(enriquecerEvento),
    totalVendidas: resumen.reduce((acc, e) => acc + e.vendidas, 0),
    totalReservadas: resumen.reduce((acc, e) => acc + e.reservadas, 0),
  });
}
module.exports = { mostrar };
