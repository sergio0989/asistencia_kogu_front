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
