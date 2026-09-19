// Rutas del panel, montadas bajo /panel. Los formularios HTML solo mandan GET y POST,
// así que lo que en la API es PUT (finalizar, cancelar, confirmar, baja) acá va por POST.
const express = require('express');
const router = express.Router();

const comunes = require('../controllers/paginas/comunes');
const inicio = require('../controllers/paginas/inicio');
const eventos = require('../controllers/paginas/eventos');
const salas = require('../controllers/paginas/salas');
const clientes = require('../controllers/paginas/clientes');
const entradas = require('../controllers/paginas/entradas');
const consultas = require('../controllers/paginas/consultas');

router.use(comunes.localesComunes);

router.get('/', inicio.mostrar);
router.get('/consultas', consultas.mostrar);

// Las rutas literales van antes que las de :id para que no las capture
router.get('/eventos', eventos.listar);
router.get('/eventos/nuevo', eventos.nuevoForm);
router.post('/eventos/nuevo', eventos.crear);
router.get('/eventos/:id', eventos.detalle);
router.get('/eventos/:id/editar', eventos.editarForm);
router.post('/eventos/:id/editar', eventos.actualizar);
router.post('/eventos/:id/finalizar', eventos.finalizar);
router.post('/eventos/:id/cancelar', eventos.cancelar);

router.get('/salas', salas.listar);
router.get('/salas/nueva', salas.nuevoForm);
router.post('/salas/nueva', salas.crear);
router.get('/salas/:id', salas.detalle);
router.get('/salas/:id/editar', salas.editarForm);
router.post('/salas/:id/editar', salas.actualizar);
router.post('/salas/:id/estado', salas.cambiarEstado);

router.get('/clientes', clientes.listar);
router.get('/clientes/nuevo', clientes.nuevoForm);
router.post('/clientes/nuevo', clientes.crear);
router.get('/clientes/:id', clientes.detalle);
router.get('/clientes/:id/editar', clientes.editarForm);
router.post('/clientes/:id/editar', clientes.actualizar);
router.post('/clientes/:id/eliminar', clientes.eliminar);

router.get('/entradas', entradas.listar);
router.get('/entradas/nueva', entradas.nuevoForm);
router.post('/entradas/nueva', entradas.crear);
router.get('/entradas/:id', entradas.detalle);
router.post('/entradas/:id/confirmar', entradas.confirmar);
router.post('/entradas/:id/cancelar', entradas.cancelar);
router.post('/entradas/:id/precio', entradas.actualizarPrecio);
router.post('/entradas/:id/eliminar', entradas.eliminar);

module.exports = router;
