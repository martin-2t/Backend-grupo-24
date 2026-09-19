const express = require('express');
const router = express.Router();
const entradasController = require('../controllers/api/entradas');

router.get('/', entradasController.getAllEntradas);
router.get('/:id', entradasController.getEntradaById);
router.post('/', entradasController.crearVenta);
router.post('/reservar', entradasController.crearReserva);
router.put('/:id/confirmar', entradasController.confirmarReserva);
router.put('/:id/cancelar', entradasController.cancelarEntrada);
router.put('/:id', entradasController.updateEntrada);
router.delete('/:id', entradasController.deleteEntrada);

module.exports = router;
