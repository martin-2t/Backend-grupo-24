// Datos de prueba: funciones que crean en la base lo mínimo que necesita cada test.
// Cada una acepta "cambios" para pisar los valores por defecto, por ejemplo:
//   const sala = await crearSala({ capacidad: 50 });
import * as salasModel from '../../models/salas.js';
import * as eventosModel from '../../models/eventos.js';
import * as clientesModel from '../../models/clientes.js';
import * as usuariosModel from '../../models/usuarios.js';
import { generarToken } from '../../config/jwt.js';

// Los tests no leen el .env: el secreto del JWT se define acá
process.env.JWT_SECRET = 'secreto-solo-para-tests';

function crearSala(cambios = {}) {
  return salasModel.createSala({
    nombre: 'Sala de Prueba',
    direccion: 'Avenida Siempreviva 742',
    capacidad: 10,
    ...cambios,
  });
}

function crearEvento(salaId, cambios = {}) {
  const enUnMes = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return eventosModel.createEvento({
    nombre: 'Evento de prueba',
    fecha: enUnMes,
    salaId,
    precio: 5000,
    ...cambios,
  });
}

// "numero" permite crear varios clientes distintos sin repetir el email
function crearCliente(numero = 1) {
  return clientesModel.create({
    nombre: 'Cliente',
    apellido: 'Prueba',
    email: `cliente${numero}@mail.com`,
    telefono: '1155550000',
  });
}

// Crea un usuario y devuelve también su token, listo para el header Authorization.
// "email" es opcional: hace falta para crear dos usuarios con el mismo rol (por ejemplo, un
// empleado de cada centro), porque el email por defecto sale del rol y no se puede repetir
async function crearUsuarioConToken({ rol = 'ADMIN', salaId, clienteId, email } = {}) {
  const usuario = await usuariosModel.create({
    nombre: 'Usuario Prueba',
    email: email || `${rol.toLowerCase()}@urbanacult.com`,
    password: 'clave-de-prueba',
    rol,
    salaId,
    clienteId,
  });
  return { usuario, token: generarToken(usuario) };
}

export { crearSala, crearEvento, crearCliente, crearUsuarioConToken };
