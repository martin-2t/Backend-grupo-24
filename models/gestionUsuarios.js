// Quién puede gestionar a quién. Las usan el panel y cualquier otro punto de entrada, para que
// las reglas sean siempre las mismas:
//  - ADMIN: gestiona a todos y puede crear ADMIN, REPRESENTANTE y EMPLEADO.
//  - REPRESENTANTE: solo gestiona EMPLEADOS de su propio centro, y solo puede crear EMPLEADOS.
import * as usuariosModel from './usuarios.js';

const ROLES_CREABLES = {
  ADMIN: ['EMPLEADO', 'REPRESENTANTE', 'ADMIN'],
  REPRESENTANTE: ['EMPLEADO'],
};

function rolesCreables(actor) {
  return ROLES_CREABLES[actor.rol] || [];
}

// ¿Puede "actor" suspender, activar o desbloquear a "objetivo"?
function puedeGestionar(actor, objetivo) {
  if (actor.rol === 'ADMIN') return true;
  if (actor.rol === 'REPRESENTANTE') {
    return objetivo.rol === 'EMPLEADO' && String(objetivo.salaId) === String(actor.salaId);
  }
  return false;
}

// Los usuarios que "actor" puede ver en su lista
async function usuariosVisibles(actor) {
  if (actor.rol === 'ADMIN') return usuariosModel.getAll();
  return usuariosModel.Usuario.find({ rol: 'EMPLEADO', salaId: actor.salaId });
}

// Alta de personal. Devuelve { usuario } o { error, status }.
async function crearPersonal(actor, { nombre, apellido, email, password, rol, salaId }) {
  if (!rolesCreables(actor).includes(rol)) {
    return { error: 'No podés crear usuarios con ese rol.', status: 403 };
  }

  // El usuario guarda un solo campo "nombre": se une con el apellido, como en el registro web
  const limpio = (texto) => String(texto ?? '').trim();
  if (!limpio(nombre) || !limpio(apellido)) {
    return { error: 'El nombre y el apellido son obligatorios.', status: 400 };
  }
  const nombreCompleto = limpio(nombre) + ' ' + limpio(apellido);

  // El gerente crea siempre en su propio centro, sin importar lo que llegue en el body.
  // El ADMIN elige el centro, que solo aplica a los roles que trabajan en uno.
  let salaFinal;
  if (usuariosModel.ROLES_DE_CENTRO.includes(rol)) {
    salaFinal = actor.rol === 'REPRESENTANTE' ? String(actor.salaId) : salaId || undefined;
    if (!salaFinal) return { error: 'Elegí el centro del usuario.', status: 400 };
  }

  const errorPassword = usuariosModel.chequearPassword(password);
  if (errorPassword) return { error: errorPassword, status: 400 };

  if (email && (await usuariosModel.getByEmail(email))) {
    return { error: 'Ya existe un usuario con ese email.', status: 409 };
  }

  const errorReferencia = await usuariosModel.chequearReferencias({ rol, salaId: salaFinal });
  if (errorReferencia) return { error: errorReferencia, status: 404 };

  const usuario = await usuariosModel.create({
    nombre: nombreCompleto,
    email,
    password,
    rol,
    salaId: salaFinal,
  });
  return { usuario };
}


export { rolesCreables, puedeGestionar, usuariosVisibles, crearPersonal };