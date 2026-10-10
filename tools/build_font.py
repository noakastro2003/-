"""Build the OTF from traced glyphs: one uniform scale for every glyph (no per-letter
stretching), optical side bearings, and computed pair kerning."""
import json, sys, math, itertools
import numpy as np, cv2
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.areaPen import AreaPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString

WORK, OUT = sys.argv[1], sys.argv[2]
P = json.load(open(WORK + '/glyphs.json'))
G = P['glyphs']
FAMILY = 'Noa Handwriting'

# ---------------- scale: one factor for the whole sheet ------------------------------
HEB_BODY = ['alef','bet','gimel','he','zayin','het','kaf','mem','samekh','pe','tsadi','resh','tav','finalmem']
body_px = float(np.median([G[k]['inkbox'][3]-G[k]['inkbox'][1] for k in HEB_BODY]))
UPM = 1000
K = 480.0 / body_px          # font units per source pixel; typical letter body = 480 units
print(f'median letter body {body_px}px -> scale {K:.3f} units/px')

# ---------------- outlines -----------------------------------------------------------
def contour_poly(segs, n=12):
    pts = []; cur = None
    for s in segs:
        if s[0] in ('M', 'L'): cur = s[1]; pts.append(cur)
        else:
            (x0,y0), (x1,y1), (x2,y2), (x3,y3) = cur, s[1], s[2], s[3]
            for t in np.linspace(0, 1, n)[1:]:
                mt = 1-t
                pts.append((mt**3*x0+3*mt*mt*t*x1+3*mt*t*t*x2+t**3*x3, mt**3*y0+3*mt*mt*t*y1+3*mt*t*t*y2+t**3*y3))
            cur = s[3]
    return np.array(pts)

def signed_area(p):
    x, y = p[:,0], p[:,1]
    return 0.5*np.sum(x*np.roll(y,-1) - np.roll(x,-1)*y)

def inside(pt, poly):
    x, y = pt; c = False
    xs, ys = poly[:,0], poly[:,1]
    for i in range(len(poly)):
        j = i-1
        if (ys[i] > y) != (ys[j] > y) and x < (xs[j]-xs[i])*(y-ys[i])/(ys[j]-ys[i]+1e-12)+xs[i]: c = not c
    return c

def to_font(g):
    """returns list of contours in font units (y up, baseline 0, x from ink left = 0 later)"""
    up = g['up']; ox, oy = g['origin']; base = g['base']
    def tf(p):
        X = (ox + p[0]/up) * K
        Y = (base - (oy + p[1]/up)) * K
        return (X, Y)
    out = []
    for segs in g['contours']:
        out.append([(s[0],) + tuple(tf(p) for p in s[1:]) for s in segs])
    return out

def draw(contours, pen, dx):
    polys = [contour_poly([(s[0],)+tuple(p for p in s[1:]) for s in c]) for c in contours]
    for i, c in enumerate(contours):
        depth = sum(inside(polys[i][0], polys[j]) for j in range(len(polys)) if j != i)
        ccw = signed_area(polys[i]) > 0
        want_ccw = depth % 2 == 0          # CFF: outer contours counter-clockwise
        segs = c
        if ccw != want_ccw:                # reverse the contour
            rp = RecordingPen(); _emit(c, rp, 0)
            from fontTools.pens.reverseContourPen import ReverseContourPen
            rec = RecordingPen(); rp.replay(ReverseContourPen(rec))
            rec.replay(TransformPen(pen, (1,0,0,1,dx,0)))
            continue
        _emit(c, pen, dx)

def _emit(c, pen, dx):
    r = lambda p: (round(p[0]+dx, 1), round(p[1], 1))
    start = c[0][1]
    pen.moveTo(r(start)); cur = start
    for s in c[1:]:
        if s[0] == 'L':
            if abs(s[1][0]-cur[0]) + abs(s[1][1]-cur[1]) > 1e-6: pen.lineTo(r(s[1]))
            cur = s[1]
        else:
            pen.curveTo(r(s[1]), r(s[2]), r(s[3])); cur = s[3]
    pen.closePath()

font_contours = {k: to_font(g) for k, g in G.items()}
# normalise so that ink starts at x=0
for k, cs in font_contours.items():
    bp = BoundsPen(None); _ = [ _emit(c, bp, 0) for c in cs ]
    xmin = bp.bounds[0]
    font_contours[k] = [[(s[0],) + tuple((p[0]-xmin, p[1]) for p in s[1:]) for s in c] for c in cs]

