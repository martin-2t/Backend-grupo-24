// Arma la aplicación de Express (middlewares, rutas y manejo de errores) sin conectarse a la
// base ni abrir un puerto. Así la pueden usar tanto el servidor (index.js) como los tests,
// que la levantan con Supertest contra una base de MongoDB en memoria.
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';

// middlewares propios
import logger from './middleware/logger.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

// autenticación: Passport con la estrategia local (ver config/passport.js)
import passport from './config/passport.js';

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

const app = express();

// En Vercel o Render la app corre detrás de un proxy que recibe el HTTPS. Con esto, req.protocol
// devuelve "https" y las URL que arma la app (por ejemplo, la del QR de cada entrada) son correctas
app.set('trust proxy', 1);

// motor de plantillas Pug
app.set('view engine', 'pug');
app.set('views', path.join(import.meta.dirname, 'views'));

// Jest define NODE_ENV=test: en los tests no se registra cada petición en consola
if (process.env.NODE_ENV !== 'test') {
  app.use(logger);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // para leer los formularios de las vistas Pug
app.use(cookieParser()); // lee la cookie "token" del JWT
app.use(passport.initialize()); // sin passport.session(): la identidad viaja en el JWT
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

// rutas de páginas (Pug): el panel visual sobre los mismos datos.
// Van bajo /panel para no chocar con la API JSON, que usa los mismos nombres
// (/clientes, /eventos, etc.) pero devuelve JSON en vez de HTML.
app.use('/panel', paginasRoutes);

// manejo de error de ruta no encontrada
app.use(notFound);

// Manejador de errores general
app.use(errorHandler);

export default app;
