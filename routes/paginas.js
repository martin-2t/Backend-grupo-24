// Rutas del panel, montadas bajo /panel. Los formularios HTML solo mandan GET y POST,
// así que lo que en la API es PUT (finalizar, cancelar, confirmar, baja) acá va por POST.
// Los permisos son los mismos que en la API: rol (permitirPagina) y, para el personal de un
// centro, que la sala sea la suya (soloSuCentroPagina).
import express from 'express';

import { cargarUsuario, requerirLogin, permitirPagina, marcarSoloLectura } from '../middleware/auth.js';
import {
  soloSuCentroPagina,
  salaDelParametro,
  salaDelBody,
  salasDelEvento,
  salaDelEventoDelBody,
  salaDeLaEntrada,
  salaDeLaEntradaPorCodigo,
} from '../middleware/centro.js';
import * as comunes from '../controllers/paginas/comunes.js';
import * as inicio from '../controllers/paginas/inicio.js';
import * as eventos from '../controllers/paginas/eventos.js';
import * as salas from '../controllers/paginas/salas.js';
import * as clientes from '../controllers/paginas/clientes.js';
import * as entradas from '../controllers/paginas/entradas.js';
import * as consultas from '../controllers/paginas/consultas.js';
import * as auth from '../controllers/paginas/auth.js';
import * as usuarios from '../controllers/paginas/usuarios.js';
import * as checkin from '../controllers/paginas/checkin.js';
import * as cliente from '../controllers/paginas/cliente.js';

const router = express.Router();

// Personal: ADMIN, REPRESENTANTE y EMPLEADO (el cajero). El REPRESENTANTE hereda lo del EMPLEADO.
// El CLIENTE solo mira la cartelera.
const personal = permitirPagina('ADMIN', 'EMPLEADO');
// Gerencia: ADMIN y REPRESENTANTE publican eventos y editan su sala. El cajero (EMPLEADO) no.
const gerencia = permitirPagina('ADMIN', 'REPRESENTANTE');
const soloAdmin = permitirPagina('ADMIN');
// Consulta: el personal y el AUDITOR, que ve la información interna pero no modifica nada
const lectura = permitirPagina('ADMIN', 'EMPLEADO', 'AUDITOR');

router.use(comunes.localesComunes);
// Identifica al usuario (si hay token válido) para que las vistas muestren su nombre
router.use(cargarUsuario);

// Rutas públicas: no piden login
router.get('/login', auth.loginForm);
router.post('/login', auth.login);
router.post('/logout', auth.logout);
router.get('/registro', auth.registroForm);
router.post('/registro', auth.registro);

// Todo lo que sigue exige haber iniciado sesión
router.use(requerirLogin);
// Las vistas ocultan los botones de acción a los roles de solo lectura
router.use(marcarSoloLectura);

// Inicio: lo ven todos los roles
router.get('/', inicio.mostrar);

// Consultas de ventas: el personal y el AUDITOR
router.get('/consultas', lectura, consultas.mostrar);

// Eventos. Ver: todos. Gestionar: ADMIN, o el REPRESENTANTE de la sala del evento.
// Las rutas literales van antes que las de :id para que no las capture
router.get('/eventos', eventos.listar);
router.get('/eventos/nuevo', gerencia, eventos.nuevoForm);
router.post('/eventos/nuevo', gerencia, soloSuCentroPagina(salaDelBody), eventos.crear);
router.get('/eventos/:id', eventos.detalle);
router.get('/eventos/:id/editar', gerencia, soloSuCentroPagina(salasDelEvento), eventos.editarForm);
router.post('/eventos/:id/editar', gerencia, soloSuCentroPagina(salasDelEvento), eventos.actualizar);
router.post('/eventos/:id/finalizar', gerencia, soloSuCentroPagina(salasDelEvento), eventos.finalizar);
router.post('/eventos/:id/cancelar', gerencia, soloSuCentroPagina(salasDelEvento), eventos.cancelar);

