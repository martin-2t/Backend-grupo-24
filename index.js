// importacion de express y utilidades
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import conectarDB from './config/db.js';

// middlewares propios
import logger from './middleware/logger.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

// rutas de la API (JSON)
import inicioRoutes from './routes/inicio.js';
import clientesRoutes from './routes/clientes.js';
import entradasRoutes from './routes/entradas.js';
import salasRoutes from './routes/salas.js';
import eventosRoutes from './routes/eventos.js';
import consultasRoutes from './routes/consultas.js';
import authRoutes from './routes/auth.js';
import usuariosRoutes from './routes/usuarios.js';

// rutas de páginas (Pug)
import paginasRoutes from './routes/paginas.js';

// carga las variables del archivo .env en process.env, antes de usarlas (puerto y conexión)
dotenv.config({ quiet: true });

const app = express();

// puerto
const PORT = process.env.PORT || 3000;

// motor de plantillas Pug
app.set('view engine', 'pug');
app.set('views', path.join(import.meta.dirname, 'views'));
app.use(logger);

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // para leer los formularios de las vistas Pug
app.use('/public', express.static(path.join(import.meta.dirname, 'public')));

// declaracion de rutas de la API (JSON)
app.use('/', inicioRoutes);
app.use('/auth', authRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/clientes', clientesRoutes);
app.use('/entradas', entradasRoutes);
app.use('/salas', salasRoutes);
app.use('/eventos', eventosRoutes);
app.use('/consultas', consultasRoutes);

// rutas de páginas (Pug) — panel visual sobre los mismos datos.
// Van bajo /panel para no chocar con la API JSON, que usa los mismos nombres
// (/clientes, /eventos, etc.) pero devuelve JSON en vez de HTML.
app.use('/panel', paginasRoutes);

// manejo de error de ruta no encontrada
app.use(notFound);

// Manejador de errores general
app.use(errorHandler);

// el servidor recién empieza a escuchar cuando la base de datos está conectada
async function iniciar() {
  await conectarDB();
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

iniciar();
