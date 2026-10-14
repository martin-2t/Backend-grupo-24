// carga las variables del archivo .env en process.env (antes que cualquier otra cosa)
require('dotenv').config({ quiet: true });

// importacion de express
const express = require('express');
const path = require('path');
const conectarDB = require('./config/db');

const app = express();

// middlewares 
const logger = require('./middleware/logger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

// puerto
const PORT = process.env.PORT || 3000;

// motor de plantillas Pug
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(logger);

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // para leer los formularios de las vistas Pug
app.use('/public', express.static(path.join(__dirname, 'public')));

// declaracion de rutas de la API (JSON)
const inicioRoutes = require('./routes/inicio');
const clientesRoutes = require('./routes/clientes');
const entradasRoutes = require('./routes/entradas');
const salasRoutes = require('./routes/salas');
const eventosRoutes = require('./routes/eventos');
const consultasRoutes = require('./routes/consultas');

app.use('/', inicioRoutes);
app.use('/clientes', clientesRoutes);
app.use('/entradas', entradasRoutes);
app.use('/salas', salasRoutes);
app.use('/eventos', eventosRoutes);
app.use('/consultas', consultasRoutes);

// rutas de páginas (Pug) — panel visual sobre los mismos datos.
// Van bajo /panel para no chocar con la API JSON, que usa los mismos nombres
// (/clientes, /eventos, etc.) pero devuelve JSON en vez de HTML.
const paginasRoutes = require('./routes/paginas');
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
