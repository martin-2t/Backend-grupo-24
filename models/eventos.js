import mongoose from 'mongoose';
import * as salasModel from './salas.js';
import * as entradasModel from './entradas.js';
import * as clientesModel from './clientes.js';
import { LARGO_MINIMO, texto, numero } from './formatos.js';

// Schema: la forma y las reglas de validación de cada documento de la colección "eventos".
// Cada evento pertenece a una Sala (salaId)
const eventoSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre del evento es obligatorio.'],
      trim: true,
      minlength: [LARGO_MINIMO, `El nombre del evento debe tener al menos ${LARGO_MINIMO} caracteres.`],
    },
    descripcion: {
      type: String,
      trim: true,
    },
    fecha: {
      type: Date,
      cast: 'La fecha es obligatoria y debe ser válida.',
      required: [true, 'La fecha es obligatoria y debe ser válida.'],
    },
    // El _id (ObjectId) de una sala de MongoDB
    salaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sala',
      cast: 'El campo "salaId" no es un ID de sala válido.',
      required: [true, 'La sala es obligatoria.'],
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
        values: ['PROGRAMADO', 'FINALIZADO', 'CANCELADO'],
        message: 'El estado debe ser PROGRAMADO, FINALIZADO o CANCELADO.',
      },
      default: 'PROGRAMADO',
    },
  },
  { versionKey: false }
);

// Model: la clase con la que se consulta y se guarda en la colección "eventos"
const Evento = mongoose.model('Evento', eventoSchema);

// READ | Todos los eventos
async function getAllEventos() {
  return Evento.find();
}

async function contarEventos() {
  return Evento.countDocuments();
}

// READ | Un evento puntual. Un id sin formato de ObjectId no puede existir:
// devolvemos null (como "no encontrado") en vez de dejar que Mongoose lance un CastError
async function getEventoById(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return Evento.findById(id);
}

// READ | Eventos próximos: fecha futura y todavía PROGRAMADO, el más cercano primero
async function getEventosProximos() {
  return Evento.find({ estado: 'PROGRAMADO', fecha: { $gt: new Date() } }).sort({ fecha: 1 });
}

// CREATE | El _id lo genera MongoDB y el estado arranca en PROGRAMADO (default del Schema)
async function createEvento({ nombre, descripcion, fecha, salaId, precio }) {
  return Evento.create({ nombre, descripcion, fecha, salaId, precio });
}

// UPDATE | Actualización parcial: solo se pisan los campos que vinieron definidos.
// save() vuelve a validar el documento completo contra el Schema.
async function updateEventoById(id, data) {
  const evento = await getEventoById(id);
  if (!evento) return null;

  const cambios = Object.fromEntries(
    Object.entries(data).filter(([, valor]) => valor !== undefined)
  );

  evento.set(cambios);
  return evento.save();
}

// UPDATE | Marca el evento como FINALIZADO (no permite más ventas)
async function finalizarEvento(id) {
  return updateEventoById(id, { estado: 'FINALIZADO' });
}

// Entradas que se arrastrarían si se cancelara este evento. La usan tanto el aviso
// de confirmación como la cancelación misma, para que digan siempre lo mismo.
async function entradasQueSeCancelan(id) {
  const entradas = await entradasModel.getEntradasByEvento(id);
  return entradas.filter((e) => e.estado !== 'CANCELADA');
}

// DELETE lógico | Cancela el evento y arrastra sus entradas: no puede quedar una
// entrada válida de algo que no va a suceder.
async function cancelarEvento(id) {
  const aCancelar = await entradasQueSeCancelan(id);
  await Promise.all(aCancelar.map((e) => entradasModel.updateEntradaById(e.id, { estado: 'CANCELADA' })));
  return updateEventoById(id, { estado: 'CANCELADO' });
}

// ---- Reglas que cruzan entidades ----
// Viven acá porque el evento es lo que ata sala, cliente y entradas. Poniéndolas de
// este lado ningún otro model necesita conocer a eventos, y no se arman ciclos.

// Transiciones válidas de un evento. Devuelven el motivo del rechazo, o null.
function validarFinalizacion(evento) {
  if (evento.estado !== 'PROGRAMADO') return 'Solo se puede finalizar un evento PROGRAMADO.';
  return null;
}

function validarCancelacion(evento) {
  if (evento.estado === 'CANCELADO') return 'El evento ya estaba cancelado.';
  return null;
}

// Eventos que todavía pueden vender entradas
async function programados() {
  return Evento.find({ estado: 'PROGRAMADO' });
}

// Reactivar una sala nunca se bloquea; darla de baja sí, si tiene eventos encima
async function validarCambioDeEstadoDeSala(sala) {
  if (sala.estado !== 'ACTIVA') return null;
  return validarBajaDeSala(sala.id);
}

async function programadosEnSala(salaId) {
  if (!mongoose.isObjectIdOrHexString(salaId)) return [];
  return Evento.find({ salaId, estado: 'PROGRAMADO' });
}

