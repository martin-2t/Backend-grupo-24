const express = require('express');
const router = express.Router();

const eventosModel = require('../models/eventos');
const salasModel = require('../models/salas');
const clientesModel = require('../models/clientes');
const entradasModel = require('../models/entradas');
const { lugaresOcupados } = require('../controllers/entradasController');

// Página de inicio: resumen general
router.get('/', (req, res) => {
  const eventos = eventosModel.getAllEventos();
  const entradas = entradasModel.getAllEntradas();

  res.render('index', {
    titulo: 'Panel Urbana Cult',
    totalEventos: eventos.length,
    totalSalas: salasModel.getAllSalas().length,
    totalClientes: clientesModel.getAll().length,
    entradasVendidas: entradas.filter((e) => e.estado === 'VALIDA').length,
    proximos: eventosModel.getEventosProximos().slice(0, 3),
  });
});

// Listado de eventos (con disponibilidad calculada)
router.get('/eventos', (req, res) => {
  const eventos = eventosModel.getAllEventos().map((evento) => {
    const sala = salasModel.getSalaById(evento.salaId);
    const ocupados = lugaresOcupados(evento.id);
    return {
      ...evento,
      sala: sala ? sala.nombre : 'Sala eliminada',
      capacidad: sala ? sala.capacidad : 0,
      disponibles: sala ? Math.max(sala.capacidad - ocupados, 0) : 0,
    };
  });
  res.render('eventos/list', { titulo: 'Eventos', eventos });
});

// Formulario de alta de evento
router.get('/eventos/nuevo', (req, res) => {
  res.render('eventos/form', { titulo: 'Nuevo evento', salas: salasModel.getAllSalas(), error: null });
});

router.post('/eventos/nuevo', (req, res) => {
  const { nombre, descripcion, fecha, salaId, precio } = req.body;
  const sala = salasModel.getSalaById(salaId);

  if (!nombre || !fecha || !sala || !precio) {
    return res.status(400).render('eventos/form', {
      titulo: 'Nuevo evento',
      salas: salasModel.getAllSalas(),
      error: 'Completá todos los campos obligatorios con datos válidos.',
    });
  }

  eventosModel.createEvento({
    nombre,
    descripcion,
    fecha,
    salaId: Number(salaId),
    precio: Number(precio),
  });
  res.redirect('/panel/eventos');
});

// Listado de salas
router.get('/salas', (req, res) => {
  res.render('salas/list', { titulo: 'Salas', salas: salasModel.getAllSalas() });
});

// Listado de clientes
router.get('/clientes', (req, res) => {
  res.render('clientes/list', { titulo: 'Clientes', clientes: clientesModel.getAll() });
});

// Listado de entradas, con datos de evento y cliente resueltos
router.get('/entradas', (req, res) => {
  const entradas = entradasModel.getAllEntradas().map((entrada) => {
    const evento = eventosModel.getEventoById(entrada.eventoId);
    const cliente = clientesModel.getById(entrada.clienteId);
    return {
      ...entrada,
      evento: evento ? evento.nombre : 'Evento eliminado',
      cliente: cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Cliente eliminado',
    };
  });
  res.render('entradas/list', { titulo: 'Entradas', entradas });
});

module.exports = router;
