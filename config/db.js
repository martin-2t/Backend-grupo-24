import mongoose from 'mongoose';

// La cadena de conexión no va en el código: cada uno la define en su .env (ver .env.example)
async function conectarDB() {
  if (!process.env.MONGODB_URI) {
    console.error('Falta la variable MONGODB_URI. Copiá .env.example como .env y completala.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a MongoDB');
  } catch (error) {
    console.error('Error de conexión a MongoDB:', error.message);
    process.exit(1);
  }
}

export default conectarDB;
