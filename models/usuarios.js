import crypto from 'crypto';
import mongoose from 'mongoose';
import { EMAIL } from './formatos.js';
import * as salasModel from './salas.js';
import * as clientesModel from './clientes.js';

const ROLES = ['ADMIN', 'EMPLEADO', 'CLIENTE'];
const PASSWORD_MINIMO = 8;

// Política de intentos fallidos: al tercer error, la cuenta se bloquea por un tiempo
const INTENTOS_MAXIMOS = 3;
const MINUTOS_BLOQUEO = 15;

// Basado en el modelo de la Clase 10 (passwordHash + salt con PBKDF2), con el agregado
// de rol, centro (salaId) y ficha de cliente (clienteId) para el control de acceso
const usuarioSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio.'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'El email es obligatorio.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL, 'El email no tiene un formato válido.'],
    },
    passwordHash: {
      type: String,
      required: true,
    },
    salt: {
      type: String,
      required: true,
    },
    rol: {
      type: String,
      enum: { values: ROLES, message: 'El rol debe ser ADMIN, EMPLEADO o CLIENTE.' },
      required: [true, 'El rol es obligatorio.'],
    },
    // El centro donde trabaja: solo lo tienen (y lo necesitan) los empleados
    salaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sala',
      required: [
        function () { return this.rol === 'EMPLEADO'; },
        'Un empleado debe tener un centro asignado (salaId).',
      ],
    },
    // Persona vs usuario: el cliente que compra por la web tiene además su ficha en "clientes"
    clienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cliente',
      required: [
        function () { return this.rol === 'CLIENTE'; },
        'Un usuario cliente debe estar asociado a una ficha de cliente (clienteId).',
      ],
    },
    estado: {
      type: String,
      enum: { values: ['ACTIVO', 'SUSPENDIDO'], message: 'El estado debe ser ACTIVO o SUSPENDIDO.' },
      default: 'ACTIVO',
    },
    intentosFallidos: {
      type: Number,
      default: 0,
    },
    // Mientras esta fecha sea futura, la cuenta no puede ingresar
    bloqueadoHasta: {
      type: Date,
      default: null,
    },
    ultimoAcceso: {
      type: Date,
      default: null,
    },
  },
  {
    versionKey: false,
    timestamps: true,
    // El hash y el salt nunca salen en las respuestas de la API
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.salt;
        return ret;
      },
    },
  }
);

// Método del usuario para validar una contraseña al iniciar sesión (igual a la Clase 10)
usuarioSchema.methods.validarPassword = function (password) {
  // Genera nuevamente el hash con la contraseña ingresada + el salt guardado
  const hash = crypto.pbkdf2Sync(password, this.salt, 10000, 64, 'sha512').toString('hex');
  // Lo compara con el hash guardado en la base de datos
  return this.passwordHash === hash;
};

// ¿La cuenta está bloqueada ahora mismo por intentos fallidos?
usuarioSchema.methods.estaBloqueado = function () {
  return Boolean(this.bloqueadoHasta && this.bloqueadoHasta > new Date());
};

// Genera salt aleatorio y hash para guardar una contraseña nueva (igual a la Clase 10)
usuarioSchema.statics.crearPasswordSeguro = function (password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, passwordHash };
};

const Usuario = mongoose.model('Usuario', usuarioSchema);

async function getAll() {
  return Usuario.find();
}

async function getById(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return Usuario.findById(id);
}

async function getByEmail(email) {
  return Usuario.findOne({ email: String(email).trim().toLowerCase() });
}

// Política mínima de contraseñas (Bloque 8). Devuelve el motivo del rechazo, o null.
function chequearPassword(password) {
  if (!password || typeof password !== 'string') return 'La contraseña es obligatoria.';
  if (password.length < PASSWORD_MINIMO) {
    return `La contraseña debe tener al menos ${PASSWORD_MINIMO} caracteres.`;
  }
  return null;
}

// "Existencia de registros relacionados": el centro y la ficha de cliente deben existir
async function chequearReferencias({ rol, salaId, clienteId }) {
  if (rol === 'EMPLEADO' && salaId && !(await salasModel.getSalaById(salaId))) {
    return 'La sala indicada como centro del empleado no existe.';
  }
  if (rol === 'CLIENTE' && clienteId && !(await clientesModel.getById(clienteId))) {
    return 'La ficha de cliente indicada no existe.';
  }
  return null;
}

// Recibe la contraseña en texto: el hash se calcula acá y es lo único que se guarda
async function create({ nombre, email, password, rol, salaId, clienteId }) {
  const { salt, passwordHash } = Usuario.crearPasswordSeguro(password);
  return Usuario.create({ nombre, email, passwordHash, salt, rol, salaId, clienteId });
}

