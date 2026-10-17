const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/api/clientes');
const { autenticar, permitir } = require('../middleware/auth');

// Los clientes son datos personales: solo el personal (ADMIN y EMPLEADO) los gestiona
const personal = [autenticar, permitir('ADMIN', 'EMPLEADO')];

router.get('/', ...personal, clientesController.listar);
router.get('/:id', ...personal, clientesController.obtener);
router.post('/', ...personal, clientesController.crear);
router.put('/:id', ...personal, clientesController.actualizar);
router.delete('/:id', autenticar, permitir('ADMIN'), clientesController.eliminar);

module.exports = router;
