"""downco symbol (G1), built as one filled outline.

Construction (256 grid):
- Loop: circle C1 centre (128, cy), centre-line radius r1, band width w, run clockwise
  from angle `start` to angle te.
- Turn: a second arc, radius r2, curving the other way, tangent to the loop at te and
  ending heading straight down at x = 128. Tangency puts C2 on the ray C1 -> te at
  distance r1 + r2; ending at x = 128 needs cos(te) = r2 / (r1 + r2).
- Stem from there down to the download arrowhead (base 2*head, height hh).
- A second arrowhead at the start, pointing back along the loop (the convert end).
Every edge is an arc or a straight line, so the outline is exact at any size.
"""
import math, sys

def symbol(w=32, r1=64, r2=32, cy=94, start=150, head=44, hh=52, bhead=44, bhh=52, stem=8):
    cx = 128
    te = math.degrees(math.acos(r2 / (r1 + r2)))
    u = lambda a: (math.cos(math.radians(a)), math.sin(math.radians(a)))
    def on(c, r, a):
        d = u(a); return (c[0] + r * d[0], c[1] + r * d[1])
    c1 = (cx, cy)
    c2 = on(c1, r1 + r2, te)
    h = w / 2
    yb = c2[1] + stem                                  # arrowhead base
    f = lambda p: f'{p[0]:.2f} {p[1]:.2f}'
    sweep1 = (te + 360 - start) % 360                  # loop angle
    large1 = 1 if sweep1 > 180 else 0
    # Side A: outside of the loop, inside of the turn. Side B: the other edges.
    a0, a1 = on(c1, r1 + h, start), on(c1, r1 + h, te)
    a2 = (cx + h, c2[1])                               # end of the turn, right edge of the stem
    b2 = (cx - h, c2[1])
    b1, b0 = on(c1, r1 - h, te), on(c1, r1 - h, start)
    # Back arrowhead at the start: base across the band (radial), tip backwards along the loop.
    t = (-math.sin(math.radians(start)), math.cos(math.radians(start)))   # clockwise tangent
    mid = on(c1, r1, start)
    # Tip straight back along the tangent (following the curve pushes it into the stem).
    tip_b = (mid[0] - t[0] * bhh, mid[1] - t[1] * bhh)
    d = (f'M{f(a0)} A{r1+h} {r1+h} 0 {large1} 1 {f(a1)} '
         f'A{r2-h} {r2-h} 0 0 0 {f(a2)} '
         f'L{cx+h} {yb:.2f} L{cx+head} {yb:.2f} L{cx} {yb+hh:.2f} L{cx-head} {yb:.2f} L{cx-h} {yb:.2f} '
         f'L{f(b2)} A{r2+h} {r2+h} 0 0 1 {f(b1)} '
         f'A{r1-h} {r1-h} 0 {large1} 0 {f(b0)} '
         f'L{f(on(c1, r1 - bhead, start))} L{f(tip_b)} L{f(on(c1, r1 + bhead, start))} Z')
    top, bottom = cy - r1 - h, yb + hh
    return d, top, bottom

def svg(d, title, w=256, h=256, fill='#000', vb=None):
    vb = vb or f'0 0 {w} {h}'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{h}" role="img" aria-labelledby="t">'
            f'<title id="t">{title}</title><path id="symbol" fill="{fill}" d="{d}"/></svg>\n')

if __name__ == '__main__':
    d, top, bottom = symbol()
    shift = (256 - (bottom - top)) / 2 - top            # centre vertically
    open('downco-symbol.svg', 'w').write(svg(d, 'downco').replace('<path', f'<path transform="translate(6.75 {shift:.2f})"', 1))
    # Small-size cut (16-32 px): heavier band, bigger heads, shorter loop start.
    d, top, bottom = symbol(w=44, r1=62, r2=36, cy=92, start=158, head=52, hh=52, bhead=50, bhh=56, stem=4)
    shift = (256 - (bottom - top)) / 2 - top
    open('downco-symbol-small.svg', 'w').write(svg(d, 'downco').replace('<path', f'<path transform="translate(9.9 {shift:.2f})"', 1))
    print('ok')
