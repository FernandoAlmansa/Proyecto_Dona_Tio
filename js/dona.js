/* ============================================================
   dona.js — dibuja la dona en SVG. Sin librerías.

   Cada porción es una subtarea ACTIVA del nivel donde estás.
   La porción se llena de adentro hacia afuera a medida que se
   completan sus propias subtareas: cuando llega al borde, esa
   rama entera está terminada.

   El anillo es ancho a propósito: cuanto más grueso, más largo
   es el arco a la altura del texto y más grande puede ser el
   nombre sin que se corte. Por eso el centro es chico.
   ============================================================ */

var Dona = (function () {

  var COLORES = [
    '#FF2E63',  // rosa
    '#FFB020',  // ámbar
    '#00D9A5',  // verde
    '#38BDF8',  // celeste
    '#B15CFF',  // violeta
    '#FF6B35'   // naranja
  ];

  var CX = 160, CY = 160;
  var R_INT = 74, R_EXT = 156;   // anillo de 82 de ancho (antes 54)
  var SEPARACION = 2;

  function color(i) {
    return COLORES[i % COLORES.length];
  }

  /* Polar -> cartesiano. El -90 pone el 0° arriba
     (si no, arrancaría a las 3 en punto). */
  function punto(r, grados) {
    var rad = (grados - 90) * Math.PI / 180;
    return {
      x: CX + r * Math.cos(rad),
      y: CY + r * Math.sin(rad)
    };
  }

  /* Sector de anillo: arco externo, línea adentro, arco interno, cerrar. */
  function sector(rInt, rExt, desde, hasta) {
    if (hasta - desde >= 360) hasta = desde + 359.99;
    var grande = (hasta - desde) > 180 ? 1 : 0;
    var a = punto(rExt, desde);
    var b = punto(rExt, hasta);
    var c = punto(rInt, hasta);
    var d = punto(rInt, desde);
    return [
      'M', a.x.toFixed(2), a.y.toFixed(2),
      'A', rExt, rExt, 0, grande, 1, b.x.toFixed(2), b.y.toFixed(2),
      'L', c.x.toFixed(2), c.y.toFixed(2),
      'A', rInt, rInt, 0, grande, 0, d.x.toFixed(2), d.y.toFixed(2),
      'Z'
    ].join(' ');
  }

  function crear(tag, atributos) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in atributos) {
      if (atributos.hasOwnProperty(k) &&
          atributos[k] !== null && atributos[k] !== undefined) {
        el.setAttribute(k, atributos[k]);
      }
    }
    return el;
  }

  /* Arco sin grosor: el riel por donde corre el texto.
     Las porciones de la mitad de abajo se recorren al revés,
     si no el nombre sale cabeza abajo. */
  function riel(r, desde, hasta, invertido) {
    var a = invertido ? hasta : desde;
    var b = invertido ? desde : hasta;
    var p1 = punto(r, a);
    var p2 = punto(r, b);
    var grande = Math.abs(hasta - desde) > 180 ? 1 : 0;
    return [
      'M', p1.x.toFixed(2), p1.y.toFixed(2),
      'A', r, r, 0, grande, invertido ? 0 : 1, p2.x.toFixed(2), p2.y.toFixed(2)
    ].join(' ');
  }

  /* El nombre siguiendo la curva. Se mide de verdad con
     getComputedTextLength() y se recorta hasta que entra: una "m"
     y una "i" no ocupan lo mismo, calcular por cantidad de letras
     recorta de más o desborda.

     Devuelve false si no entra ni recortado; ahí el que llama pone
     el número, que se corresponde con la fila de la lista. */
  function etiqueta(defs, gp, titulo, desde, hasta, i, oscuro) {
    var r = (R_INT + R_EXT) / 2;
    var abarca = Math.abs(hasta - desde);

    /* Una sola tarea ocupa el anillo entero: curvado daría la vuelta
       completa y sería ilegible. Va derecho, arriba. */
    if (abarca > 300) {
      var recto = crear('text', {
        x: CX, y: CY - r,
        class: 'porcion-nombre',
        fill: oscuro ? '#11081F' : '#FFFFFF',
        'text-anchor': 'middle',
        'dominant-baseline': 'central'
      });
      recto.textContent = titulo;
      gp.appendChild(recto);
      if (recto.getComputedTextLength() > 170) {
        recto.textContent = titulo.slice(0, 16) + '…';
      }
      return true;
    }

    var medio = (desde + hasta) / 2;
    var invertido = medio > 90 && medio < 270;
    var idRiel = 'riel-' + i + '-' + Math.random().toString(36).slice(2, 7);

    var camino = crear('path', {
      id: idRiel,
      d: riel(r, desde, hasta, invertido),
      fill: 'none'
    });
    defs.appendChild(camino);

    var texto = crear('text', {
      class: 'porcion-nombre',
      fill: oscuro ? '#11081F' : '#FFFFFF',
      dy: invertido ? -6 : 6
    });
    var tp = crear('textPath', {
      href: '#' + idRiel,
      startOffset: '50%',
      'text-anchor': 'middle'
    });
    tp.setAttribute('xlink:href', '#' + idRiel);
    texto.appendChild(tp);
    gp.appendChild(texto);

    var disponible = (abarca * Math.PI / 180) * r * 0.88;

    tp.textContent = titulo;
    var largo = texto.getComputedTextLength();
    var corte = titulo.length;

    while (largo > disponible && corte > 4) {
      corte = Math.max(4, Math.floor(corte * disponible / largo) - 1);
      tp.textContent = titulo.slice(0, corte) + '…';
      largo = texto.getComputedTextLength();
    }

    /* Recortado a menos de 6 letras el nombre ya no distingue nada
       ("Tare…", "Tare…", "Tare…"): mejor el número. */
    if (largo > disponible || (corte < titulo.length && corte < 6)) {
      texto.remove();
      camino.remove();
      return false;
    }
    return true;
  }

  /* Parte el título en hasta 2 renglones para el centro */
  function renglones(texto, porRenglon) {
    var palabras = texto.split(/\s+/);
    var lineas = [''];
    palabras.forEach(function (p) {
      var i = lineas.length - 1;
      if ((lineas[i] + ' ' + p).trim().length <= porRenglon) {
        lineas[i] = (lineas[i] + ' ' + p).trim();
      } else if (lineas.length < 2) {
        lineas.push(p);
      } else {
        lineas[1] = lineas[1].slice(0, porRenglon - 1) + '…';
      }
    });
    return lineas.filter(function (l) { return l.length > 0; });
  }

  /* ---------------------------------------------------------
     dibujar(svg, hijos, opciones)
       opciones: { onPorcion, onCentro, tituloCentro, porcentaje,
                   acento, pendientes }
     El centro SIEMPRE es un botón que abre la lista.
     Para subir de nivel están las migas de pan y la flecha de arriba.
     --------------------------------------------------------- */
  function dibujar(svg, hijos, opciones) {
    svg.innerHTML = '';

    var defs = crear('defs', {});
    svg.appendChild(defs);

    var g = crear('g', { class: 'dona-grupo' });
    svg.appendChild(g);

    /* --- sin nada activo: el anillo cambia según POR QUÉ está vacío --- */
    if (hijos.length === 0) {
      var terminado = opciones.porcentaje >= 0.999;
      g.appendChild(crear('circle', {
        cx: CX, cy: CY, r: (R_INT + R_EXT) / 2,
        fill: 'none',
        stroke: terminado ? 'var(--ok)' : 'var(--linea)',
        'stroke-width': R_EXT - R_INT,
        'stroke-dasharray': terminado ? null : '7 12',
        opacity: terminado ? '0.55' : '0.35'
      }));
    }

    var paso = hijos.length > 0 ? 360 / hijos.length : 0;
    var sep = hijos.length > 1 ? Math.min(SEPARACION, paso * 0.12) : 0;

    hijos.forEach(function (hijo, i) {
      var desde = i * paso + sep / 2;
      var hasta = (i + 1) * paso - sep / 2;
      var c = color(i);
      var p = Arbol.progreso(hijo);

      var gp = crear('g', {
        class: 'porcion',
        role: 'button',
        tabindex: '0',
        'aria-label': hijo.titulo + ', ' + Math.round(p * 100) + ' por ciento'
      });
      // Al DOM ya: getComputedTextLength() devuelve 0 si el elemento
      // todavía no está dentro del SVG renderizado.
      g.appendChild(gp);

      // fondo apagado: el hueco que falta llenar
      gp.appendChild(crear('path', {
        d: sector(R_INT, R_EXT, desde, hasta),
        fill: c,
        opacity: '0.22'
      }));

      // relleno real, creciendo de adentro hacia afuera
      if (p > 0) {
        var rLleno = R_INT + (R_EXT - R_INT) * p;
        gp.appendChild(crear('path', {
          class: 'relleno',
          d: sector(R_INT, rLleno, desde, hasta),
          fill: c
        }));
      }

      var entro = etiqueta(defs, gp, hijo.titulo, desde, hasta, i, p >= 0.6);

      if (!entro && hasta - desde > 11) {
        var m = punto((R_INT + R_EXT) / 2, (desde + hasta) / 2);
        var t = crear('text', {
          x: m.x.toFixed(1),
          y: m.y.toFixed(1),
          class: 'porcion-num',
          fill: p >= 0.6 ? '#11081F' : '#FFFFFF',
          'text-anchor': 'middle',
          'dominant-baseline': 'central'
        });
        t.textContent = String(i + 1);
        gp.appendChild(t);
      }

      gp.addEventListener('click', function () { opciones.onPorcion(hijo, i); });
      gp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          opciones.onPorcion(hijo, i);
        }
      });
    });

    /* --- centro: botón que abre la lista --- */
    var centro = crear('g', {
      class: 'centro centro-boton',
      role: 'button',
      tabindex: '0',
      'aria-label': 'Ver la lista de tareas de este nivel'
    });

    centro.appendChild(crear('circle', {
      cx: CX, cy: CY, r: R_INT - 5,
      fill: 'var(--centro)',
      stroke: opciones.acento || 'var(--linea)',
      'stroke-width': '2.5'
    }));

    var pct = crear('text', {
      x: CX, y: CY - 12,
      class: 'centro-pct',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      fill: opciones.acento || 'var(--texto)'
    });
    pct.textContent = Math.round(opciones.porcentaje * 100) + '%';
    centro.appendChild(pct);

    var verLista = crear('text', {
      x: CX, y: CY + 20,
      class: 'centro-accion',
      'text-anchor': 'middle',
      'dominant-baseline': 'central'
    });
    verLista.textContent = 'ver lista';
    centro.appendChild(verLista);

    /* puntitos: avisan que hay cosas en cola o hechas escondidas */
    if (opciones.pendientes > 0) {
      centro.appendChild(crear('circle', {
        cx: CX, cy: CY + 38, r: 3.5,
        fill: 'var(--texto-suave)', opacity: '0.8'
      }));
    }

    centro.addEventListener('click', opciones.onCentro);
    centro.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        opciones.onCentro();
      }
    });

    g.appendChild(centro);
  }

  return {
    dibujar: dibujar,
    color: color,
    renglones: renglones,
    COLORES: COLORES
  };

})();
