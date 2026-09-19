// Controller del panel: igual que los demás, pero renderiza vistas en vez de JSON.
const eventosModel = require('../models/eventos');
const salasModel = require('../models/salas');
const clientesModel = require('../models/clientes');
const entradasModel = require('../models/entradas');

// Del formulario todo llega como texto
function aNumero(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return NaN;
  return Number(valor);
}

// Sin sesiones no hay flash messages, así que los avisos viajan por querystring
function volver(res, ruta, mensaje) {
  return res.redirect(ruta + '?ok=' + encodeURIComponent(mensaje));
}

function volverConError(res, ruta, mensaje) {
  return res.redirect(ruta + '?error=' + encodeURIComponent(mensaje));
}

function mensajes(req, res, next) {
  res.locals.mensaje = req.query.ok || null;
  res.locals.alerta = req.query.error || null;
  next();
}

function enriquecerEvento(evento) {
  const sala = salasModel.getSalaById(evento.salaId);
  const ocupados = entradasModel.lugaresOcupados(evento.id);
  const capacidad = sala ? sala.capacidad : 0;
  return {
    ...evento,
    sala: sala ? sala.nombre : 'Sala eliminada',
    salaEstado: sala ? sala.estado : null,
    capacidad,
    ocupados,
    disponibles: Math.max(capacidad - ocupados, 0),
  };
}

function enriquecerEntrada(entrada) {
  const evento = eventosModel.getEventoById(entrada.eventoId);
  const cliente = clientesModel.getById(entrada.clienteId);
  return {
    ...entrada,
    evento: evento ? evento.nombre : 'Evento eliminado',
    cliente: cliente ? cliente.nombre + ' ' + cliente.apellido : 'Cliente eliminado',
  };
}

// Solo las salas activas, pero sin perder la del evento si la dieron de baja
function salasElegibles(salaIdActual) {
  const activas = salasModel.getAllSalas().filter((s) => s.estado === 'ACTIVA');
  if (salaIdActual === undefined || activas.some((s) => s.id === Number(salaIdActual))) {
    return activas;
  }
  const actual = salasModel.getSalaById(salaIdActual);
  return actual ? [...activas, actual] : activas;
}

// Las validaciones devuelven el mensaje a mostrar, o null si está todo bien

function validarEvento({ nombre, fecha, salaId, precio }) {
  if (!nombre || !String(nombre).trim()) return 'El nombre del evento es obligatorio.';
  if (!fecha || isNaN(new Date(fecha).getTime())) return 'La fecha es obligatoria y debe ser válida.';
  if (isNaN(aNumero(salaId)) || !salasModel.getSalaById(salaId)) return 'Elegí una sala existente.';
  const p = aNumero(precio);
  if (isNaN(p) || p < 0) return 'El precio es obligatorio y debe ser un número mayor o igual a cero.';
  return null;
}

function validarSala({ nombre, capacidad, direccion }) {
  if (!nombre || !String(nombre).trim()) return 'El nombre de la sala es obligatorio.';
  const c = aNumero(capacidad);
  if (isNaN(c) || c <= 0) return 'La capacidad es obligatoria y debe ser un número mayor a cero.';
  if (!direccion || !String(direccion).trim()) return 'La dirección es obligatoria.';
  return null;
}

function validarCliente({ nombre, apellido, email }) {
  if (!nombre || !String(nombre).trim()) return 'El nombre es obligatorio.';
  if (!apellido || !String(apellido).trim()) return 'El apellido es obligatorio.';
  if (!email || !String(email).includes('@')) return 'El email es obligatorio y debe ser válido.';
  return null;
}

// Mismas reglas que aplica la API al vender o reservar
function validarVenta(eventoId, clienteId) {
  const evento = eventosModel.getEventoById(eventoId);
  if (!evento) return { error: 'El evento indicado no existe.' };
  if (evento.estado !== 'PROGRAMADO') {
    return { error: 'El evento ya finalizó o fue cancelado: no admite nuevas entradas.' };
  }

  const cliente = clientesModel.getById(clienteId);
  if (!cliente) return { error: 'El cliente indicado no existe.' };

  const sala = salasModel.getSalaById(evento.salaId);
  if (!sala) return { error: 'El evento no tiene una sala válida asociada.' };

  if (entradasModel.lugaresOcupados(eventoId) >= sala.capacidad) {
    return { error: 'No quedan lugares disponibles para este evento.' };
  }

  return { evento, sala };
}

