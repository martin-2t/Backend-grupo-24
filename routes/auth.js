const express = require('express');
const router = express.Router();
const authController = require('../controllers/api/auth');
const { autenticar, permitir } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/registro', authController.registro);
router.get('/yo', autenticar, authController.yo);
router.get('/mis-entradas', autenticar, permitir('CLIENTE'), authController.misEntradas);

module.exports = router;
