import express from 'express';
import * as inicioController from '../controllers/api/inicio.js';

const router = express.Router();

router.get('/', inicioController.mostrar);

export default router;
