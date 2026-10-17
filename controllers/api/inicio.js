// Raíz de la API: índice de lo que ofrece el servicio.

function mostrar(req, res) {
  res.status(200).json({
    nombre: 'Urbana Cult API',
    version: '1.0.0',
    estado: 'ok',
    panel: '/panel',
    autenticacion: {
      login: 'POST /auth/login',
      registro: 'POST /auth/registro',
      usuarioActual: 'GET /auth/yo (header x-usuario-id)',
    },
    recursos: {
      usuarios: '/usuarios',
      clientes: '/clientes',
      salas: '/salas',
      eventos: '/eventos',
      entradas: '/entradas',
      consultas: '/consultas',
    },
  });
}

module.exports = { mostrar };
