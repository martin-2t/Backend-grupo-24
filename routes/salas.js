const express = require('express');
const router = express.Router();
const salasController = require('../controllers/api/salas');
const { autenticar, permitir } = require('../middleware/auth');
const { soloSuCentro, salaDelParametro } = require('../middleware/centro');

// Lectura pública (cartelera)
router.get('/', salasController.getAllSalas);
router.get('/nombre/:nombre', salasController.getSalaByName);
router.get('/:id', salasController.getSalaById);

// Alta y baja: solo ADMIN. Edición: ADMIN o el EMPLEADO de ese centro
router.post('/', autenticar, permitir('ADMIN'), salasController.createSala);
router.put('/:id', autenticar, permitir('ADMIN', 'EMPLEADO'), soloSuCentro(salaDelParametro), salasController.updateSala);
router.put('/dis/:id', autenticar, permitir('ADMIN'), salasController.toggleSala);

module.exports = router;
