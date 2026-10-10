"""Side-by-side check: each original handwritten sign (top) vs. the font glyph (bottom)."""
import sys, json
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
WORK, FONT, OUT = sys.argv[1:4]
P = json.load(open(WORK + '/glyphs.json'))
g = cv2.imread(WORK + '/src.jpg')
M = cv2.getRotationMatrix2D((g.shape[1]/2, g.shape[0]/2), P['angle'], 1.0)
g = cv2.warpAffine(g, M, (g.shape[1], g.shape[0]), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
src = Image.fromarray(cv2.cvtColor(g, cv2.COLOR_BGR2RGB))
names = list(P['glyphs'])
font = ImageFont.truetype(FONT, 150, layout_engine=ImageFont.Layout.BASIC)
lab = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
CW, CH, COLS = 170, 420, 12
rows = (len(names)+COLS-1)//COLS
img = Image.new('RGB', (CW*COLS, CH*rows), 'white'); d = ImageDraw.Draw(img)
S = 150/1000*7.805   # same scale as the font render: px per source px
for i, k in enumerate(names):
    G = P['glyphs'][k]; x0, y0, x1, y1 = G['inkbox']; base = G['base']
    cx, cy = (i % COLS)*CW, (i//COLS)*CH
    # source crop placed on the same baseline as the font render
    top = int(base - 150/ S); bot = int(base + 60/S)
    crop = src.crop((x0-4, top, x1+4, bot)).resize((int((x1-x0+8)*S), int((bot-top)*S)))
    img.paste(crop, (cx+10, cy+10))
    by = cy + 10 + int((base-top)*S)
    d.line((cx, by, cx+CW, by), fill=(255, 150, 150))
    d.text((cx+10, by+ 230 - 10), chr(G['unicode']), font=font, fill='black', anchor='ls')
    d.line((cx, by+220, cx+CW, by+220), fill=(255, 150, 150))
    d.text((cx+5, cy+CH-22), k, font=lab, fill=(80, 80, 200))
    d.line((cx+CW-1, cy, cx+CW-1, cy+CH), fill=(220, 220, 220))
img.save(OUT)
