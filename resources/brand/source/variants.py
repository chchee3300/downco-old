"""Colour variants of every master into out/svg, plus a PNG job list (out/png-jobs.json)
that render.mjs turns into transparent PNGs."""
import json, os, re
OUT = 'out'
os.makedirs(f'{OUT}/svg', exist_ok=True)
COLORS = {
    'blue': '#5b7fff',        # brand colour on dark (the app's dark-theme accent)
    'blue-deep': '#4060e8',   # brand colour on light (the light-theme accent)
    'black': '#0d1017',       # one-colour on light
    'white': '#eef0f4',       # one-colour reversed, on dark
}
MASTERS = ['downco-symbol', 'downco-symbol-small', 'downco-lockup-horizontal', 'downco-lockup-stacked', 'downco-wordmark']

def recolor(src, c):
    s = open(src).read()
    s = re.sub(r'fill="#[0-9a-fA-F]{3,6}"', '', s)
    return s.replace('<svg ', f'<svg fill="{c}" ', 1)

jobs = []
for m in MASTERS:
    for name, c in COLORS.items():
        p = f'{OUT}/svg/{m}-{name}.svg'
        open(p, 'w').write(recolor(f'{m}.svg', c))
# App-icon tile: the blue symbol on the app's dark background, rounded square.
sym = open('downco-symbol.svg').read()
body = re.search(r'<path.*?/>', sym).group(0).replace('fill="#000"', 'fill="#5b7fff"')
tile = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">'
        '<title>downco</title><rect width="256" height="256" rx="56" fill="#070809"/>'
        f'<g transform="translate(25.6 25.6) scale(.8)">{body}</g></svg>\n')
open(f'{OUT}/svg/downco-app-icon-tile.svg', 'w').write(tile)

jobs += [dict(src=f'{OUT}/svg/downco-symbol-{c}.svg', out=f'{OUT}/png/downco-symbol-{c}-{n}.png', w=n)
         for c in COLORS for n in (1024, 512, 256)]
jobs += [dict(src=f'{OUT}/svg/downco-symbol-small-{c}.svg', out=f'{OUT}/png/downco-symbol-small-{c}-{n}.png', w=n)
         for c in COLORS for n in (64, 32, 16)]
jobs += [dict(src=f'{OUT}/svg/downco-lockup-horizontal-{c}.svg', out=f'{OUT}/png/downco-lockup-horizontal-{c}-1200w.png', w=1200)
         for c in COLORS]
jobs += [dict(src=f'{OUT}/svg/downco-app-icon-tile.svg', out=f'{OUT}/png/downco-app-icon-tile-{n}.png', w=n) for n in (1024, 512, 180)]
json.dump(jobs, open(f'{OUT}/png-jobs.json', 'w'), indent=1)
print(len(jobs), 'png jobs')
