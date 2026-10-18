import express from 'express';
import * as entradasController from '../controllers/api/entradas.js';
import { autenticar, permitir } from '../middleware/auth.js';
import { soloSuCentro, salaDelEventoDelBody, salaDeLaEntrada } from '../middleware/centro.js';
import { compraComoCliente, clienteDeBoleteria, entradaPropia } from '../middleware/compras.js';

const router = express.Router();

const personal = [autenticar, permitir('ADMIN', 'EMPLEADO')];

router.get('/', ...personal, entradasController.getAllEntradas);
router.get('/:id', autenticar, entradaPropia, soloSuCentro(salaDeLaEntrada), entradasController.getEntradaById);

// Compra: el CLIENTE compra para sí (web); el EMPLEADO vende en su centro (boletería)
const compra = [
  autenticar,
  permitir('ADMIN', 'EMPLEADO', 'CLIENTE'),
  compraComoCliente,
  clienteDeBoleteria,
  soloSuCentro(salaDelEventoDelBody),
];
router.post('/', ...compra, entradasController.crearVenta);
router.post('/reservar', ...compra, entradasController.crearReserva);

router.put('/:id/confirmar', ...personal, soloSuCentro(salaDeLaEntrada), entradasController.confirmarReserva);
router.put('/:id/cancelar', ...personal, soloSuCentro(salaDeLaEntrada), entradasController.cancelarEntrada);
router.put('/:id', ...personal, soloSuCentro(salaDeLaEntrada), entradasController.updateEntrada);
router.delete('/:id', autenticar, permitir('ADMIN'), entradasController.deleteEntrada);

export default router;
