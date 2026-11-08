// Rutas del panel, montadas bajo /panel. Los formularios HTML solo mandan GET y POST,
// así que lo que en la API es PUT (finalizar, cancelar, confirmar, baja) acá va por POST.
// Los permisos son los mismos que en la API: rol (permitirPagina) y, para el personal de un
// centro, que la sala sea la suya (soloSuCentroPagina).
import express from 'express';

import { cargarUsuario, requerirLogin, permitirPagina } from '../middleware/auth.js';
import {
  soloSuCentroPagina,
  salaDelParametro,
  salaDelBody,
  salasDelEvento,
  salaDelEventoDelBody,
  salaDeLaEntrada,
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

const router = express.Router();

// Personal: ADMIN, REPRESENTANTE y EMPLEADO (el cajero). El REPRESENTANTE hereda lo del EMPLEADO.
// El CLIENTE solo mira la cartelera.
const personal = permitirPagina('ADMIN', 'EMPLEADO');
// Gerencia: ADMIN y REPRESENTANTE publican eventos y editan su sala. El cajero (EMPLEADO) no.
const gerencia = permitirPagina('ADMIN', 'REPRESENTANTE');
const soloAdmin = permitirPagina('ADMIN');

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

// Inicio: lo ven todos los roles
router.get('/', inicio.mostrar);

// Consultas de ventas: solo el personal
router.get('/consultas', personal, consultas.mostrar);

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
// La regla de a quién puede gestionar la aplica cada controlador (models/gestionUsuarios.js)
router.use('/usuarios', permitirPagina('ADMIN', 'REPRESENTANTE'));
router.get('/usuarios', usuarios.listar);
router.get('/usuarios/nuevo', usuarios.nuevoForm);
router.post('/usuarios/nuevo', usuarios.crear);
router.post('/usuarios/:id/estado', usuarios.cambiarEstado);
router.post('/usuarios/:id/desbloquear', usuarios.desbloquear);

// Clientes: datos personales, solo el personal. Eliminar: solo ADMIN
router.use('/clientes', personal);
router.get('/clientes', clientes.listar);
router.get('/clientes/nuevo', clientes.nuevoForm);
router.post('/clientes/nuevo', clientes.crear);
router.get('/clientes/:id', clientes.detalle);
router.get('/clientes/:id/editar', clientes.editarForm);
router.post('/clientes/:id/editar', clientes.actualizar);
router.post('/clientes/:id/eliminar', soloAdmin, clientes.eliminar);

// Entradas: solo el personal; el cajero y el REPRESENTANTE solo sobre las de su sala. Eliminar: solo ADMIN
router.use('/entradas', personal);
router.get('/entradas', entradas.listar);
router.get('/entradas/nueva', entradas.nuevoForm);
router.post('/entradas/nueva', soloSuCentroPagina(salaDelEventoDelBody), entradas.crear);
router.get('/entradas/:id', soloSuCentroPagina(salaDeLaEntrada), entradas.detalle);
router.post('/entradas/:id/confirmar', soloSuCentroPagina(salaDeLaEntrada), entradas.confirmar);
router.post('/entradas/:id/cancelar', soloSuCentroPagina(salaDeLaEntrada), entradas.cancelar);
router.post('/entradas/:id/precio', soloSuCentroPagina(salaDeLaEntrada), entradas.actualizarPrecio);
router.post('/entradas/:id/eliminar', soloAdmin, entradas.eliminar);

export default router;