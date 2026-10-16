// Model: la clase con la que se consulta y se guarda en la colección "entradas"
const Entrada = mongoose.model('Entrada', entradaSchema);
const fs = require('fs');
const path = require('path');

const mongoose = require('mongoose');

// Schema: la forma y las reglas de validación de cada documento de la colección "entradas"
const entradaSchema = new mongoose.Schema(
  {
    eventoId: {
      type: Number,
      cast: 'El campo "eventoId" debe ser un número.',
      required: [true, 'El campo "eventoId" es obligatorio.'],
    },
    clienteId: {
      type: Number,
      cast: 'El campo "clienteId" debe ser un número.',
      required: [true, 'El campo "clienteId" es obligatorio.'],
    },
    precio: {
      type: Number,
      cast: 'El precio debe ser un número.',
      required: [true, 'El precio es obligatorio.'],
      min: [0, 'El precio no puede ser negativo.'],
    },
    estado: {
      type: String,
      enum: {
        values: ['VALIDA', 'RESERVADA', 'CANCELADA'],
        message: 'El estado debe ser VALIDA, RESERVADA o CANCELADA.',
      },
      default: 'VALIDA',
    },
  },
  { versionKey: false }
);

const filePath = path.join(__dirname, '..', 'data', 'entradas.json');

// Devuelve todas las entradas
async function getAllEntradas() {
  return Entrada.find();
}

//Devuelve una entrada puntual por id. Un id que no tiene formato de ObjectId
//no puede existir: devolvemos null (como "no encontrada") en vez de un CastError
async function getEntradaById(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return Entrada.findById(id);
}

//Entradas de un evento en particular (todas, sin filtrar por estado)
async function getEntradasByEvento(eventoId) {
  return Entrada.find({ eventoId: Number(eventoId) });
}

// Crea una entrada (reserva o venta directa, según el estado que le pase el controller)
async function createEntrada({ eventoId, clienteId, precio, estado }) {
  return Entrada.create({ eventoId, clienteId, precio, estado });
}

// Actualiza una entrada por id (uso general: cambia solo los campos definidos)
function updateEntradaById(id, data) {
  const entradas = getAllEntradas();
  const idx = entradas.findIndex((e) => e.id === Number(id));
  if (idx === -1) return null;

  const cambios = Object.fromEntries(
    Object.entries(data).filter(([, valor]) => valor !== undefined)
  );

  entradas[idx] = { ...entradas[idx], ...cambios, id: entradas[idx].id };
  fs.writeFileSync(filePath, JSON.stringify(entradas, null, 2), 'utf-8');
  return entradas[idx];
}

// Elimina una entrada por id (borrado físico)
function removeEntrada(id) {
  const entradas = getAllEntradas();
  const idx = entradas.findIndex((e) => e.id === Number(id));
  if (idx === -1) return false;
  entradas.splice(idx, 1);
  fs.writeFileSync(filePath, JSON.stringify(entradas, null, 2), 'utf-8');
  return true;
}

// Lugares ocupados de un evento: vendidas y reservadas ocupan, canceladas liberan
function lugaresOcupados(eventoId) {
  return getEntradasByEvento(eventoId).filter(
    (e) => e.estado === 'VALIDA' || e.estado === 'RESERVADA'
  ).length;
}

// Transiciones válidas de una entrada. Devuelven el motivo del rechazo, o null.
function validarConfirmacion(entrada) {
  if (entrada.estado !== 'RESERVADA') return 'Solo se pueden confirmar entradas en estado RESERVADA.';
  return null;
}

function validarCancelacion(entrada) {
  if (entrada.estado === 'CANCELADA') return 'La entrada ya estaba cancelada.';
  return null;
}

// Conteo por estado. Sin argumento cuenta todas; si no, la lista que le pasen.
function contarPorEstado(lista) {
  const entradas = lista || getAllEntradas();
  return {
    vendidas: entradas.filter((e) => e.estado === 'VALIDA').length,
    reservadas: entradas.filter((e) => e.estado === 'RESERVADA').length,
    canceladas: entradas.filter((e) => e.estado === 'CANCELADA').length,
    vigentes: entradas.filter((e) => e.estado !== 'CANCELADA').length,
  };
}

// El precio de una entrada: número, y nunca negativo
function validarPrecio(valor) {
  const p = Number(valor);
  if (valor === undefined || valor === null || String(valor).trim() === '' || isNaN(p)) {
    return 'El precio debe ser un número.';
  }
  if (p < 0) return 'El precio no puede ser negativo.';
  return null;
}

module.exports = {
  validarPrecio,
  validarConfirmacion,
  validarCancelacion,
  contarPorEstado,
  getAllEntradas,
  getEntradaById,
  getEntradasByEvento,
  lugaresOcupados,
  createEntrada,
  updateEntradaById,
  removeEntrada,
};
