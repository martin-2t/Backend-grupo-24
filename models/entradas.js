// Model: la clase con la que se consulta y se guarda en la colección "entradas"
import crypto from 'crypto';
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
    // USADA: la entrada ya se validó en el ingreso al evento.
    // VENCIDA: era una reserva y no se confirmó el pago a tiempo
    estado: {
      type: String,
      enum: {
        values: ['VALIDA', 'RESERVADA', 'CANCELADA', 'USADA', 'VENCIDA'],
        message: 'El estado debe ser VALIDA, RESERVADA, CANCELADA, USADA o VENCIDA.',
      },
      default: 'VALIDA',
    },
    // Hasta cuándo se retiene el lugar de una reserva sin pagar (solo las RESERVADA lo tienen)
    venceEn: {
      type: Date,
    },
    // Código único y aleatorio que va dentro del QR. No se usa el _id porque los ObjectId son
    // en parte predecibles (llevan la fecha y un contador): alguien podría adivinar otro
    codigo: {
      type: String,
      unique: true,
      sparse: true, // las entradas creadas antes de que existiera el código no lo tienen todavía
    },
    // Registro del ingreso: cuándo se validó y qué usuario del personal lo hizo
    usadaEn: {
      type: Date,
    },
    validadaPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
    },
  },
  { versionKey: false }
);
const Entrada = mongoose.model('Entrada', entradaSchema);


// ---- Reservas con vencimiento ----
// Una reserva retiene su lugar RESERVA_MINUTOS (10 por defecto) mientras se completa el pago.
// No hay un proceso que revise el reloj (en Vercel no queda ningún servidor corriendo): las
// reservas atrasadas se vencen "al consultar", antes de cada lectura de entradas.

// La variable se lee dentro de la función: con ES Modules, los import corren antes que dotenv
function minutosDeReserva() {
  return Number(process.env.RESERVA_MINUTOS) || 10;
}

// Pasa a VENCIDA las reservas atrasadas que cumplan el filtro y devuelve sus lugares al stock.
// Cada una se vence con una operación atómica que exige que siga RESERVADA: si dos pedidos
// intentan vencer la misma reserva a la vez, gana uno solo y el lugar se libera una sola vez.
// Las reservas sin venceEn (cargadas antes de esta regla, o por la semilla) no vencen
async function vencerReservas(filtro = {}) {
  const ahora = new Date();
  const atrasadas = await Entrada.find(
    { ...filtro, estado: 'RESERVADA', venceEn: { $lt: ahora } },
    { _id: 1, eventoId: 1 }
  );
  for (const reserva of atrasadas) {
    const vencida = await Entrada.findOneAndUpdate(
      { _id: reserva._id, estado: 'RESERVADA' },
      { $set: { estado: 'VENCIDA' } }
    );
    if (vencida) await liberarLugar(reserva.eventoId);
  }
}

// Devuelve todas las entradas
async function getAllEntradas() {
  await vencerReservas();
  return Entrada.find();
}

//Devuelve una entrada puntual por id. Un id que no tiene formato de ObjectId
//no puede existir: devolvemos null (como "no encontrada") en vez de un CastError
async function getEntradaById(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  await vencerReservas({ _id: id });
  return Entrada.findById(id);
}

