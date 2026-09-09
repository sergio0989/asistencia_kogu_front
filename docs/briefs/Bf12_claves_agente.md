# Bf-12 — Claves del agente por aseguradora y plaza (frontend)

Proyecto: `kogu-asistencias-web` · rama sugerida: `feat/bf-12-claves-agente`
Depende de: **B2-11 desplegado en QA**. No empieces sin eso: media pantalla se prueba
contra endpoints nuevos.

## 1. Contexto en una frase

Cada agente tiene un identificador con cada aseguradora, y ese identificador cambia según
la plaza. La póliza debe guardar con cuál de ellos se vendió. **El sub-agente no tiene
clave propia: vende con la de su titular.**

## 2. Pantalla de claves en la ficha del agente

En `comercial/agentes.html` + `js/pages/agentes.js`.

**Copia el patrón que ya existe ahí:** `abrirDocs(id, nombre)` (línea ~247) abre el panel
de documentos de un agente. Haz `abrirClaves(id, nombre)` igual — misma forma de abrir,
mismo estilo de panel, mismo manejo de errores. No inventes una interacción nueva para
algo que la pantalla ya resuelve.

Columnas de la tabla: **Aseguradora · Plaza · Clave · Nombre en la aseguradora · Alta ·
Estado**. La clave en `font-family` monoespaciada: son códigos que la gente compara
carácter por carácter contra un estado de cuenta, y `0234` frente a `O234` tiene que
distinguirse a simple vista.

Alta y edición para `agentesEscribir` (admin, supervisor). Los demás solo leen.

Reglas que la pantalla debe hacer evidentes:

- **La baja es lógica.** El botón dice "Dar de baja", no "Eliminar", y pide fecha de baja.
  Una clave dada de baja se sigue mostrando, atenuada y con su fecha. Las pólizas viejas
  apuntan a ella.
- **Al editar no se puede cambiar aseguradora ni plaza.** Deja esos dos campos deshabilitados
  en el modal de edición, con la leyenda: *"Para cambiar de plaza o aseguradora, da de baja
  esta clave y registra una nueva."* Si no lo bloqueas en pantalla, el backend responderá
  422 y el usuario no entenderá por qué.
- **El sub-agente no lleva claves.** Cuando abras el panel de un agente que tiene padre,
  muestra en lugar de la tabla: *"Los sub-agentes venden con la clave de su agente titular.
  Esta ficha no lleva claves propias."* Sin esto, su panel vacío parece un error de carga.

## 3. Catálogo de plazas

Pantalla nueva `catalogos/plazas.html` + entrada en `js/pages/catalogos.js`, con el mismo
molde que Empresas: listado, alta, edición, baja lógica. Campos: clave, nombre, orden, activo.

Va en el grupo **Gestión** del `sidebar.js`, con `M.catalogosVer`.

Es una pantalla mínima a propósito, pero no es opcional: `catalogo_ramos` se quedó sin
administración y hoy nadie puede dar de alta un ramo sin entrar a la base. Este catálogo no
puede nacer con el mismo hueco.

## 4. El campo en el alta de póliza — la parte que importa

En `js/pages/polizas.js`, modal de creación (`abrirModalCrear`, línea ~309).

**El precedente exacto ya está en el archivo:** `cargarUsos(ramoId)` (línea ~233) es un
select dependiente que se recarga cuando cambia el ramo. La clave es lo mismo, pero
depende de **dos** campos: la aseguradora y el **agente titular**.

### Cuándo recargar

Cada vez que cambie `p-aseguradora` **o** `p-agente`. Si quien captura es un sub-agente y
no ve el picker de agente, el titular es su padre: úsalo desde
`authService.getUser()?.agente_padre_id`.

Llamada: `GET /agentes/:titularId/claves?aseguradora_id=…&activo=true`.

### Los tres estados de la respuesta

| Claves | Qué muestra el campo |
|---|---|
| **1** | Se llena solo y queda **deshabilitado**, mostrando `Plaza — clave`. Es el caso normal; no se le pide nada al usuario. |
| **2 o más** | Select habilitado con una opción por clave, etiquetada `Plaza — clave`. Sin preselección: que el usuario elija a conciencia. |
| **0** | Campo deshabilitado y **aviso visible** (ver abajo). |

### El aviso cuando no hay clave

Reutiliza el mecanismo de `mostrarAvisoAsignacion()` (línea ~199), que ya resuelve
exactamente este tipo de aviso en este mismo formulario.

Texto: *"{Nombre del titular} no tiene clave registrada con {Aseguradora}. La póliza se
guardará sin clave y habrá que completarla después."*

