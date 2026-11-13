// Páginas de consultas. Renderiza vistas; las reglas viven en los models.
import * as eventosModel from '../../models/eventos.js';
import * as entradasModel from '../../models/entradas.js';
import { enriquecerEvento } from './comunes.js';

async function mostrar(req, res, next) {
  try {
    // El personal ve las ventas de los eventos de su centro; el ADMIN y el AUDITOR, de toda la red
    const eventos = eventosModel.eventosParaUsuario(req.usuario, await eventosModel.getAllEventos());
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
      // Métrica de abandono: compras web que no se concretaron (venció el tiempo o se canceló).
      // Solo para el negocio: el personal de los centros no ve los procesos de compra
      verMetricas: ['ADMIN', 'AUDITOR'].includes(req.usuario.rol),
      totalNoConcretadas: resumen.reduce((acc, e) => acc + e.vencidas, 0),
      totalEnCurso: resumen.reduce((acc, e) => acc + e.retenidas, 0),
    });
  } catch (error) {
    next(error);
  }
}
export { mostrar };
