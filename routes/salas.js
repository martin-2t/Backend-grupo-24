import express from 'express';
import * as salasController from '../controllers/api/salas.js';
import { autenticar, permitir } from '../middleware/auth.js';
import { soloSuCentro, salaDelParametro } from '../middleware/centro.js';

const router = express.Router();

// Lectura pública (cartelera)
router.get('/', salasController.getAllSalas);
router.get('/nombre/:nombre', salasController.getSalaByName);
router.get('/:id', salasController.getSalaById);

// Alta y baja: solo ADMIN. Edición: ADMIN o el EMPLEADO de ese centro
router.post('/', autenticar, permitir('ADMIN'), salasController.createSala);
router.put('/:id', autenticar, permitir('ADMIN', 'EMPLEADO'), soloSuCentro(salaDelParametro), salasController.updateSala);
router.put('/dis/:id', autenticar, permitir('ADMIN'), salasController.toggleSala);

export default router;