**Y aquí está el detalle que hay que cuidar:** cuando quien captura es un sub-agente, ese
mensaje nombra a **otra persona** —su titular—, porque la clave es del titular. Es correcto,
pero se lee raro si no se explica. Cuando el usuario de la sesión sea sub-agente, usa esta
variante: *"Tu agente titular, {Nombre}, no tiene clave registrada con {Aseguradora}. Las
pólizas se emiten con su clave, así que hay que registrarla."*

En QA la póliza se guarda igual. En producción el backend la va a rechazar, así que el
aviso es lo que evita que el usuario descubra el problema hasta el final del formulario.

### Dos errores distintos, dos tratos distintos

El backend responde **422** cuando hay varias claves y no dijiste cuál — ese error trae
`field: 'clave_agente_id'` y debe caer sobre el campo. Pero responde **409** cuando una
clave choca contra otra viva al darla de alta (mismo agente/aseguradora/plaza, o mismo
valor en esa aseguradora y plaza). El 409 **no trae campo**: preséntalo como `toast` con
el mensaje tal cual viene del servidor, que ya dice cuál de los dos choques ocurrió. No
intentes mapearlo a un campo.

### Mapa de errores

En el `MAPA` del inicio del archivo (línea ~21), agrega:

```js
clave_agente_id: 'p-clave-agente',
```

Sin esa línea, el 422 de "indica cuál clave aplica" cae en un `toast` genérico en vez de
señalar el campo, que es justo el caso donde el usuario necesita saber dónde mirar.

## 5. Ver la clave en pólizas

- **Detalle de póliza** (`comercial/poliza.html`): en el bloque comercial, junto al agente,
  mostrar `Clave: {clave} · {plaza}`. Cuando la póliza no tiene clave, `—` (nunca vacío ni
  `null`).
- **Listado** (`comercial/polizas.html`): nuevo filtro **Plaza**, poblado desde
  `GET /catalogos/plazas`, que manda `plaza_id` al listado. Es lo que permite la pregunta
  "¿cuánto produjo la plaza Sur?".

No agregues la clave como columna del listado: la tabla ya va apretada y el dato se
consulta, no se escanea.

## 6. Permisos

En `js/utils/permisos.js` no hace falta una entrada nueva: la administración de claves usa
`agentesEscribir` y la lectura `agentesVer`, que ya existen. El catálogo de plazas usa
`catalogosVer` / `catalogosEscribir`. **No escribas listas de roles a mano en la pantalla**
— ese fue el hallazgo KA-F-08 y ya está resuelto con la matriz.

## 7. Cierre

Al terminar y antes de mergear a `main`:

```
python3 scripts/versionar-assets.py 1.7
```

Un solo comando: versiona los tags y sube el badge del pie. No lo corras en la rama antes
de tiempo — anunciaría una versión que todavía no está en el servidor.

## 7.bis Ventana en la que QA queda a medias — leer antes de probar

B2-11 se despliega solo al llegar a `main`, y el seed `016` le da al agente demo **dos
claves con GNP**. Desde ese momento y hasta que esta rama esté arriba, emitir una póliza
en QA con **agente demo + GNP** responde 422 pidiendo cuál clave aplica, y el formulario
desplegado todavía no tiene el selector: el usuario ve un `toast` que no puede resolver.

No es una regresión, es la ventana entre los dos despliegues. Mientras dure:

- **Qualitas** con el agente demo tiene una sola clave → se resuelve solo, sirve para
  probar el camino feliz.
- **AXA** no tiene ninguna → sirve para probar el aviso.
- **GNP** queda bloqueado hasta que esta rama suba. Es justo el caso que esta rama existe
  para resolver.

## 8. Verificación en navegador (obligatoria antes de reportar)

Sirve `python3 -m http.server 5500` en la raíz del repo y elige ambiente QA en el login;
`CORS_ORIGINS` de QA permite `localhost:5500`.

1. Con `admin`: alta de una clave, edición, baja lógica, y confirmar que aseguradora y
   plaza están bloqueadas al editar.
2. Con `admin`: abrir el panel del **sub-agente demo** y ver el mensaje de "vende con la
   clave de su titular", no una tabla vacía.
3. Con `agente.demo`: alta de póliza con **GNP** — el agente demo tiene dos claves (CDMX y
   Sur), así que debe pedir que elijas. Con **Qualitas** tiene una sola: debe llenarse solo.
   Con **AXA** no tiene ninguna: debe salir el aviso.
4. Con `subagente.demo`: alta de póliza con AXA y confirmar que el aviso nombra al titular
   con la redacción de sub-agente.
5. Consola del navegador **sin un solo error** en los cuatro recorridos.

Reporta al final: archivos tocados, decisiones propias, y lo que del brief no coincidiera
con el código real.
