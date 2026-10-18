import mongoose from 'mongoose';
import { SOLO_LETRAS, LARGO_MINIMO } from './formatos.js';

// Una sala chica no tiene sentido para el negocio: el mínimo es una regla del dominio
const CAPACIDAD_MINIMA = 10;

// Schema: la forma y las reglas de validación de cada documento de la colección "salas"
const salaSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre de la sala es obligatorio.'],
      trim: true,
      // TODO: permitir números en el nombre (salas reales como "Estudio 33" hoy quedan rechazadas)
      match: [SOLO_LETRAS, 'El nombre de la sala solo puede tener letras, sin números ni símbolos.'],
      minlength: [LARGO_MINIMO, `El nombre de la sala debe tener al menos ${LARGO_MINIMO} caracteres.`],
    },
    direccion: {
      type: String,
      required: [true, 'La dirección es obligatoria.'],
      trim: true,
      minlength: [LARGO_MINIMO, `La dirección debe tener al menos ${LARGO_MINIMO} caracteres.`],
    },
    capacidad: {
      type: Number,
      cast: 'La capacidad debe ser un número entero.',
      required: [true, 'La capacidad es obligatoria.'],
      min: [CAPACIDAD_MINIMA, `La capacidad no puede ser menor a ${CAPACIDAD_MINIMA} localidades.`],
      validate: {
        validator: Number.isInteger,
        message: 'La capacidad debe ser un número entero.',
      },
    },
    estado: {
      type: String,
      enum: ['ACTIVA', 'INACTIVA'],
      default: 'ACTIVA',
    },
  },
  { versionKey: false }
);

// Model: la clase con la que se consulta y se guarda en la colección "salas"
const Sala = mongoose.model('Sala', salaSchema);

async function getAllSalas() {
  return Sala.find();
}

async function contarSalas() {
  return Sala.countDocuments();
}

// Un id que ni siquiera tiene formato de ObjectId no puede existir: devolvemos null
// (como "no encontrada") en lugar de dejar que Mongoose lance un CastError
async function getSalaById(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return Sala.findById(id);
}

// Búsqueda exacta sin distinguir mayúsculas de minúsculas (strength 2 de la collation)
async function getSalaByName(nombre) {
  return Sala.findOne({ nombre: String(nombre).trim() }).collation({ locale: 'es', strength: 2 });
}

async function createSala({ nombre, capacidad, direccion }) {
  return Sala.create({ nombre, capacidad, direccion });
}

// Actualización parcial: solo se pisan los campos que vinieron definidos
async function updateSalaById(id, data) {
  const sala = await getSalaById(id);
  if (!sala) return null;

  const cambios = Object.fromEntries(
    Object.entries(data).filter(([, valor]) => valor !== undefined)
  );

  sala.set(cambios);
  return sala.save();
}

// Borrado lógico: alterna entre ACTIVA e INACTIVA
async function toggleSalaById(id) {
  const sala = await getSalaById(id);
  if (!sala) return null;

  sala.estado = sala.estado === 'ACTIVA' ? 'INACTIVA' : 'ACTIVA';
  return sala.save();
}

// Las salas que pueden recibir eventos nuevos
async function activas() {
  return Sala.find({ estado: 'ACTIVA' });
}

// Valida contra el Schema sin guardar. Devuelve el primer motivo de rechazo, o null.
async function validar({ nombre, capacidad, direccion }) {
  try {
    await new Sala({ nombre, capacidad, direccion }).validate();
    return null;
  } catch (error) {
    if (error.name !== 'ValidationError') throw error;
    return Object.values(error.errors)[0].message;
  }
}

export {
  Sala,
  CAPACIDAD_MINIMA,
  validar,
  activas,
  contarSalas,
  getAllSalas,
  getSalaById,
  getSalaByName,
  createSala,
  updateSalaById,
  toggleSalaById,
};
