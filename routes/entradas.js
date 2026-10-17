const express = require('express');
const router = express.Router();
const entradasController = require('../controllers/api/entradas');
const { autenticar, permitir } = require('../middleware/auth');
const { soloSuCentro, salaDelEventoDelBody, salaDeLaEntrada } = require('../middleware/centro');
const { compraComoCliente, clienteDeBoleteria, entradaPropia } = require('../middleware/compras');

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

module.exports = router;
