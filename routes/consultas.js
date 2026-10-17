const express = require('express');
const router = express.Router();
const consultasController = require('../controllers/api/consultas');
const { autenticar, permitir } = require('../middleware/auth');

// Ventas: información interna del negocio, solo para el personal
const personal = [autenticar, permitir('ADMIN', 'EMPLEADO')];
router.get('/entradas-vendidas/:eventoId', ...personal, consultasController.entradasVendidas);
router.get('/entradas-vendidas', ...personal, consultasController.entradasVendidas);

// Disponibilidad y cartelera: públicas
router.get('/entradas-disponibles/:eventoId', consultasController.entradasDisponibles);
router.get('/eventos-proximos', consultasController.eventosProximos);

module.exports = router;
