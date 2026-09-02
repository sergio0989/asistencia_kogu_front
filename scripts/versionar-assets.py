#!/usr/bin/env python3
"""
versionar-assets.py — Añade (o actualiza) `?v=<version>` en las etiquetas
<script src="/js/..."> y <link href="/styles/..."> de todas las páginas.

Bf-09: el front no tiene build y cPanel sirve los estáticos con caducidad larga,
así que sin query en la URL un despliegue no llega al navegador de quien ya
visitó el sitio. La versión es la MISMA que muestra el badge de index.html.

Es idempotente: si la etiqueta ya trae `?v=`, se reemplaza el valor en vez de
encadenar otro. Solo toca rutas propias (/js, /styles) — nunca CDNs, rutas
externas ni <script> inline — y no reordena nada.

Uso:
    python3 scripts/versionar-assets.py 1.3          # aplica
    python3 scripts/versionar-assets.py 1.3 --dry    # solo informa
"""
import re
import sys
import glob

# Solo estas raíces. Cualquier otra URL (CDN, externa, relativa) se ignora.
PROPIAS = ('/js/', '/styles/')

# Captura el atributo completo para reescribir únicamente la URL, dejando
# intactos el resto de atributos y el orden de la etiqueta.
RE_ASSET = re.compile(
    r'(?P<pre><(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*")(?P<url>[^"]+)(?P<post>")',
    re.I,
)


def versionar_url(url: str, version: str) -> str:
    base, sep, query = url.partition('?')
    if not query:
        return f'{base}?v={version}'
    # Reemplaza un v= existente; conserva cualquier otro parámetro.
    partes = [p for p in query.split('&') if p and not p.startswith('v=')]
    partes.insert(0, f'v={version}')
    return f'{base}?' + '&'.join(partes)


def procesar(version: str, dry: bool = False):
    paginas = sorted(glob.glob('**/*.html', recursive=True))
    total, por_pagina = 0, {}

    for pagina in paginas:
        original = open(pagina, encoding='utf-8').read()
        cuenta = 0

        def sustituir(m):
            nonlocal cuenta
            url = m.group('url')
            if not url.startswith(PROPIAS):
                return m.group(0)          # CDN / externa: intacta
            cuenta += 1
            return m.group('pre') + versionar_url(url, version) + m.group('post')

        nuevo = RE_ASSET.sub(sustituir, original)
        por_pagina[pagina] = cuenta
        total += cuenta

        if not dry and nuevo != original:
            open(pagina, 'w', encoding='utf-8').write(nuevo)

    for pagina in paginas:
        print(f'  {por_pagina[pagina]:3}  {pagina}')
    print(f'\n{"(dry) " if dry else ""}etiquetas versionadas: {total} en {len(paginas)} páginas')
    return total


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        print('Uso: python3 scripts/versionar-assets.py <version> [--dry]')
        sys.exit(1)
    procesar(args[0], dry='--dry' in sys.argv)