# ---------------- rasterised profiles for spacing / kerning --------------------------
RES = 4.0   # font units per raster cell
def raster(cs):
    bp = BoundsPen(None); [_emit(c, bp, 0) for c in cs]
    x0, y0, x1, y1 = bp.bounds
    yb, yt = math.floor(y0/RES)-1, math.ceil(y1/RES)+1
    w = math.ceil(x1/RES)+2
    img = np.zeros((yt-yb, w), np.uint8)
    for c in cs:
        poly = contour_poly(c)
        pts = np.stack([poly[:,0]/RES, yt - poly[:,1]/RES], 1)
        # even-odd fill via xor of each contour
        tmp = np.zeros_like(img); cv2.fillPoly(tmp, [np.round(pts*8).astype(np.int32)], 1, shift=3)
        img ^= tmp
    return img, yb, yt, x1

PROF = {}
for k, cs in font_contours.items():
    img, yb, yt, width = raster(cs)
    rows = {}
    for r in range(img.shape[0]):
        xs = np.nonzero(img[r])[0]
        if len(xs): rows[(yt - r)] = (xs.min()*RES, (xs.max()+1)*RES)  # y index in RES cells
    PROF[k] = dict(rows=rows, width=width)

# ---------------- optical side bearings (area based) ----------------------------------
XH = 480.0              # zone where letters are compared (baseline .. typical body top)
DEPTH = 150.0           # how deep into a counter the eye "sees" white
def side_depth(k, side, lo=0, hi=XH):
    rows = PROF[k]['rows']; w = PROF[k]['width']
    ds = []
    for yi in range(int(lo/RES), int(hi/RES)):
        if yi in rows:
            d = rows[yi][0] if side == 'L' else w - rows[yi][1]
        else:
            d = DEPTH
        ds.append(min(d, DEPTH))
    return float(np.mean(ds)) if ds else DEPTH

SPACE_SB = None
def zone(k):
    """vertical zone used for spacing: x-height band for letters, the glyph's own band for marks."""
    rows = PROF[k]['rows']
    ys = np.array(sorted(rows)) * RES
    lo, hi = ys.min(), ys.max()
    if hi < XH*0.6 or lo > XH*0.4:    # small/high marks (yod, quotes, hyphen, period...)
        return lo, hi
    return max(0, lo), min(XH, hi) if hi > XH*0.6 else hi

def bearings(k, target):
    lo, hi = zone(k)
    dl, dr = side_depth(k, 'L', lo, hi), side_depth(k, 'R', lo, hi)
    return max(target - dl, 18), max(target - dr, 18)

# ---------------- calibrate spacing to the user's own rhythm ---------------------------
# Row 2 of the sheet (מ נ ס ע פ צ ק ר) was written as a continuous run; measure how much
# optical white the writer actually left between neighbours and reproduce it.
def src_white(right, left):
    gap_px = G[right]['inkbox'][0] - G[left]['inkbox'][2]
    lo = max(zone(right)[0], zone(left)[0]); hi = min(zone(right)[1], zone(left)[1])
    return gap_px*K + side_depth(right, 'L', lo, hi) + side_depth(left, 'R', lo, hi)
run = ['mem','nun','samekh','ayin','pe','tsadi','qof','resh']
whites = [src_white(a, b) for a, b in zip(run, run[1:])]
# letters on the sheet were written as a list, a bit apart from each other; inside real
# words the same hand runs ~35% tighter, so keep the measured rhythm but tighten it uniformly.
TIGHTEN = 0.65
T = float(np.median(whites)) / 2 * TIGHTEN
print('source white per pair', np.round(whites), '-> side target', round(T))

HEBREW = [k for k in G if 0x5D0 <= G[k]['unicode'] <= 0x5EA]
DIGITS = ['zero','one','two','three','four','five','six','seven','eight','nine']
PUNCT  = ['period','comma','exclam','question','hyphen','quotedbl','parenleft','parenright']
SB = {}
for k in G:
    tgt = T
    if k in DIGITS: tgt = T*0.75          # figures are written closer together in the sheet
    if k in ('period','comma'): tgt = T*0.55
    SB[k] = bearings(k, tgt)
