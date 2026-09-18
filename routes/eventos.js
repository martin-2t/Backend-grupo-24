const express = require('express');
const router = express.Router();
const eventosController = require('../controllers/eventosController');

router.get('/proximos', eventosController.proximos);
router.get('/', eventosController.listar);
router.get('/:id', eventosController.obtener);
router.post('/', eventosController.crear);
router.put('/:id', eventosController.actualizar);
router.put('/:id/finalizar', eventosController.finalizar);
router.put('/:id/cancelar', eventosController.cancelar);

module.exports = router;
