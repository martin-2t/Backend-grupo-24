const express = require('express');
const router = express.Router();
const consultasController = require('../controllers/consultasController');

router.get('/entradas-vendidas/:eventoId', consultasController.entradasVendidas);
router.get('/entradas-vendidas', consultasController.entradasVendidas);
router.get('/entradas-disponibles/:eventoId', consultasController.entradasDisponibles);
router.get('/eventos-proximos', consultasController.eventosProximos);

module.exports = router;
