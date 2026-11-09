// Páginas del check-in en la puerta. El QR de cada entrada abre /panel/checkin/<código> en el
// celular del personal: la página muestra la entrada y un botón para validar el ingreso.
// Mostrar es GET y validar es POST: abrir una URL (o escanear un QR) nunca modifica datos.
import * as entradasModel from '../../models/entradas.js';
import * as clientesModel from '../../models/clientes.js';
import * as usuariosModel from '../../models/usuarios.js';
import { volver, volverConError, enriquecerEvento } from './comunes.js';

// GET /panel/checkin: formulario para cargar el código a mano (por ejemplo, si el QR no se lee)
function buscar(req, res) {
  const codigo = String(req.query.codigo || '').trim();
  if (codigo) return res.redirect('/panel/checkin/' + encodeURIComponent(codigo));
  res.render('checkin/buscar', { titulo: 'Ingreso al evento' });
}

// GET /panel/checkin/:codigo: la entrada del QR y si puede ingresar
async function mostrar(req, res, next) {
  try {
    const revision = await entradasModel.revisarIngreso(req.params.codigo);
    if (revision.error) {
      return res.status(revision.status).render('checkin/entrada', {
        titulo: 'Ingreso al evento',
        noEncontrada: revision.error,
      });
    }

    const { entrada, evento, motivo } = revision;
    const cliente = await clientesModel.getById(entrada.clienteId);
    const validador = entrada.validadaPor ? await usuariosModel.getById(entrada.validadaPor) : null;
    res.render('checkin/entrada', {
      titulo: 'Ingreso al evento',
      entrada,
      evento: evento ? await enriquecerEvento(evento) : null,
      cliente: cliente ? cliente.nombre + ' ' + cliente.apellido : 'Cliente eliminado',
      motivo,
      validador: validador ? validador.nombre : null,
    });
  } catch (error) {
    next(error);
  }
}

// POST /panel/checkin/:codigo: valida el ingreso y vuelve a la misma página con el resultado
async function validar(req, res, next) {
  try {
    const ruta = '/panel/checkin/' + encodeURIComponent(req.params.codigo);
    const resultado = await entradasModel.ingresar(req.params.codigo, req.usuario.id);
    if (resultado.error) return volverConError(res, ruta, resultado.error);
    volver(res, ruta, 'Ingreso registrado. ¡Que disfrute el evento!');
  } catch (error) {
    next(error);
  }
}

export { buscar, mostrar, validar };
