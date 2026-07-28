from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter


CANVAS = (1536, 1024)
FONT_PATH = "/System/Library/Fonts/Supplemental/Courier New Bold.ttf"
OUTPUT = Path(__file__).resolve().parents[1] / "public/assets/key-labels.png"

ROWS = [
    ([522, 572, 622, 672, 722, 772, 823, 873, 924, 975, 1025, 1075], 709,
     ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "−", "="]),
    ([485, 537, 589, 641, 693, 745, 797, 849, 901, 953, 1005, 1057], 750,
     list("QWERTYUIOP") + ["[", "]"]),
    ([491, 545, 599, 653, 707, 761, 815, 869, 923, 977, 1031, 1085], 799,
     list("ASDFGHJKL") + [";", "'", "RETURN"]),
    ([444, 512, 565, 619, 672, 726, 780, 834, 888, 942, 995, 1048, 1103], 841,
     ["SHIFT"] + list("ZXCVBNM") + [",", ".", "/", "\\", "SHIFT"]),
]


def centered_text(draw, center, label, font, fill):
    bounds = draw.textbbox((0, 0), label, font=font)
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    x = center[0] - width / 2
    y = center[1] - height / 2 - bounds[1]
    draw.text((x + 1, y + 2), label, font=font, fill=(10, 7, 5, 180))
    draw.text((x, y), label, font=font, fill=fill)


def main():
    image = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    glow = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    glow_draw = ImageDraw.Draw(glow)
    regular = ImageFont.truetype(FONT_PATH, 18)
    shift = ImageFont.truetype(FONT_PATH, 10)

    for centers, top, labels in ROWS:
        for center_x, label in zip(centers, labels, strict=True):
            center = (center_x, top)
            font = shift if label in {"SHIFT", "RETURN"} else regular
            centered_text(glow_draw, center, label, font, (222, 190, 117, 80))
            centered_text(draw, center, label, font, (218, 207, 177, 232))

    glow = glow.filter(ImageFilter.GaussianBlur(2.2))
    image = Image.alpha_composite(glow, image)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, optimize=True)


if __name__ == "__main__":
    main()
