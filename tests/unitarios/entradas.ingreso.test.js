// Tests unitarios: reglas del ingreso con QR (validarIngreso en models/entradas.js).
// validarIngreso recibe la entrada, el evento y la hora "actual" por parámetro: por eso se
// puede probar con objetos armados a mano y una hora fija, sin base de datos ni reloj real.
import { validarIngreso } from '../../models/entradas.js';

// Un evento el 15/11 a las 21 hs de Buenos Aires. En UTC (la hora del servidor en Vercel o
// Render) eso ya es el 16/11 a las 00 hs: justo el caso que puede confundir el "día del evento"
const evento = { estado: 'PROGRAMADO', fecha: new Date('2026-11-15T21:00:00-03:00') };
const valida = { estado: 'VALIDA' };

// Horas "actuales" de prueba, todas en hora de Buenos Aires
const elMismoDiaALas20 = new Date('2026-11-15T20:30:00-03:00'); // en UTC todavía es el 15
const elMismoDiaALas2350 = new Date('2026-11-15T23:50:00-03:00'); // en UTC ya es el 16
const elDiaAnterior = new Date('2026-11-14T21:00:00-03:00');
const elDiaSiguiente = new Date('2026-11-16T10:00:00-03:00');

describe('validarIngreso', () => {
  test('una entrada VALIDA, el día del evento, puede ingresar', () => {
    expect(validarIngreso(valida, evento, elMismoDiaALas20)).toBeNull();
  });

  test('el día se cuenta en hora de Buenos Aires, aunque en UTC ya sea el día siguiente', () => {
    expect(validarIngreso(valida, evento, elMismoDiaALas2350)).toBeNull();
  });

  test('no se valida el día anterior ni el siguiente', () => {
    expect(validarIngreso(valida, evento, elDiaAnterior)).toMatch(/solo se valida ese día/);
    expect(validarIngreso(valida, evento, elDiaSiguiente)).toMatch(/solo se valida ese día/);
  });

  test('una entrada ya usada se rechaza e informa cuándo ingresó', () => {
    const usada = { estado: 'USADA', usadaEn: new Date('2026-11-15T21:03:00-03:00') };
    expect(validarIngreso(usada, evento, elMismoDiaALas2350)).toMatch(/ya ingresó el 15\/11 a las 21:03/);
  });

  test('una reserva sin confirmar no puede ingresar, porque no está pagada', () => {
    expect(validarIngreso({ estado: 'RESERVADA' }, evento, elMismoDiaALas20)).toMatch(/no está pagada/);
  });

  test('una entrada cancelada no puede ingresar', () => {
    expect(validarIngreso({ estado: 'CANCELADA' }, evento, elMismoDiaALas20)).toMatch(/cancelada/);
  });

  test('si el evento fue cancelado o ya finalizó, nadie puede ingresar', () => {
    const cancelado = { ...evento, estado: 'CANCELADO' };
    expect(validarIngreso(valida, cancelado, elMismoDiaALas20)).toMatch(/finalizó o fue cancelado/);
  });
});
