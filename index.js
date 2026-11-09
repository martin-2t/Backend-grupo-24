// Punto de entrada del servidor: carga el .env, conecta a MongoDB y abre el puerto.
// La aplicación (rutas, middlewares, errores) se arma en app.js.
import dotenv from 'dotenv';
import app from './app.js';
import conectarDB from './config/db.js';

// carga las variables del archivo .env en process.env, antes de usarlas (puerto y conexión)
dotenv.config({ quiet: true });

// puerto
const PORT = process.env.PORT || 3000;

// el servidor recién empieza a escuchar cuando la base de datos está conectada
async function iniciar() {
  await conectarDB();
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

iniciar();

// Vercel toma la app exportada desde este archivo (ver vercel.json)
export default app;
