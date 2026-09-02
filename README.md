# Kogu Asistencias — Frontend

Frontend HTML + CSS + JavaScript (vanilla) de la plataforma de gestión de asistencias por siniestros automotrices.

## Estructura
- `index.html` — Login
- `bandeja.html`, `detalle.html`, `dashboard.html`, `nuevo-caso.html` — Pantallas principales
- `catalogos/`, `usuarios/` — Pantallas de administración
- `js/` — Servicios, páginas y utilidades
- `styles/` — Hoja de estilos

## Backend
Consume el API `kogu-asistencias-api`. La URL base del API se configura en `js/config.js`.

## Ejecución local
Abrir `index.html` con un servidor estático (p. ej. `python3 -m http.server 5500`) y navegar a http://localhost:5500.

Usa el puerto **5500**: es el que el `CORS_ORIGINS` del API permite. Desde otro
puerto el navegador rechaza las respuestas.

## Publicar una versión

No hay paso de build, y cPanel sirve los estáticos con caducidad larga: sin
versión en la URL, un despliegue **no llega** al navegador de quien ya visitó el
sitio hasta que su caché expire sola. Pasó el 2026-09-02 — tras subir Bf-07 y
Bf-08 una consola seguía cargando el `catalogos.service.js` de julio y lanzaba
`catalogosService.getRoles is not a function`, con el código y el servidor
correctos. Por eso cada `<script src>` y `<link href>` propio lleva `?v=<versión>`.

La **fuente única** de ese número es el badge del pie de `index.html`
(`v1.2 · Promotoría P2`). Para publicar:

1. **Subir el número** en el badge y en las 247 etiquetas. El script lo hace y es
   idempotente (reemplaza el `?v=` existente, no encadena otro):

   ```bash
   python3 scripts/versionar-assets.py 1.3        # --dry para solo informar
   sed -i '' 's/v1\.2 · Promotoría/v1.3 · Promotoría/' index.html
   ```

   Solo toca rutas propias (`/js/`, `/styles/`): nunca CDNs, rutas externas ni
   `<script>` inline, y no altera el orden de carga, que es significativo
   (config → api → servicios → utils → sidebar → auth.guard → pages).

2. **Commit y push a `main`.**

3. En cPanel → *Git Version Control* → **Update from Remote**. Eso es todo: el
   Document Root de `cotizador.kogu.ink` **es** el repositorio, no hay copia
   intermedia y **no debe existir un `.cpanel.yml`**.

4. **Abrir el sitio y mirar el pie.** Si muestra la versión nueva, el navegador
   cargó el `index.html` nuevo — y ese index pide los assets con la query nueva,
   así que los assets nuevos también entraron. El badge es la prueba del
   despliegue: un vistazo, sin incógnito ni DevTools.

Para comprobar que no quedó ninguna etiqueta fuera (una sola sin versionar
reintroduce el problema en ese archivo):

```bash
grep -roh 'src="/js/[^"]*"\|href="/styles/[^"]*"' --include="*.html" . | grep -c '?v='   # debe dar 247
grep -roh 'src="/js/[^"]*"\|href="/styles/[^"]*"' --include="*.html" . | grep -vc '?v='  # debe dar 0
```
