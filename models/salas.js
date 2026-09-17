const fs = require('fs');
const path = require('path');

// Entidad Sala
class Sala {
  constructor(id, nombre, capacidad, direccion, estado = "ACTIVA") {
    this.id = id;
    this.nombre = nombre;
    this.capacidad = capacidad;
    this.direccion = direccion;
    this.estado = estado;
  }
}

const filePath = path.join(__dirname, '..', 'data', 'salas.json');

function getAllSalas() {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function getSalaById(id) {
  return getAllSalas().find((s) => s.id === Number(id));
}

function getSalaByName(nombre) {
  return getAllSalas().find((s) => s.nombre.toLowerCase() === String(nombre).toLowerCase());
}

function createSala(data) {
  const salas = getAllSalas();
  const nuevoId = salas.length ? Math.max(...salas.map((s) => s.id)) + 1 : 1;
  const nuevaSala = new Sala(nuevoId, data.nombre, data.capacidad, data.direccion);
  salas.push(nuevaSala);
  fs.writeFileSync(filePath, JSON.stringify(salas, null, 2), 'utf-8');
  return nuevaSala;
}

function updateSalaById(id, data) {
  const salas = getAllSalas();
  const idx = salas.findIndex((s) => s.id === Number(id));
  if (idx === -1) return null;

  const cambios = Object.fromEntries(
    Object.entries(data).filter(([, valor]) => valor !== undefined)
  );

  salas[idx] = { ...salas[idx], ...cambios, id: salas[idx].id };
  fs.writeFileSync(filePath, JSON.stringify(salas, null, 2), 'utf-8');
  return salas[idx];
}

function toggleSalaById(id) {
  const salas = getAllSalas();
  const idx = salas.findIndex((s) => s.id === Number(id));
  if (idx === -1) return null;

  salas[idx].estado = salas[idx].estado === "ACTIVA" ? "INACTIVA" : "ACTIVA";
  fs.writeFileSync(filePath, JSON.stringify(salas, null, 2), 'utf-8');
  return salas[idx];
}

module.exports = { getAllSalas, getSalaById, getSalaByName, createSala, updateSalaById, toggleSalaById };
