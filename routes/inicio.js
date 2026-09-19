const express = require('express');
const router = express.Router();
const inicioController = require('../controllers/api/inicio');

router.get('/', inicioController.mostrar);

module.exports = router;
