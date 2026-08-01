#!/usr/bin/env python3
"""
Builds beatass.html — the finished, single-file website.

Why a build step at all?
    The site has to work as ONE file with no internet: no CDN, no font
    downloads, nothing. So the fonts and the GIF library get baked
    straight into the HTML as text. Doing that by hand would make
    template.html impossible to read or edit (it'd be ~200KB of base64).

    So: you edit template.html, which has short placeholders like
    __FONT_CAVEAT__ where the big stuff goes. This script swaps the
    placeholders for the real thing and writes beatass.html.

Run it with:   python3 build.py
"""

import base64
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
TEMPLATE = HERE / "template.html"
OUTPUT = HERE / "beatass.html"

# placeholder in template.html  ->  file whose contents replace it
FONTS = {
    "__FONT_PATRICK__": HERE / "fonts" / "PatrickHand.woff2",   # body text
    "__FONT_CAVEAT__":  HERE / "fonts" / "Caveat.woff2",        # headings, labels
    "__FONT_MARKER__":  HERE / "fonts" / "Marker.woff2",        # logo, buttons
}
SCRIPTS = {
    "__GIFJS__":     HERE / "vendor" / "gif.js",          # the GIF encoder
    "__GIFWORKER__": HERE / "vendor" / "gif.worker.js",   # its background worker
}


def main() -> int:
    html = TEMPLATE.read_text(encoding="utf-8")

    # fonts go in as base64 (binary files can't sit in HTML as-is)
    for placeholder, path in FONTS.items():
        if placeholder not in html:
            print(f"!! {placeholder} is missing from template.html")
            return 1
        html = html.replace(placeholder, base64.b64encode(path.read_bytes()).decode())

    # javascript goes in as plain text
    for placeholder, path in SCRIPTS.items():
        if placeholder not in html:
            print(f"!! {placeholder} is missing from template.html")
            return 1
        html = html.replace(placeholder, path.read_text(encoding="utf-8"))

    OUTPUT.write_text(html, encoding="utf-8")
    print(f"built {OUTPUT.name} — {len(html) / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
