// Model: la clase con la que se consulta y se guarda en la colección "entradas"
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
const Entrada = mongoose.model('Entrada', entradaSchema);


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

//Crea una entrada (reserva o venta directa, según el estado que le pase el controller)
async function createEntrada({ eventoId, clienteId, precio, estado }) {
  return Entrada.create({ eventoId, clienteId, precio, estado });
}

//Actualización parcial: solo se pisan los campos que vinieron definidos
async function updateEntradaById(id, data) {
  const entrada = await getEntradaById(id);
  if (!entrada) return null;

  const cambios = Object.fromEntries(
    Object.entries(data).filter(([, valor]) => valor !== undefined)
  );

  entrada.set(cambios);
  return entrada.save();
}

//Elimina una entrada por id (borrado físico). Devuelve true si existía, false si no
async function removeEntrada(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return false;
  const eliminada = await Entrada.findByIdAndDelete(id);
  return eliminada !== null;
}

//Lugares ocupados de un evento: vendidas y reservadas ocupan, canceladas liberan
async function lugaresOcupados(eventoId) {
  return Entrada.countDocuments({
    eventoId: Number(eventoId),
    estado: { $in: ['VALIDA', 'RESERVADA'] },
  });
}

//Transiciones válidas de una entrada. Devuelven el motivo del rechazo, o null.
function validarConfirmacion(entrada) {
  if (entrada.estado !== 'RESERVADA') return 'Solo se pueden confirmar entradas en estado RESERVADA.';
  return null;
}

function validarCancelacion(entrada) {
  if (entrada.estado === 'CANCELADA') return 'La entrada ya estaba cancelada.';
  return null;
}

//Conteo por estado. Sin argumento cuenta todas; si no, la lista que le pasen.
async function contarPorEstado(lista) {
  const entradas = lista || (await getAllEntradas());
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
  Entrada,
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