// Actualización parcial. Si viene una contraseña nueva, se vuelve a hashear.
async function update(id, { password, ...datos }) {
  const usuario = await getById(id);
  if (!usuario) return null;

  const cambios = Object.fromEntries(
    Object.entries(datos).filter(([, valor]) => valor !== undefined)
  );
  if (password !== undefined) {
    Object.assign(cambios, Usuario.crearPasswordSeguro(password));
  }

  usuario.set(cambios);
  return usuario.save();
}

async function remove(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return false;
  return (await Usuario.findByIdAndDelete(id)) !== null;
}

function mensajeBloqueo(usuario) {
  const minutos = Math.ceil((usuario.bloqueadoHasta - new Date()) / 60000);
  return `Cuenta bloqueada por ${INTENTOS_MAXIMOS} intentos fallidos. Probá de nuevo en ${minutos} minuto(s).`;
}

// Login (lo usan la API y el panel). Devuelve { usuario } o { error, status }.
// Cuenta los intentos fallidos: al llegar a INTENTOS_MAXIMOS bloquea la cuenta MINUTOS_BLOQUEO.
async function iniciarSesion(email, password) {
  if (!email || !password) {
    return { error: 'El email y la contraseña son obligatorios.', status: 400 };
  }

  const usuario = await getByEmail(email);
  // Un email que no existe no tiene cuenta que bloquear
  if (!usuario) {
    return { error: 'Email o contraseña incorrectos.', status: 401 };
  }
  if (usuario.estaBloqueado()) {
    return { error: mensajeBloqueo(usuario), status: 403 };
  }

  if (!usuario.validarPassword(password)) {
    usuario.intentosFallidos += 1;
    if (usuario.intentosFallidos >= INTENTOS_MAXIMOS) {
      usuario.bloqueadoHasta = new Date(Date.now() + MINUTOS_BLOQUEO * 60000);
      usuario.intentosFallidos = 0;
      await usuario.save();
      return { error: mensajeBloqueo(usuario), status: 403 };
    }
    await usuario.save();
    const restantes = INTENTOS_MAXIMOS - usuario.intentosFallidos;
    return { error: `Email o contraseña incorrectos. Te quedan ${restantes} intento(s).`, status: 401 };
  }

  if (usuario.estado !== 'ACTIVO') {
    return { error: 'El usuario está suspendido.', status: 403 };
  }

  // Login correcto: se reinicia el contador y se registra el acceso
  usuario.intentosFallidos = 0;
  usuario.bloqueadoHasta = null;
  usuario.ultimoAcceso = new Date();
  await usuario.save();
  return { usuario };
}

// Desbloqueo manual por un ADMIN (antes de que venza el bloqueo)
async function desbloquear(id) {
  const usuario = await getById(id);
  if (!usuario) return null;
  usuario.intentosFallidos = 0;
  usuario.bloqueadoHasta = null;
  return usuario.save();
}

// Registro web de un cliente (lo usan la API y el panel): crea o reutiliza su ficha en
// "clientes" y le crea un usuario CLIENTE. Devuelve { usuario } o { error, status }.
async function registrarCliente({ nombre, apellido, email, telefono, password }) {
  const errorPassword = chequearPassword(password);
  if (errorPassword) return { error: errorPassword, status: 400 };
  if (email && (await getByEmail(email))) {
    return { error: 'Ya existe un usuario con ese email.', status: 409 };
  }

  // Si ya compró en boletería tiene ficha de cliente: la reutilizamos en vez de duplicarla
  let cliente = email ? await clientesModel.getByEmail(email) : null;
  let clienteNuevo = false;
  if (!cliente) {
    const errorCliente = await clientesModel.validar({ nombre, apellido, email, telefono });
    if (errorCliente) return { error: errorCliente, status: 400 };
    cliente = await clientesModel.create({ nombre, apellido, email, telefono });
    clienteNuevo = true;
  }

  try {
    const usuario = await create({
      nombre: `${cliente.nombre} ${cliente.apellido}`,
      email,
      password,
      rol: 'CLIENTE',
      clienteId: cliente.id,
    });
    return { usuario };
  } catch (error) {
    // Si el usuario no se pudo crear, no dejamos una ficha de cliente suelta
    if (clienteNuevo) await clientesModel.remove(cliente.id);
    throw error;
  }
}

export {
  Usuario,
  ROLES,
  PASSWORD_MINIMO,
  chequearPassword,
  chequearReferencias,
  INTENTOS_MAXIMOS,
  MINUTOS_BLOQUEO,
  iniciarSesion,
  desbloquear,
  registrarCliente,
  getAll,
  getById,
  getByEmail,
  create,
  update,
  remove,
};
