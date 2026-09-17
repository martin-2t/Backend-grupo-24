// importacion de express
const express = require('express');
const path = require('path');

const app = express();

// puerto
const PORT = 3000;

// motor de plantillas Pug
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // para leer los formularios de las vistas Pug
app.use('/public', express.static(path.join(__dirname, 'public')));

// declaracion de rutas de la API (JSON)
const clientesRoutes = require('./routes/clientes');
const entradasRoutes = require('./routes/entradas');
const salasRoutes = require('./routes/salasRoutes');
const eventosRoutes = require('./routes/eventos');
const consultasRoutes = require('./routes/consultas');

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
app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado' });
});

// Manejador de errores general
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// muestra el servidor en el puerto indicado
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
