/* ============================================================
   app.js — junta las piezas: sesión, navegación, panel de listas,
   diálogos y el refresco en vivo.
   ============================================================ */

(function () {

  var estado = {
    filas: [],
    indice: {},
    raices: [],
    actualId: null,      // null = raíz
    pestania: 'activas', // activas | cola | hechas
    editando: false,
    sinConexion: false
  };

  function $(id) { return document.getElementById(id); }

  var pantallaLogin = $('pantalla-login');
  var pantallaApp   = $('pantalla-app');
  var svg           = $('dona');
  var aviso         = $('aviso');
  var panel         = $('panel');
  var panelFondo    = $('panel-fondo');

  /* =========================================================
     DIÁLOGOS
     ========================================================= */
  var Dialogo = {
    /* alAceptar(texto, opcion) — opcion viene de los botones extra */
    pedirTexto: function (titulo, valorInicial, botones, alAceptar) {
      var fondo = document.createElement('div');
      fondo.className = 'modal-fondo';
      var htmlBotones = botones.map(function (b) {
        return '<button class="btn ' + (b.principal ? 'btn-lleno' : 'btn-fantasma') +
               '" data-accion="ok" data-opcion="' + b.valor + '">' +
               escapar(b.texto) + '</button>';
      }).join('');

      fondo.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true">' +
          '<h2>' + escapar(titulo) + '</h2>' +
          '<input type="text" class="modal-input" maxlength="200">' +
          '<div class="modal-botones modal-botones-columna">' + htmlBotones + '</div>' +
          '<button class="btn btn-fantasma btn-ancho" data-accion="cancelar">Cancelar</button>' +
        '</div>';
      document.body.appendChild(fondo);

      var input = fondo.querySelector('.modal-input');
      input.value = valorInicial || '';
      setTimeout(function () { input.focus(); input.select(); }, 50);

      function cerrar() { fondo.remove(); }
      function aceptar(opcion) {
        var v = input.value.trim();
        if (!v) { input.focus(); return; }
        cerrar();
        alAceptar(v, opcion);
      }

      fondo.addEventListener('click', function (e) {
        if (e.target === fondo) return cerrar();
        var b = e.target.closest('button');
        if (!b) return;
        if (b.getAttribute('data-accion') === 'cancelar') cerrar();
        if (b.getAttribute('data-accion') === 'ok') aceptar(b.getAttribute('data-opcion'));
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') aceptar(botones[0].valor);
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
        if (e.target === fondo) return fondo.remove();
        var b = e.target.closest('button');
        if (!b) return;
        if (b.getAttribute('data-accion') === 'cancelar') fondo.remove();
        if (b.getAttribute('data-accion') === 'ok') { fondo.remove(); alAceptar(); }
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
     CARGA
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

    reconstruir();

    if (estado.actualId && !estado.indice[estado.actualId]) {
      estado.actualId = null;   // la borraron desde otro dispositivo
    }

    pintar();
  }

  function reconstruir() {
    var a = Arbol.construir(estado.filas);
    estado.raices = a.raices;
    estado.indice = a.indice;
  }

  var recargarLento = (function () {
    var t = null;
    return function () {
      clearTimeout(t);
      t = setTimeout(recargar, 400);
    };
  })();

  /* =========================================================
     HELPERS DE NAVEGACIÓN
     ========================================================= */
  function nodoActual() {
    return estado.actualId ? estado.indice[estado.actualId] : null;
  }

  /* La raíz se comporta como un nodo virtual con los top-level de hijos */
  function nivelActual() {
    var n = nodoActual();
    return n || { hijos: estado.raices, titulo: 'Mis tareas', id: null, estado: 'activa' };
  }

  function activas()  { return Arbol.hijosActivos(nivelActual()); }
  function enCola()   { return Arbol.hijosEnCola(nivelActual()); }
  function hechas()   { return Arbol.hijosHechos(nivelActual()); }

  function progresoNivel() {
    var n = nodoActual();
    if (n) return Arbol.progreso(n);
    var cuentan = Arbol.hijosQueCuentan({ hijos: estado.raices });
    if (!cuentan.length) return 0;
    return cuentan.reduce(function (a, x) { return a + Arbol.progreso(x); }, 0) / cuentan.length;
  }

  function colorDelActual() {
    var n = nodoActual();
    if (!n) return null;
    var hermanos = n.padre_id
      ? Arbol.hijosActivos(estado.indice[n.padre_id])
      : Arbol.hijosActivos({ hijos: estado.raices });
    var j = hermanos.indexOf(n);
    return j >= 0 ? Dona.color(j) : Dona.COLORES[0];
  }

  /* =========================================================
     PINTAR
     ========================================================= */
  function pintar() {
    var actual = nodoActual();
    var acento = colorDelActual();
    document.documentElement.style.setProperty('--acento', acento || '#FF2E63');

    /* --- flecha de volver + migas --- */
    $('btn-volver').hidden = !actual;

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

    /* --- título arriba de la dona (antes iba adentro) --- */
    var tit = $('titulo-nivel');
    tit.textContent = actual ? actual.titulo : 'Mis tareas';

    /* --- la dona --- */
    Dona.dibujar(svg, activas(), {
      acento: acento,
      porcentaje: progresoNivel(),
      pendientes: enCola().length + hechas().length,
      onPorcion: function (hijo) { ir(hijo.id); },
      onCentro: abrirPanel
    });

    /* --- botón de agregar: cambia el texto según dónde estés --- */
    $('btn-agregar').textContent = actual ? '＋ Agregar subtarea' : '＋ Agregar tarea';

    if (!panel.hidden) pintarPanel();
  }

  function ir(id) {
    estado.actualId = id;
    estado.pestania = 'activas';
    cerrarPanel();
    pintar();
  }

  function subirNivel() {
    var a = nodoActual();
    ir(a && a.padre_id ? a.padre_id : null);
  }

  /* =========================================================
     PANEL DESLIZABLE
     ========================================================= */
  function abrirPanel() {
    panel.hidden = false;
    panelFondo.hidden = false;
    requestAnimationFrame(function () { panel.classList.add('panel-abierto'); });
    pintarPanel();
  }

  function cerrarPanel() {
    panel.classList.remove('panel-abierto');
    panelFondo.hidden = true;
    setTimeout(function () { panel.hidden = true; }, 200);
  }

  function pintarPanel() {
    var actual = nodoActual();
    $('panel-titulo').textContent = actual ? actual.titulo : 'Mis tareas';

    var cuentas = {
      activas: activas().length,
      cola: enCola().length,
      hechas: hechas().length
    };

    var tabs = $('panel-tabs');
    tabs.innerHTML = '';
    [['activas', 'En la dona'], ['cola', 'En cola'], ['hechas', 'Hechas']]
      .forEach(function (par) {
        var b = document.createElement('button');
        b.className = 'tab' + (estado.pestania === par[0] ? ' tab-activa' : '');
        b.innerHTML = escapar(par[1]) +
          ' <span class="tab-num">' + cuentas[par[0]] + '</span>';
        b.addEventListener('click', function () {
          estado.pestania = par[0];
          pintarPanel();
        });
        tabs.appendChild(b);
      });

    var cont = $('panel-lista');
    cont.innerHTML = '';

    var items = estado.pestania === 'activas' ? activas()
              : estado.pestania === 'cola'    ? enCola()
              : hechas();

    if (items.length === 0) {
      var vacio = document.createElement('p');
      vacio.className = 'vacio';
      vacio.textContent =
        estado.pestania === 'activas' ? 'No hay nada en la dona. Agregá una tarea o traé una de la cola.'
      : estado.pestania === 'cola'    ? 'La cola está vacía. Acá van las tareas que querés hacer más adelante.'
      :                                 'Todavía no terminaste ninguna en este nivel.';
      cont.appendChild(vacio);
    }

    items.forEach(function (nodo, i) {
      cont.appendChild(fila(nodo, i));
    });

    $('btn-editar').textContent = estado.editando ? 'Listo' : 'Editar';
    document.body.classList.toggle('modo-edicion', estado.editando);
  }

  function fila(nodo, i) {
    var esActiva = nodo.estado === 'activa';
    var c = esActiva ? Dona.color(i) : 'var(--texto-suave)';
    var p = Arbol.progreso(nodo);
    var hoja = Arbol.hijosQueCuentan(nodo).length === 0;

    var el = document.createElement('div');
    el.className = 'fila fila-' + nodo.estado;
    el.style.setProperty('--color-fila', c);

    /* --- control de la izquierda --- */
    if (nodo.estado === 'activa') {
      var ctrl = document.createElement('button');
      if (hoja) {
        ctrl.className = 'tilde';
        ctrl.setAttribute('aria-label', 'Marcar como hecha');
        ctrl.textContent = '';
        ctrl.addEventListener('click', function (e) {
          e.stopPropagation();
          accion(function () { return DB.cambiarEstado(nodo.id, 'hecha'); });
        });
      } else {
        ctrl.className = 'tilde tilde-auto';
        ctrl.disabled = true;
        ctrl.textContent = Math.round(p * 100) + '%';
        ctrl.title = 'Se completa sola cuando terminen sus subtareas';
      }
      el.appendChild(ctrl);
    } else {
      var icono = document.createElement('span');
      icono.className = 'marca';
      icono.textContent = nodo.estado === 'hecha' ? '✓' : '◷';
      el.appendChild(icono);
    }

    /* --- texto --- */
    var texto = document.createElement('div');
    texto.className = 'fila-texto';
    var t = document.createElement('span');
    t.className = 'fila-titulo';
    t.textContent = nodo.titulo;
    texto.appendChild(t);

    if (!hoja) {
      var sub = document.createElement('span');
      sub.className = 'fila-sub';
      var cuentan = Arbol.hijosQueCuentan(nodo);
      var listas = cuentan.filter(function (h) { return Arbol.completa(h); }).length;
      sub.textContent = listas + ' de ' + cuentan.length + ' subtareas listas';
      texto.appendChild(sub);
    }
    el.appendChild(texto);

    /* --- acciones --- */
    var acciones = document.createElement('div');
    acciones.className = 'fila-acciones';

    if (nodo.estado === 'cola') {
      acciones.appendChild(botonAccion('A la dona', 'accion-primaria', function () {
        accion(function () { return DB.cambiarEstado(nodo.id, 'activa'); });
      }));
    } else if (nodo.estado === 'hecha') {
      acciones.appendChild(botonAccion('Reactivar', 'accion-primaria', function () {
        accion(function () { return DB.cambiarEstado(nodo.id, 'activa'); });
      }));
    } else if (estado.editando) {
      acciones.appendChild(botonAccion('A la cola', '', function () {
        accion(function () { return DB.cambiarEstado(nodo.id, 'cola'); });
      }));
    }

    if (estado.editando) {
      acciones.appendChild(iconoBoton('✎', 'Cambiar el nombre', '', function () {
        Dialogo.pedirTexto('Cambiar el nombre', nodo.titulo,
          [{ texto: 'Guardar', valor: 'ok', principal: true }],
          function (v) { accion(function () { return DB.renombrar(nodo.id, v); }); });
      }));
      acciones.appendChild(iconoBoton('🗑', 'Borrar', 'icono-peligro', function () {
        var n = Arbol.contarDescendientes(nodo);
        var msg = n > 0
          ? 'Se va a borrar «' + nodo.titulo + '» y sus ' + n + ' subtarea(s). No se puede deshacer.'
          : 'Se va a borrar «' + nodo.titulo + '». No se puede deshacer.';
        Dialogo.confirmar('¿Borrar la tarea?', msg, 'Sí, borrar', function () {
          accion(function () { return DB.borrar(nodo.id); });
        });
      }));
    }

    el.appendChild(acciones);

    if (esActiva && !estado.editando) {
      var flecha = document.createElement('span');
      flecha.className = 'fila-flecha';
      flecha.textContent = '›';
      el.appendChild(flecha);
      el.addEventListener('click', function () { ir(nodo.id); });
    }

    return el;
  }

  function botonAccion(texto, clase, fn) {
    var b = document.createElement('button');
    b.className = 'btn-fila ' + clase;
    b.textContent = texto;
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    return b;
  }

  function iconoBoton(simbolo, etiqueta, clase, fn) {
    var b = document.createElement('button');
    b.className = 'icono ' + clase;
    b.setAttribute('aria-label', etiqueta);
    b.textContent = simbolo;
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    return b;
  }

  /* =========================================================
     ESCRIBIR
     ========================================================= */

  /* Ejecuta el cambio, y después revisa si alguna tarea CRUZÓ el 100%
     con eso. Las que cruzaron se archivan solas.

     Comparamos la foto de antes con la de después en vez de mirar solo
     el después: así reactivar una tarea terminada no la vuelve a
     archivar al instante (ya estaba en 100%, no cruzó nada). */
  async function accion(fn) {
    if (estado.sinConexion) {
      mostrarAviso('Sin conexión: no se pueden guardar cambios ahora.', 'error');
      return;
    }
    try {
      var antes = Arbol.foto(estado.indice);

      await fn();

      estado.filas = await DB.listar();
      reconstruir();

      var despues = Arbol.foto(estado.indice);
      var aArchivar = Arbol.cruzaronEl100(antes, despues, estado.indice);

      if (aArchivar.length) {
        await DB.cambiarEstadoVarias(aArchivar, 'hecha');
        estado.filas = await DB.listar();
        reconstruir();
      }

      if (estado.actualId && !estado.indice[estado.actualId]) estado.actualId = null;
      pintar();
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
      Dialogo.pedirTexto(titulo, '', [
        { texto: 'Ponerla en la dona', valor: 'activa', principal: true },
        { texto: 'Guardar en la cola', valor: 'cola' }
      ], function (v, destino) {
        var cantidad = destino === 'cola' ? enCola().length : activas().length;
        accion(function () {
          return DB.crear(v, estado.actualId, cantidad, destino);
        }).then(function () {
          if (destino === 'cola') {
            estado.pestania = 'cola';
            abrirPanel();
          }
        });
      });
    });

    $('btn-volver').addEventListener('click', subirNivel);

    $('btn-editar').addEventListener('click', function () {
      estado.editando = !estado.editando;
      pintarPanel();
    });

    $('panel-cerrar').addEventListener('click', cerrarPanel);
    panelFondo.addEventListener('click', cerrarPanel);

    $('btn-salir').addEventListener('click', function () {
      Dialogo.confirmar(
        '¿Cerrar sesión?',
        'Vas a tener que poner el mail y la contraseña de nuevo en este dispositivo.',
        'Sí, salir',
        async function () { await DB.salir(); }
      );
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) cerrarPanel();
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
        '<div class="setup"><h1>Falta configurar</h1>' +
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

    // Los nombres de la dona se miden con la tipografía real; en la
    // primerísima carga puede no estar lista, así que repintamos.
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
