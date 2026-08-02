#!/usr/bin/env python3
"""
Pulls the doll's artwork out of design/assets/brand/svg/doll-*.svg and bakes it
into template.html as the ART constant (between the ART:BEGIN / ART:END
markers). Run it again whenever the design files change:

    python3 tools/extract-doll-art.py && python3 build.py
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).parent.parent
SVG = ROOT / "design" / "assets" / "brand" / "svg"
TEMPLATE = ROOT / "template.html"

GROUPS = ["arm-left", "arm-right", "leg-left", "leg-right", "body", "stitches", "head", "blush"]
STATES = ["blink", "hurt", "flinch", "loved", "panic"]


def paths_of(group_html):
    out = []
    for m in re.finditer(r"<path ([^>]+?)/?>", group_html):
        attrs = dict(re.findall(r'([a-z-]+)="([^"]*)"', m.group(1)))
        e = {"d": attrs["d"]}
        if attrs.get("fill", "none") != "none":
            e["f"] = attrs["fill"]
        if attrs.get("stroke"):
            e["s"] = attrs["stroke"]
        if attrs.get("stroke-width"):
            e["w"] = float(attrs["stroke-width"])
        if attrs.get("opacity"):
            e["o"] = float(attrs["opacity"])
        out.append(e)
    return out


def group(svg, gid):
    m = re.search(r'<g id="%s"[^>]*>(.*?)</g>' % gid, svg, re.S)
    return m.group(1) if m else None


def main() -> int:
    base = (SVG / "doll-default.svg").read_text()
    art = {gid: paths_of(group(base, gid)) for gid in GROUPS}
    piv = {}
    for gid in GROUPS[:4]:
        m = re.search(r'<g id="%s" data-pivot="([\d. ]+)"' % gid, base)
        piv[gid] = [float(v) for v in m.group(1).split()]
    faces = {"default": paths_of(group(base, "face-default"))}
    for st in STATES:
        faces[st] = paths_of(group((SVG / f"doll-{st}.svg").read_text(), f"face-{st}"))

    missing = [k for k, v in {**art, **faces}.items() if not v]
    if missing:
        raise SystemExit(f"!! empty groups in the design SVGs: {missing}")

    js = "const ART = " + json.dumps({"art": art, "piv": piv, "faces": faces},
                                     separators=(",", ":")) + ";"
    html = TEMPLATE.read_text()
    marked = re.sub(r"/\* ART:BEGIN \*/.*?/\* ART:END \*/",
                    "/* ART:BEGIN */\n" + js + "\n/* ART:END */",
                    html, count=1, flags=re.S)
    if marked == html:
        raise SystemExit("!! ART:BEGIN/ART:END markers not found in template.html")
    TEMPLATE.write_text(marked)
    print(f"baked {sum(len(v) for v in art.values())} body paths + "
          f"{sum(len(v) for v in faces.values())} face paths into template.html")
    return 0


if __name__ == "__main__":
    sys.exit(main())