//Entradas de un evento en particular (todas, sin filtrar por estado)
async function getEntradasByEvento(eventoId) {
  if (!mongoose.isObjectIdOrHexString(eventoId)) return [];
  await vencerReservas({ eventoId });
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

// Una entrada USADA sigue ocupando su lugar: la persona está adentro
const OCUPAN_LUGAR = ['VALIDA', 'RESERVADA', 'USADA'];
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

// Intenta ocupar un lugar del evento. Devuelve true si lo consiguió, false si está lleno.
// Antes vence las reservas atrasadas del evento, así sus lugares vuelven a estar disponibles
async function ocuparLugar(eventoId) {
  await vencerReservas({ eventoId });
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

  // Una reserva retiene el lugar solo unos minutos: después vence sola
  const venceEn = estado === 'RESERVADA' ? new Date(Date.now() + minutosDeReserva() * 60000) : undefined;

  try {
    return await Entrada.create({ eventoId, clienteId, precio, estado, venceEn, codigo: generarCodigo() });
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
  const entrada = await getEntradaById(id); // si era una reserva atrasada, ya vuelve VENCIDA
  if (!entrada) return null;

  const cambios = Object.fromEntries(
    Object.entries(data).filter(([, valor]) => valor !== undefined)
  );

  const estadoLeido = entrada.estado;
  entrada.set(cambios);
  // Al salir de RESERVADA (confirmada o cancelada), el vencimiento ya no aplica
  if (entrada.estado !== 'RESERVADA') entrada.venceEn = undefined;
  await entrada.validate();

  const actualizacion = entrada.$getChanges(); // solo los campos que cambiaron ($set y $unset)
  if (!Object.keys(actualizacion).length) return entrada;

  // Se guarda con la condición de que el estado siga siendo el que se leyó. Si en el medio
  // otro pedido la venció o la canceló, no se pisa ese cambio: así una reserva que venció
  // no "revive" al confirmarla, y su lugar no se libera dos veces
  const guardada = await Entrada.findOneAndUpdate(
    { _id: entrada._id, estado: estadoLeido },
    actualizacion,
    { returnDocument: 'after' }
  );
  if (!guardada) return Entrada.findById(entrada._id);

  if (ocupaLugar(estadoLeido) && !ocupaLugar(guardada.estado)) await liberarLugar(guardada.eventoId);
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

//Lugares ocupados de un evento: vendidas, reservadas y usadas ocupan; canceladas y vencidas liberan
async function lugaresOcupados(eventoId) {
  if (!mongoose.isObjectIdOrHexString(eventoId)) return 0;
  await vencerReservas({ eventoId });
  return Entrada.countDocuments({
    eventoId,
    estado: { $in: OCUPAN_LUGAR },
  });
}

// ---- Validación en el ingreso (check-in con QR) ----

// 16 bytes aleatorios en base64url: 22 caracteres que se pueden poner en una URL
function generarCodigo() {
  return crypto.randomBytes(16).toString('base64url');
}

async function getEntradaByCodigo(codigo) {
  if (!codigo || typeof codigo !== 'string') return null;
  await vencerReservas({ codigo });
  return Entrada.findOne({ codigo });
}

// Las entradas creadas antes de que existiera el código lo reciben la primera vez que se
// muestra su QR. El filtro $exists hace que, si dos pedidos llegan juntos, gane uno solo
async function asegurarCodigo(entrada) {
  if (entrada.codigo) return entrada;
  await Entrada.updateOne(
    { _id: entrada._id, codigo: { $exists: false } },
    { $set: { codigo: generarCodigo() } }
  );
  return Entrada.findById(entrada._id);
}

// El "día del evento" se cuenta en la hora de Buenos Aires, no en la del servidor
// (en Vercel o Render el servidor corre en UTC, y un evento a las 23 sería "otro día")
const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';
function diaLocal(fecha) {
  return new Date(fecha).toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA }); // AAAA-MM-DD
}
function fechaYHora(fecha) {
  return new Date(fecha).toLocaleString('es-AR', {
    timeZone: ZONA_HORARIA, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).replace(',', ' a las'); // "15/11 a las 21:03"
}

// ¿Esta entrada puede ingresar ahora? Devuelve el motivo del rechazo, o null.
// Es una función pura (recibe todo por parámetro), así se puede probar sin base de datos
function validarIngreso(entrada, evento, ahora = new Date()) {
  if (entrada.estado === 'USADA') {
    return 'Esta entrada ya ingresó el ' + fechaYHora(entrada.usadaEn) + '.';
  }
  if (entrada.estado === 'CANCELADA') return 'La entrada está cancelada.';
  if (entrada.estado === 'VENCIDA') return 'Era una reserva y venció sin que se confirmara el pago.';
  if (entrada.estado === 'RESERVADA') return 'Es una reserva sin confirmar: todavía no está pagada.';
  if (!evento || evento.estado !== 'PROGRAMADO') return 'El evento ya finalizó o fue cancelado.';
  if (diaLocal(evento.fecha) !== diaLocal(ahora)) {
    return 'La entrada es para el evento del ' + fechaYHora(evento.fecha) + ': solo se valida ese día.';
  }
  return null;
}

// Marca la entrada como USADA. Es atómico, igual que el control de sobreventa: si dos personas
// escanean el mismo QR a la vez, solo una encuentra la entrada todavía VALIDA. Devuelve null
// si otra validación ganó
async function registrarIngreso(id, usuarioId) {
  return Entrada.findOneAndUpdate(
    { _id: id, estado: 'VALIDA' },
    { $set: { estado: 'USADA', usadaEn: new Date(), validadaPor: usuarioId } },
    { returnDocument: 'after' } // devuelve la entrada ya actualizada
  );
}

// Busca la entrada del QR y su evento, y dice si puede ingresar (sin modificar nada).
// Devuelve { entrada, evento, motivo }, con motivo null si puede, o { error, status } si el
// código no existe. El evento se pide por nombre a Mongoose, como en el control de sobreventa
async function revisarIngreso(codigo) {
  const entrada = await getEntradaByCodigo(codigo);
  if (!entrada) return { error: 'No existe una entrada con ese código.', status: 404 };
  const evento = await mongoose.model('Evento').findById(entrada.eventoId);
  return { entrada, evento, motivo: validarIngreso(entrada, evento) };
}

// Valida el ingreso de la entrada del QR. Devuelve { entrada, evento } o { error, status }.
// Una entrada ya usada responde 409 (conflicto con su estado actual); los demás rechazos, 400
async function ingresar(codigo, usuarioId) {
  const revision = await revisarIngreso(codigo);
  if (revision.error) return revision;

  const { entrada, evento, motivo } = revision;
  if (motivo) return { error: motivo, status: entrada.estado === 'USADA' ? 409 : 400 };

  const usada = await registrarIngreso(entrada._id, usuarioId);
  if (!usada) {
    // Otra validación ganó entre la revisión y el registro: se informa con el estado actual
    const actual = await Entrada.findById(entrada._id);
    return { error: validarIngreso(actual, evento) || 'La entrada ya no se puede validar.', status: 409 };
  }
  return { entrada: usada, evento };
}

//Transiciones válidas de una entrada. Devuelven el motivo del rechazo, o null.
function validarConfirmacion(entrada) {
  if (entrada.estado === 'VENCIDA') {
    return 'La reserva venció: pasaron más de ' + minutosDeReserva() + ' minutos sin confirmar el pago.';
  }
  if (entrada.estado !== 'RESERVADA') return 'Solo se pueden confirmar entradas en estado RESERVADA.';
  return null;
}

function validarCancelacion(entrada) {
  if (entrada.estado === 'CANCELADA') return 'La entrada ya estaba cancelada.';
  if (entrada.estado === 'USADA') return 'La entrada ya se usó para ingresar: no se puede cancelar.';
  if (entrada.estado === 'VENCIDA') return 'La reserva ya venció y su lugar se liberó: no hay nada que cancelar.';
  return null;
}

//Conteo por estado. Sin argumento cuenta todas; si no, la lista que le pasen.
async function contarPorEstado(lista) {
  const entradas = lista || (await getAllEntradas());
  return {
    // una entrada usada también se vendió: cuenta en las ventas
    vendidas: entradas.filter((e) => ['VALIDA', 'USADA'].includes(e.estado)).length,
    usadas: entradas.filter((e) => e.estado === 'USADA').length,
    reservadas: entradas.filter((e) => e.estado === 'RESERVADA').length,
    canceladas: entradas.filter((e) => e.estado === 'CANCELADA').length,
    vencidas: entradas.filter((e) => e.estado === 'VENCIDA').length,
    vigentes: entradas.filter((e) => !['CANCELADA', 'VENCIDA'].includes(e.estado)).length,
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
  minutosDeReserva,
  getEntradaByCodigo,
  asegurarCodigo,
  validarIngreso,
  revisarIngreso,
  ingresar,
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
