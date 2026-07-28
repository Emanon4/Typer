from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "reference/feedback/paper-bail-reference.png"
OUTPUT = ROOT / "public/assets/paper-bail-reference.png"

# The supplied crop is 930 × 170. This band contains only the paper bail rod
# and its two rubber rollers; the text above and below remains outside it.
CROP = (72, 66, 827, 86)


def clamp(value: float, minimum: int = 0, maximum: int = 255) -> int:
    return int(max(minimum, min(maximum, round(value))))


def main() -> None:
    source = Image.open(SOURCE).convert("RGB").crop(CROP)
    width, height = source.size
    pixels = source.load()
    output = Image.new("RGBA", source.size, (0, 0, 0, 0))
    result = output.load()

    for x in range(width):
        # The first four rows are clean wall/paper and give a local background
        # sample that follows the source crop's lighting falloff.
        background = tuple(
            sum(pixels[x, y][channel] for y in range(4)) / 4
            for channel in range(3)
        )
        for y in range(height):
            red, green, blue = pixels[x, y]
            distance = (
                (red - background[0]) ** 2
                + (green - background[1]) ** 2
                + (blue - background[2]) ** 2
            ) ** 0.5
            alpha = clamp((distance - 5) * 5.6)
            if alpha < 10:
                continue

            normalized_alpha = max(alpha / 255, 0.08)
            foreground = tuple(
                clamp(
                    (channel - background[index] * (1 - normalized_alpha))
                    / normalized_alpha
                )
                for index, channel in enumerate((red, green, blue))
            )
            result[x, y] = (*foreground, alpha)

    alpha = output.getchannel("A").filter(ImageFilter.GaussianBlur(0.28))
    output.putalpha(alpha)
    output = output.resize((width * 2, height * 2), Image.Resampling.LANCZOS)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    output.save(OUTPUT, optimize=True)


if __name__ == "__main__":
    main()
