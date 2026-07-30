/* ============================================================
   app.js — junta todas las piezas: sesión, navegación, lista,
   diálogos y el refresco en vivo.
   ============================================================ */

(function () {

  /* ---------- estado ---------- */
  var estado = {
    filas: [],
    indice: {},
    raices: [],
    actualId: null,     // null = estás en la raíz
    editando: false,
    sinConexion: false
  };

  /* ---------- atajos al DOM ---------- */
  function $(id) { return document.getElementById(id); }

  var pantallaLogin = $('pantalla-login');
  var pantallaApp   = $('pantalla-app');
  var svg           = $('dona');
  var lista         = $('lista');
  var aviso         = $('aviso');

  /* =========================================================
     DIÁLOGOS  (más grandes y claros que un prompt del navegador)
     ========================================================= */
  var Dialogo = {
    pedirTexto: function (titulo, valorInicial, etiquetaOk, alAceptar) {
      var fondo = document.createElement('div');
      fondo.className = 'modal-fondo';
      fondo.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true">' +
          '<h2>' + escapar(titulo) + '</h2>' +
          '<input type="text" class="modal-input" maxlength="200">' +
          '<div class="modal-botones">' +
            '<button class="btn btn-fantasma" data-accion="cancelar">Cancelar</button>' +
            '<button class="btn btn-lleno" data-accion="ok">' + escapar(etiquetaOk) + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(fondo);

      var input = fondo.querySelector('.modal-input');
      input.value = valorInicial || '';
      setTimeout(function () { input.focus(); input.select(); }, 50);

      function cerrar() { fondo.remove(); }
      function aceptar() {
        var v = input.value.trim();
        if (!v) { input.focus(); return; }
        cerrar();
        alAceptar(v);
      }

      fondo.addEventListener('click', function (e) {
        if (e.target === fondo) cerrar();
        var accion = e.target.getAttribute('data-accion');
        if (accion === 'cancelar') cerrar();
        if (accion === 'ok') aceptar();
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') aceptar();
        if (e.key === 'Escape') cerrar();
      });
    },

    confirmar: function (titulo, mensaje, etiquetaOk, alAceptar) {
      var fondo = document.createElement('div');
      fondo.className = 'modal-fondo';
      fondo.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true">' +
          '<h2>' + escapar(titulo) + '</h2>' +
          '<p class="modal-texto">' + escapar(mensaje) + '</p>' +
          '<div class="modal-botones">' +
            '<button class="btn btn-fantasma" data-accion="cancelar">No, dejalo</button>' +
            '<button class="btn btn-peligro" data-accion="ok">' + escapar(etiquetaOk) + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(fondo);

      fondo.addEventListener('click', function (e) {
        if (e.target === fondo) fondo.remove();
        var accion = e.target.getAttribute('data-accion');
        if (accion === 'cancelar') fondo.remove();
        if (accion === 'ok') { fondo.remove(); alAceptar(); }
      });
    }
  };

  function escapar(s) {
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function mostrarAviso(texto, tipo) {
    aviso.textContent = texto;
    aviso.className = 'aviso aviso-' + (tipo || 'info');
    aviso.hidden = false;
    if (tipo !== 'permanente') {
      clearTimeout(mostrarAviso._t);
      mostrarAviso._t = setTimeout(function () { aviso.hidden = true; }, 4000);
    }
  }

  /* =========================================================
     LOGIN
     ========================================================= */
  function configurarLogin() {
    $('form-login').addEventListener('submit', async function (e) {
      e.preventDefault();
      var boton = $('btn-entrar');
      var error = $('login-error');
      error.hidden = true;
      boton.disabled = true;
      boton.textContent = 'Entrando…';

      try {
        await DB.entrar($('email').value, $('password').value);
        // el listener de sesión se encarga de mostrar la app
      } catch (err) {
        error.textContent = mensajeDeError(err);
        error.hidden = false;
      } finally {
        boton.disabled = false;
        boton.textContent = 'Entrar';
      }
    });
  }

  function mensajeDeError(err) {
    var m = (err && err.message) ? err.message.toLowerCase() : '';
    if (m.indexOf('invalid login') >= 0) return 'El mail o la contraseña no coinciden.';
    if (m.indexOf('email not confirmed') >= 0) return 'Falta confirmar el mail de esta cuenta.';
    if (m.indexOf('failed to fetch') >= 0 || m.indexOf('network') >= 0) return 'No hay conexión a internet.';
    if (m.indexOf('rate limit') >= 0) return 'Demasiados intentos. Esperá un minuto.';
    return 'No se pudo entrar. Probá de nuevo.';
  }

  /* =========================================================
     CARGA Y REFRESCO
     ========================================================= */
  async function recargar() {
    try {
      estado.filas = await DB.listar();
      estado.sinConexion = false;
    } catch (err) {
      var copia = DB.leerCopia();
      if (copia) {
        estado.filas = copia.filas;
        estado.sinConexion = true;
        mostrarAviso('Sin conexión. Estás viendo la última versión guardada.', 'permanente');
      } else {
        mostrarAviso('No se pudieron cargar las tareas.', 'error');
        return;
      }
    }

    var a = Arbol.construir(estado.filas);
    estado.raices = a.raices;
    estado.indice = a.indice;

    // si la tarea donde estabas parado se borró desde otro dispositivo
    if (estado.actualId && !estado.indice[estado.actualId]) {
      estado.actualId = null;
    }

    pintar();
  }

  var recargarLento = (function () {
    var t = null;
    return function () {
      clearTimeout(t);
      t = setTimeout(recargar, 400);
    };
  })();

  /* =========================================================
     PINTAR LA PANTALLA
     ========================================================= */
  function nodoActual() {
    return estado.actualId ? estado.indice[estado.actualId] : null;
  }

  function hijosActuales() {
    var n = nodoActual();
    return n ? n.hijos : estado.raices;
  }

  function colorDelActual() {
    var n = nodoActual();
    if (!n || !n.padre_id) {
      if (!n) return null;
      var i = estado.raices.indexOf(n);
      return i >= 0 ? Dona.color(i) : null;
    }
    var padre = estado.indice[n.padre_id];
    var j = padre.hijos.indexOf(n);
    return j >= 0 ? Dona.color(j) : null;
  }

  function pintar() {
    var actual = nodoActual();
    var hijos = hijosActuales();
    var acento = colorDelActual();

    document.documentElement.style.setProperty('--acento', acento || '#FF2E63');

    /* migas de pan */
    var migas = $('migas');
    migas.innerHTML = '';
    if (actual) {
      var ruta = Arbol.camino(estado.indice, actual.id);
      var inicio = document.createElement('button');
      inicio.className = 'miga';
      inicio.textContent = 'Todo';
      inicio.addEventListener('click', function () { ir(null); });
      migas.appendChild(inicio);

      ruta.forEach(function (n, i) {
        var sep = document.createElement('span');
        sep.className = 'miga-sep';
        sep.textContent = '›';
        migas.appendChild(sep);

        var b = document.createElement('button');
        b.className = 'miga' + (i === ruta.length - 1 ? ' miga-activa' : '');
        b.textContent = n.titulo;
        b.addEventListener('click', function () { ir(n.id); });
        migas.appendChild(b);
      });
    }
    migas.hidden = !actual;

    /* la dona */
    var progresoCentro = actual
      ? Arbol.progreso(actual)
      : (estado.raices.length
          ? estado.raices.reduce(function (a, n) { return a + Arbol.progreso(n); }, 0) / estado.raices.length
          : 0);

    Dona.dibujar(svg, hijos, {
      esRaiz: !actual,
      acento: acento,
      tituloCentro: actual ? actual.titulo : 'Mis tareas',
      porcentaje: progresoCentro,
      onPorcion: function (hijo) { ir(hijo.id); },
      onCentro: function () {
        ir(actual && actual.padre_id ? actual.padre_id : null);
      }
    });

    /* la lista */
    lista.innerHTML = '';

    if (hijos.length === 0) {
      var vacio = document.createElement('p');
      vacio.className = 'vacio';
      vacio.textContent = actual
        ? 'Esta tarea no tiene subtareas todavía. Agregá la primera con el botón de abajo.'
        : 'Todavía no hay tareas. Empezá agregando una con el botón de abajo.';
      lista.appendChild(vacio);
    }

    hijos.forEach(function (hijo, i) {
      lista.appendChild(filaDeTarea(hijo, i));
    });

    /* botón de marcar la tarea actual como hecha (solo si no tiene hijos) */
    var zonaHecha = $('zona-hecha');
    zonaHecha.innerHTML = '';
    if (actual && actual.hijos.length === 0) {
      var b = document.createElement('button');
      b.className = 'btn btn-lleno btn-ancho';
      b.textContent = actual.hecho ? '✓ Está hecha — desmarcar' : 'Marcar esta tarea como hecha';
      b.addEventListener('click', function () {
        accion(function () { return DB.marcar(actual.id, !actual.hecho); });
      });
      zonaHecha.appendChild(b);
    }

    $('btn-editar').textContent = estado.editando ? 'Listo' : 'Editar';
    document.body.classList.toggle('modo-edicion', estado.editando);
  }

  function filaDeTarea(nodo, i) {
    var c = Dona.color(i);
    var p = Arbol.progreso(nodo);
    var hoja = nodo.hijos.length === 0;
    var lista_ = document.createElement('div');
    lista_.className = 'fila' + (p >= 0.999 ? ' fila-completa' : '');
    lista_.style.setProperty('--color-fila', c);

    /* número, que coincide con el de la porción de la dona */
    var num = document.createElement('span');
    num.className = 'fila-num';
    num.textContent = String(i + 1);
    lista_.appendChild(num);

    /* tilde: solo las tareas SIN subtareas se marcan a mano */
    var tilde = document.createElement('button');
    tilde.className = 'tilde' + (p >= 0.999 ? ' tilde-ok' : '');
    if (hoja) {
      tilde.setAttribute('aria-label', nodo.hecho ? 'Desmarcar' : 'Marcar como hecha');
      tilde.textContent = nodo.hecho ? '✓' : '';
      tilde.addEventListener('click', function (e) {
        e.stopPropagation();
        accion(function () { return DB.marcar(nodo.id, !nodo.hecho); });
      });
    } else {
      tilde.className += ' tilde-auto';
      tilde.disabled = true;
      tilde.textContent = Math.round(p * 100) + '%';
      tilde.title = 'Se completa sola cuando terminen sus subtareas';
    }
    lista_.appendChild(tilde);

    var texto = document.createElement('div');
    texto.className = 'fila-texto';
    var t = document.createElement('span');
    t.className = 'fila-titulo';
    t.textContent = nodo.titulo;
    texto.appendChild(t);
    if (!hoja) {
      var sub = document.createElement('span');
      sub.className = 'fila-sub';
      var hechas = nodo.hijos.filter(function (h) { return Arbol.completa(h); }).length;
      sub.textContent = hechas + ' de ' + nodo.hijos.length + ' subtareas listas';
      texto.appendChild(sub);
    }
    lista_.appendChild(texto);

    /* botones de edición */
    var acciones = document.createElement('div');
    acciones.className = 'fila-acciones';

    var lapiz = document.createElement('button');
    lapiz.className = 'icono';
    lapiz.setAttribute('aria-label', 'Cambiar el nombre');
    lapiz.textContent = '✎';
    lapiz.addEventListener('click', function (e) {
      e.stopPropagation();
      Dialogo.pedirTexto('Cambiar el nombre', nodo.titulo, 'Guardar', function (v) {
        accion(function () { return DB.renombrar(nodo.id, v); });
      });
    });
    acciones.appendChild(lapiz);

    var tacho = document.createElement('button');
    tacho.className = 'icono icono-peligro';
    tacho.setAttribute('aria-label', 'Borrar');
    tacho.textContent = '🗑';
    tacho.addEventListener('click', function (e) {
      e.stopPropagation();
      var n = Arbol.contarDescendientes(nodo);
      var msg = n > 0
        ? 'Se va a borrar «' + nodo.titulo + '» y sus ' + n + ' subtarea(s). No se puede deshacer.'
        : 'Se va a borrar «' + nodo.titulo + '». No se puede deshacer.';
      Dialogo.confirmar('¿Borrar la tarea?', msg, 'Sí, borrar', function () {
        accion(function () { return DB.borrar(nodo.id); });
      });
    });
    acciones.appendChild(tacho);
    lista_.appendChild(acciones);

    var flecha = document.createElement('span');
    flecha.className = 'fila-flecha';
    flecha.textContent = '›';
    lista_.appendChild(flecha);

    lista_.addEventListener('click', function () { ir(nodo.id); });
    return lista_;
  }

  function ir(id) {
    estado.actualId = id;
    pintar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* Ejecuta una escritura y refresca. Si estás sin conexión, avisa. */
  async function accion(fn) {
    if (estado.sinConexion) {
      mostrarAviso('Sin conexión: no se pueden guardar cambios ahora.', 'error');
      return;
    }
    try {
      await fn();
      await recargar();
    } catch (err) {
      mostrarAviso('No se pudo guardar. Revisá la conexión.', 'error');
    }
  }

  /* =========================================================
     BOTONES FIJOS
     ========================================================= */
  function configurarBotones() {
    $('btn-agregar').addEventListener('click', function () {
      var actual = nodoActual();
      var titulo = actual ? 'Nueva subtarea de «' + actual.titulo + '»' : 'Nueva tarea';
      Dialogo.pedirTexto(titulo, '', 'Agregar', function (v) {
        accion(function () {
          return DB.crear(v, estado.actualId, hijosActuales().length);
        });
      });
    });

    $('btn-editar').addEventListener('click', function () {
      estado.editando = !estado.editando;
      pintar();
    });

    $('btn-salir').addEventListener('click', function () {
      Dialogo.confirmar(
        '¿Cerrar sesión?',
        'Vas a tener que poner el mail y la contraseña de nuevo en este dispositivo.',
        'Sí, salir',
        async function () { await DB.salir(); }
      );
    });

    window.addEventListener('online', recargar);
    window.addEventListener('offline', function () {
      estado.sinConexion = true;
      mostrarAviso('Se cortó la conexión. Podés mirar, pero no guardar.', 'permanente');
    });
  }

  /* =========================================================
     ARRANQUE
     ========================================================= */
  async function iniciar() {
    if (CONFIG.SUPABASE_URL.indexOf('TU-PROYECTO') >= 0) {
      document.body.innerHTML =
        '<div class="setup">' +
        '<h1>Falta configurar</h1>' +
        '<p>Abrí <code>js/config.js</code> y poné la URL y la anon key ' +
        'de tu proyecto de Supabase.</p></div>';
      return;
    }

    configurarLogin();
    configurarBotones();

    var suscripto = false;
    function escucharUnaVez() {
      if (suscripto) return;
      suscripto = true;
      DB.escucharCambios(recargarLento);
    }

    DB.alCambiarSesion(function (sesion) {
      if (sesion) {
        pantallaLogin.hidden = true;
        pantallaApp.hidden = false;
        recargar();
        escucharUnaVez();
      } else {
        pantallaApp.hidden = true;
        pantallaLogin.hidden = false;
      }
    });

    var sesion = await DB.sesionActual();
    if (sesion) {
      pantallaLogin.hidden = true;
      pantallaApp.hidden = false;
      await recargar();
      escucharUnaVez();
    } else {
      pantallaLogin.hidden = false;
    }

    $('cargando').hidden = true;

    // Los nombres sobre la dona se miden con la tipografía real. En la
    // primerísima carga puede no estar lista todavía, así que repintamos
    // cuando llega para que los recortes queden bien.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (!pantallaApp.hidden) pintar();
      });
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    }
  }

  iniciar();

})();
