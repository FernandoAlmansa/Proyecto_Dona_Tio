/* ============================================================
   db.js — todo lo que habla con Supabase vive acá adentro.

   El resto de la app no sabe que existe Supabase: solo llama a
   DB.listar(), DB.crear(), etc. Si algún día cambiás de backend,
   reescribís este archivo y no tocás una línea de los demás.
   ============================================================ */

var DB = (function () {

  var cliente = null;
  var CLAVE_COPIA = 'dona_tareas_copia';   // copia local para modo sin conexión

  function conectar() {
    if (cliente) return cliente;
    cliente = window.supabase.createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_KEY,
      {
        auth: {
          persistSession: true,      // guarda la sesión en el teléfono
          autoRefreshToken: true     // la renueva sola: se loguea UNA vez
        }
      }
    );
    return cliente;
  }

  /* ---------------------------------------------------------
     SESIÓN
     --------------------------------------------------------- */

  async function sesionActual() {
    var r = await conectar().auth.getSession();
    return r.data.session;
  }

  async function entrar(email, password) {
    var r = await conectar().auth.signInWithPassword({
      email: email.trim(),
      password: password
    });
    if (r.error) throw r.error;
    return r.data.session;
  }

  async function salir() {
    localStorage.removeItem(CLAVE_COPIA);
    await conectar().auth.signOut();
  }

  function alCambiarSesion(fn) {
    conectar().auth.onAuthStateChange(function (evento, sesion) {
      fn(sesion);
    });
  }

  /* ---------------------------------------------------------
     TAREAS
     --------------------------------------------------------- */

  // Trae TODAS las tareas del usuario de una sola vez.
  // Son pocas (decenas, capaz cientos): traer todo y armar el árbol
  // en el teléfono es más simple y más rápido que ir pidiendo por nivel.
  async function listar() {
    var r = await conectar()
      .from('tareas')
      .select('id, padre_id, titulo, estado, orden, creado_en')
      .order('orden', { ascending: true })
      .order('creado_en', { ascending: true });

    if (r.error) throw r.error;

    guardarCopia(r.data);
    return r.data;
  }

  async function crear(titulo, padreId, orden, estado) {
    var sesion = await sesionActual();
    if (!sesion) throw new Error('Sin sesión');

    var r = await conectar()
      .from('tareas')
      .insert({
        titulo: titulo.trim(),
        padre_id: padreId || null,
        orden: orden || 0,
        estado: estado || 'activa',
        user_id: sesion.user.id
      })
      .select()
      .single();

    if (r.error) throw r.error;
    return r.data;
  }

  // 'cola' | 'activa' | 'hecha'
  async function cambiarEstado(id, estado) {
    var r = await conectar()
      .from('tareas')
      .update({ estado: estado })
      .eq('id', id);
    if (r.error) throw r.error;
  }

  // Varias de una: al archivar en cascada evita ir de a una request.
  async function cambiarEstadoVarias(ids, estado) {
    if (!ids.length) return;
    var r = await conectar()
      .from('tareas')
      .update({ estado: estado })
      .in('id', ids);
    if (r.error) throw r.error;
  }

  async function renombrar(id, titulo) {
    var r = await conectar()
      .from('tareas')
      .update({ titulo: titulo.trim() })
      .eq('id', id);
    if (r.error) throw r.error;
  }

  // El "on delete cascade" del SQL se encarga de hijos, nietos, etc.
  async function borrar(id) {
    var r = await conectar().from('tareas').delete().eq('id', id);
    if (r.error) throw r.error;
  }

  /* ---------------------------------------------------------
     SINCRONIZACIÓN EN VIVO
     --------------------------------------------------------- */

  function escucharCambios(fn) {
    return conectar()
      .channel('tareas-en-vivo')
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'tareas' },
          function () { fn(); })
      .subscribe();
  }

  /* ---------------------------------------------------------
     COPIA LOCAL (modo sin conexión, solo lectura)
     --------------------------------------------------------- */

  function guardarCopia(filas) {
    try {
      localStorage.setItem(CLAVE_COPIA, JSON.stringify({
        cuando: Date.now(),
        filas: filas
      }));
    } catch (e) { /* si no hay espacio, seguimos igual */ }
  }

  function leerCopia() {
    try {
      var crudo = localStorage.getItem(CLAVE_COPIA);
      return crudo ? JSON.parse(crudo) : null;
    } catch (e) { return null; }
  }

  return {
    sesionActual: sesionActual,
    entrar: entrar,
    salir: salir,
    alCambiarSesion: alCambiarSesion,
    listar: listar,
    crear: crear,
    cambiarEstado: cambiarEstado,
    cambiarEstadoVarias: cambiarEstadoVarias,
    renombrar: renombrar,
    borrar: borrar,
    escucharCambios: escucharCambios,
    leerCopia: leerCopia
  };

})();
