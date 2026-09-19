const fs = require('fs');
const path = require('path');
const salasModel = require('./salas');
const entradasModel = require('./entradas');
const clientesModel = require('./clientes');
const { LARGO_MINIMO, texto, numero } = require('./formatos');

// Entidad Evento. Cada evento pertenece a una Sala (salaId)
class Evento {
  constructor(id, nombre, descripcion, fecha, salaId, precio, estado = "PROGRAMADO") {
    this.id = id;
    this.nombre = nombre;
    this.descripcion = descripcion;
    this.fecha = fecha;       // ISO string
    this.salaId = salaId;
    this.precio = precio;
    this.estado = estado;     // PROGRAMADO | FINALIZADO | CANCELADO
  }
}

const filePath = path.join(__dirname, '..', 'data', 'eventos.json');

// READ | Todos los eventos
function getAllEventos() {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

// READ | Un evento puntual
function getEventoById(id) {
  return getAllEventos().find((e) => e.id === Number(id));
}

// READ | Eventos próximos: fecha futura y todavía PROGRAMADO
function getEventosProximos() {
  const ahora = new Date();
  return getAllEventos()
    .filter((e) => e.estado === 'PROGRAMADO' && new Date(e.fecha) > ahora)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}

// CREATE
function createEvento(data) {
  const eventos = getAllEventos();
  const nuevoId = eventos.length ? Math.max(...eventos.map((e) => e.id)) + 1 : 1;
  const nuevoEvento = new Evento(nuevoId, data.nombre, data.descripcion, data.fecha, data.salaId, data.precio);
  eventos.push(nuevoEvento);
  fs.writeFileSync(filePath, JSON.stringify(eventos, null, 2), 'utf-8');
  return nuevoEvento;
}

// UPDATE | Actualización parcial
function updateEventoById(id, data) {
  const eventos = getAllEventos();
  const idx = eventos.findIndex((e) => e.id === Number(id));
  if (idx === -1) return null;

  const cambios = Object.fromEntries(
    Object.entries(data).filter(([, valor]) => valor !== undefined)
  );

  eventos[idx] = { ...eventos[idx], ...cambios, id: eventos[idx].id };
  fs.writeFileSync(filePath, JSON.stringify(eventos, null, 2), 'utf-8');
  return eventos[idx];
}

// UPDATE | Marca el evento como FINALIZADO (no permite más ventas)
function finalizarEvento(id) {
  return updateEventoById(id, { estado: 'FINALIZADO' });
}

// DELETE lógico | Cancela el evento
// Entradas que se arrastrarían si se cancelara este evento. La usan tanto el aviso
// de confirmación como la cancelación misma, para que digan siempre lo mismo.
function entradasQueSeCancelan(id) {
  return entradasModel.getEntradasByEvento(id).filter((e) => e.estado !== 'CANCELADA');
}

// DELETE lógico | Cancela el evento y arrastra sus entradas: no puede quedar una
// entrada válida de algo que no va a suceder.
function cancelarEvento(id) {
  entradasQueSeCancelan(id).forEach((e) => entradasModel.updateEntradaById(e.id, { estado: 'CANCELADA' }));
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
function programados() {
  return getAllEventos().filter((e) => e.estado === 'PROGRAMADO');
}

// Reactivar una sala nunca se bloquea; darla de baja sí, si tiene eventos encima
function validarCambioDeEstadoDeSala(sala) {
  if (sala.estado !== 'ACTIVA') return null;
  return validarBajaDeSala(sala.id);
}

function programadosEnSala(salaId) {
  return getAllEventos().filter((e) => e.salaId === Number(salaId) && e.estado === 'PROGRAMADO');
}

// Lugares ocupados del evento más lleno de una sala: el piso al que puede bajar su capacidad
function ocupacionMaximaEnSala(salaId) {
  return programadosEnSala(salaId).reduce(
    (max, e) => Math.max(max, entradasModel.lugaresOcupados(e.id)),
    0
  );
}

// Un evento programado ocupa su sala: mientras exista, la sala no se puede dar de baja
function validarBajaDeSala(salaId) {
  const programados = programadosEnSala(salaId);
  if (!programados.length) return null;
  return 'No se puede dar de baja: la sala tiene ' + programados.length +
    (programados.length === 1 ? ' evento programado' : ' eventos programados') +
    '. Finalizalos o cancelalos primero.';
}

// Achicar una sala no puede dejar afuera entradas ya vendidas o reservadas
function validarCapacidadDeSala(salaId, nuevaCapacidad) {
  const ocupados = ocupacionMaximaEnSala(salaId);
  const c = numero(nuevaCapacidad);
  if (isNaN(c) || c >= ocupados) return null;
  return 'No se puede bajar la capacidad a ' + c + ': hay un evento programado con ' +
    ocupados + ' lugares ya ocupados.';
}

// Qué hace válido a un evento. Al editar recibe el evento actual, porque algunas
// reglas dependen de lo que ya pasó con él.
function validar({ nombre, fecha, salaId, precio }, eventoActual) {
  const n = texto(nombre);
  if (!n) return 'El nombre del evento es obligatorio.';
  if (n.length < LARGO_MINIMO) return 'El nombre del evento debe tener al menos ' + LARGO_MINIMO + ' caracteres.';

  const f = texto(fecha);
  if (!f || isNaN(new Date(f).getTime())) return 'La fecha es obligatoria y debe ser válida.';
  // Un evento nuevo no puede nacer en el pasado. Al editar uno viejo sí se permite,
  // para poder corregir datos de eventos que ya ocurrieron.
  if (!eventoActual && new Date(f) <= new Date()) {
    return 'La fecha del evento tiene que ser posterior a este momento.';
  }

  const sala = salasModel.getSalaById(salaId);
  if (isNaN(numero(salaId)) || !sala) return 'Elegí una sala existente.';

  // Se puede conservar una sala dada de baja al editar, pero no mudarse a una
  const cambiaDeSala = !eventoActual || Number(salaId) !== eventoActual.salaId;
  if (cambiaDeSala && sala.estado !== 'ACTIVA') {
    return 'La sala "' + sala.nombre + '" está dada de baja: elegí una activa.';
  }

  const p = numero(precio);
  if (isNaN(p) || p < 0) return 'El precio es obligatorio y debe ser un número mayor o igual a cero.';

  // Si mueven el evento a otra sala, tiene que entrar la gente que ya compró
  if (eventoActual) {
    const ocupados = entradasModel.lugaresOcupados(eventoActual.id);
    if (sala.capacidad < ocupados) {
      return 'La sala "' + sala.nombre + '" tiene capacidad ' + sala.capacidad +
        ' y este evento ya tiene ' + ocupados + ' lugares ocupados.';
    }
  }

  return null;
}

// ¿Este evento admite venderle o reservarle una entrada a este cliente?
function validarVenta(eventoId, clienteId) {
  const evento = getEventoById(eventoId);
  if (!evento) return { error: 'El evento indicado no existe.' };
  if (evento.estado !== 'PROGRAMADO') {
    return { error: 'El evento ya finalizó o fue cancelado: no admite nuevas entradas.' };
  }

  if (!clientesModel.getById(clienteId)) return { error: 'El cliente indicado no existe.' };

  const sala = salasModel.getSalaById(evento.salaId);
  if (!sala) return { error: 'El evento no tiene una sala válida asociada.' };
  if (sala.estado !== 'ACTIVA') {
    return { error: 'La sala "' + sala.nombre + '" está dada de baja: no se pueden vender entradas.' };
  }

  if (entradasModel.lugaresOcupados(evento.id) >= sala.capacidad) {
    return { error: 'No quedan lugares disponibles para este evento.' };
  }

  return { evento, sala };
}

module.exports = {
  getAllEventos,
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
