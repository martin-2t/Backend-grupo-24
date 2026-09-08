const express = require('express');
const router = express.Router();
const salasController = require('../controllers/salasController');

router.get('/', salasController.getAllSalas);
router.get('/nombre/:nombre', salasController.getSalaByName);
router.get('/:id', salasController.getSalaById);
router.post('/', salasController.createSala);
router.put('/:id', salasController.updateSala);
router.put('/dis/:id', salasController.toggleSala);

module.exports = router;