# Noa Handwriting – פונט מכתב יד

- `font/NoaHandwriting-Regular.otf` – קובץ הפונט להתקנה (OTF / CFF, עם kerning).
- `samples/sample.png` – משפטים לדוגמה בפונט.
- `samples/compare_original_vs_font.png` – כל סימן: הסריקה המקורית (למעלה) מול הפונט (למטה).
- `samples/original_scan.jpg` – הסריקה המקורית.
- `tools/` – הסקריפטים שבנו את הפונט (`extract.py` → `build_font.py` → `render_sample.py`).

בנייה מחדש:
```
python3 tools/extract.py samples/original_scan.jpg WORKDIR
python3 tools/build_font.py WORKDIR font/NoaHandwriting-Regular.otf
python3 tools/render_sample.py font/NoaHandwriting-Regular.otf samples/sample.png
```
דרוש: `opencv-python-headless numpy fonttools potracer pillow` (ו-libraqm לרינדור הדוגמה).
