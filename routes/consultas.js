import express from 'express';
import * as consultasController from '../controllers/api/consultas.js';
import { autenticar, permitir } from '../middleware/auth.js';

const router = express.Router();

// Ventas: información interna del negocio, solo para el personal
const personal = [autenticar, permitir('ADMIN', 'EMPLEADO')];
router.get('/entradas-vendidas/:eventoId', ...personal, consultasController.entradasVendidas);
router.get('/entradas-vendidas', ...personal, consultasController.entradasVendidas);

// Disponibilidad y cartelera: públicas
router.get('/entradas-disponibles/:eventoId', consultasController.entradasDisponibles);
router.get('/eventos-proximos', consultasController.eventosProximos);

export default router;
