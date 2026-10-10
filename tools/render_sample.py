"""Render sample text with the built font (HarfBuzz shaping via Pillow/raqm: RTL + kerning)."""
import sys
from PIL import Image, ImageDraw, ImageFont
FONT, OUT = sys.argv[1], sys.argv[2]
SRC = sys.argv[3] if len(sys.argv) > 3 else None
lines = [
    'שלום, קוראים לי נועה ואני כותבת בכתב היד שלי!',
    'הדג הקטן שחה בים הכחול וצחק מול הספינה.',
    'זה פונט אמיתי - האם הוא נראה "טבעי"?',
    'כמה עולה קפה? 12 שקלים (בערך) ועוד 3 לעוגה.',
    'צריך לקנות חלב, לחם, גבינה וביצים ב-9 בבוקר.',
    'אבגדהוזחטי כלמנסעפצקר שתךםןףץ',
    '0123456789 .,!?-"()',
]
f = ImageFont.truetype(FONT, 64, layout_engine=ImageFont.Layout.RAQM)
W, LH, M = 1900, 120, 60
img = Image.new('RGB', (W, M*2 + LH*len(lines) + (0 if not SRC else 40)), 'white')
d = ImageDraw.Draw(img)
y = M
for t in lines:
    d.text((W - M, y), t, font=f, fill=(20, 20, 30), direction='rtl', anchor='ra', language='he')
    y += LH
img.save(OUT)
print(img.size)
