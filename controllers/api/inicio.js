// Raíz de la API: índice de lo que ofrece el servicio.

function mostrar(req, res) {
  res.status(200).json({
    nombre: 'Urbana Cult API',
    version: '1.0.0',
    estado: 'ok',
    panel: '/panel',
    recursos: {
      clientes: '/clientes',
      salas: '/salas',
      eventos: '/eventos',
      entradas: '/entradas',
      consultas: '/consultas',
    },
  });
}

module.exports = { mostrar };
