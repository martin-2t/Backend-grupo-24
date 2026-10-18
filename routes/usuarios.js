import express from 'express';
import * as usuariosController from '../controllers/api/usuarios.js';
import { autenticar, permitir } from '../middleware/auth.js';

const router = express.Router();

// Todo el recurso es solo para ADMIN: el middleware se aplica a todas las rutas del router
router.use(autenticar, permitir('ADMIN'));

router.get('/', usuariosController.listar);
router.get('/:id', usuariosController.obtener);
router.post('/', usuariosController.crear);
router.put('/:id/desbloquear', usuariosController.desbloquear);
router.put('/:id', usuariosController.actualizar);
router.delete('/:id', usuariosController.eliminar);

export default router;