function inicio(req, res) {
  const entradas = entradasModel.getAllEntradas();
  res.render('index', {
    titulo: 'Panel Urbana Cult',
    totalEventos: eventosModel.getAllEventos().length,
    totalSalas: salasModel.getAllSalas().length,
    totalClientes: clientesModel.getAll().length,
    entradasVendidas: entradas.filter((e) => e.estado === 'VALIDA').length,
    entradasReservadas: entradas.filter((e) => e.estado === 'RESERVADA').length,
    proximos: eventosModel.getEventosProximos().slice(0, 3),
  });
}

function eventosListar(req, res) {
  res.render('eventos/list', {
    titulo: 'Eventos',
    eventos: eventosModel.getAllEventos().map(enriquecerEvento),
  });
}

function eventoNuevoForm(req, res) {
  res.render('eventos/form', {
    titulo: 'Nuevo evento',
    evento: null,
    accion: '/panel/eventos/nuevo',
    salas: salasElegibles(),
    error: null,
  });
}

function eventoCrear(req, res) {
  const error = validarEvento(req.body);
  if (error) {
    // Devolvemos el form con lo que había cargado para no hacerle tipear todo de nuevo
    return res.status(400).render('eventos/form', {
      titulo: 'Nuevo evento',
      evento: req.body,
      accion: '/panel/eventos/nuevo',
      salas: salasElegibles(),
      error,
    });
  }

  const { nombre, descripcion, fecha, salaId, precio } = req.body;
  const nuevo = eventosModel.createEvento({
    nombre,
    descripcion,
    fecha,
    salaId: Number(salaId),
    precio: Number(precio),
  });
  volver(res, '/panel/eventos/' + nuevo.id, 'Evento creado correctamente.');
}

function eventoDetalle(req, res, next) {
  const evento = eventosModel.getEventoById(req.params.id);
  if (!evento) return next();

  res.render('eventos/detail', {
    titulo: evento.nombre,
    evento: enriquecerEvento(evento),
    entradas: entradasModel.getEntradasByEvento(evento.id).map(enriquecerEntrada),
  });
}

function eventoEditarForm(req, res, next) {
  const evento = eventosModel.getEventoById(req.params.id);
  if (!evento) return next();

  res.render('eventos/form', {
    titulo: 'Editar ' + evento.nombre,
    evento,
    accion: '/panel/eventos/' + evento.id + '/editar',
    salas: salasElegibles(evento.salaId),
    error: null,
  });
}

function eventoActualizar(req, res, next) {
  const evento = eventosModel.getEventoById(req.params.id);
  if (!evento) return next();

  const error = validarEvento(req.body);
  if (error) {
    return res.status(400).render('eventos/form', {
      titulo: 'Editar ' + evento.nombre,
      evento: { ...req.body, id: evento.id },
      accion: '/panel/eventos/' + evento.id + '/editar',
      salas: salasElegibles(evento.salaId),
      error,
    });
  }

  const { nombre, descripcion, fecha, salaId, precio } = req.body;
  eventosModel.updateEventoById(evento.id, {
    nombre,
    descripcion,
    fecha,
    salaId: Number(salaId),
    precio: Number(precio),
  });
  volver(res, '/panel/eventos/' + evento.id, 'Evento actualizado.');
}

function eventoFinalizar(req, res, next) {
  const evento = eventosModel.getEventoById(req.params.id);
  if (!evento) return next();

  if (evento.estado !== 'PROGRAMADO') {
    return volverConError(res, '/panel/eventos/' + evento.id, 'Solo se puede finalizar un evento PROGRAMADO.');
  }

  eventosModel.finalizarEvento(evento.id);
  volver(res, '/panel/eventos/' + evento.id, 'Evento marcado como finalizado.');
}

function eventoCancelar(req, res, next) {
  const evento = eventosModel.getEventoById(req.params.id);
  if (!evento) return next();

  if (evento.estado === 'CANCELADO') {
    return volverConError(res, '/panel/eventos/' + evento.id, 'El evento ya estaba cancelado.');
  }

  eventosModel.cancelarEvento(evento.id);
  volver(res, '/panel/eventos/' + evento.id, 'Evento cancelado.');
}

