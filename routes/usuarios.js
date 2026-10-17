const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/api/usuarios');
const { autenticar, permitir } = require('../middleware/auth');

// Todo el recurso es solo para ADMIN: el middleware se aplica a todas las rutas del router
router.use(autenticar, permitir('ADMIN'));

router.get('/', usuariosController.listar);
router.get('/:id', usuariosController.obtener);
router.post('/', usuariosController.crear);
router.put('/:id/desbloquear', usuariosController.desbloquear);
router.put('/:id', usuariosController.actualizar);
router.delete('/:id', usuariosController.eliminar);

module.exports = router;
