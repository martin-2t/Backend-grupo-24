// Rutas del panel, montadas bajo /panel. Los formularios HTML solo mandan GET y POST,
// así que lo que en la API es PUT (finalizar, cancelar, confirmar, baja) acá va por POST.
const express = require('express');
const router = express.Router();
const paginasController = require('../controllers/paginasController');

router.use(paginasController.mensajes);

router.get('/', paginasController.inicio);
router.get('/consultas', paginasController.consultas);

// Las rutas literales van antes que las de :id para que no las capture
router.get('/eventos', paginasController.eventosListar);
router.get('/eventos/nuevo', paginasController.eventoNuevoForm);
router.post('/eventos/nuevo', paginasController.eventoCrear);
router.get('/eventos/:id', paginasController.eventoDetalle);
router.get('/eventos/:id/editar', paginasController.eventoEditarForm);
router.post('/eventos/:id/editar', paginasController.eventoActualizar);
router.post('/eventos/:id/finalizar', paginasController.eventoFinalizar);
router.post('/eventos/:id/cancelar', paginasController.eventoCancelar);

router.get('/salas', paginasController.salasListar);
router.get('/salas/nueva', paginasController.salaNuevaForm);
router.post('/salas/nueva', paginasController.salaCrear);
router.get('/salas/:id', paginasController.salaDetalle);
router.get('/salas/:id/editar', paginasController.salaEditarForm);
router.post('/salas/:id/editar', paginasController.salaActualizar);
router.post('/salas/:id/estado', paginasController.salaCambiarEstado);

router.get('/clientes', paginasController.clientesListar);
router.get('/clientes/nuevo', paginasController.clienteNuevoForm);
router.post('/clientes/nuevo', paginasController.clienteCrear);
router.get('/clientes/:id', paginasController.clienteDetalle);
router.get('/clientes/:id/editar', paginasController.clienteEditarForm);
router.post('/clientes/:id/editar', paginasController.clienteActualizar);
router.post('/clientes/:id/eliminar', paginasController.clienteEliminar);

router.get('/entradas', paginasController.entradasListar);
router.get('/entradas/nueva', paginasController.entradaNuevaForm);
router.post('/entradas/nueva', paginasController.entradaCrear);
router.get('/entradas/:id', paginasController.entradaDetalle);
router.post('/entradas/:id/confirmar', paginasController.entradaConfirmar);
router.post('/entradas/:id/cancelar', paginasController.entradaCancelar);
router.post('/entradas/:id/precio', paginasController.entradaActualizarPrecio);
router.post('/entradas/:id/eliminar', paginasController.entradaEliminar);

module.exports = router;
