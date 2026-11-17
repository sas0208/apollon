"""Apollon: disegna il marchio (lira + sole, con il triangolo play al centro) e rifà icon.svg, icon-music.svg, icon-192.png e icon-512.png.
Uso: python scripts/make_icons.py   (serve solo Playwright, già usato dai test)"""
from pathlib import Path
from playwright.sync_api import sync_playwright

PUBLIC = Path(__file__).resolve().parents[1] / 'public'
VARIANTS = {'video': ('#ff8c42', '#1c0d02'), 'music': ('#2cd46b', '#04140a')}


def mark(base, ink):
    import math
    rays = ''.join(f'<path d="M{64 + 14 * math.cos(math.radians(a)):.1f} {44 + 14 * math.sin(math.radians(a)):.1f}L{64 + 24 * math.cos(math.radians(a)):.1f} {44 + 24 * math.sin(math.radians(a)):.1f}"/>'
                   for a in (-90, -55, -125, -20, -160))
    return (f'<g fill="none" stroke="{ink}" stroke-linecap="round" stroke-width="8"><path d="M28 36C28 78 40 110 64 110S100 78 100 36"/><path d="M28 50H100"/>{rays}</g>'
            f'<g fill="{ink}"><circle cx="28" cy="34" r="7"/><circle cx="100" cy="34" r="7"/><circle cx="64" cy="80" r="23"/></g>'
            f'<path d="M57 68 77 80 57 92Z" fill="{base}"/>')


def svg(variant, bleed=False):
    base, ink = VARIANTS[variant]
    body = mark(base, ink)
    if bleed:  # PNG a tutto riquadro, marchio dentro la zona sicura delle icone "maskable"
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="{base}"/><g transform="translate(14 14) scale(.78)">{body}</g></svg>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="{base}"/>{body}</svg>'


(PUBLIC / 'icon.svg').write_text(svg('video') + '\n', encoding='utf-8')
(PUBLIC / 'icon-music.svg').write_text(svg('music') + '\n', encoding='utf-8')
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--disable-gpu'])
    for size in (192, 512):
        page = browser.new_page(viewport={'width': size, 'height': size})
        page.set_content(f'<body style="margin:0">{svg("video", True).replace("<svg ", f"<svg width={size} height={size} ")}</body>')
        page.screenshot(path=str(PUBLIC / f'icon-{size}.png'))
        page.close()
    browser.close()
print('Icone di Apollon pronte.')
