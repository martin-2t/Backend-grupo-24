// Páginas de inicio del panel. Renderiza vistas; las reglas viven en los models.
const eventosModel = require('../../models/eventos');
const salasModel = require('../../models/salas');
const clientesModel = require('../../models/clientes');
const entradasModel = require('../../models/entradas');

function mostrar(req, res) {
  const conteo = entradasModel.contarPorEstado();
  res.render('index', {
    titulo: 'Panel Urbana Cult',
    totalEventos: eventosModel.getAllEventos().length,
    totalSalas: salasModel.getAllSalas().length,
    totalClientes: clientesModel.getAll().length,
    entradasVendidas: conteo.vendidas,
    entradasReservadas: conteo.reservadas,
    proximos: eventosModel.getEventosProximos().slice(0, 3),
  });
}
module.exports = { mostrar };
