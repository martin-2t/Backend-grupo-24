import express from 'express';
import * as clientesController from '../controllers/api/clientes.js';
import { autenticar, permitir } from '../middleware/auth.js';

const router = express.Router();

// Los clientes son datos personales: solo el personal (ADMIN y EMPLEADO) los gestiona.
// El AUDITOR puede consultarlos, pero no modificarlos
const personal = [autenticar, permitir('ADMIN', 'EMPLEADO')];
const lectura = [autenticar, permitir('ADMIN', 'EMPLEADO', 'AUDITOR')];

router.get('/', ...lectura, clientesController.listar);
router.get('/:id', ...lectura, clientesController.obtener);
router.post('/', ...personal, clientesController.crear);
router.put('/:id', ...personal, clientesController.actualizar);
router.delete('/:id', autenticar, permitir('ADMIN'), clientesController.eliminar);

export default router;
