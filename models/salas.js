const fs = require('fs');
const path = require('path');
const { SOLO_LETRAS, LARGO_MINIMO, texto, numero } = require('./formatos');

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


// Una sala chica no tiene sentido para el negocio: el mínimo es una regla del dominio
const CAPACIDAD_MINIMA = 10;

// Qué hace válida a una sala. Devuelve el motivo del rechazo, o null si está bien.
function validar({ nombre, capacidad, direccion }) {
  const n = texto(nombre);
  if (!n) return 'El nombre de la sala es obligatorio.';
  if (!SOLO_LETRAS.test(n)) return 'El nombre de la sala solo puede tener letras, sin números ni símbolos.';
  if (n.length < LARGO_MINIMO) return 'El nombre de la sala debe tener al menos ' + LARGO_MINIMO + ' caracteres.';

  const d = texto(direccion);
  if (!d) return 'La dirección es obligatoria.';
  if (d.length < LARGO_MINIMO) return 'La dirección debe tener al menos ' + LARGO_MINIMO + ' caracteres.';

  const c = numero(capacidad);
  if (isNaN(c) || !Number.isInteger(c)) return 'La capacidad debe ser un número entero.';
  if (c < CAPACIDAD_MINIMA) return 'La capacidad no puede ser menor a ' + CAPACIDAD_MINIMA + ' localidades.';

  return null;
}

// Las salas que pueden recibir eventos nuevos
function activas() {
  return getAllSalas().filter((s) => s.estado === 'ACTIVA');
}

module.exports = { CAPACIDAD_MINIMA, validar, activas, getAllSalas, getSalaById, getSalaByName, createSala, updateSalaById, toggleSalaById };
