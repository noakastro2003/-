# Noa Handwriting – פונט מכתב יד

- `font/NoaHandwriting-Regular.otf` – קובץ הפונט להתקנה (OTF / CFF, עם kerning).
- `samples/sample.png` – משפטים לדוגמה בפונט.
- `samples/compare_original_vs_font.png` – כל סימן: הסריקה המקורית (למעלה) מול הפונט (למטה).
- `samples/original_scan.jpg` – הסריקה המקורית.
- `tools/` – הסקריפטים שבנו את הפונט (`extract.py` → `build_font.py` → `render_sample.py`).

## Noa Bubble – אותיות בועה

- `font/NoaBubble-Regular.otf` – הפונט.
- `samples/bubble_sample.png` – משפטים לדוגמה.
- `samples/bubble_compare_original_vs_font.png` – סריקה מול פונט, לכל סימן.
- `samples/bubble_original_scan.jpg` – הצילום המקורי.

## Noa Nikud – כתב יד עם ניקוד

- `font/NoaNikud-Regular.otf` – הפונט: אותיות, ספרות, סימנים, וניקוד (פתח, קמץ, סגול, צירה, קובוץ, שורוק/דגש, שווא, חטף פתח, חטף סגול, חיריק, חולם, ונקודות שׁ/שׂ).
- `samples/nikud_sample.png` – משפטים לדוגמה, עם ובלי ניקוד.
- `samples/nikud_compare_original_vs_font.png` – סריקה מול פונט, לכל סימן.
- `samples/nikud_original_scan.jpg` – הצילום המקורי.
- `font/NoaNikud-Bold.otf` – גרסת בולד (אותו מסלול עט, קו עבה יותר; `sheets/nikud-bold.json`).
- `samples/nikud_bold_sample.png`, `samples/nikud_regular_vs_bold.png` – דוגמאות לבולד.

## בנייה מחדש

כל דף מוגדר בקובץ `sheets/*.json` (איזה צורה בדף שייכת לאיזו אות, קו בסיס, ריווח):
```
python3 tools/extract.py sheets/bubble.json samples/bubble_original_scan.jpg WORKDIR
python3 tools/build_font.py sheets/bubble.json WORKDIR font/NoaBubble-Regular.otf
python3 tools/render_sample.py font/NoaBubble-Regular.otf samples/bubble_sample.png 96
# לדף ניקוד: render_sample.py FONT OUT 80 nikud
python3 tools/compare_glyphs.py WORKDIR font/NoaBubble-Regular.otf samples/bubble_compare_original_vs_font.png
```
דרוש: `opencv-python-headless numpy scikit-image fonttools potracer pillow` (ו-libraqm לרינדור הדוגמה).
