// Tests unitarios: contraseñas y bloqueo de cuentas (models/usuarios.js).
// "new Usuario(...)" arma un documento en memoria, sin guardarlo: alcanza para probar sus
// métodos sin conectarse a MongoDB.
import { Usuario, chequearPassword, PASSWORD_MINIMO } from '../../models/usuarios.js';

// Arma un usuario en memoria con la contraseña ya hasheada, como quedaría en la base
function usuarioCon(password, cambios = {}) {
  return new Usuario({ ...Usuario.crearPasswordSeguro(password), ...cambios });
}

describe('Contraseñas (PBKDF2 con salt)', () => {
  test('la contraseña correcta valida y una incorrecta no', () => {
    const usuario = usuarioCon('clave-secreta');

    expect(usuario.validarPassword('clave-secreta')).toBe(true);
    expect(usuario.validarPassword('otra-clave')).toBe(false);
  });

  test('la misma contraseña genera hashes distintos, porque cada salt es aleatorio', () => {
    const primera = Usuario.crearPasswordSeguro('clave-secreta');
    const segunda = Usuario.crearPasswordSeguro('clave-secreta');

    expect(primera.salt).not.toBe(segunda.salt);
    expect(primera.passwordHash).not.toBe(segunda.passwordHash);
  });

  test('nunca se guarda la contraseña en texto', () => {
    const { passwordHash } = Usuario.crearPasswordSeguro('clave-secreta');
    expect(passwordHash).not.toContain('clave-secreta');
  });
});

describe('Política de contraseñas', () => {
  test(`rechaza una contraseña de menos de ${PASSWORD_MINIMO} caracteres`, () => {
    expect(chequearPassword('corta')).toMatch(/al menos/);
  });

  test('rechaza una contraseña vacía o que no es texto', () => {
    expect(chequearPassword('')).toMatch(/obligatoria/);
    expect(chequearPassword(12345678)).toMatch(/obligatoria/);
  });

  test('acepta una contraseña válida', () => {
    expect(chequearPassword('clave-secreta')).toBeNull();
  });
});

describe('Bloqueo por intentos fallidos', () => {
  const enDiezMinutos = new Date(Date.now() + 10 * 60 * 1000);
  const haceUnMinuto = new Date(Date.now() - 60 * 1000);

  test('una cuenta con bloqueo vigente está bloqueada', () => {
    expect(usuarioCon('clave-secreta', { bloqueadoHasta: enDiezMinutos }).estaBloqueado()).toBe(true);
  });

  test('cuando el bloqueo vence, la cuenta vuelve a estar habilitada', () => {
    expect(usuarioCon('clave-secreta', { bloqueadoHasta: haceUnMinuto }).estaBloqueado()).toBe(false);
  });

  test('una cuenta que nunca fue bloqueada no está bloqueada', () => {
    expect(usuarioCon('clave-secreta').estaBloqueado()).toBe(false);
  });
});