function salasListar(req, res) {
  const busqueda = req.query.q ? String(req.query.q).trim() : '';
  let salas = salasModel.getAllSalas();
  let sinResultado = false;

  // Búsqueda exacta, igual que GET /salas/nombre/:nombre
  if (busqueda) {
    const encontrada = salasModel.getSalaByName(busqueda);
    salas = encontrada ? [encontrada] : [];
    sinResultado = !encontrada;
  }

  res.render('salas/list', { titulo: 'Salas', salas, busqueda, sinResultado });
}

function salaNuevaForm(req, res) {
  res.render('salas/form', {
    titulo: 'Nueva sala',
    sala: null,
    accion: '/panel/salas/nueva',
    error: null,
  });
}

function salaCrear(req, res) {
  const error = validarSala(req.body);
  if (error) {
    return res.status(400).render('salas/form', {
      titulo: 'Nueva sala',
      sala: req.body,
      accion: '/panel/salas/nueva',
      error,
    });
  }

  const { nombre, capacidad, direccion } = req.body;
  const nueva = salasModel.createSala({ nombre, capacidad: Number(capacidad), direccion });
  volver(res, '/panel/salas/' + nueva.id, 'Sala creada correctamente.');
}

function salaDetalle(req, res, next) {
  const sala = salasModel.getSalaById(req.params.id);
  if (!sala) return next();

  const eventos = eventosModel
    .getAllEventos()
    .filter((e) => e.salaId === sala.id)
    .map(enriquecerEvento);

  res.render('salas/detail', { titulo: sala.nombre, sala, eventos });
}

function salaEditarForm(req, res, next) {
  const sala = salasModel.getSalaById(req.params.id);
  if (!sala) return next();

  res.render('salas/form', {
    titulo: 'Editar ' + sala.nombre,
    sala,
    accion: '/panel/salas/' + sala.id + '/editar',
    error: null,
  });
}

function salaActualizar(req, res, next) {
  const sala = salasModel.getSalaById(req.params.id);
  if (!sala) return next();

  const error = validarSala(req.body);
  if (error) {
    return res.status(400).render('salas/form', {
      titulo: 'Editar ' + sala.nombre,
      sala: { ...req.body, id: sala.id },
      accion: '/panel/salas/' + sala.id + '/editar',
      error,
    });
  }

  const { nombre, capacidad, direccion } = req.body;
  salasModel.updateSalaById(sala.id, { nombre, capacidad: Number(capacidad), direccion });
  volver(res, '/panel/salas/' + sala.id, 'Sala actualizada.');
}

// Baja o alta lógica de la sala
function salaCambiarEstado(req, res, next) {
  const sala = salasModel.getSalaById(req.params.id);
  if (!sala) return next();

  const actualizada = salasModel.toggleSalaById(sala.id);
  volver(res, '/panel/salas', 'La sala "' + actualizada.nombre + '" ahora está ' + actualizada.estado + '.');
}

function clientesListar(req, res) {
  res.render('clientes/list', { titulo: 'Clientes', clientes: clientesModel.getAll() });
}

function clienteNuevoForm(req, res) {
  res.render('clientes/form', {
    titulo: 'Nuevo cliente',
    cliente: null,
    accion: '/panel/clientes/nuevo',
    error: null,
  });
}

function clienteCrear(req, res) {
  const error = validarCliente(req.body);
  if (error) {
    return res.status(400).render('clientes/form', {
      titulo: 'Nuevo cliente',
      cliente: req.body,
      accion: '/panel/clientes/nuevo',
      error,
    });
  }

  const { nombre, apellido, email, telefono } = req.body;
  const nuevo = clientesModel.create({ nombre, apellido, email, telefono });
  volver(res, '/panel/clientes/' + nuevo.id, 'Cliente creado correctamente.');
}

function clienteDetalle(req, res, next) {
  const cliente = clientesModel.getById(req.params.id);
  if (!cliente) return next();

  const entradas = entradasModel
    .getAllEntradas()
    .filter((e) => e.clienteId === cliente.id)
    .map(enriquecerEntrada);

  res.render('clientes/detail', {
    titulo: cliente.nombre + ' ' + cliente.apellido,
    cliente,
    entradas,
  });
}

