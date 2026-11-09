import express from 'express';
import * as usuariosController from '../controllers/api/usuarios.js';
import { autenticar, permitir } from '../middleware/auth.js';

const router = express.Router();

// Todo el recurso exige login: el middleware se aplica a todas las rutas del router.
// Consultar: ADMIN y AUDITOR. Crear, modificar y eliminar: solo ADMIN
router.use(autenticar);
const lectura = permitir('ADMIN', 'AUDITOR');
const soloAdmin = permitir('ADMIN');

router.get('/', lectura, usuariosController.listar);
router.get('/:id', lectura, usuariosController.obtener);
router.post('/', soloAdmin, usuariosController.crear);
router.put('/:id/desbloquear', soloAdmin, usuariosController.desbloquear);
router.put('/:id', soloAdmin, usuariosController.actualizar);
router.delete('/:id', soloAdmin, usuariosController.eliminar);

export default router;
