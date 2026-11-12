// Chat desplegable del asistente de cartelera.
// La conversación se guarda en sessionStorage para que no se pierda al cambiar de página del
// panel (cada página se renderiza de nuevo en el servidor). Los textos se insertan con
// textContent, nunca como HTML: lo que devuelve el modelo no se interpreta.
(() => {
  const raiz = document.getElementById('asistente');
  if (!raiz) return;

  const boton = document.getElementById('asistente-abrir');
  const panel = document.getElementById('asistente-panel');
  const cerrar = document.getElementById('asistente-cerrar');
  const lista = document.getElementById('asistente-mensajes');
  const sugerencias = document.getElementById('asistente-sugerencias');
  const form = document.getElementById('asistente-form');
  const input = document.getElementById('asistente-input');
  const enviar = form.querySelector('button[type="submit"]');

    // Una clave por usuario: si otro inicia sesión en la misma pestaña, no ve la conversación anterior
  const CLAVE = 'asistente-cartelera-' + (raiz.dataset.usuario || 'sin-usuario');
  const SALUDO = '¡Hola! Soy el asistente de Urbana Cult. ¿Querés saber qué hay en cartelera?';

  let historial = []; // [{ rol: 'usuario' | 'asistente', texto }]
  let esperando = false;

  // sessionStorage puede fallar (modo privado, bloqueado): el chat tiene que andar igual
  function leer() {
    try {
      return JSON.parse(sessionStorage.getItem(CLAVE)) || {};
    } catch {
      return {};
    }
  }

  function guardar(abierto) {
    try {
      sessionStorage.setItem(CLAVE, JSON.stringify({ historial, abierto }));
    } catch {
      // sin almacenamiento: no pasa nada
    }
  }

  function agregar(rol, texto) {
    const burbuja = document.createElement('div');
    burbuja.className = 'asistente-msg ' + rol;
    burbuja.textContent = texto;
    lista.appendChild(burbuja);
    lista.scrollTop = lista.scrollHeight;
    return burbuja;
  }

  function abrir(abierto) {
    panel.hidden = !abierto;
    boton.setAttribute('aria-expanded', String(abierto));
    if (abierto) input.focus();
    guardar(abierto);
  }

  async function consultar(mensaje) {
    if (esperando || !mensaje.trim()) return;
    esperando = true;
    enviar.disabled = true;
    sugerencias.hidden = true;

    agregar('usuario', mensaje);
    const pensando = agregar('asistente pensando', 'Escribiendo…');

    try {
      const res = await fetch('/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje, historial }),
      });
      const datos = await res.json().catch(() => ({}));
      pensando.remove();

      if (res.status === 401 || res.status === 403) {
        agregar('asistente error', 'Tu sesión expiró. Recargá la página e iniciá sesión de nuevo.');
      } else if (!res.ok) {
        agregar('asistente error', datos.error || 'No pude responder ahora. Probá de nuevo.');
      } else {
        agregar('asistente', datos.respuesta);
        historial.push({ rol: 'usuario', texto: mensaje }, { rol: 'asistente', texto: datos.respuesta });
        historial = historial.slice(-6);
        guardar(true);
      }
    } catch {
      pensando.remove();
      agregar('asistente error', 'No hay conexión con el servidor. Probá de nuevo.');
    } finally {
      esperando = false;
      enviar.disabled = false;
      input.focus();
    }
  }

  // Estado inicial: conversación anterior (si hay) y saludo
  const guardado = leer();
  historial = Array.isArray(guardado.historial) ? guardado.historial : [];
  agregar('asistente', SALUDO);
  for (const m of historial) agregar(m.rol, m.texto);
  sugerencias.hidden = historial.length > 0;
  if (guardado.abierto) abrir(true);

  boton.addEventListener('click', () => abrir(panel.hidden));
  cerrar.addEventListener('click', () => abrir(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) abrir(false);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const mensaje = input.value;
    input.value = '';
    consultar(mensaje);
  });

  sugerencias.addEventListener('click', (e) => {
    const sugerencia = e.target.closest('.sugerencia');
    if (sugerencia) consultar(sugerencia.textContent);
  });
  
  // Al cerrar sesión se borra la conversación guardada
  document.querySelectorAll('form[action="/panel/logout"]').forEach((f) =>
    f.addEventListener('submit', () => {
      try {
        sessionStorage.removeItem(CLAVE);
      } catch {
        // sin almacenamiento: no pasa nada
      }
    })
  );
})();
