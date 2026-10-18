// Páginas de inicio del panel. Renderiza vistas; las reglas viven en los models.
import * as eventosModel from '../../models/eventos.js';
import * as salasModel from '../../models/salas.js';
import * as clientesModel from '../../models/clientes.js';
import * as entradasModel from '../../models/entradas.js';

async function mostrar(req, res, next) {
  try {
    const conteo = await entradasModel.contarPorEstado();
    res.render('index', {
      titulo: 'Panel Urbana Cult',
      totalEventos: await eventosModel.contarEventos(),
      totalSalas: await salasModel.contarSalas(),
      totalClientes: await clientesModel.contarClientes(),
      entradasVendidas: conteo.vendidas,
      entradasReservadas: conteo.reservadas,
      proximos: (await eventosModel.getEventosProximos()).slice(0, 3),
    });
  } catch (error) {
    next(error);
  }
}
export { mostrar };
