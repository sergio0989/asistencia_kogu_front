# Bf-03 — Sanitización XSS en el frontend

Brief para Claude Code. Independiente de los briefs B2-* del backend; puede
ejecutarse en cualquier momento. Se pega completo en Claude Code como un solo
prompt.

Trabajo sobre `/Users/sergioj/Documents/Claude/Projects/Kogu Asistencia/kogu-asistencias-web`.

---

## Control de avance

| Brief | Descripción                  | Estado      | Fecha      | Commit | Notas |
|-------|------------------------------|-------------|------------|--------|-------|
| Bf-03 | Sanitización XSS (innerHTML) | Cerrado | 2026-06-10 | `0490c50` (merge a `main`) | Función única `fmt.esc()` en `format.js` (convención global `window.fmt`); 102 interpolaciones escapadas en 10 archivos; `badgeHtml` escapa internamente; consolidados los escapers locales `escDetalle`/`escHtml` de detalle.js en `fmt.esc`. Casos especiales cubiertos (`renderSelect`, formularios dinámicos de nuevo-caso y detalle: labels del esquema JSON + respuestas guardadas). `innerHTML` estáticos marcados con `// estático`. Verificado con arnés que ejecuta las funciones de render reales con los payloads del brief (img/onerror, script, svg, breakout de textarea): todo escapado. Post-merge: render normal (acentos/comillas OK; `&`→`&amp;` una sola vez, sin doble-escape ni HTML roto). Mergeada a `main` con `--no-ff` (commit `0490c50`, rama `fix/bf03-xss`). |

---

## Contexto

Auditoría del 2026-06-09: se usa `innerHTML` interpolando datos de la API en
11 archivos JS y **no existe ninguna función de escape en el repo**. Los datos
se capturan por cabina, web y (a futuro) WhatsApp y formulario público — es
decir, contenido potencialmente hostil que hoy se renderiza sin sanitizar.

Archivos con `innerHTML` (auditar todos):
`js/utils/table.js`, `js/utils/modal.js`, `js/utils/toast.js`,
`js/components/sidebar.js`, `js/pages/catalogos.js`, `js/pages/nuevo-caso.js`,
`js/pages/detalle.js`, `js/pages/bandeja.js`, `js/pages/auth.js`,
`js/pages/usuarios.js`, `js/pages/dashboard.js`.

## Decisiones de diseño

1. Una sola función de escape en `js/utils/format.js`:
   ```js
   export ... function esc(v) {
     return String(v ?? '')
       .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
       .replaceAll('"','&quot;').replaceAll("'",'&#39;');
   }
   ```
   (Ajustar a la convención de módulos real del proyecto: si los utils se
   cargan como scripts globales, exponerla igual que las demás funciones de
   `format.js`.)
2. **Regla:** todo valor que provenga de la API o de input del usuario y se
   interpole en un template string que termina en `innerHTML` pasa por
   `esc(...)`. El HTML estático de los templates no se toca.
3. Atributos: valores dentro de atributos (`value="${...}"`, `data-id="${...}"`)
   también se escapan. Para ids UUID propios puede omitirse solo si el valor
   nunca viene de captura libre — ante la duda, escapar.
4. No introducir librerías externas ni refactorizar el renderizado; este brief
   es exclusivamente de sanitización.

## Alcance — SÍ

1. Crear `esc()` en `js/utils/format.js`.
2. Auditar los 11 archivos y aplicar `esc()` en cada interpolación de datos
   dinámicos: nombres, teléfonos, descripciones, ubicaciones, comentarios,
   bitácora, nombres de archivo de documentos, nombres de usuario/proveedor/
   empresa, mensajes de error de API que se rendericen, valores de respuestas
   de formularios dinámicos.
3. Caso especial `nuevo-caso.js` (`renderSelect`): escapar labels y values de
   los options.
4. Caso especial formularios dinámicos en `detalle.js`: los labels/valores del
   esquema JSON y las respuestas guardadas también se escapan.
5. Revisar usos de `format.js` existentes (badges, fechas): las funciones que
   construyen HTML con datos deben escapar internamente para que el fix quede
   centralizado.

## Alcance — NO

- NO migrar a framework ni a `textContent` masivo.
- NO tocar lógica de negocio, estilos ni estructura de páginas.
- NO sanitizar del lado del servidor (el backend guarda el dato crudo; el
  escape es responsabilidad del render).

## Criterios de aceptación

1. Prueba manual: crear una asistencia con
   `conductor_nombre = <img src=x onerror=alert(1)>` y
   `descripcion = <script>alert(2)</script>`; verificar que bandeja, detalle,
   dashboard y bitácora muestran el texto literal y no ejecutan nada.
2. Lo mismo con un comentario, un nombre de usuario y un nombre de archivo
   subido con HTML malicioso.
3. `grep -n "innerHTML" js/ -r` revisado línea por línea: cada interpolación
   dinámica usa `esc()` o queda justificada con comentario `// estático`.
4. El render visual no cambia para datos normales (sin dobles escapes:
   verificar que no aparezca `&amp;` en pantalla para textos con `&`).
5. Rama `fix/bf03-xss`, commits `fix(seguridad): Bf-03 …`, merge a `main`.
