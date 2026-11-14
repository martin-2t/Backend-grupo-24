// Tests de integración del panel para la boletería (entradas) y la programación (eventos):
// vender, reservar, confirmar, cancelar, cambiar el precio y eliminar entradas; crear, editar,
// finalizar y cancelar eventos.
import request from 'supertest';
import app from '../../app.js';
import * as entradasModel from '../../models/entradas.js';
import * as eventosModel from '../../models/eventos.js';
import { conectar, limpiar, desconectar } from '../helpers/db.js';
import { crearSala, crearEvento, crearCliente, crearUsuarioConToken } from '../helpers/datos.js';

beforeAll(conectar);
afterEach(limpiar);
afterAll(desconectar);

const ID_INEXISTENTE = '64b000000000000000000000';
const UN_DIA = 24 * 60 * 60 * 1000;
// Formato del input datetime-local del formulario
const EN_UN_MES = () => new Date(Date.now() + 30 * UN_DIA).toISOString().slice(0, 16);

let d;
beforeEach(async () => {
  const sala = await crearSala({ nombre: 'Centro Cultural Norte', capacidad: 10 });
  const otra = await crearSala({ nombre: 'Centro Cultural Sur' });
  d = {
    sala,
    otra,
    evento: await crearEvento(sala.id, { nombre: 'Recital de jazz', precio: 4000 }),
    cliente: await crearCliente(),
    admin: await crearUsuarioConToken({ rol: 'ADMIN' }),
    representante: await crearUsuarioConToken({ rol: 'REPRESENTANTE', salaId: sala.id }),
    empleado: await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: sala.id }),
    empleadoSur: await crearUsuarioConToken({ rol: 'EMPLEADO', salaId: otra.id, email: 'empleado.sur@urbanacult.com' }),
  };
});

const ver = (quien, ruta) => request(app).get(ruta).set('Cookie', `token=${quien.token}`);
const enviar = (quien, ruta, form = {}) => request(app).post(ruta).set('Cookie', `token=${quien.token}`).type('form').send(form);
const aviso = (respuesta) => decodeURIComponent(respuesta.headers.location.split(/[?&](?:ok|error)=/)[1] || '');
const nuevaEntrada = (cambios = {}) =>
  entradasModel.createEntrada({ eventoId: d.evento.id, clienteId: d.cliente.id, precio: 4000, ...cambios });

describe('Panel de entradas: vender y reservar', () => {
  test('el formulario ofrece los eventos programados, con el elegido marcado', async () => {
    const pagina = await ver(d.empleado, `/panel/entradas/nueva?evento=${d.evento.id}`);

    expect(pagina.status).toBe(200);
    expect(pagina.text).toContain('Recital de jazz');
  });

  test('vender deja la entrada VALIDA al precio del evento', async () => {
    const respuesta = await enviar(d.empleado, '/panel/entradas/nueva', { eventoId: d.evento.id, clienteId: d.cliente.id, accion: 'vender' });

    expect(aviso(respuesta)).toBe('Venta registrada.');
    const [entrada] = await entradasModel.getEntradasByEvento(d.evento.id);
    expect(entrada).toMatchObject({ estado: 'VALIDA', precio: 4000 });
    expect(respuesta.headers.location).toContain(`/panel/entradas/${entrada.id}`);
  });

  test('reservar deja la entrada RESERVADA', async () => {
    const respuesta = await enviar(d.empleado, '/panel/entradas/nueva', { eventoId: d.evento.id, clienteId: d.cliente.id, accion: 'reservar' });

    expect(aviso(respuesta)).toBe('Reserva registrada.');
    expect((await entradasModel.getEntradasByEvento(d.evento.id))[0].estado).toBe('RESERVADA');
  });

  test('sin evento o sin cliente vuelve al formulario con el motivo (400)', async () => {
    const sinEvento = await enviar(d.empleado, '/panel/entradas/nueva', { clienteId: d.cliente.id });
    expect(sinEvento.status).toBe(400);
    expect(sinEvento.text).toContain('Elegí un evento.');

    const sinCliente = await enviar(d.empleado, '/panel/entradas/nueva', { eventoId: d.evento.id, clienteId: ID_INEXISTENTE });
    expect(sinCliente.status).toBe(400);
    expect(sinCliente.text).toContain('Elegí un cliente.');
  });

  test('un evento finalizado o lleno no admite la venta (400)', async () => {
    for (let i = 0; i < 10; i++) await nuevaEntrada();
    const lleno = await enviar(d.empleado, '/panel/entradas/nueva', { eventoId: d.evento.id, clienteId: d.cliente.id });
    expect(lleno.status).toBe(400);
    expect(lleno.text).toContain(entradasModel.SIN_LUGARES);

    await eventosModel.finalizarEvento(d.evento.id);
    const finalizado = await enviar(d.empleado, '/panel/entradas/nueva', { eventoId: d.evento.id, clienteId: d.cliente.id });
    expect(finalizado.status).toBe(400);
    expect(finalizado.text).toContain('ya finalizó o fue cancelado');
  });

  test('el empleado de otro centro no puede vender para este evento', async () => {
    const respuesta = await enviar(d.empleadoSur, '/panel/entradas/nueva', { eventoId: d.evento.id, clienteId: d.cliente.id });

    expect(aviso(respuesta)).toBe('Solo podés operar sobre tu propio centro.');
  });
});

