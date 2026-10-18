// Carga los datos iniciales de /data en MongoDB. Se ejecuta con: npm run seed
// ATENCIÓN: vacía cada colección antes de cargarla.
//
// Los documentos de /data traen un _id fijo (por ejemplo, la sala 1 es
// "5a1a00000000000000000001" y el evento 1 es "5a1e00000000000000000001"), así las
// referencias entre colecciones son las mismas
// en la base de cada integrante y en Atlas.
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import conectarDB from '../config/db.js';
import { Sala } from '../models/salas.js';
import { Entrada } from '../models/entradas.js';
import { Cliente } from '../models/clientes.js';
import { Usuario } from '../models/usuarios.js';
import { Evento } from '../models/eventos.js';

dotenv.config({ quiet: true });

// Los usuarios de prueba traen la contraseña en texto: se reemplaza por salt + hash
// antes de guardar, así en la base nunca queda una contraseña real
function prepararUsuario({ password, ...usuario }) {
  return { ...usuario, ...Usuario.crearPasswordSeguro(password) };
}

// Cada entidad que está en Mongo tiene aquí su model y su archivo de datos.
// El orden acompaña las referencias: el evento apunta a una sala, y la entrada a un evento y un cliente
// "preparar" es opcional: transforma cada documento antes de insertarlo.
const colecciones = [
  { model: Sala, archivo: 'salas.json' },
  { model: Cliente, archivo: 'clientes.json' },
  { model: Evento, archivo: 'eventos.json' },
  { model: Entrada, archivo: 'entradas.json' },
  { model: Usuario, archivo: 'usuarios.json', preparar: prepararUsuario },
];

function leerDatos(archivo) {
  const ruta = path.join(import.meta.dirname, '..', 'data', archivo);
  return JSON.parse(fs.readFileSync(ruta, 'utf-8'));
}

async function sembrar() {
  await conectarDB();

  for (const { model, archivo, preparar } of colecciones) {
    const datos = preparar ? leerDatos(archivo).map(preparar) : leerDatos(archivo);
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