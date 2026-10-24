"""Cut an image on a white background into a transparent webp for the game.

    python3 tools/prepare_assets.py RAW_IMAGE NAME [MAX_SIDE]

Writes assets/NAME.webp. Needs: pillow numpy scipy.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage


def cutout(im, max_side=480):
    a = np.asarray(im.convert("RGB")).astype(int)
    mn, mx = a.min(2), a.max(2)
    bgish = (mn > 228) & ((mx - mn) < 22)
    lab, _ = ndimage.label(bgish)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    alpha = np.where(bg, 0, 255).astype(float)
    near = ndimage.binary_dilation(bg, iterations=2) & ~bg
    light = (mn - 200).clip(0, 55) / 55.0
    alpha[near] = 255 * (1 - light[near] * 0.8)
    alpha = ndimage.gaussian_filter(alpha, 0.6)
    alpha[~ndimage.binary_dilation(bg, iterations=3)] = 255
    out = Image.fromarray(np.dstack([a, alpha.clip(0, 255)]).astype(np.uint8), "RGBA")
    out = out.crop(out.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox())
    out.thumbnail((max_side, max_side), Image.LANCZOS)
    return out


if __name__ == "__main__":
    src, name = sys.argv[1], sys.argv[2]
    side = int(sys.argv[3]) if len(sys.argv) > 3 else 480
    img = cutout(Image.open(src), side)
    img.save(f"assets/{name}.webp", "WEBP", quality=88, method=6)
    print(name, img.size)
