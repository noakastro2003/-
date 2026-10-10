"""Extract glyphs from the handwriting sheet: deskew, separate ink from paper,
smooth the strokes (without adding/removing strokes) and trace outlines."""
import json, sys, math
import cv2, numpy as np, potrace

SRC, OUT = sys.argv[1], sys.argv[2]
UP = 4  # supersampling factor for tracing

# glyph name -> unicode, components given by top-left (x,y) of their bbox in the source
GLYPHS = {
 # row 1
 'alef': (0x5D0, [(1019,420),(993,418)], 1), 'bet': (0x5D1, [(873,411),(873,438)], 1),
 'gimel': (0x5D2, [(778,406)], 1), 'dalet': (0x5D3, [(688,403)], 1),
 'he': (0x5D4, [(568,407),(579,430)], 1), 'vav': (0x5D5, [(470,400)], 1),
 'zayin': (0x5D6, [(382,400)], 1), 'het': (0x5D7, [(282,410)], 1),
 'tet': (0x5D8, [(166,379)], 1), 'yod': (0x5D9, [(105,405)], 1),
 # row 2
 'kaf': (0x5DB, [(1012,572)], 2), 'lamed': (0x5DC, [(865,529)], 2),
 'mem': (0x5DE, [(774,557)], 2), 'nun': (0x5E0, [(668,549)], 2),
 'samekh': (0x5E1, [(580,549)], 2), 'ayin': (0x5E2, [(478,530)], 2),
 'pe': (0x5E4, [(379,543)], 2), 'tsadi': (0x5E6, [(291,547)], 2),
 'qof': (0x5E7, [(215,548),(223,579)], 2), 'resh': (0x5E8, [(140,552)], 2),
 # row 3
 'shin': (0x5E9, [(987,688)], 3), 'tav': (0x5EA, [(861,702)], 3),
 'finalkaf': (0x5DA, [(751,708)], 3), 'finalmem': (0x5DD, [(642,710)], 3),
 'finalnun': (0x5DF, [(561,701)], 3), 'finalpe': (0x5E3, [(422,645)], 3),
 'finaltsadi': (0x5E5, [(282,652)], 3),
 # row 4
 'zero': (0x30, [(962,943)], 4), 'one': (0x31, [(172,911)], 4), 'two': (0x32, [(235,921)], 4),
 'three': (0x33, [(321,914)], 4), 'four': (0x34, [(411,918)], 4), 'five': (0x35, [(510,926)], 4),
 'six': (0x36, [(586,927)], 4), 'seven': (0x37, [(656,920)], 4), 'eight': (0x38, [(775,915)], 4),
 'nine': (0x39, [(860,933)], 4),
 # row 5
 'period': (0x2E, [(519,1192)], 5), 'comma': (0x2C, [(563,1189)], 5),
 'exclam': (0x21, [(611,1111),(626,1203)], 5), 'question': (0x3F, [(652,1110),(685,1206)], 5),
 'hyphen': (0x2D, [(764,1163)], 5), 'quotedbl': (0x22, [(849,1107),(862,1106)], 5),
 'parenleft': (0x28, [(945,1112)], 5), 'parenright': (0x29, [(1014,1112)], 5),
}
# letters sitting on the baseline in the user's writing (bottom snapped to baseline);
# everything else keeps its height relative to the row's baseline (descenders, yod, marks)
BASE_SITTING = {'alef','bet','gimel','dalet','he','vav','zayin','het','tet',
  'kaf','lamed','mem','samekh','ayin','pe','tsadi','resh',
  'shin','tav','finalmem','zero','one','two','three','four','five','six','seven','eight'}  # nun and nine descend in this hand

g = cv2.imread(SRC, 0).astype(np.float32)
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
for row in (1,2,3,4):
    pts = [(st[c,0]+st[c,2]/2, max(st[i,1]+st[i,3] for i in members[k]))
           for k,(u,cs,r) in GLYPHS.items() if r == row and k in BASE_SITTING for c in members[k][:1]]
    xs, ys = np.array(pts).T
    a, b = np.polyfit(xs, ys, 1)
    # one robust pass: drop the worst outlier
    res = np.abs(ys - (a*xs+b)); keep = res < res.max()
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
    m = np.isin(lab_r, members[k])
    ys, xs = np.nonzero(m)
    boxes[k] = (xs.min(), ys.min(), xs.max()+1, ys.max()+1)
# row baselines (after deskew): median bottom of baseline letters
rows = {}
for row in (1,2,3,4):
    rows[row] = float(np.median([boxes[k][3] for k,(u,c,r) in GLYPHS.items() if r == row and k in BASE_SITTING]))
rows[5] = float(np.median([boxes[k][3] for k in ('period','exclam','question')]))
print('row baselines', rows)

def trace(mask_f):
    """mask_f: float ink image (UP-scaled). returns list of closed contours, each a list of
    segments ('L', p) / ('C', c1, c2, p), coordinates in UP-scaled pixels, y down."""
    bmp = potrace.Bitmap(~mask_f)  # potracer treats False as ink
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

result = {'rows': rows, 'angle': angle, 'glyphs': {}}
PAD = 6
for k, (uni, comps, row) in GLYPHS.items():
    x0, y0, x1, y1 = boxes[k]
    x0 -= PAD; y0 -= PAD; x1 += PAD; y1 += PAD
    crop = ink_r[y0:y1, x0:x1].copy()
    own = np.isin(lab_r[y0:y1, x0:x1], members[k]).astype(np.uint8)
    own = cv2.dilate(own, np.ones((5,5), np.uint8))  # keep only this glyph's own strokes
    crop *= own
    big = cv2.resize(crop, None, fx=UP, fy=UP, interpolation=cv2.INTER_CUBIC)
    # smooth pen tremor: low-pass the ink field, then re-threshold at the same level
    big = cv2.GaussianBlur(big, (0,0), 1.6*UP)
    mask = big > TH  # same ink level as the scan: keeps the pen weight
    # drop specks that the blur may separate (no new strokes, no lost strokes)
    nn, ll, ss, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    for i in range(1, nn):
        if ss[i,4] < 60*UP*UP/16: mask[ll == i] = False
    contours = trace(mask)
    if k in BASE_SITTING:
        base = boxes[k][3]           # snap the letter's own bottom to the baseline
    else:
        base = rows[row]             # keep natural height relative to the line
    result['glyphs'][k] = dict(unicode=uni, row=row, origin=[x0, y0], base=base, up=UP,
                               contours=contours, inkbox=[int(v) for v in boxes[k]],
                               mask_shape=list(mask.shape))
    np.save(OUT + f'/mask_{k}.npy', mask)
    print(f'{k:11s} w={boxes[k][2]-boxes[k][0]:3d} h={boxes[k][3]-boxes[k][1]:3d} '
          f'bottom-row={boxes[k][3]-rows[row]:+6.1f} contours={len(contours)}')
json.dump(result, open(OUT + '/glyphs.json', 'w'), default=float)
