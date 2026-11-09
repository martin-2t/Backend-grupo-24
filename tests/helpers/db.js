// Base de datos para los tests: un MongoDB real que corre en memoria (mongodb-memory-server).
// Cada archivo de test levanta la suya, así no toca la base de nadie (ni local ni Atlas)
// y cada corrida arranca de cero.
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let servidor;

// Se llama en beforeAll: levanta el MongoDB en memoria y conecta Mongoose
async function conectar() {
  servidor = await MongoMemoryServer.create();
  await mongoose.connect(servidor.getUri());
}

// Se llama en afterEach: vacía todas las colecciones, para que un test no afecte al siguiente
async function limpiar() {
  const colecciones = Object.values(mongoose.connection.collections);
  await Promise.all(colecciones.map((coleccion) => coleccion.deleteMany({})));
}

// Se llama en afterAll: cierra la conexión y apaga el MongoDB en memoria
async function desconectar() {
  await mongoose.disconnect();
  await servidor.stop();
}

export { conectar, limpiar, desconectar };
