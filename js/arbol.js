/* ============================================================
   arbol.js — la lógica de la muñeca rusa.

   Supabase devuelve una lista plana de filas. Acá la convertimos
   en un árbol y calculamos cuánto está hecho de cada rama.
   Sin dependencias, sin frameworks: matemática y recursión.

   LOS TRES ESTADOS
   ----------------
   'cola'   : anotada para más adelante. No se dibuja y NO cuenta
              para el progreso. Es backlog, no trabajo comprometido.
   'activa' : está en la dona.
   'hecha'  : terminada. NO se dibuja, pero SÍ cuenta como 1.

   Ese último punto es el que sostiene todo. Si una tarea terminada
   dejara de contar, al completar el último hijo el padre se
   quedaría sin hijos, volvería a ser una hoja sin tildar y su
   progreso caería a cero. Sale de la vista, no de la cuenta.
   ============================================================ */

var Arbol = (function () {

  /* Lista plana  ->  árbol.
     Un recorrido para indexar por id, otro para colgar cada tarea
     de su padre. O(n), no O(n²). */
  function construir(filas) {
    var indice = {};
    var raices = [];

    filas.forEach(function (f) {
      indice[f.id] = {
        id: f.id,
        titulo: f.titulo,
        estado: f.estado || 'activa',
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

  /* Los hijos que participan del progreso: todos menos los de la cola. */
  function hijosQueCuentan(nodo) {
    return nodo.hijos.filter(function (h) { return h.estado !== 'cola'; });
  }

  /* Los que se dibujan en la dona: solo los activos. */
  function hijosActivos(nodo) {
    return nodo.hijos.filter(function (h) { return h.estado === 'activa'; });
  }

  function hijosEnCola(nodo) {
    return nodo.hijos.filter(function (h) { return h.estado === 'cola'; });
  }

  function hijosHechos(nodo) {
    return nodo.hijos.filter(function (h) { return h.estado === 'hecha'; });
  }

  /* EL corazón del asunto.

     - Sin hijos que cuenten  -> vale 1 si está hecha, 0 si no.
     - Con hijos que cuenten  -> el promedio de esos hijos.

     Consecuencia: una tarea con subtareas nunca se marca a mano.
     Se completa sola, y solo cuando TODAS sus subtareas (y las
     subtareas de sus subtareas) están completas. */
  function progreso(nodo) {
    var cuentan = hijosQueCuentan(nodo);

    if (cuentan.length === 0) {
      return nodo.estado === 'hecha' ? 1 : 0;
    }

    var suma = cuentan.reduce(function (acc, h) {
      return acc + progreso(h);
    }, 0);
    return suma / cuentan.length;
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

  /* Foto del progreso de todos los nodos, para comparar antes/después.
     Sirve para detectar qué tareas CRUZARON el 100% con el último
     cambio: esas son las que se archivan solas.

     Comparar antes vs. después (en lugar de mirar solo el después) es
     lo que permite reactivar una tarea terminada sin que se archive
     de nuevo al instante: ya estaba en 100%, no cruzó nada. */
  function foto(indice) {
    var f = {};
    Object.keys(indice).forEach(function (id) {
      f[id] = progreso(indice[id]) >= 0.999;
    });
    return f;
  }

  /* Ids que pasaron de incompletos a completos entre las dos fotos,
     siguen activos y no tienen nada pendiente en la cola. */
  function cruzaronEl100(antes, despues, indice) {
    return Object.keys(despues).filter(function (id) {
      var n = indice[id];
      return despues[id] &&
             !antes[id] &&
             n &&
             n.estado === 'activa' &&
             hijosEnCola(n).length === 0;
    });
  }

  return {
    construir: construir,
    progreso: progreso,
    completa: completa,
    hijosActivos: hijosActivos,
    hijosEnCola: hijosEnCola,
    hijosHechos: hijosHechos,
    hijosQueCuentan: hijosQueCuentan,
    contarDescendientes: contarDescendientes,
    camino: camino,
    foto: foto,
    cruzaronEl100: cruzaronEl100
  };

})();
