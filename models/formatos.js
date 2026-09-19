// Formatos que comparten varias entidades. Las mismas expresiones van en el atributo
// pattern de los inputs, así el navegador avisa antes de mandar el formulario.
const SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ '\-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/;
const SOLO_DIGITOS = /^[0-9]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Largo mínimo para los nombres y direcciones que lo piden
const LARGO_MINIMO = 4;

// Los formularios mandan todo como texto, así que las validaciones normalizan antes
function texto(valor) {
  return valor === undefined || valor === null ? '' : String(valor).trim();
}

function numero(valor) {
  if (texto(valor) === '') return NaN;
  return Number(valor);
}

module.exports = { SOLO_LETRAS, SOLO_DIGITOS, EMAIL, LARGO_MINIMO, texto, numero };
