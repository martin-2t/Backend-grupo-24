import express from 'express';
import * as entradasController from '../controllers/api/entradas.js';
import { autenticar, permitir } from '../middleware/auth.js';
import { soloSuCentro, salaDelEventoDelBody, salaDeLaEntrada, salaDeLaEntradaPorCodigo } from '../middleware/centro.js';
import { compraComoCliente, clienteDeBoleteria, entradaPropia } from '../middleware/compras.js';

const router = express.Router();

// Boletería: el personal de cada centro (EMPLEADO y REPRESENTANTE), solo en su centro.
// El ADMIN administra la plataforma: no opera la boletería (mínimo privilegio)
const personal = [autenticar, permitir('EMPLEADO', 'REPRESENTANTE')];
// Consulta: el personal (solo lo de su centro), y el ADMIN y el AUDITOR (toda la red)
const lectura = [autenticar, permitir('ADMIN', 'EMPLEADO', 'REPRESENTANTE', 'AUDITOR')];

router.get('/', ...lectura, entradasController.getAllEntradas);
router.get('/:id', autenticar, entradaPropia, soloSuCentro(salaDeLaEntrada), entradasController.getEntradaById);

// Compra: el CLIENTE compra para sí (web); el personal vende en su centro (boletería)
const compra = [
  autenticar,
  permitir('EMPLEADO', 'REPRESENTANTE', 'CLIENTE'),
  compraComoCliente,
  clienteDeBoleteria,
  soloSuCentro(salaDelEventoDelBody),
];
router.post('/', ...compra, entradasController.crearVenta);
router.post('/reservar', ...compra, entradasController.crearReserva);

// Check-in en la puerta: solo el personal del centro donde se hace el evento. El ADMIN no:
// validar una entrada es una tarea del lugar, no de la administración del sistema (mínimo privilegio)
router.post(
  '/checkin',
  autenticar,
  permitir('EMPLEADO', 'REPRESENTANTE'),
  soloSuCentro(salaDeLaEntradaPorCodigo),
  entradasController.checkin
);

router.put('/:id/confirmar', ...personal, soloSuCentro(salaDeLaEntrada), entradasController.confirmarReserva);
router.put('/:id/cancelar', ...personal, soloSuCentro(salaDeLaEntrada), entradasController.cancelarEntrada);
router.put('/:id', ...personal, soloSuCentro(salaDeLaEntrada), entradasController.updateEntrada);
// Borrado físico: mantenimiento de datos de la plataforma, solo ADMIN
router.delete('/:id', autenticar, permitir('ADMIN'), entradasController.deleteEntrada);

export default router;
