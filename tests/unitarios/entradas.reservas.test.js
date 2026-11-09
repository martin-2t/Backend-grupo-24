// Tests unitarios: qué se puede hacer con una reserva vencida (reglas de models/entradas.js).
// Son funciones puras: reciben la entrada y devuelven el motivo del rechazo, o null.
import {
  validarConfirmacion,
  validarCancelacion,
  validarIngreso,
  minutosDeReserva,
} from '../../models/entradas.js';

const vencida = { estado: 'VENCIDA' };
const reservada = { estado: 'RESERVADA' };
const eventoDeHoy = { estado: 'PROGRAMADO', fecha: new Date() };

describe('Reserva vencida', () => {
  test('no se puede confirmar, y el mensaje dice el plazo', () => {
    expect(validarConfirmacion(vencida)).toMatch(/venció: pasaron más de 10 minutos/);
  });

  test('no se puede cancelar, porque su lugar ya se liberó', () => {
    expect(validarCancelacion(vencida)).toMatch(/ya venció/);
  });

  test('no puede ingresar al evento', () => {
    expect(validarIngreso(vencida, eventoDeHoy)).toMatch(/venció/);
  });

  test('una reserva vigente sí se puede confirmar y cancelar', () => {
    expect(validarConfirmacion(reservada)).toBeNull();
    expect(validarCancelacion(reservada)).toBeNull();
  });
});

describe('Plazo de la reserva (RESERVA_MINUTOS)', () => {
  const original = process.env.RESERVA_MINUTOS;
  afterEach(() => {
    if (original === undefined) delete process.env.RESERVA_MINUTOS;
    else process.env.RESERVA_MINUTOS = original;
  });

  test('sin la variable, son 10 minutos', () => {
    delete process.env.RESERVA_MINUTOS;
    expect(minutosDeReserva()).toBe(10);
  });

  test('con la variable, se usa su valor', () => {
    process.env.RESERVA_MINUTOS = '5';
    expect(minutosDeReserva()).toBe(5);
  });

  test('un valor inválido vuelve a los 10 minutos', () => {
    process.env.RESERVA_MINUTOS = 'diez';
    expect(minutosDeReserva()).toBe(10);
  });
});
