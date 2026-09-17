const fs = require('fs');
const path = require('path');

// Clase que representa a un Cliente. Definimos qué datos tiene cada cliente
class Cliente {
  constructor(id, nombre, apellido, email, telefono) {
    this.id = id;
    this.nombre = nombre;
    this.apellido = apellido;
    this.email = email;
    this.telefono = telefono;
  }
}

// Arma la ruta absoluta al archivo clientes.json
const filePath = path.join(__dirname, '..', 'data', 'clientes.json');

// Lee todo el archivo clientes.json y devuelve el array de clientes
function getAll() {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

// Busca un cliente puntual por su id
function getById(id) {
  return getAll().find((c) => c.id === Number(id));
}

// Crea un nuevo cliente y lo guarda en el archivo
function create(datos) {
  const clientes = getAll();
  const newId = clientes.length ? Math.max(...clientes.map((c) => c.id)) + 1 : 1;
  const nuevo = new Cliente(newId, datos.nombre, datos.apellido, datos.email, datos.telefono);
  clientes.push(nuevo);
  fs.writeFileSync(filePath, JSON.stringify(clientes, null, 2), 'utf-8');
  return nuevo;
}

// Actualiza un cliente existente por id
function update(id, cambios) {
  const clientes = getAll();
  const idx = clientes.findIndex((c) => c.id === Number(id));
  if (idx === -1) return null;

  const cambiosLimpios = Object.fromEntries(
    Object.entries(cambios).filter(([, valor]) => valor !== undefined)
  );

  clientes[idx] = { ...clientes[idx], ...cambiosLimpios, id: clientes[idx].id };
  fs.writeFileSync(filePath, JSON.stringify(clientes, null, 2), 'utf-8');
  return clientes[idx];
}

// Elimina un cliente por id
function remove(id) {
  const clientes = getAll();
  const idx = clientes.findIndex((c) => c.id === Number(id));
  if (idx === -1) return false;

  clientes.splice(idx, 1);
  fs.writeFileSync(filePath, JSON.stringify(clientes, null, 2), 'utf-8');
  return true;
}

module.exports = { getAll, getById, create, update, remove };
