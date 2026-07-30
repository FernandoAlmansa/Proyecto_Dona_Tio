/* ============================================================
   dona.js — dibuja la dona en SVG. Sin librerías.

   Cada porción de la dona es una subtarea del nivel donde estás.
   La porción se LLENA DE ADENTRO HACIA AFUERA a medida que se
   completan sus propias subtareas: cuando llega al borde, esa
   rama entera está terminada.
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

  var CX = 160, CY = 160;      // centro del lienzo
  var R_INT = 96, R_EXT = 150; // radios del anillo
  var SEPARACION = 2;          // grados de aire entre porciones

  function color(i) {
    return COLORES[i % COLORES.length];
  }

  /* Polar -> cartesiano. El -90 es para que el 0° quede arriba
     (si no, arrancaría a las 3 en punto). */
  function punto(r, grados) {
    var rad = (grados - 90) * Math.PI / 180;
    return {
      x: CX + r * Math.cos(rad),
      y: CY + r * Math.sin(rad)
    };
  }

  /* El path de un sector de anillo: arco externo, línea hacia
     adentro, arco interno de vuelta, cerrar. */
  function sector(rInt, rExt, desde, hasta) {
    if (hasta - desde >= 360) hasta = desde + 359.99;  // círculo completo
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

  /* Un arco simple (sin grosor) que sirve de riel para el texto.
     Si la porción cae en la mitad de abajo, lo recorremos al revés:
     si no, el nombre saldría cabeza abajo. */
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

  /* Etiqueta de la porción: el nombre siguiendo la curva.
     Se mide de verdad con getComputedTextLength() y se va recortando
     hasta que entra. Si ni así entra, devuelve null y el que llama
     pone el número. */
  function etiqueta(svg, defs, gp, titulo, desde, hasta, i, oscuro) {
    var r = (R_INT + R_EXT) / 2;
    var abarca = Math.abs(hasta - desde);

    /* Una sola tarea ocupa el anillo entero: si le curvamos el nombre,
       da la vuelta completa y no se lee. Va derecho, arriba de todo. */
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
      if (recto.getComputedTextLength() > 150) {
        recto.textContent = titulo.slice(0, 18) + '…';
      }
      return true;
    }

    var invertido = ((desde + hasta) / 2) > 90 && ((desde + hasta) / 2) < 270;
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
      dy: invertido ? -5 : 5
    });
    var tp = crear('textPath', {
      href: '#' + idRiel,
      startOffset: '50%',
      'text-anchor': 'middle'
    });
    tp.setAttribute('xlink:href', '#' + idRiel);   // navegadores viejos
    texto.appendChild(tp);
    gp.appendChild(texto);

    // largo disponible sobre el arco, con un margen para que no toque los bordes
    var disponible = (abarca * Math.PI / 180) * r * 0.86;

    tp.textContent = titulo;
    var largo = texto.getComputedTextLength();
    var corte = titulo.length;

    while (largo > disponible && corte > 4) {
      corte = Math.max(4, Math.floor(corte * disponible / largo) - 1);
      tp.textContent = titulo.slice(0, corte) + '…';
      largo = texto.getComputedTextLength();
    }

    /* Si hubo que recortar tanto que quedaron menos de 6 letras, el nombre
       ya no distingue nada ("Tare…", "Tare…", "Tare…"): en ese caso conviene
       el número, que al menos se corresponde con la fila de la lista. */
    if (largo > disponible || (corte < titulo.length && corte < 6)) {
      texto.remove();
      camino.remove();
      return false;
    }
    return true;
  }

  /* Parte el título en un máximo de 2 renglones para el centro */
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
     dibujar(svg, nodo, opciones)
       nodo    : la tarea en la que estás parado (o null = raíz)
       hijos   : las tareas de este nivel
       opciones: { onPorcion, onCentro, tituloCentro, esRaiz }
     --------------------------------------------------------- */
  function dibujar(svg, hijos, opciones) {
    svg.innerHTML = '';

    // acá guardamos los arcos invisibles que le sirven de guía al texto
    var defs = crear('defs', {});
    svg.appendChild(defs);

    var g = crear('g', { class: 'dona-grupo' });
    svg.appendChild(g);

    /* --- caso vacío: anillo punteado invitando a agregar --- */
    if (hijos.length === 0) {
      g.appendChild(crear('circle', {
        cx: CX, cy: CY, r: (R_INT + R_EXT) / 2,
        fill: 'none',
        stroke: 'var(--linea)',
        'stroke-width': R_EXT - R_INT,
        'stroke-dasharray': '6 10',
        opacity: '0.35'
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
      // Va al DOM ya, porque getComputedTextLength() más abajo devuelve 0
      // si el elemento todavía no está dentro del SVG renderizado.
      g.appendChild(gp);

      // fondo apagado: el "hueco" que falta llenar
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

      // El nombre sobre el arco. Si la porción es muy finita para que
      // entre aunque sea recortado, cae al número, que sigue estando
      // en la fila de la lista para poder atar una cosa con la otra.
      var entro = etiqueta(svg, defs, gp, hijo.titulo, desde, hasta, i, p >= 0.6);

      if (!entro && hasta - desde > 12) {
        var medio = punto((R_INT + R_EXT) / 2, (desde + hasta) / 2);
        var t = crear('text', {
          x: medio.x.toFixed(1),
          y: medio.y.toFixed(1),
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

    /* --- centro --- */
    var centro = crear('g', {
      class: 'centro' + (opciones.esRaiz ? '' : ' centro-clickable'),
      role: opciones.esRaiz ? null : 'button',
      tabindex: opciones.esRaiz ? null : '0',
      'aria-label': opciones.esRaiz ? null : 'Volver un nivel'
    });

    centro.appendChild(crear('circle', {
      cx: CX, cy: CY, r: R_INT - 8,
      fill: 'var(--centro)',
      stroke: opciones.acento || 'var(--linea)',
      'stroke-width': '2'
    }));

    var lineas = renglones(opciones.tituloCentro, 14);
    var yBase = lineas.length === 2 ? CY - 26 : CY - 18;

    lineas.forEach(function (linea, i) {
      var t = crear('text', {
        x: CX, y: yBase + i * 20,
        class: 'centro-titulo',
        'text-anchor': 'middle',
        'dominant-baseline': 'central'
      });
      t.textContent = linea;
      centro.appendChild(t);
    });

    var pct = crear('text', {
      x: CX, y: CY + 22,
      class: 'centro-pct',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      fill: opciones.acento || 'var(--texto)'
    });
    pct.textContent = Math.round(opciones.porcentaje * 100) + '%';
    centro.appendChild(pct);

    if (!opciones.esRaiz) {
      var volver = crear('text', {
        x: CX, y: CY + 50,
        class: 'centro-volver',
        'text-anchor': 'middle',
        'dominant-baseline': 'central'
      });
      volver.textContent = '↑ volver';
      centro.appendChild(volver);

      centro.addEventListener('click', opciones.onCentro);
      centro.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          opciones.onCentro();
        }
      });
    }

    g.appendChild(centro);
  }

  return {
    dibujar: dibujar,
    color: color,
    COLORES: COLORES
  };

})();
