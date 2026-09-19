const fs = require('fs');
const path = require('path');
const { SOLO_LETRAS, SOLO_DIGITOS, EMAIL, texto } = require('./formatos');
const entradasModel = require('./entradas');

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


const TELEFONO_MINIMO = 10;

// Qué hace válido a un cliente. Devuelve el motivo del rechazo, o null si está bien.
function validar({ nombre, apellido, email, telefono }) {
  const n = texto(nombre);
  if (!n) return 'El nombre es obligatorio.';
  if (!SOLO_LETRAS.test(n)) return 'El nombre solo puede tener letras, sin números ni símbolos.';

  const a = texto(apellido);
  if (!a) return 'El apellido es obligatorio.';
  if (!SOLO_LETRAS.test(a)) return 'El apellido solo puede tener letras, sin números ni símbolos.';

  const e = texto(email);
  if (!e) return 'El email es obligatorio.';
  if (!EMAIL.test(e)) return 'El email no tiene un formato válido.';

  // El teléfono es opcional, pero si lo cargan tiene que ser válido
  const t = texto(telefono);
  if (t && !SOLO_DIGITOS.test(t)) return 'El teléfono solo puede tener números, sin letras ni símbolos.';
  if (t && t.length < TELEFONO_MINIMO) return 'El teléfono debe tener al menos ' + TELEFONO_MINIMO + ' dígitos.';

  return null;
}

// El borrado de cliente es físico: una entrada sin titular quedaría huérfana
function tieneEntradasVigentes(id) {
  return entradasModel
    .getAllEntradas()
    .some((e) => e.clienteId === Number(id) && e.estado !== 'CANCELADA');
}

function entradasDelCliente(id) {
  return entradasModel.getAllEntradas().filter((e) => e.clienteId === Number(id));
}

module.exports = { TELEFONO_MINIMO, validar, tieneEntradasVigentes, entradasDelCliente, getAll, getById, create, update, remove };
