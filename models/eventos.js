const fs = require('fs');
const path = require('path');

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
function cancelarEvento(id) {
  return updateEventoById(id, { estado: 'CANCELADO' });
}

module.exports = {
  getAllEventos,
  getEventoById,
  getEventosProximos,
  createEvento,
  updateEventoById,
  finalizarEvento,
  cancelarEvento,
};
