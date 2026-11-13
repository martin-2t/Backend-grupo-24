import express from 'express';
import * as clientesController from '../controllers/api/clientes.js';
import { autenticar, permitir } from '../middleware/auth.js';

const router = express.Router();

// Los clientes son datos personales compartidos por toda la red. Los cargan y editan el
// personal de los centros (EMPLEADO y REPRESENTANTE); el ADMIN y el AUDITOR los consultan.
// El borrado físico (por ejemplo, si un cliente pide que borren sus datos) es solo del ADMIN
const personal = [autenticar, permitir('EMPLEADO', 'REPRESENTANTE')];
const lectura = [autenticar, permitir('ADMIN', 'EMPLEADO', 'REPRESENTANTE', 'AUDITOR')];

router.get('/', ...lectura, clientesController.listar);
router.get('/:id', ...lectura, clientesController.obtener);
router.post('/', ...personal, clientesController.crear);
router.put('/:id', ...personal, clientesController.actualizar);
router.delete('/:id', autenticar, permitir('ADMIN'), clientesController.eliminar);

export default router;
