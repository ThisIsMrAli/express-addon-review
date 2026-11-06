"""Cut a plain studio backdrop out of one floating object.

Floods from the image edge through pixels that match their neighbor, and stops
at the object's silhouette. A chroma-only cut eats chrome and pale glass.
"""
import sys
from PIL import Image, ImageFilter

def main():
    src, dest = sys.argv[1], sys.argv[2]
    image = Image.open(src).convert("RGBA")
    width, height = image.size
    pixels = image.load()
    edges = image.convert("L").filter(ImageFilter.FIND_EDGES).load()
    seen = bytearray(width * height)
    queue = []

    def seed(x, y):
        index = y * width + x
        if seen[index]:
            return
        seen[index] = 1
        queue.append((x, y))

    for x in range(width):
        seed(x, 0)
        seed(x, height - 1)
    for y in range(height):
        seed(0, y)
        seed(width - 1, y)

    head = 0
    while head < len(queue):
        x, y = queue[head]
        head += 1
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if nx < 0 or ny < 0 or nx >= width or ny >= height:
                continue
            index = ny * width + nx
            if seen[index]:
                continue
            nr, ng, nb, _ = pixels[nx, ny]
            dist = abs(nr - r) + abs(ng - g) + abs(nb - b)
            edge = edges[nx, ny]
            # Soft paper, including a gentle gradient. A hard silhouette stops the fill.
            if dist > 28 or edge > 42:
                continue
            seen[index] = 1
            queue.append((nx, ny))

    image.save(dest)

if __name__ == "__main__":
    main()