describe('Panel de entradas: lista y detalle', () => {
  test('la lista se puede filtrar por evento, cliente y estado', async () => {
    const otroEvento = await crearEvento(d.sala.id, { nombre: 'Noche de poesía' });
    await nuevaEntrada();
    await nuevaEntrada({ eventoId: otroEvento.id, estado: 'RESERVADA' });

    const porEvento = await ver(d.empleado, `/panel/entradas?evento=${otroEvento.id}`);
    expect(porEvento.status).toBe(200);
    expect(porEvento.text).toContain('RESERVADA');

    const porEstado = await ver(d.admin, `/panel/entradas?estado=VALIDA&cliente=${d.cliente.id}`);
    expect(porEstado.status).toBe(200);
    expect(porEstado.text).toContain('Recital de jazz');
  });

  test('el detalle muestra el QR; una entrada cancelada ya no lo tiene', async () => {
    const valida = await nuevaEntrada();
    expect((await ver(d.empleado, `/panel/entradas/${valida.id}`)).text).toContain('data:image/png;base64');

    const cancelada = await nuevaEntrada({ estado: 'CANCELADA' });
    const pagina = await ver(d.empleado, `/panel/entradas/${cancelada.id}`);
    expect(pagina.status).toBe(200);
    expect(pagina.text).not.toContain('data:image/png;base64');
  });

  test('una entrada inexistente muestra la página 404', async () => {
    expect((await ver(d.admin, `/panel/entradas/${ID_INEXISTENTE}`)).status).toBe(404);
  });
});

describe('Panel de entradas: confirmar, cancelar, precio y eliminar', () => {
  test('confirmar una reserva la deja VALIDA; confirmar una vendida avisa el motivo', async () => {
    const reserva = await nuevaEntrada({ estado: 'RESERVADA' });

    expect(aviso(await enviar(d.empleado, `/panel/entradas/${reserva.id}/confirmar`))).toContain('Reserva confirmada');
    expect((await entradasModel.getEntradaById(reserva.id)).estado).toBe('VALIDA');

    const otraVez = await enviar(d.empleado, `/panel/entradas/${reserva.id}/confirmar`);
    expect(otraVez.headers.location).toContain('?error=');
    expect(aviso(otraVez)).toContain('Solo se pueden confirmar entradas en estado RESERVADA.');
  });

  test('cancelar libera el lugar; cancelar dos veces avisa el motivo', async () => {
    const entrada = await nuevaEntrada();

    expect(aviso(await enviar(d.empleado, `/panel/entradas/${entrada.id}/cancelar`))).toContain('el lugar quedó liberado');
    expect(await entradasModel.lugaresOcupados(d.evento.id)).toBe(0);

    expect(aviso(await enviar(d.empleado, `/panel/entradas/${entrada.id}/cancelar`))).toBe('La entrada ya estaba cancelada.');
  });

  test('el precio se actualiza; uno inválido o negativo avisa el motivo', async () => {
    const entrada = await nuevaEntrada();

    expect(aviso(await enviar(d.empleado, `/panel/entradas/${entrada.id}/precio`, { precio: '3500' }))).toBe('Precio actualizado.');
    expect((await entradasModel.getEntradaById(entrada.id)).precio).toBe(3500);

    expect(aviso(await enviar(d.empleado, `/panel/entradas/${entrada.id}/precio`, { precio: 'abc' }))).toBe('El precio debe ser un número.');
    expect(aviso(await enviar(d.empleado, `/panel/entradas/${entrada.id}/precio`, { precio: '-1' }))).toBe('El precio no puede ser negativo.');
  });

  test('el ADMIN elimina una entrada; el EMPLEADO no', async () => {
    const entrada = await nuevaEntrada();

    expect((await enviar(d.empleado, `/panel/entradas/${entrada.id}/eliminar`)).headers.location).toMatch(/^\/panel\?error=/);
    expect(aviso(await enviar(d.admin, `/panel/entradas/${entrada.id}/eliminar`))).toContain('eliminada');
    expect(await entradasModel.getEntradaById(entrada.id)).toBeNull();
  });

  test('las acciones sobre una entrada inexistente muestran la página 404', async () => {
    for (const accion of ['confirmar', 'cancelar', 'precio']) {
      expect((await enviar(d.empleado, `/panel/entradas/${ID_INEXISTENTE}/${accion}`, { precio: '1' })).status).toBe(404);
    }
    expect((await enviar(d.admin, `/panel/entradas/${ID_INEXISTENTE}/eliminar`)).status).toBe(404);
  });
});