ADV = {k: round(SB[k][0] + PROF[k]['width'] + SB[k][1]) for k in G}

# ---------------- kerning ---------------------------------------------------------------
R = 10   # rows (x RES units) of vertical neighbourhood: white near a protrusion reads as tighter
def dilated(k, side):
    rows = PROF[k]['rows']; out = {}
    for y in rows:
        for dy in range(-R, R+1):
            v = rows[y][0] if side == 'L' else rows[y][1]
            yy = y + dy
            if side == 'L': out[yy] = min(out.get(yy, 1e9), v)
            else:           out[yy] = max(out.get(yy, -1e9), v)
    return out
DL = {k: dilated(k, 'L') for k in G}; DR = {k: dilated(k, 'R') for k in G}
RAWL = {k: {y: v[0] for y, v in PROF[k]['rows'].items()} for k in G}
RAWR = {k: {y: v[1] for y, v in PROF[k]['rows'].items()} for k in G}

def pair_metrics(right, left):
    """right glyph is read first (RTL); left glyph sits to its left."""
    off = ADV[left] + SB[right][0] - SB[left][0]   # x of right glyph ink-origin relative to left's
    lo = max(zone(right)[0], zone(left)[0]); hi = min(zone(right)[1], zone(left)[1])
    CAP = 2*T + DEPTH
    vals = []
    for yi in range(int(lo/RES), int(hi/RES)+1):
        a = DL[right].get(yi); b = DR[left].get(yi)
        g = CAP if a is None or b is None else min(off + a - b, CAP)
        vals.append(g)
    G_opt = float(np.mean(vals)) if vals else None
    # true closest approach over the full height (no dilation) for collision checks
    common = set(RAWL[right]) & set(RAWR[left])
    mind = min((off + RAWL[right][y] - RAWR[left][y] for y in common), default=1e9)
    # near-collision across rows: approximate with dilated profiles over full height
    commond = set(DL[right]) & set(DR[left])
    mind_d = min((off + DL[right][y] - DR[left][y] for y in commond), default=1e9)
    return G_opt, mind, mind_d

KERN = {}
def kern_group(rights, lefts, strength=0.5):
    ms = {(a, b): pair_metrics(a, b) for a in rights for b in lefts}
    ref = float(np.median([m[0] for m in ms.values() if m[0] is not None]))
    for (a, b), (g, mind, mind_d) in ms.items():
        k = 0.0
        if g is not None: k = strength*(ref - g)
        k = max(min(k, 0.5*T), -0.8*T)
        # never collide; keep a minimum breathing space even diagonally
        need = max(0.35*T - (mind + k), 0.15*T - (mind_d + k))
        if need > 0: k += need
        k = int(round(k/5.0)*5)
        if abs(k) >= 15: KERN[(a, b)] = k
    return ref
ref_h = kern_group(HEBREW, HEBREW)
kern_group(HEBREW, PUNCT + DIGITS); kern_group(PUNCT + DIGITS, HEBREW)
kern_group(DIGITS + PUNCT, DIGITS + PUNCT)
print('kern pairs', len(KERN), 'range', min(KERN.values()), max(KERN.values()))

# ---------------- assemble the font -----------------------------------------------------
order = ['.notdef', 'space'] + list(G) + ['quotesingle', 'geresh', 'gershayim', 'maqaf']
cmap = {G[k]['unicode']: k for k in G}
cmap.update({0x20: 'space', 0xA0: 'space', 0x27: 'quotesingle', 0x5F3: 'geresh', 0x5F4: 'gershayim', 0x5BE: 'maqaf'})
# the apostrophe/geresh reuse ONE of the user's two quote strokes; maqaf reuses the hyphen
qcs = font_contours['quotedbl']
def cx(c): return np.mean(contour_poly(c)[:,0])
single = [sorted(qcs, key=cx)[-1]]
bp = BoundsPen(None); [_emit(c, bp, 0) for c in single]
single = [[(s[0],) + tuple((p[0]-bp.bounds[0], p[1]) for p in s[1:]) for s in c] for c in single]
font_contours['quotesingle'] = single
PROF['quotesingle'] = dict(width=bp.bounds[2]-bp.bounds[0])
SB['quotesingle'] = SB['quotedbl']
ADV['quotesingle'] = round(SB['quotedbl'][0]*2 + PROF['quotesingle']['width'])
for alias, src in (('geresh', 'quotesingle'), ('gershayim', 'quotedbl'), ('maqaf', 'hyphen')):
    font_contours[alias] = font_contours[src]; SB[alias] = SB[src]; ADV[alias] = ADV[src]; PROF[alias] = PROF[src]

