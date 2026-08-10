# Dona de tareas

Organizador de tareas con subtareas anidadas, en forma de dona. Es una PWA:
se abre en el navegador, se instala como app en el celular y sincroniza entre
todos los dispositivos.

**Una tarea con subtareas no se marca a mano.** Se completa sola cuando todas
sus subtareas están completas, y las de ellas también. Eso es la muñeca rusa.

## Los tres estados

Cada tarea vive en uno de tres lugares:

| Estado | ¿Se dibuja en la dona? | ¿Cuenta para el progreso? |
|---|---|---|
| **En cola** — anotada para más adelante | no | **no** |
| **En la dona** — el trabajo de ahora | sí | sí |
| **Hecha** — terminada | no | **sí, como 1** |

Las dos casillas raras son las que hacen que todo funcione:

- **La cola no cuenta** porque no es trabajo comprometido todavía. Si contara,
  anotar cinco ideas para el mes que viene te bajaría el progreso de hoy.
- **Las hechas sí cuentan** aunque no se dibujen. Si dejaran de contar, al
  terminar la última subtarea el padre se quedaría sin hijos, volvería a ser
  una hoja sin tildar y su progreso caería a cero. **Salen de la vista, no de
  la cuenta.**

Cuando una tarea llega al 100% se archiva sola y desaparece de la dona. Si la
reactivás desde la pestaña *Hechas*, vuelve y **no** se re-archiva: el código
compara el progreso de antes y el de después, y solo archiva lo que *cruzó* el
100% con ese cambio. Una tarea que ya estaba en 100% no cruzó nada.

Una excepción: un padre que llega al 100% pero todavía tiene subtareas **en
cola** no se archiva. Sigue en la dona avisándote que ahí queda algo planeado.

---

## Cómo se usa

- La pantalla principal es **solo la dona**. Cada porción es una tarea.
- Tocás una porción y entrás adentro: ahora la dona muestra sus subtareas.
- El **centro es un botón**: abre la lista del nivel donde estás, con tres
  pestañas (En la dona / En cola / Hechas).
- **← Volver** arriba a la izquierda, o las migas de pan, para subir un nivel.
- Al agregar, elegís si va **a la dona** o **a la cola**.
- El puntito abajo del "ver lista" avisa que hay algo guardado en la cola o en
  las hechas de ese nivel.

## Archivos

```
index.html                     la app
css/estilos.css                estilos
js/config.js                   ← EL ÚNICO QUE TENÉS QUE EDITAR
js/db.js                       todo lo que habla con Supabase
js/arbol.js                    árbol de tareas + cálculo de progreso
js/dona.js                     dibujo de la dona en SVG
js/app.js                      pantallas, navegación, diálogos
manifest.json                  para que Android la instale como app
sw.js                          service worker (funciona sin internet)
icons/                         íconos de la app
supabase/schema.sql            ← ESTO VA A SUPABASE (proyecto nuevo)
supabase/migracion-v2.sql      ← si ya tenías la tabla de antes
.github/workflows/mantener-viva.yml   ping diario anti-pausa
```

---

## Paso 1 — Supabase

