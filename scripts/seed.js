// Carga los datos iniciales de scripts/semillas en MongoDB. Se ejecuta con: npm run seed
// ATENCIÓN: vacía cada colección antes de cargarla.
//
// Las semillas son solo datos de arranque: la aplicación persiste todo en MongoDB.
// Sus documentos traen un _id fijo (por ejemplo, la sala 1 es
// "5a1a00000000000000000001" y el evento 1 es "5a1e00000000000000000001"), así las
// referencias entre colecciones son las mismas
// en la base de cada integrante y en Atlas.
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import conectarDB from '../config/db.js';
import { Sala } from '../models/salas.js';
import { Entrada, recalcularLugares } from '../models/entradas.js';
import { Cliente } from '../models/clientes.js';
import { Usuario } from '../models/usuarios.js';
import { Evento } from '../models/eventos.js';

dotenv.config({ quiet: true });

// Los usuarios de prueba traen la contraseña en texto: se reemplaza por salt + hash
// antes de guardar, así en la base nunca queda una contraseña real
function prepararUsuario({ password, ...usuario }) {
  return { ...usuario, ...Usuario.crearPasswordSeguro(password) };
}

// Un evento puede traer "fechaRelativa" en vez de "fecha": { "dias": 0, "hora": "21:00" } es hoy
// a las 21 (hora de Buenos Aires), { "dias": 1, ... } mañana. Sirve para el evento de demostración
// del check-in con QR, que solo se valida el día del evento: corriendo la semilla el día de la
// prueba, ese evento siempre es "hoy". Las entradas de demostración traen códigos fijos y legibles
// (DemoIngreso...) para encontrarlas fácil; las entradas reales reciben un código aleatorio
function prepararEvento({ fechaRelativa, ...evento }) {
  if (!fechaRelativa) return evento;
  const enMilisegundos = Date.now() + fechaRelativa.dias * 24 * 60 * 60 * 1000;
  const dia = new Date(enMilisegundos).toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }); // AAAA-MM-DD
  // Argentina está siempre en UTC-3 (no cambia la hora en verano)
  return { ...evento, fecha: new Date(`${dia}T${fechaRelativa.hora}:00-03:00`) };
}

// Cada entidad que está en Mongo tiene aquí su model y su archivo de datos.
// El orden acompaña las referencias: el evento apunta a una sala, y la entrada a un evento y un cliente.
// "preparar" es opcional: transforma cada documento antes de insertarlo.
const colecciones = [
  { model: Sala, archivo: 'salas.json' },
  { model: Cliente, archivo: 'clientes.json' },
  { model: Evento, archivo: 'eventos.json', preparar: prepararEvento },
  { model: Entrada, archivo: 'entradas.json' },
  { model: Usuario, archivo: 'usuarios.json', preparar: prepararUsuario },
];

function leerDatos(archivo) {
  const ruta = path.join(import.meta.dirname, 'semillas', archivo);
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

  // insertMany no pasa por createEntrada: el contador de lugares de cada evento se calcula
  // al final, contando sus entradas
  const eventos = await Evento.find();
  await Promise.all(eventos.map((evento) => recalcularLugares(evento.id)));
  console.log(`eventos: contador de lugares ocupados calculado en ${eventos.length} eventos`);

  await mongoose.disconnect();
}

sembrar().catch((error) => {
  console.error('Error al cargar los datos:', error.message);
  process.exit(1);
});