function clienteEditarForm(req, res, next) {
  const cliente = clientesModel.getById(req.params.id);
  if (!cliente) return next();

  res.render('clientes/form', {
    titulo: 'Editar ' + cliente.nombre + ' ' + cliente.apellido,
    cliente,
    accion: '/panel/clientes/' + cliente.id + '/editar',
    error: null,
  });
}

function clienteActualizar(req, res, next) {
  const cliente = clientesModel.getById(req.params.id);
  if (!cliente) return next();

  const error = validarCliente(req.body);
  if (error) {
    return res.status(400).render('clientes/form', {
      titulo: 'Editar ' + cliente.nombre + ' ' + cliente.apellido,
      cliente: { ...req.body, id: cliente.id },
      accion: '/panel/clientes/' + cliente.id + '/editar',
      error,
    });
  }

  const { nombre, apellido, email, telefono } = req.body;
  clientesModel.update(cliente.id, { nombre, apellido, email, telefono });
  volver(res, '/panel/clientes/' + cliente.id, 'Cliente actualizado.');
}

function clienteEliminar(req, res, next) {
  const cliente = clientesModel.getById(req.params.id);
  if (!cliente) return next();

  // El borrado es físico, así que no lo dejamos pasar si todavía tiene entradas
  const tieneEntradas = entradasModel
    .getAllEntradas()
    .some((e) => e.clienteId === cliente.id && e.estado !== 'CANCELADA');

  if (tieneEntradas) {
    return volverConError(
      res,
      '/panel/clientes/' + cliente.id,
      'No se puede eliminar: el cliente tiene entradas vigentes. Cancelalas primero.'
    );
  }

  clientesModel.remove(cliente.id);
  volver(res, '/panel/clientes', 'Cliente eliminado.');
}

function entradasListar(req, res) {
  const filtros = {
    evento: req.query.evento || '',
    cliente: req.query.cliente || '',
    estado: req.query.estado || '',
  };

  let entradas = entradasModel.getAllEntradas();
  if (filtros.evento) entradas = entradas.filter((e) => e.eventoId === Number(filtros.evento));
  if (filtros.cliente) entradas = entradas.filter((e) => e.clienteId === Number(filtros.cliente));
  if (filtros.estado) entradas = entradas.filter((e) => e.estado === filtros.estado);

  res.render('entradas/list', {
    titulo: 'Entradas',
    entradas: entradas.map(enriquecerEntrada),
    filtros,
    eventos: eventosModel.getAllEventos(),
    clientes: clientesModel.getAll(),
    estados: ['VALIDA', 'RESERVADA', 'CANCELADA'],
  });
}

function datosFormularioEntrada(seleccionado) {
  return {
    eventos: eventosModel
      .getAllEventos()
      .filter((e) => e.estado === 'PROGRAMADO')
      .map(enriquecerEvento),
    clientes: clientesModel.getAll(),
    seleccionado: seleccionado ? String(seleccionado) : '',
  };
}

function entradaNuevaForm(req, res) {
  res.render('entradas/form', {
    titulo: 'Vender o reservar entrada',
    ...datosFormularioEntrada(req.query.evento),
    valores: {},
    error: null,
  });
}

function entradaCrear(req, res) {
  // El botón que apretaron manda "accion": vender deja VALIDA, reservar deja RESERVADA
  const { eventoId, clienteId, accion } = req.body;
  const reservar = accion === 'reservar';

  function fallar(mensaje) {
    return res.status(400).render('entradas/form', {
      titulo: 'Vender o reservar entrada',
      ...datosFormularioEntrada(eventoId),
      valores: req.body,
      error: mensaje,
    });
  }

  if (isNaN(aNumero(eventoId))) return fallar('Elegí un evento.');
  if (isNaN(aNumero(clienteId))) return fallar('Elegí un cliente.');

  const chequeo = validarVenta(Number(eventoId), Number(clienteId));
  if (chequeo.error) return fallar(chequeo.error);

  const nueva = entradasModel.createEntrada({
    eventoId: Number(eventoId),
    clienteId: Number(clienteId),
    precio: chequeo.evento.precio,
    estado: reservar ? 'RESERVADA' : 'VALIDA',
  });

  volver(res, '/panel/entradas/' + nueva.id, reservar ? 'Reserva registrada.' : 'Venta registrada.');
}

