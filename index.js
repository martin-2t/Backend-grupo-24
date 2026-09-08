// importacion de express
const express = require('express');

const app = express();

// puerto
const PORT = 3000;

app.use(express.json());

// declaracion de rutas

const clientesRoutes = require('./routes/clientes');



app.use('/clientes', clientesRoutes);


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
