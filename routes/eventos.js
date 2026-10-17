const express = require('express');
const router = express.Router();
const eventosController = require('../controllers/api/eventos');
const { autenticar, permitir } = require('../middleware/auth');
const { soloSuCentro, salaDelBody, salasDelEvento } = require('../middleware/centro');

// Lectura pública (cartelera)
router.get('/proximos', eventosController.proximos);
router.get('/', eventosController.listar);
router.get('/:id', eventosController.obtener);

// Gestión: ADMIN, o EMPLEADO solo para eventos de su propio centro
const gestion = [autenticar, permitir('ADMIN', 'EMPLEADO')];
router.post('/', ...gestion, soloSuCentro(salaDelBody), eventosController.crear);
router.put('/:id', ...gestion, soloSuCentro(salasDelEvento), eventosController.actualizar);
router.put('/:id/finalizar', ...gestion, soloSuCentro(salasDelEvento), eventosController.finalizar);
router.put('/:id/cancelar', ...gestion, soloSuCentro(salasDelEvento), eventosController.cancelar);

module.exports = router;