// Salas. Ver: todos. Alta y baja: ADMIN. Edición: ADMIN o el REPRESENTANTE de esa sala
router.get('/salas', salas.listar);
router.get('/salas/nueva', soloAdmin, salas.nuevoForm);
router.post('/salas/nueva', soloAdmin, salas.crear);
router.get('/salas/:id', salas.detalle);
router.get('/salas/:id/editar', gerencia, soloSuCentroPagina(salaDelParametro), salas.editarForm);
router.post('/salas/:id/editar', gerencia, soloSuCentroPagina(salaDelParametro), salas.actualizar);
router.post('/salas/:id/estado', soloAdmin, salas.cambiarEstado);

// Usuarios: ADMIN gestiona a todos; el REPRESENTANTE, solo a los empleados de su centro.
// El AUDITOR ve la lista completa, sin acciones.
// La regla de a quién puede gestionar la aplica cada controlador (models/gestionUsuarios.js)
const gestionUsuarios = permitirPagina('ADMIN', 'REPRESENTANTE');
router.get('/usuarios', permitirPagina('ADMIN', 'REPRESENTANTE', 'AUDITOR'), usuarios.listar);
router.get('/usuarios/nuevo', gestionUsuarios, usuarios.nuevoForm);
router.post('/usuarios/nuevo', gestionUsuarios, usuarios.crear);
router.post('/usuarios/:id/estado', gestionUsuarios, usuarios.cambiarEstado);
router.post('/usuarios/:id/desbloquear', gestionUsuarios, usuarios.desbloquear);

// Clientes: datos personales. Consultar: el personal y el AUDITOR. Cargar y editar: el
// personal. Eliminar: solo ADMIN. Las rutas literales van antes que las de :id
router.use('/clientes', lectura);
router.get('/clientes', clientes.listar);
router.get('/clientes/nuevo', personal, clientes.nuevoForm);
router.post('/clientes/nuevo', personal, clientes.crear);
router.get('/clientes/:id', clientes.detalle);
router.get('/clientes/:id/editar', personal, clientes.editarForm);
router.post('/clientes/:id/editar', personal, clientes.actualizar);
router.post('/clientes/:id/eliminar', soloAdmin, clientes.eliminar);

// Entradas: el personal opera; el cajero y el REPRESENTANTE solo sobre las de su sala.
// El AUDITOR consulta todas, sin operar. Eliminar: solo ADMIN
router.use('/entradas', lectura);
router.get('/entradas', entradas.listar);
router.get('/entradas/nueva', personal, entradas.nuevoForm);
router.post('/entradas/nueva', personal, soloSuCentroPagina(salaDelEventoDelBody), entradas.crear);
router.get('/entradas/:id', soloSuCentroPagina(salaDeLaEntrada), entradas.detalle);
router.post('/entradas/:id/confirmar', personal, soloSuCentroPagina(salaDeLaEntrada), entradas.confirmar);
router.post('/entradas/:id/cancelar', personal, soloSuCentroPagina(salaDeLaEntrada), entradas.cancelar);
router.post('/entradas/:id/precio', personal, soloSuCentroPagina(salaDeLaEntrada), entradas.actualizarPrecio);
router.post('/entradas/:id/eliminar', soloAdmin, entradas.eliminar);

// Check-in en la puerta: el EMPLEADO y el REPRESENTANTE, solo en su propio centro. El ADMIN no
// valida ingresos: es una tarea del lugar, no de la administración del sistema (mínimo privilegio)
const puerta = permitirPagina('EMPLEADO', 'REPRESENTANTE');
router.get('/checkin', puerta, checkin.buscar);
router.get('/checkin/:codigo', puerta, soloSuCentroPagina(salaDeLaEntradaPorCodigo), checkin.mostrar);
router.post('/checkin/:codigo', puerta, soloSuCentroPagina(salaDeLaEntradaPorCodigo), checkin.validar);

// Compra web y "Mis entradas": solo el CLIENTE, y cada uno sobre lo suyo (lo controla cada
// controlador: una compra o entrada ajena responde "no encontrada")
const soloCliente = permitirPagina('CLIENTE');
router.post('/compras', soloCliente, cliente.crearCompra);
router.get('/compras/:compraId', soloCliente, cliente.mostrarCompra);
router.post('/compras/:compraId/pagar', soloCliente, cliente.pagarCompra);
router.post('/compras/:compraId/cancelar', soloCliente, cliente.cancelarCompra);
router.get('/mis-entradas', soloCliente, cliente.misEntradas);
router.get('/mis-entradas/:id', soloCliente, cliente.miEntrada);

export default router;