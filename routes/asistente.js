import express from 'express';
import * as asistenteController from '../controllers/api/asistente.js';
import { autenticar } from '../middleware/auth.js';
import { limitarAsistente } from '../middleware/limiteAsistente.js';

const router = express.Router();

// Solo con sesión iniciada (cookie "token" o header Bearer), como el resto del panel.
// Primero se identifica al usuario y después se le aplica el límite de consultas.
router.post('/', autenticar, limitarAsistente, asistenteController.preguntar);

export default router;
