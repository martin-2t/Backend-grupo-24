import express from 'express';
import * as eventosController from '../controllers/api/eventos.js';
import { autenticar, permitir } from '../middleware/auth.js';
import { soloSuCentro, salaDelBody, salasDelEvento } from '../middleware/centro.js';

const router = express.Router();

// Lectura pública (cartelera)
router.get('/proximos', eventosController.proximos);
router.get('/', eventosController.listar);
router.get('/:id', eventosController.obtener);

// Gestión: ADMIN, o EMPLEADO solo para eventos de su propio centro
const gestion = [autenticar, permitir('ADMIN', 'EMPLEADO')];
router.post('/', ...gestion, soloSuCentro(salaDelBody), eventosController.crear);
router.put('/:id', ...gestion, soloSuCentro(salasDelEvento), eventosController.actualizar);
router.put('/:id/finalizar', ...gestion, soloSuCentro(salasDelEvento), eventosController.finalizar);
router.put('/:id/cancelar', ...gestion, soloSuCentro(salasDelEvento), eventosController.cancelar);

export default router;
