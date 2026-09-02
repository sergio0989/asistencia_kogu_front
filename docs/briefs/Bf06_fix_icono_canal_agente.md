# Bf-06 — Fix cosmético: ícono del canal `agente` en `fmt.canal`

Brief corto para Claude Code, repo **kogu-asistencias-web**. Follow-up trivial de
Bf-05 (ya en main y desplegado). Se pega completo.

Trabajo sobre `/Users/sergioj/Documents/Claude/Projects/Kogu Asistencia/kogu-asistencias-web`.

## Problema

El canal de origen `'agente'` es nuevo en P2, pero el helper `fmt.canal()` de
`js/utils/format.js` (heredado de P1) no lo tiene en su mapa, así que cae en el
fallback y en el detalle de oportunidad el campo Canal muestra **"❓ agente"** en
vez del ícono correcto.

## Fix

Agregar la entrada `agente` al mapa de `fmt.canal()`. Usar **🎫** para que
coincida con el chip "Agente" de `comercial/nueva-oportunidad.html` (línea del
`canal-card` de agente) y con el enlace de Agentes del sidebar:

```diff
   canal(canal_origen) {
     const map = {
+      agente:   { label: 'Agente',   icon: '🎫' },
       llamada:  { label: 'Llamada',  icon: '📞' },
       web:      { label: 'Web',      icon: '🌐' },
       whatsapp: { label: 'WhatsApp', icon: '💬' },
       interno:  { label: 'Interno',  icon: '🏢' },
       api:      { label: 'API',      icon: '⚡' },
     };
     return map[canal_origen] || { label: canal_origen || '—', icon: '❓' };
   },
```

## Verificación

- Abrir `comercial/oportunidad.html?id=<una oportunidad con canal_origen=agente>`
  (p. ej. las del seed 013, todas son canal `agente`) y confirmar que Canal
  muestra "🎫 Agente" sin el "?".

## Cierre

Es un one-liner cosmético; según la convención del front, va **directo a `main`**
con verificación previa al push. Commit `fix(promotoria): Bf-06 ícono de canal
agente en fmt.canal`. Antes de push, pásame el `git diff` para eyeballearlo.
