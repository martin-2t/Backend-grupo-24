import express from 'express';
import * as clientesController from '../controllers/api/clientes.js';
import { autenticar, permitir } from '../middleware/auth.js';

const router = express.Router();

// Los clientes son datos personales: solo el personal (ADMIN y EMPLEADO) los gestiona
const personal = [autenticar, permitir('ADMIN', 'EMPLEADO')];

router.get('/', ...personal, clientesController.listar);
router.get('/:id', ...personal, clientesController.obtener);
router.post('/', ...personal, clientesController.crear);
router.put('/:id', ...personal, clientesController.actualizar);
router.delete('/:id', autenticar, permitir('ADMIN'), clientesController.eliminar);

export default router;
