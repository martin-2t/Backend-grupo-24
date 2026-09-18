// importacion de express
const express = require('express');

const app = express();

// middlewares 
const logger = require('./middleware/logger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

// puerto
const PORT = 3000;

app.use(logger);

app.use(express.json());

// declaracion de rutas

const clientesRoutes = require('./routes/clientes');

const entradasRoutes = require('./routes/entradas');

const salasRoutes = require('./routes/salasRoutes');

app.use('/clientes', clientesRoutes);

app.use('/entradas', entradasRoutes);

app.use('/salas', salasRoutes);

// manejo de error de ruta no encontrada
app.use(notFound);

// Manejador de errores general
app.use(errorHandler);


// muestra el servidor en el puerto indicado
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
