# Bf-09 — Versionado de assets para que un deploy llegue al navegador

**Repo:** `sergio0989/asistencia_kogu_front`
**Tamaño:** pequeño y mecánico · **Sin cambios de comportamiento**
**Estado:** abierto

---

## Por qué

El front no tiene build y los `<script src>` / `<link href>` no llevan versión ni hash.
Apache en cPanel sirve esos estáticos con caducidad larga, así que **un despliegue no
llega al navegador de un usuario que ya visitó el sitio** hasta que su caché expire sola.

Ocurrió en producción el 2026-09-02: tras desplegar Bf-07 y Bf-08, un navegador con caché
previa seguía cargando el `catalogos.service.js` de julio y la consola lanzaba
`catalogosService.getRoles is not a function`. El código estaba bien, el servidor estaba
bien, y aun así la pantalla corría JavaScript viejo. Se perdió cerca de una hora
distinguiendo eso de un bug real, con dos diagnósticos equivocados por el camino.

Con el docroot apuntando al propio repositorio y sin paso de build, versionar la URL es la
única forma de hacer un deploy **observable**.

---

## Qué hacer

### 1. Una sola versión, la misma que el badge

`index.html` ya muestra un badge de versión en el pie (hoy `v1.2 · Promotoría P2`).
**Ese número es la fuente única.** Añadir `?v=1.2` a **todas** las etiquetas
`<script src="/js/...">` y `<link ... href="/styles/...css">` de las 19 páginas
(son 247 etiquetas en total; hazlo con un script, no a mano):

```html
<script src="/js/services/api.js?v=1.2"></script>
<link rel="stylesheet" href="/styles/styles.css?v=1.2">
```

Reglas:
- Solo rutas **propias** (`/js/...`, `/styles/...`). No tocar CDNs ni rutas externas.
- No tocar `<script>` inline.
- No cambiar el orden de carga: es significativo (config → api → servicios → utils →
  sidebar → auth.guard → pages).
- Verificar que ninguna etiqueta ya traiga query, para no generar `?v=1.2?v=1.2`.

### 2. El efecto que buscamos

Al subir la versión, **el badge se convierte en la prueba del despliegue**: si el pie
muestra la versión nueva, es que el navegador cargó el `index.html` nuevo — y ese index
pide los assets con la query nueva, así que los assets nuevos también entraron. Un vistazo
y sabes si el deploy tomó, sin incógnito ni DevTools.

### 3. Documentar el paso de release

En el `README.md`, una sección corta **"Publicar una versión"**:

1. Subir el número en el badge de `index.html` y en las 247 etiquetas (un `sed` sobre
   `?v=` basta; deja el comando escrito en el README).
2. Commit, push a `main`.
3. En cPanel → Git Version Control → **Update from Remote**. Eso es todo: el Document Root
   de `cotizador.kogu.ink` **es** el repositorio, no hay paso de copia y **no debe existir
   un `.cpanel.yml`**.
4. Abrir el sitio y confirmar que el pie muestra la versión nueva.

---

## Cierre

- `node --check` no aplica (solo cambia HTML), pero **verifica que las 19 páginas siguen
  cargando sus scripts**: abre cada una y confirma que no hay 404 en la consola. Un typo en
  una ruta versionada rompe la página entera y es el riesgo real de este cambio.
- Confirma que el conteo de etiquetas versionadas coincide con el total previo (247), para
  que no se quede ninguna fuera: una sola sin versionar reintroduce el problema en ese archivo.
