const mongoose = require('mongoose');
const { SOLO_LETRAS, SOLO_DIGITOS, EMAIL } = require('./formatos');
const entradasModel = require('./entradas');

const TELEFONO_MINIMO = 10;

// El teléfono es opcional: un texto vacío (como llega desde el formulario del panel)
// se guarda como "sin teléfono" en vez de fallar el minlength
const vacioAUndefined = (valor) =>
  typeof valor === 'string' && valor.trim() === '' ? undefined : valor;

// Schema: la forma y las reglas de validación de cada documento de la colección "clientes"
const clienteSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio.'],
      trim: true,
      match: [SOLO_LETRAS, 'El nombre solo puede tener letras, sin números ni símbolos.'],
    },
    apellido: {
      type: String,
      required: [true, 'El apellido es obligatorio.'],
      trim: true,
      match: [SOLO_LETRAS, 'El apellido solo puede tener letras, sin números ni símbolos.'],
    },
    email: {
      type: String,
      required: [true, 'El email es obligatorio.'],
      trim: true,
      match: [EMAIL, 'El email no tiene un formato válido.'],
    },
    telefono: {
      type: String,
      trim: true,
      set: vacioAUndefined,
      match: [SOLO_DIGITOS, 'El teléfono solo puede tener números, sin letras ni símbolos.'],
      minlength: [TELEFONO_MINIMO, `El teléfono debe tener al menos ${TELEFONO_MINIMO} dígitos.`],
    },
  },
  { versionKey: false }
);

// Model: la clase con la que se consulta y se guarda en la colección "clientes"
const Cliente = mongoose.model('Cliente', clienteSchema);

async function getAll() {
  return Cliente.find();
}

async function contarClientes() {
  return Cliente.countDocuments();
}

// Un id sin formato de ObjectId no puede existir: devolvemos null (404)
// en lugar de dejar que Mongoose lance un CastError
async function getById(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return Cliente.findById(id);
}

// Búsqueda exacta por email sin distinguir mayúsculas (venta en boletería y registro web)
async function getByEmail(email) {
  return Cliente.findOne({ email: String(email).trim() }).collation({ locale: 'es', strength: 2 });
}

async function create({ nombre, apellido, email, telefono }) {
  return Cliente.create({ nombre, apellido, email, telefono });
}

// Actualización parcial: solo se pisan los campos que vinieron definidos.
// save() vuelve a validar el documento completo contra el Schema.
async function update(id, cambios) {
  const cliente = await getById(id);
  if (!cliente) return null;

  const cambiosLimpios = Object.fromEntries(
    Object.entries(cambios).filter(([, valor]) => valor !== undefined)
  );

  cliente.set(cambiosLimpios);
  return cliente.save();
}

// Borrado físico. Devuelve true si existía, false si no
async function remove(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return false;
  const eliminado = await Cliente.findByIdAndDelete(id);
  return eliminado !== null;
}

// Valida contra el Schema sin guardar. Devuelve el primer motivo de rechazo, o null.
async function validar({ nombre, apellido, email, telefono }) {
  try {
    await new Cliente({ nombre, apellido, email, telefono }).validate();
    return null;
  } catch (error) {
    if (error.name !== 'ValidationError') throw error;
    return Object.values(error.errors)[0].message;
  }
}

// clienteId en las entradas es un ObjectId: lo comparamos como texto
async function entradasDelCliente(id) {
  const entradas = await entradasModel.getAllEntradas();
  return entradas.filter((e) => String(e.clienteId) === String(id));
}

// El borrado de cliente es físico: una entrada sin titular quedaría huérfana
async function tieneEntradasVigentes(id) {
  const entradas = await entradasDelCliente(id);
  return entradas.some((e) => e.estado !== 'CANCELADA');
}

module.exports = {
  Cliente,
  TELEFONO_MINIMO,
  validar,
  tieneEntradasVigentes,
  entradasDelCliente,
  contarClientes,
  getAll,
  getById,
  getByEmail,
  create,
  update,
  remove,
};