SPACE = round(2*T + 190)
fb = FontBuilder(UPM, isTTF=False)
fb.setupGlyphOrder(order)
fb.setupCharacterMap(cmap)
charstrings, metrics = {}, {}
for name in order:
    if name == '.notdef':
        pen = T2CharStringPen(500, None)
        pen.moveTo((50,0)); pen.lineTo((450,0)); pen.lineTo((450,700)); pen.lineTo((50,700)); pen.closePath()
        pen.moveTo((100,50)); pen.lineTo((100,650)); pen.lineTo((400,650)); pen.lineTo((400,50)); pen.closePath()
        charstrings[name] = pen.getCharString(); metrics[name] = (500, 50); continue
    if name == 'space':
        pen = T2CharStringPen(SPACE, None); charstrings[name] = pen.getCharString(); metrics[name] = (SPACE, 0); continue
    lsb = SB[name][0]
    pen = T2CharStringPen(ADV[name], None)
    draw(font_contours[name], pen, lsb)
    charstrings[name] = pen.getCharString()
    metrics[name] = (ADV[name], round(lsb))
fb.setupCFF(FAMILY.replace(' ', ''), {'FullName': FAMILY, 'FamilyName': FAMILY, 'Weight': 'Regular'}, charstrings, {})
fb.setupHorizontalMetrics(metrics)

# vertical metrics from the real extents of the handwriting
ymin = min(BoundsPen_b[1] for BoundsPen_b in [
    (lambda bp: ([_emit(c, bp, 0) for c in font_contours[k]], bp.bounds)[1])(BoundsPen(None)) for k in G])
ymax = max(BoundsPen_b[3] for BoundsPen_b in [
    (lambda bp: ([_emit(c, bp, 0) for c in font_contours[k]], bp.bounds)[1])(BoundsPen(None)) for k in G])
ASC, DESC, GAP = 760, -340, 250
fb.setupHorizontalHeader(ascent=ASC, descent=DESC, lineGap=GAP)
fb.setupNameTable({'familyName': FAMILY, 'styleName': 'Regular',
                   'uniqueFontIdentifier': FAMILY + ' Regular 1.000',
                   'fullName': FAMILY + ' Regular', 'psName': FAMILY.replace(' ', '') + '-Regular',
                   'version': 'Version 1.000', 'designer': 'Noa (handwriting)',
                   'description': 'Font made from a scan of personal Hebrew handwriting.'})
fb.setupOS2(sTypoAscender=ASC, sTypoDescender=DESC, sTypoLineGap=GAP,
            usWinAscent=int(math.ceil(ymax)) + 10, usWinDescent=int(math.ceil(-ymin)) + 10,
            sxHeight=480, sCapHeight=round(max(PROF[d]['rows'] and max(PROF[d]['rows'])*RES for d in DIGITS)),
            fsSelection=0x40 | 0x80,  # REGULAR + USE_TYPO_METRICS
            ulUnicodeRange1=(1 << 0) | (1 << 11), ulCodePageRange1=(1 << 0) | (1 << 5),
            achVendID='NOAH', usWeightClass=400)
fb.font['OS/2'].version = 4
fb.setupPost(isFixedPitch=0, underlinePosition=-120, underlineThickness=40)

pairs = '\n'.join(f'    pos {a} {b} {v};' for (a, b), v in sorted(KERN.items()))
fea = f"""
languagesystem DFLT dflt;
languagesystem hebr dflt;
languagesystem latn dflt;
feature kern {{
{pairs}
}} kern;
"""
addOpenTypeFeaturesFromString(fb.font, fea)
fb.save(OUT)
json.dump({'T': T, 'K': K, 'adv': ADV, 'sb': {k: list(map(float, v)) for k, v in SB.items()},
           'kern': {f'{a} {b}': v for (a, b), v in KERN.items()}, 'ymin': ymin, 'ymax': ymax, 'space': SPACE},
          open(WORK + '/metrics.json', 'w'), indent=1)
print('saved', OUT, 'ymin/ymax', round(ymin), round(ymax), 'space', SPACE)