function entradaDetalle(req, res, next) {
  const entrada = entradasModel.getEntradaById(req.params.id);
  if (!entrada) return next();

  const evento = eventosModel.getEventoById(entrada.eventoId);
  res.render('entradas/detail', {
    titulo: 'Entrada #' + entrada.id,
    entrada: enriquecerEntrada(entrada),
    evento: evento ? enriquecerEvento(evento) : null,
    cliente: clientesModel.getById(entrada.clienteId),
  });
}

function entradaConfirmar(req, res, next) {
  const entrada = entradasModel.getEntradaById(req.params.id);
  if (!entrada) return next();

  if (entrada.estado !== 'RESERVADA') {
    return volverConError(res, '/panel/entradas/' + entrada.id, 'Solo se pueden confirmar entradas en estado RESERVADA.');
  }

  entradasModel.updateEntradaById(entrada.id, { estado: 'VALIDA' });
  volver(res, '/panel/entradas/' + entrada.id, 'Reserva confirmada: la entrada quedó vendida.');
}

function entradaCancelar(req, res, next) {
  const entrada = entradasModel.getEntradaById(req.params.id);
  if (!entrada) return next();

  if (entrada.estado === 'CANCELADA') {
    return volverConError(res, '/panel/entradas/' + entrada.id, 'La entrada ya estaba cancelada.');
  }

  entradasModel.updateEntradaById(entrada.id, { estado: 'CANCELADA' });
  volver(res, '/panel/entradas/' + entrada.id, 'Entrada cancelada: el lugar quedó liberado.');
}

function entradaActualizarPrecio(req, res, next) {
  const entrada = entradasModel.getEntradaById(req.params.id);
  if (!entrada) return next();

  const precio = aNumero(req.body.precio);
  if (isNaN(precio) || precio < 0) {
    return volverConError(res, '/panel/entradas/' + entrada.id, 'El precio debe ser un número mayor o igual a cero.');
  }

  entradasModel.updateEntradaById(entrada.id, { precio });
  volver(res, '/panel/entradas/' + entrada.id, 'Precio actualizado.');
}

function entradaEliminar(req, res, next) {
  const entrada = entradasModel.getEntradaById(req.params.id);
  if (!entrada) return next();

  entradasModel.removeEntrada(entrada.id);
  volver(res, '/panel/entradas', 'Entrada #' + entrada.id + ' eliminada.');
}

function consultas(req, res) {
  const resumen = eventosModel.getAllEventos().map((evento) => {
    const entradas = entradasModel.getEntradasByEvento(evento.id);
    return {
      ...enriquecerEvento(evento),
      vendidas: entradas.filter((e) => e.estado === 'VALIDA').length,
      reservadas: entradas.filter((e) => e.estado === 'RESERVADA').length,
      canceladas: entradas.filter((e) => e.estado === 'CANCELADA').length,
    };
  });

  res.render('consultas/index', {
    titulo: 'Consultas',
    resumen,
    proximos: eventosModel.getEventosProximos().map(enriquecerEvento),
    totalVendidas: resumen.reduce((acc, e) => acc + e.vendidas, 0),
    totalReservadas: resumen.reduce((acc, e) => acc + e.reservadas, 0),
  });
}

module.exports = {
  mensajes,
  inicio,
  eventosListar,
  eventoNuevoForm,
  eventoCrear,
  eventoDetalle,
  eventoEditarForm,
  eventoActualizar,
  eventoFinalizar,
  eventoCancelar,
  salasListar,
  salaNuevaForm,
  salaCrear,
  salaDetalle,
  salaEditarForm,
  salaActualizar,
  salaCambiarEstado,
  clientesListar,
  clienteNuevoForm,
  clienteCrear,
  clienteDetalle,
  clienteEditarForm,
  clienteActualizar,
  clienteEliminar,
  entradasListar,
  entradaNuevaForm,
  entradaCrear,
  entradaDetalle,
  entradaConfirmar,
  entradaCancelar,
  entradaActualizarPrecio,
  entradaEliminar,
  consultas,
};
