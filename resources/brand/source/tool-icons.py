"""Hub tool icons in the downco logo's language (24 grid, stroke 1.4, round)."""
import math
f = lambda v: f'{v:.2f}'.rstrip('0').rstrip('.')
P = lambda p: f'{f(p[0])} {f(p[1])}'

def on(c, r, a):
    a = math.radians(a); return (c[0] + r * math.cos(a), c[1] + r * math.sin(a))

def chevron(tip, ang, arm=3.4):
    """Open arrowhead at `tip` pointing along angle `ang` (deg, svg coords)."""
    l = on(tip, arm, ang + 180 - 45); r = on(tip, arm, ang + 180 + 45)
    return f'M{P(l)} L{P(tip)} L{P(r)}'

def converter(cx=12, cy=11.6, r=7.5, start=150, end=60):
    # The logo's loop: clockwise from `start` round to `end`, arrowheads at both ends
    # (the end runs on, the start points back): one turn = convert.
    a0, a1 = on((cx, cy), r, start), on((cx, cy), r, end)
    sweep = (end - start) % 360
    d = [f'M{P(a0)} A{f(r)} {f(r)} 0 {1 if sweep > 180 else 0} 1 {P(a1)}',
         chevron(a1, end + 90),          # clockwise tangent
         chevron(a0, start - 90)]        # counter-clockwise tangent
    return d

def downloader(x=12, r=6.5, top=4, tip=17.5, tray=20.5):
    # The logo's drop: comes in from the loop (top right), turns straight down, lands.
    c = (x + r, top + r)
    d = [f'M{P((x + r, top))} A{f(r)} {f(r)} 0 0 0 {P((x, top + r))} L{P((x, tip))}',
         chevron((x, tip), 90, 4.2),
         f'M{P((5, tray))} H19']
    return d

def svg(paths, sw=1.4):
    body = ''.join(f'<path d="{d}"/>' for d in paths)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{body}</svg>')

if __name__ == '__main__':
    import json
    out = {'converter': converter(), 'downloader': downloader()}
    json.dump(out, open('icons.json', 'w'), indent=1)
    for k, v in out.items():
        open(f'{k}.svg', 'w').write(svg(v))
    print(json.dumps(out, indent=1))
