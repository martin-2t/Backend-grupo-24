// Páginas del cliente: la compra web y "Mis entradas". Solo el rol CLIENTE llega acá (lo
// controla la ruta) y cada cliente opera únicamente sobre lo suyo: una compra o una entrada
// ajena responde "no encontrada", sin revelar que existe.
//
// La compra tiene dos pasos, como en cualquier ticketera: al elegir la cantidad se retienen
// los lugares RETENCION_MINUTOS (estado RETENIDA) y se muestra la pantalla de pago. Las
// entradas existen recién cuando el cliente paga (el pago es simulado).
import * as entradasModel from '../../models/entradas.js';
import * as eventosModel from '../../models/eventos.js';
import { volver, volverConError, enriquecerEvento, qrDeIngreso } from './comunes.js';

// Para cada entrada que tiene un QR que sirve (VALIDA de un evento por venir), la imagen del QR
async function conQr(req, item) {
  const qr = item.situacion === 'VIGENTE' ? await qrDeIngreso(req, item.entrada.codigo) : null;
  return { ...item, qr };
}

// POST /panel/compras  { eventoId, cantidad }: retiene los lugares y lleva a la pantalla de pago
async function crearCompra(req, res, next) {
  try {
    const { eventoId, cantidad } = req.body;
    const volverAlEvento = '/panel/eventos/' + encodeURIComponent(eventoId || '');

    const chequeo = await eventosModel.validarVenta(eventoId, req.usuario.clienteId);
    if (chequeo.error) return volverConError(res, volverAlEvento, chequeo.error);
    if (entradasModel.eventoYaPaso(chequeo.evento.fecha)) {
      return volverConError(res, volverAlEvento, 'El evento ya pasó: no se pueden comprar entradas.');
    }

    const resultado = await entradasModel.crearCompra({
      eventoId,
      clienteId: req.usuario.clienteId,
      precio: chequeo.evento.precio,
      cantidad,
    });
    if (resultado.error) return volverConError(res, volverAlEvento, resultado.error);
    res.redirect('/panel/compras/' + resultado.compraId);
  } catch (error) {
    next(error);
  }
}

// GET /panel/compras/:compraId: la pantalla de pago (en curso), las entradas compradas (pagada)
// o el aviso de que no se concretó (vencida)
async function mostrarCompra(req, res, next) {
  try {
    const compra = await entradasModel.getCompra(req.params.compraId, req.usuario.clienteId);
    if (!compra) return next();

    const evento = await eventosModel.getEventoById(compra.eventoId);
    const entradas = compra.estado === 'PAGADA'
      ? await Promise.all(
        compra.entradas.map(async (entrada) => ({ entrada, qr: await qrDeIngreso(req, entrada.codigo) }))
      )
      : [];

    res.render('compras/compra', {
      titulo: compra.estado === 'PAGADA' ? 'Compra confirmada' : 'Tu compra',
      compra,
      evento: evento ? await enriquecerEvento(evento) : null,
      entradas,
      venceA: compra.venceEn ? entradasModel.fechaYHora(compra.venceEn).split(' a las ')[1] : null,
      minutos: entradasModel.minutosDeRetencion(),
    });
  } catch (error) {
    next(error);
  }
}

// POST /panel/compras/:compraId/pagar: el pago es simulado. Las retenidas pasan a VALIDA
async function pagarCompra(req, res, next) {
  try {
    const ruta = '/panel/compras/' + encodeURIComponent(req.params.compraId);
    const resultado = await entradasModel.pagarCompra(req.params.compraId, req.usuario.clienteId);
    if (resultado.status === 404) return next();
    if (resultado.error) return volverConError(res, ruta, resultado.error);
    volver(res, ruta, '¡Compra confirmada! Ya tenés tus entradas.');
  } catch (error) {
    next(error);
  }
}

// POST /panel/compras/:compraId/cancelar: los lugares retenidos se liberan en el acto
async function cancelarCompra(req, res, next) {
  try {
    const compra = await entradasModel.getCompra(req.params.compraId, req.usuario.clienteId);
    if (!compra) return next();

    const volverAlEvento = '/panel/eventos/' + compra.eventoId;
    const resultado = await entradasModel.cancelarCompra(req.params.compraId, req.usuario.clienteId);
    if (resultado.error) return volverConError(res, volverAlEvento, resultado.error);
    volver(res, volverAlEvento, 'Compra cancelada: los lugares quedaron libres.');
  } catch (error) {
    next(error);
  }
}

// GET /panel/mis-entradas: próximas (con su QR) e historial
async function misEntradas(req, res, next) {
  try {
    const entradas = await entradasModel.entradasVisiblesDelCliente(req.usuario.clienteId);
    const ids = [...new Set(entradas.map((e) => String(e.eventoId)))];
    const eventos = await Promise.all(ids.map((id) => eventosModel.getEventoById(id)));
    const eventosPorId = Object.fromEntries(eventos.filter(Boolean).map((e) => [String(e.id), e]));

    const { proximas, historial } = entradasModel.agruparEntradasDelCliente(entradas, eventosPorId);
    res.render('mis-entradas/list', {
      titulo: 'Mis entradas',
      proximas: await Promise.all(proximas.map((item) => conQr(req, item))),
      historial,
    });
  } catch (error) {
    next(error);
  }
}

// GET /panel/mis-entradas/:id: una entrada con su QR grande, para mostrar en la puerta
async function miEntrada(req, res, next) {
  try {
    const entradas = await entradasModel.entradasVisiblesDelCliente(req.usuario.clienteId);
    const entrada = entradas.find((e) => String(e.id) === String(req.params.id));
    if (!entrada) return next(); // ajena, inexistente o una compra no concretada: "no encontrada"

    const evento = await eventosModel.getEventoById(entrada.eventoId);
    const eventosPorId = evento ? { [String(evento.id)]: evento } : {};
    const [item] = [
      ...Object.values(entradasModel.agruparEntradasDelCliente([entrada], eventosPorId)).flat(),
    ];
    res.render('mis-entradas/entrada', {
      titulo: 'Mi entrada',
      item: await conQr(req, item),
      evento: evento ? await enriquecerEvento(evento) : null,
    });
  } catch (error) {
    next(error);
  }
}

export { crearCompra, mostrarCompra, pagarCompra, cancelarCompra, misEntradas, miEntrada };
