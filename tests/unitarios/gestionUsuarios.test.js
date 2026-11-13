// Tests unitarios: reglas de quién puede gestionar a quién (models/gestionUsuarios.js).
// Son funciones puras: reciben objetos y devuelven un resultado, así que no hace falta
// base de datos, servidor ni token. Los usuarios son objetos comunes armados a mano.
import { rolesCreables, puedeGestionar, filtrarYOrdenar } from '../../models/gestionUsuarios.js';

const CENTRO_A = '5a1a00000000000000000001';
const CENTRO_B = '5a1a00000000000000000002';

const admin = { rol: 'ADMIN' };
const auditor = { rol: 'AUDITOR' };
const representanteA = { rol: 'REPRESENTANTE', salaId: CENTRO_A };
const empleadoA = { rol: 'EMPLEADO', salaId: CENTRO_A };
const empleadoB = { rol: 'EMPLEADO', salaId: CENTRO_B };

describe('rolesCreables', () => {
  test('el ADMIN puede crear cualquier rol de personal, incluido el AUDITOR', () => {
    expect(rolesCreables(admin)).toEqual(
      expect.arrayContaining(['ADMIN', 'REPRESENTANTE', 'EMPLEADO', 'AUDITOR'])
    );
  });

  test('el REPRESENTANTE solo puede crear empleados', () => {
    expect(rolesCreables(representanteA)).toEqual(['EMPLEADO']);
  });

  test('el AUDITOR y el EMPLEADO no pueden crear usuarios', () => {
    expect(rolesCreables(auditor)).toEqual([]);
    expect(rolesCreables(empleadoA)).toEqual([]);
  });
});

describe('puedeGestionar', () => {
  test('el ADMIN gestiona a cualquier usuario', () => {
    expect(puedeGestionar(admin, empleadoB)).toBe(true);
    expect(puedeGestionar(admin, auditor)).toBe(true);
  });

  test('el REPRESENTANTE gestiona a los empleados de su centro', () => {
    expect(puedeGestionar(representanteA, empleadoA)).toBe(true);
  });

  test('el REPRESENTANTE no gestiona empleados de otro centro', () => {
    expect(puedeGestionar(representanteA, empleadoB)).toBe(false);
  });

  test('el AUDITOR no gestiona a nadie, aunque vea a todos', () => {
    expect(puedeGestionar(auditor, empleadoA)).toBe(false);
  });
});

describe('filtrarYOrdenar (filtros de la lista de usuarios)', () => {
  const ahora = new Date('2026-11-15T12:00:00-03:00');
  const usuarios = [
    { nombre: 'Zoe', rol: 'EMPLEADO', estado: 'ACTIVO', salaId: CENTRO_A },
    { nombre: 'Ana', rol: 'EMPLEADO', estado: 'SUSPENDIDO', salaId: CENTRO_B },
    { nombre: 'Beto', rol: 'ADMIN', estado: 'ACTIVO' },
    { nombre: 'Caro', rol: 'REPRESENTANTE', estado: 'ACTIVO', salaId: CENTRO_A,
      bloqueadoHasta: new Date('2026-11-15T12:10:00-03:00') },
  ];
  const nombres = (lista) => lista.map((u) => u.nombre);

  test('ordena por rol (de plataforma a centro) y después por nombre', () => {
    expect(nombres(filtrarYOrdenar(usuarios, {}, ahora))).toEqual(['Beto', 'Caro', 'Ana', 'Zoe']);
  });

  test('filtra por rol, por estado y por centro', () => {
    expect(nombres(filtrarYOrdenar(usuarios, { rol: 'EMPLEADO' }, ahora))).toEqual(['Ana', 'Zoe']);
    expect(nombres(filtrarYOrdenar(usuarios, { estado: 'SUSPENDIDO' }, ahora))).toEqual(['Ana']);
    expect(nombres(filtrarYOrdenar(usuarios, { salaId: CENTRO_A }, ahora))).toEqual(['Caro', 'Zoe']);
  });

  test('BLOQUEADO son los que tienen un bloqueo por intentos todavía vigente', () => {
    expect(nombres(filtrarYOrdenar(usuarios, { estado: 'BLOQUEADO' }, ahora))).toEqual(['Caro']);
  });
});
