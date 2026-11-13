// Tests unitarios: reglas de la compra web y de "Mis entradas" (models/entradas.js).
// Son funciones puras: reciben objetos armados a mano (y la hora "actual" por parámetro), así
// que no hace falta base de datos.
import {
  validarConfirmacion,
  validarCancelacion,
  validarIngreso,
  minutosDeRetencion,
  visiblesPara,
  agruparEntradasDelCliente,
} from '../../models/entradas.js';

const eventoDeHoy = { estado: 'PROGRAMADO', fecha: new Date() };

describe('Compra web en curso (RETENIDA) y no concretada (VENCIDA)', () => {
  test('el personal no puede confirmar ni cancelar una compra web en curso', () => {
    expect(validarConfirmacion({ estado: 'RETENIDA' })).toMatch(/la confirma el cliente al pagar/);
    expect(validarCancelacion({ estado: 'RETENIDA' })).toMatch(/solo el cliente puede cancelarla/);
  });

  test('una compra no concretada no se confirma, no se cancela y no ingresa', () => {
    expect(validarConfirmacion({ estado: 'VENCIDA' })).toMatch(/no se concretó/);
    expect(validarCancelacion({ estado: 'VENCIDA' })).toMatch(/no se concretó/);
    expect(validarIngreso({ estado: 'VENCIDA' }, eventoDeHoy)).toMatch(/no se concretó/);
  });

  test('una compra en curso no puede ingresar al evento', () => {
    expect(validarIngreso({ estado: 'RETENIDA' }, eventoDeHoy)).toMatch(/todavía no se pagó/);
  });

  test('la reserva de boletería se sigue confirmando y cancelando como siempre', () => {
    expect(validarConfirmacion({ estado: 'RESERVADA' })).toBeNull();
    expect(validarCancelacion({ estado: 'RESERVADA' })).toBeNull();
  });
});

describe('Plazo de la retención (RETENCION_MINUTOS)', () => {
  afterEach(() => delete process.env.RETENCION_MINUTOS);

  test('sin la variable son 10 minutos, con la variable se usa su valor, y uno inválido vuelve a 10', () => {
    expect(minutosDeRetencion()).toBe(10);
    process.env.RETENCION_MINUTOS = '5';
    expect(minutosDeRetencion()).toBe(5);
    process.env.RETENCION_MINUTOS = 'diez';
    expect(minutosDeRetencion()).toBe(10);
  });
});

describe('visiblesPara: qué estados ve cada rol', () => {
  const todas = ['VALIDA', 'RESERVADA', 'USADA', 'CANCELADA', 'RETENIDA', 'VENCIDA'].map((estado) => ({ estado }));
  const estados = (lista) => lista.map((e) => e.estado);

  test('el ADMIN y el AUDITOR ven todo, incluidas las compras en curso y las no concretadas', () => {
    expect(visiblesPara('ADMIN', todas)).toHaveLength(6);
    expect(visiblesPara('AUDITOR', todas)).toHaveLength(6);
  });

  test('el personal de los centros no ve las compras en curso ni las no concretadas', () => {
    expect(estados(visiblesPara('EMPLEADO', todas))).toEqual(['VALIDA', 'RESERVADA', 'USADA', 'CANCELADA']);
    expect(estados(visiblesPara('REPRESENTANTE', todas))).not.toContain('RETENIDA');
  });
});

describe('agruparEntradasDelCliente: próximas e historial', () => {
  const ahora = new Date('2026-11-15T12:00:00-03:00');
  const eventos = {
    hoy: { estado: 'PROGRAMADO', fecha: new Date('2026-11-15T21:00:00-03:00') },
    manana: { estado: 'PROGRAMADO', fecha: new Date('2026-11-16T21:00:00-03:00') },
    pasado: { estado: 'FINALIZADO', fecha: new Date('2026-11-01T21:00:00-03:00') },
    cancelado: { estado: 'CANCELADO', fecha: new Date('2026-11-20T21:00:00-03:00') },
  };
  const entrada = (estado, eventoId) => ({ estado, eventoId });

  test('las VALIDA de eventos por venir son próximas, de la más cercana a la más lejana', () => {
    const { proximas } = agruparEntradasDelCliente(
      [entrada('VALIDA', 'manana'), entrada('VALIDA', 'hoy')], eventos, ahora
    );
    expect(proximas.map((p) => p.entrada.eventoId)).toEqual(['hoy', 'manana']);
    expect(proximas.every((p) => p.situacion === 'VIGENTE')).toBe(true);
  });

  test('una VALIDA de un evento que ya pasó va al historial como "No utilizada"', () => {
    const { proximas, historial } = agruparEntradasDelCliente([entrada('VALIDA', 'pasado')], eventos, ahora);
    expect(proximas).toHaveLength(0);
    expect(historial[0].situacion).toBe('NO_UTILIZADA');
  });

  test('las usadas y las canceladas van al historial, y se distingue si se canceló el evento', () => {
    const { historial } = agruparEntradasDelCliente(
      [entrada('USADA', 'pasado'), entrada('CANCELADA', 'cancelado'), entrada('CANCELADA', 'manana')],
      eventos,
      ahora
    );
    expect(historial.map((h) => h.situacion)).toEqual(['EVENTO_CANCELADO', 'CANCELADA', 'USADA']);
  });

  test('las compras en curso, las no concretadas y las reservas de boletería nunca aparecen', () => {
    const { proximas, historial } = agruparEntradasDelCliente(
      [entrada('RETENIDA', 'hoy'), entrada('VENCIDA', 'hoy'), entrada('RESERVADA', 'hoy')], eventos, ahora
    );
    expect(proximas).toHaveLength(0);
    expect(historial).toHaveLength(0);
  });
});