1. Entrá a [supabase.com](https://supabase.com) → **New project**.
   Elegí la región **South America (São Paulo)**: es la más cercana y se nota
   en la velocidad. Guardá la contraseña de la base que te pide (no es la de
   tu tío, es la de administración; no va en ningún lado del código).

   En la sección **Security** de esa misma pantalla:

   | Opción | |
   |---|---|
   | Enable Data API | ✅ **sí** — es por donde habla `supabase-js` |
   | Automatically expose new tables | ❌ **no** — los permisos los da el `schema.sql` a mano |
   | Enable automatic RLS | ✅ **sí** — red de seguridad para tablas futuras |

   Si ya creaste el proyecto con la segunda tildada, la cambiás después en
   **Project Settings → Data API**. El `schema.sql` funciona igual con
   cualquiera de las dos, porque los grants están escritos explícitamente.

2. Cuando termine de crearse, andá a **SQL Editor** → **New query**, pegá
   **todo** el contenido de `supabase/schema.sql` y dale **Run**.
   Tiene que decir *Success*.

   **¿Ya tenías la tabla creada con la versión anterior?** No corras
   `schema.sql` de nuevo: usá `supabase/migracion-v2.sql`, que agrega la
   columna `estado`, pasa lo que había (lo tildado → `hecha`, el resto →
   `activa`) y saca la columna `hecho`. Se puede correr dos veces sin romper
   nada.

3. **Creá el usuario de tu tío a mano:**
   **Authentication** → **Users** → **Add user** → *Create new user*.
   - Email: el mail de tu tío (o uno que le hagas, no necesita ser real
     mientras te acuerdes cuál es).
   - Password: una que se pueda escribir en un celular sin sufrir.
   - ✅ Tildá **Auto Confirm User**.

4. **Cerrá el registro público:**
   **Authentication** → **Sign In / Providers** → **Email** →
   desactivá **Allow new users to sign up**.

   Esto importa: si queda abierto, cualquiera que encuentre tu URL puede
   crearse una cuenta en tu proyecto. No vería las tareas de tu tío (la RLS
   lo impide), pero te llenaría la base de usuarios. Con el registro cerrado,
   los únicos usuarios son los que creás vos desde el panel.

5. **Copiá las dos credenciales:**
   **Project Settings** → **Data API**
   - *Project URL* → va en `SUPABASE_URL`
   - la clave **anon** / *publishable* → va en `SUPABASE_KEY`

---

## Paso 2 — Configurar la app

Abrí `js/config.js` y reemplazá los dos valores:

```js
var CONFIG = {
  SUPABASE_URL: 'https://abcdefgh.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOi...'
};
```

> **La clave anon es pública y está bien que lo sea.** Va a quedar visible en
> GitHub y cualquiera puede leerla. Lo que protege los datos no es esconderla,
> es la RLS del paso 1.
>
> **Lo que NUNCA va acá** es la clave `service_role` (aparece como *secret* en
> el panel). Esa saltea la RLS entera. Si se te escapa a un repo público,
> cualquiera puede leer y borrar todo. Esa clave no sale de tu máquina.

---

## Paso 3 — Subirlo a GitHub Pages

```bash
cd dona-tareas
git init
git add .
git commit -m "Dona de tareas"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/dona-tareas.git
git push -u origin main
```

Después, en el repo: **Settings** → **Pages** →
*Source*: **Deploy from a branch** → rama `main`, carpeta `/ (root)` → **Save**.

En un par de minutos queda en:
`https://TU-USUARIO.github.io/dona-tareas/`

---

## Paso 4 — Instalarla en el celular de tu tío

1. Mandale el link por WhatsApp.
2. Que lo abra **con Chrome** (importante: si lo abre dentro de WhatsApp no
   le va a aparecer la opción de instalar). En el navegador de WhatsApp hay
   un menú `⋮` → *Abrir en el navegador*.
3. Menú `⋮` de Chrome → **Instalar aplicación** (o *Agregar a pantalla principal*).
4. Le queda el ícono en el escritorio. Se abre en pantalla completa, sin barra
   de navegador.
5. Entra con el mail y la contraseña **una sola vez**. La sesión queda guardada
   y se renueva sola: no la vuelve a ver.

Repetí el paso en cada dispositivo donde quiera verla. Los datos son los mismos
en todos, y se actualizan en vivo: si tilda algo en el celular, la tablet se
entera en un segundo.

---

## Paso 5 — Que Supabase no se duerma

Los proyectos del plan gratis **se pausan a los 7 días sin actividad**. Los
datos no se pierden, pero la app deja de responder hasta que la reactivás a
mano desde el panel. Si tu tío la usa todos los días no pasa nunca — pero un
viaje de dos semanas alcanza.

El workflow `.github/workflows/mantener-viva.yml` manda un ping por día. Para
activarlo, cargá dos secretos en el repo:

**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Nombre | Valor |
|---|---|
| `SUPABASE_URL` | el mismo de `config.js` |
| `SUPABASE_ANON_KEY` | el mismo de `config.js` |

> GitHub desactiva los workflows programados si el repo pasa 60 días sin
> commits. Si dejás el proyecto quieto mucho tiempo, entrá a la pestaña
> **Actions** y reactivalo.

---

## Chequeo de seguridad

Antes de darlo por terminado, verificá que la RLS esté haciendo su trabajo.
Desde tu terminal, pedile los datos a Supabase **sin estar logueado**:

```bash
curl "https://TU-PROYECTO.supabase.co/rest/v1/tareas?select=*" \
  -H "apikey: TU_ANON_KEY"
```

Cualquiera de estas dos respuestas está bien:

- `{"code":"42501", "message":"permission denied for table tareas"}` — el rol
  `anon` ni siquiera tiene permiso para tocar la tabla. Es el resultado
  esperado si destildaste *Automatically expose new tables*. Es el más seguro
  de los dos: corta antes de llegar a la RLS.
- `[]` — una lista vacía. El rol `anon` puede consultar la tabla, pero la RLS
  no le deja ver ninguna fila porque no hay sesión.

**Lo que NO puede pasar es que te devuelva las tareas.** Si las ves, la RLS no
está activa y cualquiera con la key puede leer todo. Volvé al SQL Editor y
corré de nuevo la parte 3 del `schema.sql`.

Repaso de lo que protege qué:

| | |
|---|---|
| **Grants solo a `authenticated`** | Sin sesión no se puede ni consultar la tabla; `anon` no tiene permiso sobre ella |
| **RLS + políticas** | Ya con sesión, nadie ve ni toca filas que no sean suyas |
| **Trigger `validar_padre`** | Nadie puede colgar una tarea del árbol de otro usuario |
| **Registro público cerrado** | Los usuarios los creás solo vos, desde el panel |
| **Solo la clave `anon` en el código** | Aunque la lean, sin sesión no sirve para nada |
| **HTTPS de GitHub Pages** | La contraseña viaja cifrada |

---

## Cómo actualizar la app después

Cambiás lo que sea, y **antes de subir, subí el número de versión** en `sw.js`:

```js
var VERSION = 'dona-v2';   // era dona-v1
```

Si no lo hacés, los teléfonos siguen usando la copia vieja que tienen
guardada. Después:

```bash
git add .
git commit -m "qué cambiaste"
git push
```

Tu tío no tiene que hacer nada: la próxima vez que abra la app, se actualiza sola.

---

## Si algo no anda

**Aparece "Falta configurar"** → no editaste `js/config.js`.

**"El mail o la contraseña no coinciden"** → revisá en *Authentication → Users*
que el usuario esté ahí y con *Confirmed* en verde.

**Entra pero no aparece ninguna tarea y no puede agregar** → la RLS está
rechazando la escritura. Verificá que el SQL haya corrido completo, sobre todo
la política `crear solo lo propio`.

**Dice "Sin conexión" con internet andando** → lo más probable es que el
proyecto de Supabase esté pausado. Entrá al panel y dale *Restore*.

**Cambiaste el código y no se ve el cambio** → no subiste `VERSION` en `sw.js`.

---

## Qué agregarle más adelante

- Reordenar tareas arrastrando (ya existe la columna `orden`).
- Fechas de vencimiento (una columna `vence` y un aviso en la fila).
- Notificaciones (las PWA en Android las soportan).
- Exportar todo a un archivo, por si quiere una copia aparte.
