import express from 'express';
import * as authController from '../controllers/api/auth.js';
import { autenticar, permitir } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', authController.login);
router.post('/registro', authController.registro);
router.get('/yo', autenticar, authController.yo);
router.get('/mis-entradas', autenticar, permitir('CLIENTE'), authController.misEntradas);

export default router;
