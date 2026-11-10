"""Wordmark "downco" outlined from Inter SemiBold (the app's UI font, OFL), plus
horizontal and stacked lockups with the symbol."""
import re
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

import os
FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'fonts', 'inter-latin-600.woff2')
TEXT, SIZE, TRACK = 'downco', 120, -0.02          # tracking in em

font = TTFont(FONT)
upm = font['head'].unitsPerEm
cmap, gs, hmtx = font.getBestCmap(), font.getGlyphSet(), font['hmtx']
s = SIZE / upm

def wordmark(x0, baseline):
    pen = SVGPathPen(gs)
    x = 0
    for ch in TEXT:
        g = cmap[ord(ch)]
        gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x0 + x, baseline)))
        x += hmtx[g][0] * s + TRACK * SIZE
    return pen.getCommands(), x - TRACK * SIZE

def fmt(d):   # 2 decimals
    return re.sub(r'-?\d+\.\d+', lambda m: f'{float(m.group()):.2f}'.rstrip('0').rstrip('.'), d)

xh = font['OS/2'].sxHeight * s                    # x-height in px
asc = font['OS/2'].sCapHeight * s

sym = re.search(r'<path[^>]*?(transform="[^"]+")[^>]*d="([^"]+)"', open('downco-symbol.svg').read())
sym_t, sym_d = sym.group(1), sym.group(2)
# Symbol ink in the 256 box: 41.2..214.7 x, 12.9..243.3 y (svg_audit margins).
INK = (41.2, 12.9, 214.7, 243.3)

def sym_group(x, y, k):
    return f'<g transform="translate({x:.2f} {y:.2f}) scale({k:.4f})"><path {sym_t} d="{sym_d}"/></g>'

def write(name, w, h, body):
    open(name, 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" role="img" aria-labelledby="t">'
                          f'<title id="t">downco</title>{body}</svg>\n')

# Horizontal: symbol 1.55x the cap height, centred on the cap height's middle;
# canvas cropped to the ink plus a 24 px margin.
PAD = 24
k = asc * 1.55 / (INK[3] - INK[1])
sh_ = (INK[3] - INK[1]) * k
top = PAD
sy = top - INK[1] * k
base = top + sh_ / 2 + asc / 2
sx = PAD - INK[0] * k
wx = PAD + (INK[2] - INK[0]) * k + asc * 0.32
d, ww = wordmark(wx, base)
write('downco-lockup-horizontal.svg', wx + ww + PAD, sh_ + 2 * PAD,
      sym_group(sx, sy, k) + f'<path id="wordmark" d="{fmt(d)}"/>')
H = 256
base = 168

# Stacked: symbol above, wordmark centred below.
k2 = 1.0
sw, sh = (INK[2] - INK[0]) * k2, (INK[3] - INK[1]) * k2
W2 = max(ww, sw) + 48
sym_y = 24
base2 = sym_y + sh + 36 + asc
d2, _ = wordmark((W2 - ww) / 2, base2)
write('downco-lockup-stacked.svg', W2, base2 + 40,
      sym_group((W2 - sw) / 2 - INK[0] * k2, sym_y - INK[1] * k2, k2) + f'<path id="wordmark" d="{fmt(d2)}"/>')

# Wordmark only.
d3, _ = wordmark(16, base)
write('downco-wordmark.svg', ww + 32, H, f'<path id="wordmark" d="{fmt(d3)}"/>')
print('ok', round(ww), round(k, 3))
