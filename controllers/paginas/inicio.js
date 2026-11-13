// Páginas de inicio del panel. Renderiza vistas; las reglas viven en los models.
import * as eventosModel from '../../models/eventos.js';
import * as salasModel from '../../models/salas.js';
import * as clientesModel from '../../models/clientes.js';
import * as entradasModel from '../../models/entradas.js';
import { enriquecerEvento } from './comunes.js';

// Inicio del cliente: un saludo, cuántas entradas tiene para próximos eventos y la cartelera
// que viene. Sin los números de gestión del personal (salas, clientes, ventas)
async function inicioCliente(req, res) {
  const entradas = await entradasModel.entradasVisiblesDelCliente(req.usuario.clienteId);
  const ids = [...new Set(entradas.map((e) => String(e.eventoId)))];
  const eventos = (await Promise.all(ids.map((id) => eventosModel.getEventoById(id)))).filter(Boolean);
  const { proximas } = entradasModel.agruparEntradasDelCliente(
    entradas, Object.fromEntries(eventos.map((e) => [String(e.id), e]))
  );
  res.render('index-cliente', {
    titulo: 'Inicio',
    misProximas: proximas.length,
    proximos: await Promise.all((await eventosModel.getEventosProximos()).slice(0, 5).map(enriquecerEvento)),
  });
}

async function mostrar(req, res, next) {
  try {
    if (req.usuario.rol === 'CLIENTE') return await inicioCliente(req, res);
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