// Lugares ocupados del evento más lleno de una sala: el piso al que puede bajar su capacidad
async function ocupacionMaximaEnSala(salaId) {
  const eventos = await programadosEnSala(salaId);
  const ocupados = await Promise.all(eventos.map((e) => entradasModel.lugaresOcupados(e.id)));
  return Math.max(0, ...ocupados);
}

// Un evento programado ocupa su sala: mientras exista, la sala no se puede dar de baja
async function validarBajaDeSala(salaId) {
  const programados = await programadosEnSala(salaId);
  if (!programados.length) return null;
  return 'No se puede dar de baja: la sala tiene ' + programados.length +
    (programados.length === 1 ? ' evento programado' : ' eventos programados') +
    '. Finalizalos o cancelalos primero.';
}

// Achicar una sala no puede dejar afuera entradas ya vendidas o reservadas
async function validarCapacidadDeSala(salaId, nuevaCapacidad) {
  const ocupados = await ocupacionMaximaEnSala(salaId);
  const c = numero(nuevaCapacidad);
  if (isNaN(c) || c >= ocupados) return null;
  return 'No se puede bajar la capacidad a ' + c + ': hay un evento programado con ' +
    ocupados + ' lugares ya ocupados.';
}

// Qué hace válido a un evento. Al editar recibe el evento actual, porque algunas
// reglas dependen de lo que ya pasó con él.
async function validar({ nombre, fecha, salaId, precio }, eventoActual) {
  const n = texto(nombre);
  if (!n) return 'El nombre del evento es obligatorio.';
  if (n.length < LARGO_MINIMO) return 'El nombre del evento debe tener al menos ' + LARGO_MINIMO + ' caracteres.';

  // La fecha puede llegar como texto (del body) o como Date (del documento guardado)
  const f = fecha instanceof Date ? fecha : texto(fecha);
  if (!f || isNaN(new Date(f).getTime())) return 'La fecha es obligatoria y debe ser válida.';
  // Un evento nuevo no puede nacer en el pasado. Al editar uno viejo sí se permite,
  // para poder corregir datos de eventos que ya ocurrieron.
  if (!eventoActual && new Date(f) <= new Date()) {
    return 'La fecha del evento tiene que ser posterior a este momento.';
  }

  const sala = await salasModel.getSalaById(salaId);
  if (!sala) return 'Elegí una sala existente.';

  // Se puede conservar una sala dada de baja al editar, pero no mudarse a una
  const cambiaDeSala = !eventoActual || String(salaId) !== String(eventoActual.salaId);
  if (cambiaDeSala && sala.estado !== 'ACTIVA') {
    return 'La sala "' + sala.nombre + '" está dada de baja: elegí una activa.';
  }

  const p = numero(precio);
  if (isNaN(p) || p < 0) return 'El precio es obligatorio y debe ser un número mayor o igual a cero.';

  // Si mueven el evento a otra sala, tiene que entrar la gente que ya compró
  if (eventoActual) {
    const ocupados = await entradasModel.lugaresOcupados(eventoActual.id);
    if (sala.capacidad < ocupados) {
      return 'La sala "' + sala.nombre + '" tiene capacidad ' + sala.capacidad +
        ' y este evento ya tiene ' + ocupados + ' lugares ocupados.';
    }
  }

  return null;
}

// ¿Este evento admite venderle o reservarle una entrada a este cliente?
async function validarVenta(eventoId, clienteId) {
  const evento = await getEventoById(eventoId);
  if (!evento) return { error: 'El evento indicado no existe.' };
  if (evento.estado !== 'PROGRAMADO') {
    return { error: 'El evento ya finalizó o fue cancelado: no admite nuevas entradas.' };
  }

  if (!(await clientesModel.getById(clienteId))) return { error: 'El cliente indicado no existe.' };

  const sala = await salasModel.getSalaById(evento.salaId);
  if (!sala) return { error: 'El evento no tiene una sala válida asociada.' };
  if (sala.estado !== 'ACTIVA') {
    return { error: 'La sala "' + sala.nombre + '" está dada de baja: no se pueden vender entradas.' };
  }

  if ((await entradasModel.lugaresOcupados(evento.id)) >= sala.capacidad) {
    return { error: 'No quedan lugares disponibles para este evento.' };
  }

  return { evento, sala };
}

export {
  Evento,
  getAllEventos,
  contarEventos,
  getEventoById,
  getEventosProximos,
  createEvento,
  updateEventoById,
  finalizarEvento,
  cancelarEvento,
  entradasQueSeCancelan,
  programadosEnSala,
  ocupacionMaximaEnSala,
  validarBajaDeSala,
  validarCambioDeEstadoDeSala,
  validarFinalizacion,
  validarCancelacion,
  programados,
  validarCapacidadDeSala,
  validar,
  validarVenta,
};
