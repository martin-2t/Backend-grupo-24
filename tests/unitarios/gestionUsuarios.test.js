// Tests unitarios: reglas de quién puede gestionar a quién (models/gestionUsuarios.js).
// Son funciones puras: reciben objetos y devuelven un resultado, así que no hace falta
// base de datos, servidor ni token. Los usuarios son objetos comunes armados a mano.
import { rolesCreables, puedeGestionar } from '../../models/gestionUsuarios.js';

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
