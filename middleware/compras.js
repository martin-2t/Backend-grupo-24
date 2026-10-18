// Reglas de compra según quién vende. Se ubican antes del controller de entradas, que
// sigue recibiendo siempre un eventoId y un clienteId.
import * as clientesModel from '../models/clientes.js';
import * as entradasModel from '../models/entradas.js';

// Compra web: un CLIENTE solo compra para sí mismo y paga el precio del evento.
// Pisamos el clienteId con el suyo y descartamos cualquier precio que haya enviado.
function compraComoCliente(req, res, next) {
  if (req.usuario.rol === 'CLIENTE') {
    req.body.clienteId = String(req.usuario.clienteId);
    delete req.body.precio;
  }
  next();
}

// Venta en boletería: el EMPLEADO (o un ADMIN) puede indicar un clienteId existente o enviar
// los datos del comprador en "cliente". Si ya existe un cliente con ese email se usa ese;
// si no, se crea en el momento.
async function clienteDeBoleteria(req, res, next) {
  try {
    const { clienteId, cliente } = req.body;
    if (req.usuario.rol === 'CLIENTE' || clienteId || !cliente) return next();

    const existente = cliente.email ? await clientesModel.getByEmail(cliente.email) : null;
    if (existente) {
      req.body.clienteId = existente.id;
      return next();
    }

    const error = await clientesModel.validar(cliente);
    if (error) {
      return res.status(400).json({ error: 'Datos del comprador: ' + error });
    }
    const nuevo = await clientesModel.create(cliente);
    req.body.clienteId = nuevo.id;
    next();
  } catch (error) {
    next(error);
  }
}

// Un CLIENTE solo puede ver sus propias entradas
async function entradaPropia(req, res, next) {
  try {
    if (req.usuario.rol !== 'CLIENTE') return next();

    const entrada = await entradasModel.getEntradaById(req.params.id);
    if (entrada && String(entrada.clienteId) !== String(req.usuario.clienteId)) {
      return res.status(403).json({ error: 'Esa entrada no es tuya.' });
    }
    next();
  } catch (error) {
    next(error);
  }
}

export { compraComoCliente, clienteDeBoleteria, entradaPropia };
