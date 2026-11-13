import express from 'express';
import * as eventosController from '../controllers/api/eventos.js';
import { autenticar, permitir } from '../middleware/auth.js';
import { soloSuCentro, salaDelBody, salasDelEvento } from '../middleware/centro.js';

const router = express.Router();

// Lectura pública (cartelera)
router.get('/proximos', eventosController.proximos);
router.get('/', eventosController.listar);
router.get('/:id', eventosController.obtener);

// Gestión: el REPRESENTANTE, solo para los eventos de su centro. El cajero (EMPLEADO) vende
// entradas, pero no publica ni modifica eventos. El ADMIN no gestiona la programación de los
// centros, salvo cancelar un evento por fuerza mayor (una decisión de plataforma)
const gestion = [autenticar, permitir('REPRESENTANTE')];
router.post('/', ...gestion, soloSuCentro(salaDelBody), eventosController.crear);
router.put('/:id', ...gestion, soloSuCentro(salasDelEvento), eventosController.actualizar);
router.put('/:id/finalizar', ...gestion, soloSuCentro(salasDelEvento), eventosController.finalizar);
router.put('/:id/cancelar', autenticar, permitir('ADMIN', 'REPRESENTANTE'), soloSuCentro(salasDelEvento), eventosController.cancelar);

export default router;