import express from 'express';
import * as consultasController from '../controllers/api/consultas.js';
import { autenticar, permitir } from '../middleware/auth.js';

const router = express.Router();

// Ventas: información interna. El personal ve solo los eventos de su centro (lo filtra el
// controller); el ADMIN y el AUDITOR, toda la red
const lectura = [autenticar, permitir('ADMIN', 'EMPLEADO', 'REPRESENTANTE', 'AUDITOR')];
router.get('/entradas-vendidas/:eventoId', ...lectura, consultasController.entradasVendidas);
router.get('/entradas-vendidas', ...lectura, consultasController.entradasVendidas);

// Disponibilidad y cartelera: públicas
router.get('/entradas-disponibles/:eventoId', consultasController.entradasDisponibles);
router.get('/eventos-proximos', consultasController.eventosProximos);

export default router;
