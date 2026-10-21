# Portal de recursos Éxito — versión lista para Vercel

Esta versión usa **Vercel para publicar la web** y **Supabase para guardar archivos y datos en la nube**. No usa SQLite ni carpetas locales, porque esos datos no persisten de forma fiable en Vercel.

## Antes de desplegar (10–15 minutos)

### 1. Crear el proyecto de almacenamiento
1. Entra a https://supabase.com y crea un proyecto.
2. Abre **SQL Editor → New query**, pega el contenido de `supabase/setup.sql` y pulsa **Run**.
3. Abre **Storage → New bucket**. Crea un bucket llamado exactamente `portal-archivos` y marca **Public bucket**.
4. Si el SQL no creó las políticas de Storage por permisos, ejecuta de nuevo en SQL Editor solo el bloque de políticas de Storage al final de `supabase/setup.sql`.
5. En **Project Settings → API** (o Connect), copia la **Project URL** y la clave **publishable/anon**. Nunca uses una `service_role` o una clave secreta en el navegador.

### 2. Poner las credenciales públicas
Abre `public/js/config.js` y reemplaza los dos textos de ejemplo:
- `PEGA_AQUI_LA_URL_DE_TU_PROYECTO_SUPABASE` por la URL del proyecto.
- `PEGA_AQUI_TU_CLAVE_PUBLICABLE_O_ANON` por la clave publicable/anon.

Guarda el archivo. Esas credenciales son públicas por diseño; las políticas SQL habilitan el acceso de demostración.

### 3. Publicar en Vercel
**Método más fácil:**
1. Sube la carpeta del proyecto a un repositorio GitHub.
2. Entra a https://vercel.com → **Add New → Project** e importa el repositorio.
3. Framework Preset: **Other**. Build Command: vacío. Output Directory: `public`.
4. Pulsa **Deploy**. Vercel te dará una URL pública.

También puedes importar el ZIP a GitHub tras descomprimirlo. El `index.html` está en `public/`, por lo que debes establecer `public` como directorio de salida.

## Qué incluye
- Diseño adaptable para escritorio, tablet y móvil.
- Galería de imágenes y vista de PDF.
- Carga de JPG, PNG, WebP, GIF y PDF (máximo 15 MB por archivo).
- Categorías, búsqueda y eliminación.
- Persistencia en Supabase compartida entre visitantes.

## Aviso importante de privacidad
Esta configuración es **una demo pública sin inicio de sesión**: cualquier persona con el enlace puede ver, subir, crear categorías y borrar archivos; los archivos del bucket son públicos. No subas información interna, datos personales ni documentos confidenciales de Éxito. Para uso real de empresa hay que añadir autenticación y políticas por usuario/rol, y usar almacenamiento privado con enlaces firmados.

## Si algo falla
- `Invalid API key` / `Failed to fetch`: revisa URL y clave en `public/js/config.js`.
- `Bucket not found`: comprueba que el bucket se llame exactamente `portal-archivos`.
- `row-level security policy` / `permission denied`: vuelve a ejecutar `supabase/setup.sql` y confirma que las políticas estén activas.
- Los archivos de una web pública no pueden protegerse solo ocultando botones; si son confidenciales, no publiques esta demo abierta.
