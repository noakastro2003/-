"""Extract glyphs from a handwriting sheet: deskew, separate ink from paper,
smooth the strokes (without adding/removing strokes) and trace outlines.

usage: extract.py SHEET_CONFIG.json SOURCE_IMAGE WORKDIR"""
import json, sys, math
import cv2, numpy as np, potrace
from skimage.morphology import skeletonize

CFG, SRC, OUT = sys.argv[1:4]
C = json.load(open(CFG))
UP = 4  # supersampling factor for tracing
GLYPHS = {k: (v['unicode'], [tuple(p) for p in v['parts']], v['row']) for k, v in C['glyphs'].items()}
BASE_SITTING = set(C['base_sitting'])

g = cv2.imread(SRC, 0).astype(np.float32)
for x0, y0, x1, y1 in C.get('blank', []):          # outside the paper (table, page edge, shadow)
    g[y0:y1, x0:x1] = 255
bg = cv2.GaussianBlur(cv2.morphologyEx(g, cv2.MORPH_CLOSE, np.ones((31,31),np.uint8)), (0,0), 15)
norm = np.clip(g/bg*255, 0, 255).astype(np.uint8)
TH0, bw = cv2.threshold(norm, 0, 1, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
ink = 1.0 - norm.astype(np.float32)/255.0  # 0 = paper, high = pen
TH = 1.0 - TH0/255.0
n, lab, st, _ = cv2.connectedComponentsWithStats(bw, 8)
def comp_at(x, y):
    for i in range(1, n):
        if st[i,0] == x and st[i,1] == y: return i
    raise SystemExit(f'no component at {(x,y)}')
members = {k: [comp_at(*p) for p in v[1]] for k, v in GLYPHS.items()}

# --- deskew: fit straight lines through the bottoms of baseline letters of each row
slopes = []
for row in sorted({r for _, _, r in GLYPHS.values()}):
    pts = [(st[members[k][0],0]+st[members[k][0],2]/2, max(st[i,1]+st[i,3] for i in members[k]))
           for k,(u,cs,r) in GLYPHS.items() if r == row and k in BASE_SITTING]
    if len(pts) < 3: continue
    xs, ys = np.array(pts).T
    a, b = np.polyfit(xs, ys, 1)
    res = np.abs(ys - (a*xs+b)); keep = res < res.max()   # one robust pass
    a, b = np.polyfit(xs[keep], ys[keep], 1)
    slopes.append(a)
angle = math.degrees(math.atan(float(np.median(slopes))))
print('deskew angle (deg):', round(angle, 3), 'row slopes', np.round(slopes, 4))
H, W = g.shape
M = cv2.getRotationMatrix2D((W/2, H/2), angle, 1.0)
ink_r = cv2.warpAffine(ink, M, (W, H), flags=cv2.INTER_CUBIC, borderValue=0)
lab_r = cv2.warpAffine(lab.astype(np.float32), M, (W, H), flags=cv2.INTER_NEAREST, borderValue=0).astype(np.int32)

boxes = {}
for k in GLYPHS:
    ys, xs = np.nonzero(np.isin(lab_r, members[k]))
    boxes[k] = (xs.min(), ys.min(), xs.max()+1, ys.max()+1)
height = {k: boxes[k][3]-boxes[k][1] for k in GLYPHS}

# --- per-row size: rows written noticeably smaller/larger are brought to the common size
# with ONE uniform factor per row (aspect ratio and in-row proportions untouched)
rows_letters = C['rows_with_letters']
row_body = {r: float(np.median([height[k] for k,(u,c,rr) in GLYPHS.items() if rr == r and k in BASE_SITTING]))
            for r in rows_letters}
ref_body = float(np.median([row_body[r] for r in C.get('reference_rows', rows_letters)]))
row_scale = {r: 1.0 for r in {r for _, _, r in GLYPHS.values()}}
for r in C.get('normalize_rows', []) if C.get('normalize_row_size') else []:
    row_scale[r] = ref_body / row_body[r]
print('row body heights', {r: round(v) for r, v in row_body.items()}, 'row scale', {r: round(v, 3) for r, v in row_scale.items()})

# --- baselines
rows = {}
for r in row_scale:
    src = C.get('row_baseline_from', {}).get(str(r))
    lst = src if src else [k for k,(u,c,rr) in GLYPHS.items() if rr == r and k in BASE_SITTING]
    if lst: rows[r] = float(np.median([boxes[k][3] for k in lst]))
print('row baselines', rows)

def trace(mask):
    bmp = potrace.Bitmap(~mask)  # potracer treats False as ink
    path = bmp.trace(turdsize=40, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
                     alphamax=1.15, opticurve=True, opttolerance=0.6)
    out = []
    for curve in path:
        segs = [('M', (curve.start_point.x, curve.start_point.y))]
        for s in curve.segments:
            if s.is_corner:
                segs.append(('L', (s.c.x, s.c.y))); segs.append(('L', (s.end_point.x, s.end_point.y)))
            else:
                segs.append(('C', (s.c1.x, s.c1.y), (s.c2.x, s.c2.y), (s.end_point.x, s.end_point.y)))
        out.append(segs)
    return out

def topology(mask):
    """(#pieces, #holes) – used to prove smoothing neither broke nor joined strokes"""
    m = mask.astype(np.uint8)
    pieces = cv2.connectedComponents(m, connectivity=8)[0] - 1
    holes = cv2.connectedComponents(1 - m, connectivity=4)[0] - 2   # minus the outside
    return pieces, holes

result = {'rows': rows, 'angle': angle, 'row_scale': row_scale, 'glyphs': {}}
PAD = 8
blur = C.get('blur_px', 1.6); speck = C.get('speck_px', 60); thf = C.get('threshold_factor', 1.0)
stroke_px = C.get('stroke_px')
problems = []
for k, (uni, comps, row) in GLYPHS.items():
    x0, y0, x1, y1 = boxes[k]
    x0 -= PAD; y0 -= PAD; x1 += PAD; y1 += PAD
    crop = ink_r[y0:y1, x0:x1].copy()
    own = np.isin(lab_r[y0:y1, x0:x1], members[k]).astype(np.uint8)
    raw = own.copy()
    own = cv2.dilate(own, np.ones((5,5), np.uint8))  # keep only this glyph's own strokes
    crop *= own
    s = row_scale[row]
    # target topology: the pen line as drawn, bridging only 1px photo drop-outs; it must not
    # merge strokes that are separate on paper
    rawU = cv2.resize(raw, None, fx=UP, fy=UP, interpolation=cv2.INTER_NEAREST)
    t_raw = topology(rawU)
    closed = cv2.morphologyEx(raw, cv2.MORPH_CLOSE, np.ones((3,3), np.uint8))
    t_cl = topology(cv2.resize(closed, None, fx=UP, fy=UP, interpolation=cv2.INTER_NEAREST))
    use_closed = t_cl[0] == t_raw[0]
    target = t_cl if use_closed else t_raw
    # ink field (0.5 == the scan's own ink threshold), low-passed to smooth pen tremor
    big = cv2.resize(crop, None, fx=UP, fy=UP, interpolation=cv2.INTER_CUBIC)
    field = cv2.GaussianBlur(np.clip(big / (2*TH*thf), 0, 1), (0,0), blur*UP)
    bridgeU = np.zeros_like(field, bool)
    if use_closed:   # where the photo dropped ~1px of a continuous line, bridge exactly there
        bridge = closed.astype(bool) & ~raw.astype(bool)
        bridge = (cv2.dilate(bridge.astype(np.uint8), np.ones((3,3), np.uint8)).astype(bool) & closed.astype(bool)).astype(np.float32)
        bridgeU = cv2.GaussianBlur(cv2.resize(bridge, None, fx=UP, fy=UP, interpolation=cv2.INTER_LINEAR), (0,0), blur*UP) > 0.3
    for f in [0.5, 0.45, 0.4, 0.35, 0.3]:
        mask = field > f
        nn, ll, ss, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
        for i in range(1, nn):
            if ss[i,4] < speck*UP*UP/16: mask[ll == i] = False
        if stroke_px and s > 1.0001:
            # the row gets enlarged; thin the pen line back to the common pen width
            r = (s - 1) * stroke_px / 2 / s * UP
            thin = cv2.distanceTransform(mask.astype(np.uint8), cv2.DIST_L2, 5) > r
            # never let thinning cut a faint stretch of the line: keep its centre line
            spine = cv2.dilate(skeletonize(mask).astype(np.uint8), np.ones((5,5), np.uint8)).astype(bool) & mask
            mask = thin | spine
        mask = mask | (bridgeU & cv2.dilate(mask.astype(np.uint8), np.ones((9,9), np.uint8)).astype(bool))
        t_new = topology(mask)
        if t_new == target: break
    if t_new != target: problems.append((k, target, t_new))
    contours = trace(mask)
    if C.get('debug'): cv2.imwrite(OUT + f'/mask_{k}.png', (~mask).astype(np.uint8)*255)
    hang = C.get('hang_baseline', {}).get(k)
    if hang:                      # final letters of a row without regular letters: hang from the top line
        base = boxes[hang][1] + ref_body / s
    elif k in BASE_SITTING:
        base = boxes[k][3]        # snap the letter's own bottom to the baseline
    else:
        base = rows[row]          # keep natural height relative to the line
    result['glyphs'][k] = dict(unicode=uni, row=row, origin=[x0, y0], base=base, up=UP, scale=s,
                               contours=contours, inkbox=[int(v) for v in boxes[k]],
                               mask_shape=list(mask.shape))
    print(f'{k:11s} w={boxes[k][2]-boxes[k][0]:3d} h={height[k]:3d} '
          f'bottom-base={boxes[k][3]-base:+6.1f} contours={len(contours)} topo={t_new} thr={f:.2f}')
if problems:
    print('TOPOLOGY CHANGED (smoothing altered strokes):', problems)
json.dump(result, open(OUT + '/glyphs.json', 'w'), default=float)
