// Model: la clase con la que se consulta y se guarda en la colección "entradas"
import mongoose from 'mongoose';

// Schema: la forma y las reglas de validación de cada documento de la colección "entradas"
const entradaSchema = new mongoose.Schema(
  {
    // El _id (ObjectId) de un evento de MongoDB
    eventoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evento',
      cast: 'El campo "eventoId" no es un ID de evento válido.',
      required: [true, 'El campo "eventoId" es obligatorio.'],
    },
    // El _id (ObjectId) de un cliente de MongoDB
    clienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cliente',
      cast: 'El campo "clienteId" no es un ID de cliente válido.',
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
  if (!mongoose.isObjectIdOrHexString(eventoId)) return [];
  return Entrada.find({ eventoId });
}

// ---- Stock único: control de sobreventa ----
// Cada evento lleva un contador "lugaresOcupados". Contar las entradas y después crear la
// nueva no alcanza: si dos compras llegan juntas por el último lugar, las dos cuentan
// "queda uno" y las dos se crean. Por eso el lugar se ocupa con UNA sola operación de
// MongoDB, "sumá 1 solo si todavía hay lugar", que es atómica: dos compras nunca pueden
// ganar el mismo lugar.
//
// Los models Evento y Sala se piden por nombre a Mongoose (en vez de importarlos) porque
// models/eventos.js ya importa este archivo, y así no se arma un ciclo de imports.

const OCUPAN_LUGAR = ['VALIDA', 'RESERVADA'];
const SIN_LUGARES = 'No quedan lugares disponibles para este evento.';

function ocupaLugar(estado) {
  return OCUPAN_LUGAR.includes(estado);
}

// Pone el contador en el valor real contando las entradas. Lo usa la semilla después de
// cargar los datos, porque insertMany no pasa por createEntrada
async function recalcularLugares(eventoId) {
  const ocupados = await lugaresOcupados(eventoId);
  await mongoose.model('Evento').updateOne({ _id: eventoId }, { $set: { lugaresOcupados: ocupados } });
}

// Los eventos creados antes de que existiera el contador no lo tienen guardado: la primera
// vez se calcula contando. El filtro $exists hace que solo lo inicialice una petición
async function inicializarContador(eventoId) {
  const ocupados = await lugaresOcupados(eventoId);
  await mongoose.model('Evento').updateOne(
    { _id: eventoId, lugaresOcupados: { $exists: false } },
    { $set: { lugaresOcupados: ocupados } }
  );
}

// Intenta ocupar un lugar del evento. Devuelve true si lo consiguió, false si está lleno
async function ocuparLugar(eventoId) {
  const Evento = mongoose.model('Evento');
  const evento = await Evento.findById(eventoId);
  if (!evento) return false;
  const sala = await mongoose.model('Sala').findById(evento.salaId);
  if (!sala) return false;

  await inicializarContador(eventoId);

  // La operación atómica: si el contador ya llegó a la capacidad, el filtro no encuentra
  // el evento, no se suma nada y devuelve null
  const ocupado = await Evento.findOneAndUpdate(
    { _id: eventoId, lugaresOcupados: { $lt: sala.capacidad } },
    { $inc: { lugaresOcupados: 1 } }
  );
  return ocupado !== null;
}

// Devuelve un lugar al stock (entrada cancelada o eliminada). Nunca baja de cero
async function liberarLugar(eventoId) {
  await mongoose.model('Evento').updateOne(
    { _id: eventoId, lugaresOcupados: { $gt: 0 } },
    { $inc: { lugaresOcupados: -1 } }
  );
}

//Crea una entrada (reserva o venta directa, según el estado que le pase el controller).
//Primero ocupa el lugar; si el evento está lleno no crea nada y devuelve null
async function createEntrada({ eventoId, clienteId, precio, estado = 'VALIDA' }) {
  if (ocupaLugar(estado) && !(await ocuparLugar(eventoId))) return null;

  try {
    return await Entrada.create({ eventoId, clienteId, precio, estado });
  } catch (error) {
    // Si la entrada no se pudo guardar (por ejemplo, un dato inválido), el lugar vuelve al stock
    if (ocupaLugar(estado)) await liberarLugar(eventoId);
    throw error;
  }
}

//Actualización parcial: solo se pisan los campos que vinieron definidos.
//Si la entrada pasa a CANCELADA, su lugar vuelve al stock. El camino inverso no existe:
//una entrada cancelada no se reactiva (lo impiden validarConfirmacion y validarCancelacion)
async function updateEntradaById(id, data) {
  const entrada = await getEntradaById(id);
  if (!entrada) return null;

  const cambios = Object.fromEntries(
    Object.entries(data).filter(([, valor]) => valor !== undefined)
  );

  const ocupabaLugar = ocupaLugar(entrada.estado);
  entrada.set(cambios);
  const guardada = await entrada.save();

  if (ocupabaLugar && !ocupaLugar(guardada.estado)) await liberarLugar(guardada.eventoId);
  return guardada;
}

//Elimina una entrada por id (borrado físico). Devuelve true si existía, false si no.
//Si la entrada ocupaba un lugar, lo devuelve al stock
async function removeEntrada(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return false;
  const eliminada = await Entrada.findByIdAndDelete(id);
  if (!eliminada) return false;

  if (ocupaLugar(eliminada.estado)) await liberarLugar(eliminada.eventoId);
  return true;
}

//Lugares ocupados de un evento: vendidas y reservadas ocupan, canceladas liberan
async function lugaresOcupados(eventoId) {
  if (!mongoose.isObjectIdOrHexString(eventoId)) return 0;
  return Entrada.countDocuments({
    eventoId,
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

export {
  Entrada,
  SIN_LUGARES,
  recalcularLugares,
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
