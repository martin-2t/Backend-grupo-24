const fs = require('fs');
const path = require('path');

// Entidad Entrada
// estado: RESERVADA (reserva temporal, ocupa lugar) | VALIDA (vendida) | CANCELADA (libera el lugar)
class Entrada {
  constructor(id, eventoId, clienteId, precio, estado = "VALIDA") {
    this.id = id;
    this.eventoId = eventoId;
    this.clienteId = clienteId;
    this.precio = precio;
    this.estado = estado;
  }
}

const filePath = path.join(__dirname, '..', 'data', 'entradas.json');

// Devuelve array de todas las entradas
function getAllEntradas() {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

// Devuelve una entrada puntual por id
function getEntradaById(id) {
  return getAllEntradas().find((e) => e.id === Number(id));
}

// Entradas de un evento en particular (todas, sin filtrar por estado)
function getEntradasByEvento(eventoId) {
  return getAllEntradas().filter((e) => e.eventoId === Number(eventoId));
}

// Crea una entrada (reserva o venta directa, según el estado que le pase el controller)
function createEntrada(data) {
  const entradas = getAllEntradas();
  const nuevoId = entradas.length ? Math.max(...entradas.map((e) => e.id)) + 1 : 1;
  const nuevaEntrada = new Entrada(nuevoId, data.eventoId, data.clienteId, data.precio, data.estado);
  entradas.push(nuevaEntrada);
  fs.writeFileSync(filePath, JSON.stringify(entradas, null, 2), 'utf-8');
  return nuevaEntrada;
}

// Actualiza una entrada por id (uso general: cambia solo los campos definidos)
function updateEntradaById(id, data) {
  const entradas = getAllEntradas();
  const idx = entradas.findIndex((e) => e.id === Number(id));
  if (idx === -1) return null;

  const cambios = Object.fromEntries(
    Object.entries(data).filter(([, valor]) => valor !== undefined)
  );

  entradas[idx] = { ...entradas[idx], ...cambios, id: entradas[idx].id };
  fs.writeFileSync(filePath, JSON.stringify(entradas, null, 2), 'utf-8');
  return entradas[idx];
}

// Elimina una entrada por id (borrado físico)
function removeEntrada(id) {
  const entradas = getAllEntradas();
  const idx = entradas.findIndex((e) => e.id === Number(id));
  if (idx === -1) return false;
  entradas.splice(idx, 1);
  fs.writeFileSync(filePath, JSON.stringify(entradas, null, 2), 'utf-8');
  return true;
}

// Lugares ocupados de un evento: vendidas y reservadas ocupan, canceladas liberan
function lugaresOcupados(eventoId) {
  return getEntradasByEvento(eventoId).filter(
    (e) => e.estado === 'VALIDA' || e.estado === 'RESERVADA'
  ).length;
}

module.exports = {
  getAllEntradas,
  getEntradaById,
  getEntradasByEvento,
  lugaresOcupados,
  createEntrada,
  updateEntradaById,
  removeEntrada,
};
