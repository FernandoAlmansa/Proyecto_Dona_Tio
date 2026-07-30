/* ============================================================
   arbol.js — la lógica de la muñeca rusa.

   Supabase devuelve una lista plana de filas. Acá la convertimos
   en un árbol y calculamos cuánto está hecho de cada rama.
   Sin dependencias, sin frameworks: matemática y recursión.
   ============================================================ */

var Arbol = (function () {

  /* Lista plana  ->  árbol.
     Recorremos una sola vez armando un índice por id, y una segunda
     vez colgando cada tarea de su padre. O(n), no O(n²). */
  function construir(filas) {
    var indice = {};
    var raices = [];

    filas.forEach(function (f) {
      indice[f.id] = {
        id: f.id,
        titulo: f.titulo,
        hecho: f.hecho,
        padre_id: f.padre_id,
        orden: f.orden,
        hijos: []
      };
    });

    filas.forEach(function (f) {
      var nodo = indice[f.id];
      if (f.padre_id && indice[f.padre_id]) {
        indice[f.padre_id].hijos.push(nodo);
      } else {
        raices.push(nodo);
      }
    });

    return { raices: raices, indice: indice };
  }

  /* EL corazón del asunto.

     - Una tarea SIN hijos vale 1 si está tildada, 0 si no.
     - Una tarea CON hijos vale el promedio de sus hijos.

     Consecuencia directa: una tarea con subtareas nunca se marca
     a mano. Se completa sola, y solo cuando TODAS sus subtareas
     (y las subtareas de sus subtareas) están completas.
     Eso es la muñeca rusa, en cinco líneas. */
  function progreso(nodo) {
    if (nodo.hijos.length === 0) {
      return nodo.hecho ? 1 : 0;
    }
    var suma = nodo.hijos.reduce(function (acc, h) {
      return acc + progreso(h);
    }, 0);
    return suma / nodo.hijos.length;
  }

  function completa(nodo) {
    return progreso(nodo) >= 0.999;
  }

  /* Cuántas tareas hay colgando en total (para el aviso al borrar) */
  function contarDescendientes(nodo) {
    return nodo.hijos.reduce(function (acc, h) {
      return acc + 1 + contarDescendientes(h);
    }, 0);
  }

  /* Camino desde la raíz hasta un nodo, para las migas de pan */
  function camino(indice, id) {
    var ruta = [];
    var actual = indice[id];
    while (actual) {
      ruta.unshift(actual);
      actual = actual.padre_id ? indice[actual.padre_id] : null;
    }
    return ruta;
  }

  return {
    construir: construir,
    progreso: progreso,
    completa: completa,
    contarDescendientes: contarDescendientes,
    camino: camino
  };

})();