describe('Panel de eventos', () => {
  const form = (cambios = {}) => ({ nombre: 'Obra de teatro', descripcion: 'Comedia', fecha: EN_UN_MES(), salaId: d.sala.id, precio: '2500', ...cambios });

  test('el REPRESENTANTE crea un evento en su sala', async () => {
    expect((await ver(d.representante, '/panel/eventos/nuevo')).status).toBe(200);

    const respuesta = await enviar(d.representante, '/panel/eventos/nuevo', form());

    expect(aviso(respuesta)).toBe('Evento creado correctamente.');
    expect((await eventosModel.getAllEventos()).map((e) => e.nombre)).toContain('Obra de teatro');
  });

  test('un alta inválida vuelve al formulario con lo cargado (400)', async () => {
    const respuesta = await enviar(d.representante, '/panel/eventos/nuevo', form({ precio: '-10' }));

    expect(respuesta.status).toBe(400);
    expect(respuesta.text).toContain('mayor o igual a cero');
    expect(respuesta.text).toContain('Obra de teatro');
  });

  test('un filtro de fecha inválido avisa y muestra todos los eventos', async () => {
    const pagina = await ver(d.empleado, '/panel/eventos?desde=ayer');

    expect(pagina.status).toBe(200);
    expect(pagina.text).toContain('Recital de jazz');
  });

  test('el REPRESENTANTE edita el evento; una edición inválida vuelve al formulario', async () => {
    expect((await ver(d.representante, `/panel/eventos/${d.evento.id}/editar`)).status).toBe(200);

    const ok = await enviar(d.representante, `/panel/eventos/${d.evento.id}/editar`, form({ nombre: 'Recital de jazz fusión' }));
    expect(aviso(ok)).toBe('Evento actualizado.');
    expect((await eventosModel.getEventoById(d.evento.id)).nombre).toBe('Recital de jazz fusión');

    const mal = await enviar(d.representante, `/panel/eventos/${d.evento.id}/editar`, form({ nombre: '' }));
    expect(mal.status).toBe(400);
  });

  test('finalizar un evento programado; una segunda vez avisa el motivo', async () => {
    expect(aviso(await enviar(d.representante, `/panel/eventos/${d.evento.id}/finalizar`))).toBe('Evento marcado como finalizado.');
    expect(aviso(await enviar(d.representante, `/panel/eventos/${d.evento.id}/finalizar`))).toContain('Solo se puede finalizar');
  });

  test.each([
    [0, 'Evento cancelado.'],
    [1, 'Evento cancelado. También se canceló 1 entrada.'],
    [3, 'Evento cancelado. También se cancelaron 3 entradas.'],
  ])('al cancelar con %i entradas, el aviso dice cuántas se arrastraron', async (cantidad, mensaje) => {
    for (let i = 0; i < cantidad; i++) await nuevaEntrada();

    expect(aviso(await enviar(d.admin, `/panel/eventos/${d.evento.id}/cancelar`))).toBe(mensaje);
  });

  test('cancelar un evento ya cancelado avisa el motivo', async () => {
    await eventosModel.cancelarEvento(d.evento.id);

    expect(aviso(await enviar(d.admin, `/panel/eventos/${d.evento.id}/cancelar`))).toBe('El evento ya estaba cancelado.');
  });

  test('un evento inexistente muestra la página 404', async () => {
    expect((await ver(d.representante, `/panel/eventos/${ID_INEXISTENTE}`)).status).toBe(404);
    expect((await ver(d.representante, `/panel/eventos/${ID_INEXISTENTE}/editar`)).status).toBe(404);
    expect((await enviar(d.representante, `/panel/eventos/${ID_INEXISTENTE}/editar`, form())).status).toBe(404);
    expect((await enviar(d.representante, `/panel/eventos/${ID_INEXISTENTE}/finalizar`)).status).toBe(404);
    expect((await enviar(d.admin, `/panel/eventos/${ID_INEXISTENTE}/cancelar`)).status).toBe(404);
  });
});
