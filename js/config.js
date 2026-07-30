/* ============================================================
   CONFIGURACIÓN — el único archivo que tenés que editar
   ============================================================

   Los dos valores salen de:
   Supabase → tu proyecto → Project Settings → Data API

   - SUPABASE_URL  = "Project URL"
   - SUPABASE_KEY  = la clave "anon" / "publishable"

   ⚠️ IMPORTANTE
   La clave anon es PÚBLICA por diseño: va a quedar visible en
   GitHub y cualquiera puede leerla. Eso está bien y no es un
   descuido — la seguridad la da la RLS que activaste en el SQL.

   ❌ NUNCA pongas acá la clave "service_role" (o "secret").
      Esa saltea la RLS entera y le da control total a cualquiera
      que la encuentre. Esa clave no sale nunca de tu máquina.
   ============================================================ */

var CONFIG = {
  SUPABASE_URL: 'https://konqrkyyfmxrqkwqinji.supabase.co',
  SUPABASE_KEY: 'sb_publishable_WWMEke2HtR3KSQYXtLXHEg_8VBqehkn'
};
