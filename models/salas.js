const fs = require('fs');
const path = require('path');

// Entidad Sala
class Sala{
    constructor(id, nombre, capacidad, direccion, estado = "ACTIVA"){
        this.id = id;
        this.nombre = nombre;
        this.capacidad = capacidad;
        this.direccion = direccion;
        this.estado = estado;
    }
}

// Coneccion con BBDD (JSON)
const filePath = path.join(__dirname, '..', 'data', 'salas.json');

// READ | Retorna array de todas las Salas
function getAllSalas() {
  const raw = fs.readFileSync(filePath, 'utf-8'); 
  return JSON.parse(raw);   
}

// READ | Retorna una Sala en particular a partir del ID
function getSalaById(id) {
  return getAllSalas().find((s) => s.id === Number(id));
}

// READ | Retorna una Sala en particular a partir del Nombre
function getSalaByName(nombre) {
  return getAllSalas().find((s) => s.nombre.toLowerCase() === String(nombre).toLocaleLowerCase());
}

// CREATE | Crea y Graba una nueva Sala en BBDD
function createSala(data) {
  // Recupera todas las salas existentes en BBDD
  const salas = getAllSalas(); 

  // Calcula el próximo id
  const nuevoId = salas.length ? Math.max(...salas.map((s) => s.id)) + 1 : 1;

  // Crea un nuevo objeto Sala con los datos
  let nuevaSala = new Sala(nuevoId, data.nombre, data.capacidad, data.direccion);

  //  y lo agrega al array
  salas.push(nuevaSala); 

  // Graba en BBDD el array actualizado con la nueva Sala creada
  fs.writeFileSync(filePath, JSON.stringify(salas, null, 2), 'utf-8');

  // Retorna la nueva Sala creada
  return nuevaSala; 
}

// UPTADE | Actualiza una Sala por id
function updateSalaById(id, data) {
  // Recupera todas las salas existentes en BBDD
  const salas = getAllSalas();

  // Busca la posición índice dentro del array
  const idx = salas.findIndex((s) => s.id === Number(id));

  // Si no se encuentra el id, retorna NULL
  if (idx === -1) return null;

  // Como el Update es parcial, sacamos del objeto "data" las claves que vinieron
  // en undefined (campos que el usuario no quiso modificar), para no pisar con
  // undefined los valores que la Sala ya tenía guardados
  const cambios = Object.fromEntries(
    Object.entries(data).filter(([, valor]) => valor !== undefined)
  );

  // Si se encuentra la Sala, actualiza solo con los cambios recibidos
  salas[idx] = { ...salas[idx], ...cambios, id: salas[idx].id };

  // Graba en BBDD el array actualizado con la Sala modificada
  fs.writeFileSync(filePath, JSON.stringify(salas, null, 2), 'utf-8');

  // Retorna la Sala modificada
  return salas[idx];
}

// DELETE | Borrado logico para persistencia de datos
function toggleSalaById(id) {
  // Recupera todas las salas existentes en BBDD
  const salas = getAllSalas();

  // Busca la posición índice dentro del array
  const idx = salas.findIndex((s) => s.id === Number(id));

  if (idx === -1) {
        return null;
  }

  // Modifica el estado actual de la Sala
  salas[idx].estado = salas[idx].estado === "ACTIVA" ? "INACTIVA" : "ACTIVA";

  // Graba en BBDD el array actualizado con la Sala modificada
  fs.writeFileSync(filePath, JSON.stringify(salas, null, 2), 'utf-8');

  // Retorna la Sala modificada
  return salas[idx];
}

// Exportacion de Modulos para el Controller
module.exports = { getAllSalas, getSalaById, getSalaByName, createSala, updateSalaById, toggleSalaById }