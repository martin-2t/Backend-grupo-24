// Páginas de inicio del panel. Renderiza vistas; las reglas viven en los models.
const eventosModel = require('../../models/eventos');
const salasModel = require('../../models/salas');
const clientesModel = require('../../models/clientes');
const entradasModel = require('../../models/entradas');

async function mostrar(req, res, next) {
  try {
    const conteo = await entradasModel.contarPorEstado();
    res.render('index', {
      titulo: 'Panel Urbana Cult',
      totalEventos: eventosModel.getAllEventos().length,
      totalSalas: await salasModel.contarSalas(),
      totalClientes: await clientesModel.contarClientes(),
      entradasVendidas: conteo.vendidas,
      entradasReservadas: conteo.reservadas,
      proximos: eventosModel.getEventosProximos().slice(0, 3),
    });
  } catch (error) {
    next(error);
  }
}
module.exports = { mostrar };
