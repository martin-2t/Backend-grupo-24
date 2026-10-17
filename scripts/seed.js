// Carga los datos iniciales de /data en MongoDB. Se ejecuta con: npm run seed
// ATENCIÓN: vacía cada colección antes de cargarla.
//
// Los documentos de /data traen un _id fijo (por ejemplo, la sala 1 es
// "5a1a00000000000000000001"), así las referencias entre colecciones son las mismas
// en la base de cada integrante y en Atlas.
require('dotenv').config({ quiet: true });

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const conectarDB = require('../config/db');
const { Sala } = require('../models/salas');
const { Entrada } = require('../models/entradas');

// Cada entidad que se migre a Mongo agrega aquí su model y su archivo de datos
const colecciones = [
  { model: Sala, archivo: 'salas.json' },
  { model: Entrada, archivo: 'entradas.json' },
];

function leerDatos(archivo) {
  const ruta = path.join(__dirname, '..', 'data', archivo);
  return JSON.parse(fs.readFileSync(ruta, 'utf-8'));
}

async function sembrar() {
  await conectarDB();

  for (const { model, archivo } of colecciones) {
    const datos = leerDatos(archivo);
    await model.deleteMany({});
    await model.insertMany(datos);
    console.log(`${model.collection.name}: ${datos.length} documentos cargados`);
  }

  await mongoose.disconnect();
}

sembrar().catch((error) => {
  console.error('Error al cargar los datos:', error.message);
  process.exit(1);
});
