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
    // Qué representa cada estado (por cómo creció la app, todo vive en la misma entidad):
    //  - VALIDA: entrada vendida. USADA: ya se validó en el ingreso al evento.
    //  - CANCELADA: anulada por fuerza mayor (se canceló el evento o la anuló la boletería).
    //  - RESERVADA: reserva de boletería, "te guardo el lugar y pagás cuando vengas" (no vence).
    //  - RETENIDA: lugar apartado mientras un cliente completa una compra web. No es una entrada
    //    todavía: dura RETENCION_MINUTOS y la ven solo el ADMIN y el AUDITOR.
    //  - VENCIDA: compra web que no se concretó (venció el tiempo o el cliente la canceló).
    //    Es un dato para las métricas del negocio, no una entrada.
    estado: {
      type: String,
      enum: {
        values: ['VALIDA', 'RESERVADA', 'CANCELADA', 'USADA', 'RETENIDA', 'VENCIDA'],
        message: 'El estado debe ser VALIDA, RESERVADA, CANCELADA, USADA, RETENIDA o VENCIDA.',
      },
      default: 'VALIDA',
    },
    // Hasta cuándo se retiene el lugar de una compra web en curso (solo las RETENIDA lo tienen)
    venceEn: {
      type: Date,
    },
    // Agrupa las entradas de una misma compra web (hasta MAXIMO_POR_COMPRA): se pagan o se
    // cancelan juntas
    compraId: {
      type: mongoose.Schema.Types.ObjectId,
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


// ---- Retenciones con vencimiento (compra web) ----
// Mientras un cliente completa una compra, sus lugares quedan RETENIDA RETENCION_MINUTOS
// (10 por defecto). No hay un proceso que revise el reloj (en Vercel no queda ningún servidor
// corriendo): las retenciones atrasadas se vencen "al consultar", antes de cada lectura.

const MAXIMO_POR_COMPRA = 6;

// La variable se lee dentro de la función: con ES Modules, los import corren antes que dotenv
function minutosDeRetencion() {
  return Number(process.env.RETENCION_MINUTOS) || 10;
}

// Pasa a VENCIDA las retenciones atrasadas que cumplan el filtro y devuelve sus lugares.
// Cada una se vence con una operación atómica que exige que siga RETENIDA: si dos pedidos
// intentan vencer la misma a la vez, gana uno solo y el lugar se libera una sola vez
async function vencerRetenciones(filtro = {}) {
  const ahora = new Date();
  const atrasadas = await Entrada.find(
    { ...filtro, estado: 'RETENIDA', venceEn: { $lt: ahora } },
    { _id: 1, eventoId: 1 }
  );
  for (const retenida of atrasadas) {
    const vencida = await Entrada.findOneAndUpdate(
      { _id: retenida._id, estado: 'RETENIDA' },
      { $set: { estado: 'VENCIDA' }, $unset: { venceEn: 1 } }
    );
    if (vencida) await liberarLugares(retenida.eventoId, 1);
  }
}

// Devuelve todas las entradas
async function getAllEntradas() {
  await vencerRetenciones();
  return Entrada.find();
}

//Devuelve una entrada puntual por id. Un id que no tiene formato de ObjectId
//no puede existir: devolvemos null (como "no encontrada") en vez de un CastError
async function getEntradaById(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  await vencerRetenciones({ _id: id });
  return Entrada.findById(id);
}

//Entradas de un evento en particular (todas, sin filtrar por estado)
async function getEntradasByEvento(eventoId) {
  if (!mongoose.isObjectIdOrHexString(eventoId)) return [];
  await vencerRetenciones({ eventoId });
  return Entrada.find({ eventoId });
}

// ---- Qué ve cada rol ----
// RETENIDA y VENCIDA no son entradas para nadie más que el negocio: son compras en curso o que
// no se concretaron. El personal de los centros no las ve; el ADMIN y el AUDITOR sí (métricas)
const SOLO_PARA_EL_NEGOCIO = ['RETENIDA', 'VENCIDA'];
const ROLES_DEL_NEGOCIO = ['ADMIN', 'AUDITOR'];

function visiblesPara(rol, entradas) {
  if (ROLES_DEL_NEGOCIO.includes(rol)) return entradas;
  return entradas.filter((e) => !SOLO_PARA_EL_NEGOCIO.includes(e.estado));
}

// El personal de un centro (EMPLEADO y REPRESENTANTE) trabaja dentro de su centro: además de no
// ver lo que es solo del negocio, ve únicamente las entradas de los eventos de su centro (cada
// entrada lleva el nombre del comprador). Es el mismo criterio de soloSuCentro, aplicado a lo
// que se lee y no solo a lo que se hace. El ADMIN y el AUDITOR ven toda la red
const ROLES_DE_CENTRO = ['EMPLEADO', 'REPRESENTANTE'];

async function entradasParaUsuario(usuario, entradas) {
  const porEstado = visiblesPara(usuario.rol, entradas);
  if (!ROLES_DE_CENTRO.includes(usuario.rol)) return porEstado;
  const delCentro = await mongoose.model('Evento').find({ salaId: usuario.salaId }, { _id: 1 });
  const ids = new Set(delCentro.map((e) => String(e._id)));
  return porEstado.filter((e) => ids.has(String(e.eventoId)));
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

// Una entrada USADA sigue ocupando su lugar (la persona está adentro), y una RETENIDA también,
// mientras dure la compra: así nadie compra un lugar que otro está pagando
const OCUPAN_LUGAR = ['VALIDA', 'RESERVADA', 'USADA', 'RETENIDA'];
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

// Intenta ocupar "cantidad" lugares del evento, todos o ninguno. Devuelve true si lo consiguió.
// Antes vence las retenciones atrasadas del evento, así sus lugares vuelven a estar disponibles
async function ocuparLugares(eventoId, cantidad = 1) {
  await vencerRetenciones({ eventoId });
  const Evento = mongoose.model('Evento');
  const evento = await Evento.findById(eventoId);
  if (!evento) return false;
  const sala = await mongoose.model('Sala').findById(evento.salaId);
  if (!sala) return false;

  await inicializarContador(eventoId);

  // La operación atómica: "sumá N solo si todavía entran N". Si no entran, el filtro no
  // encuentra el evento, no se suma nada y devuelve null. Dos compras simultáneas por los
  // últimos lugares nunca se los reparten: una se lleva todos y la otra ninguno
  const ocupado = await Evento.findOneAndUpdate(
    { _id: eventoId, lugaresOcupados: { $lte: sala.capacidad - cantidad } },
    { $inc: { lugaresOcupados: cantidad } }
  );
  return ocupado !== null;
}

// Devuelve "cantidad" lugares al stock (entrada cancelada, eliminada o compra no concretada).
// La actualización con $max nunca deja el contador por debajo de cero
async function liberarLugares(eventoId, cantidad = 1) {
  if (cantidad < 1) return;
  // Mongoose 9 pide confirmar explícitamente las actualizaciones con pipeline (updatePipeline)
  await mongoose.model('Evento').updateOne(
    { _id: eventoId, lugaresOcupados: { $exists: true } },
    [{ $set: { lugaresOcupados: { $max: [0, { $subtract: ['$lugaresOcupados', cantidad] }] } } }],
    { updatePipeline: true }
  );
}

//Crea una entrada de boletería (venta directa o reserva, según el estado que le pase el
//controller). Primero ocupa el lugar; si el evento está lleno no crea nada y devuelve null
async function createEntrada({ eventoId, clienteId, precio, estado = 'VALIDA' }) {
  if (ocupaLugar(estado) && !(await ocuparLugares(eventoId, 1))) return null;

  try {
    return await Entrada.create({ eventoId, clienteId, precio, estado, codigo: generarCodigo() });
  } catch (error) {
    // Si la entrada no se pudo guardar (por ejemplo, un dato inválido), el lugar vuelve al stock
    if (ocupaLugar(estado)) await liberarLugares(eventoId, 1);
    throw error;
  }
}

//Actualización parcial: solo se pisan los campos que vinieron definidos.
//Si la entrada pasa a CANCELADA, su lugar vuelve al stock. El camino inverso no existe:
//una entrada cancelada no se reactiva (lo impiden validarConfirmacion y validarCancelacion)
async function updateEntradaById(id, data) {
  const entrada = await getEntradaById(id); // si era una retención atrasada, ya vuelve VENCIDA
  if (!entrada) return null;

  const cambios = Object.fromEntries(
    Object.entries(data).filter(([, valor]) => valor !== undefined)
  );

  const estadoLeido = entrada.estado;
  entrada.set(cambios);
  // Al salir de RETENIDA, el vencimiento ya no aplica
  if (entrada.estado !== 'RETENIDA') entrada.venceEn = undefined;
  await entrada.validate();

  const actualizacion = entrada.$getChanges(); // solo los campos que cambiaron ($set y $unset)
  if (!Object.keys(actualizacion).length) return entrada;

  // Se guarda con la condición de que el estado siga siendo el que se leyó. Si en el medio
  // otro pedido la venció o la canceló, no se pisa ese cambio: así una retención que venció
  // no "revive", y su lugar no se libera dos veces
  const guardada = await Entrada.findOneAndUpdate(
    { _id: entrada._id, estado: estadoLeido },
    actualizacion,
    { returnDocument: 'after' }
  );
  if (!guardada) return Entrada.findById(entrada._id);

  if (ocupaLugar(estadoLeido) && !ocupaLugar(guardada.estado)) await liberarLugares(guardada.eventoId, 1);
  return guardada;
}

//Elimina una entrada por id (borrado físico). Devuelve true si existía, false si no.
//Si la entrada ocupaba un lugar, lo devuelve al stock
async function removeEntrada(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return false;
  const eliminada = await Entrada.findByIdAndDelete(id);
  if (!eliminada) return false;

  if (ocupaLugar(eliminada.estado)) await liberarLugares(eliminada.eventoId, 1);
  return true;
}

//Lugares ocupados de un evento: vendidas, reservadas, usadas y retenidas ocupan; canceladas y
//vencidas liberan
async function lugaresOcupados(eventoId) {
  if (!mongoose.isObjectIdOrHexString(eventoId)) return 0;
  await vencerRetenciones({ eventoId });
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
  await vencerRetenciones({ codigo });
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
// ¿El evento ya pasó? El día del evento todavía cuenta como vigente (hora de Buenos Aires)
function eventoYaPaso(fecha, ahora = new Date()) {
  return diaLocal(fecha) < diaLocal(ahora);
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
  if (entrada.estado === 'VENCIDA') return 'Es una compra que no se concretó: no hay entrada.';
  if (entrada.estado === 'RETENIDA') return 'Es una compra en curso: todavía no se pagó.';
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
  if (entrada.estado === 'RETENIDA') return 'Es una compra web en curso: la confirma el cliente al pagar.';
  if (entrada.estado === 'VENCIDA') return 'Es una compra que no se concretó: no hay nada que confirmar.';
  if (entrada.estado !== 'RESERVADA') return 'Solo se pueden confirmar entradas en estado RESERVADA.';
  return null;
}

function validarCancelacion(entrada) {
  if (entrada.estado === 'CANCELADA') return 'La entrada ya estaba cancelada.';
  if (entrada.estado === 'USADA') return 'La entrada ya se usó para ingresar: no se puede cancelar.';
  if (entrada.estado === 'RETENIDA') return 'Es una compra web en curso: solo el cliente puede cancelarla.';
  if (entrada.estado === 'VENCIDA') return 'Es una compra que no se concretó: no hay nada que cancelar.';
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
    // compras web: en curso y no concretadas (métricas del negocio)
    retenidas: entradas.filter((e) => e.estado === 'RETENIDA').length,
    vencidas: entradas.filter((e) => e.estado === 'VENCIDA').length,
    vigentes: entradas.filter((e) => !['CANCELADA', 'RETENIDA', 'VENCIDA'].includes(e.estado)).length,
  };
}

// ---- Compra web del cliente ----
// El cliente elige cuántas entradas quiere (hasta MAXIMO_POR_COMPRA) y se le retienen los
// lugares RETENCION_MINUTOS mientras paga. Si paga, las retenidas pasan a VALIDA y recién ahí
// son entradas. Si cancela o se le vence el tiempo, pasan a VENCIDA y los lugares se liberan.
// Todas las de una misma compra comparten el compraId.

// Crea la compra: retiene "cantidad" lugares de forma atómica (todos o ninguno) y crea esas
// entradas RETENIDA. Las validaciones del evento (programado, sala activa, cliente) las hace
// antes el controller con eventosModel.validarVenta. Devuelve { compraId } o { error, status }
async function crearCompra({ eventoId, clienteId, precio, cantidad }) {
  const n = Number(cantidad);
  if (!Number.isInteger(n) || n < 1 || n > MAXIMO_POR_COMPRA) {
    return { error: `Podés comprar entre 1 y ${MAXIMO_POR_COMPRA} entradas por compra.`, status: 400 };
  }

  if (!(await ocuparLugares(eventoId, n))) {
    const disponibles = await lugaresDisponibles(eventoId);
    const mensaje = disponibles === 0
      ? 'No quedan lugares disponibles para este evento.'
      : `Solo quedan ${disponibles} lugares disponibles.`;
    return { error: mensaje, status: 400 };
  }

  const compraId = new mongoose.Types.ObjectId();
  const venceEn = new Date(Date.now() + minutosDeRetencion() * 60000);
  const retenidas = Array.from({ length: n }, () => ({
    eventoId, clienteId, precio, estado: 'RETENIDA', venceEn, compraId, codigo: generarCodigo(),
  }));
  try {
    await Entrada.insertMany(retenidas);
  } catch (error) {
    await liberarLugares(eventoId, n); // si no se pudieron guardar, los lugares vuelven
    throw error;
  }
  return { compraId: String(compraId) };
}

// Lugares que quedan libres en el evento (capacidad de la sala menos los ocupados)
async function lugaresDisponibles(eventoId) {
  const evento = await mongoose.model('Evento').findById(eventoId);
  if (!evento) return 0;
  const sala = await mongoose.model('Sala').findById(evento.salaId);
  if (!sala) return 0;
  return Math.max(sala.capacidad - (await lugaresOcupados(eventoId)), 0);
}

// La compra de un cliente: sus entradas y en qué situación está. Devuelve null si no existe o
// si es de otro cliente (para no revelar compras ajenas). estado: EN_CURSO, PAGADA o VENCIDA
async function getCompra(compraId, clienteId) {
  if (!mongoose.isObjectIdOrHexString(compraId)) return null;
  await vencerRetenciones({ compraId });
  const entradas = await Entrada.find({ compraId, clienteId });
  if (!entradas.length) return null;

  let estado = 'VENCIDA';
  if (entradas.some((e) => e.estado === 'RETENIDA')) estado = 'EN_CURSO';
  else if (entradas.some((e) => ['VALIDA', 'USADA'].includes(e.estado))) estado = 'PAGADA';

  return {
    compraId: String(compraId),
    estado,
    eventoId: entradas[0].eventoId,
    cantidad: entradas.length,
    precio: entradas[0].precio,
    total: entradas.reduce((suma, e) => suma + e.precio, 0),
    venceEn: entradas[0].venceEn,
    entradas,
  };
}

// Paga la compra (el pago es simulado): las retenidas pasan a VALIDA. updateMany solo toca las
// que siguen RETENIDA, así que una compra vencida no "revive". Devuelve { compra } o { error, status }
async function pagarCompra(compraId, clienteId) {
  const compra = await getCompra(compraId, clienteId); // vence la compra si estaba atrasada
  if (!compra) return { error: 'No encontramos esa compra.', status: 404 };
  if (compra.estado === 'PAGADA') return { error: 'Esta compra ya está pagada.', status: 409 };
  if (compra.estado === 'VENCIDA') {
    return { error: 'La compra no se concretó: venció el tiempo para pagar o se canceló.', status: 409 };
  }

  await Entrada.updateMany(
    { compraId, clienteId, estado: 'RETENIDA' },
    { $set: { estado: 'VALIDA' }, $unset: { venceEn: 1 } }
  );
  return { compra: await getCompra(compraId, clienteId) };
}

// Cancela la compra en curso: las retenidas pasan a VENCIDA (compra no concretada) y sus
// lugares se liberan en el acto. Se liberan tantos como retenidas cambió updateMany, así cada
// lugar se libera una sola vez aunque la compra venza en ese mismo instante
async function cancelarCompra(compraId, clienteId) {
  const compra = await getCompra(compraId, clienteId);
  if (!compra) return { error: 'No encontramos esa compra.', status: 404 };
  if (compra.estado !== 'EN_CURSO') return { error: 'Esta compra ya no está en curso.', status: 409 };

  const resultado = await Entrada.updateMany(
    { compraId, clienteId, estado: 'RETENIDA' },
    { $set: { estado: 'VENCIDA' }, $unset: { venceEn: 1 } }
  );
  await liberarLugares(compra.eventoId, resultado.modifiedCount);
  return { compra: await getCompra(compraId, clienteId) };
}

// ---- Mis entradas (lo que ve el cliente) ----

// Las entradas del cliente, sin las compras en curso ni las no concretadas (no son entradas
// para él) ni las reservas de boletería. Su ficha completa la ve el personal con
// clientesModel.entradasDelCliente
async function entradasVisiblesDelCliente(clienteId) {
  if (!mongoose.isObjectIdOrHexString(clienteId)) return [];
  await vencerRetenciones({ clienteId });
  return Entrada.find({ clienteId, estado: { $in: ['VALIDA', 'USADA', 'CANCELADA'] } });
}

// Ordena las entradas del cliente en próximas e historial. Función pura: recibe las entradas,
// sus eventos (indexados por id) y la hora actual, así se prueba sin base de datos.
//  - Próximas: VALIDA de eventos programados que todavía no pasaron (el día del evento cuenta).
//  - Historial: USADA, CANCELADA (con el motivo si se canceló el evento) y VALIDA de eventos
//    que ya pasaron, que se marcan como NO_UTILIZADA.
function agruparEntradasDelCliente(entradas, eventosPorId, ahora = new Date()) {
  const proximas = [];
  const historial = [];
  for (const entrada of entradas) {
    const evento = eventosPorId[String(entrada.eventoId)] || null;
    const fecha = evento ? new Date(evento.fecha) : new Date(0);
    if (entrada.estado === 'VALIDA') {
      const vigente = evento && evento.estado === 'PROGRAMADO' && !eventoYaPaso(fecha, ahora);
      if (vigente) proximas.push({ entrada, evento, situacion: 'VIGENTE', fecha });
      else historial.push({ entrada, evento, situacion: 'NO_UTILIZADA', fecha });
    } else if (entrada.estado === 'USADA') {
      historial.push({ entrada, evento, situacion: 'USADA', fecha });
    } else if (entrada.estado === 'CANCELADA') {
      const situacion = evento && evento.estado === 'CANCELADO' ? 'EVENTO_CANCELADO' : 'CANCELADA';
      historial.push({ entrada, evento, situacion, fecha });
    }
  }
  proximas.sort((a, b) => a.fecha - b.fecha); // la más cercana primero
  historial.sort((a, b) => b.fecha - a.fecha); // la más reciente primero
  return { proximas, historial };
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
  MAXIMO_POR_COMPRA,
  minutosDeRetencion,
  visiblesPara,
  entradasParaUsuario,
  crearCompra,
  getCompra,
  pagarCompra,
  cancelarCompra,
  lugaresDisponibles,
  entradasVisiblesDelCliente,
  agruparEntradasDelCliente,
  eventoYaPaso,
  fechaYHora,
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
