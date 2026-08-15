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
import datetime
import html as html_mod
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
TEMPLATE = HERE / "template.html"
OUTPUT = HERE / "beatass.html"

SITE = "https://beatass.com"

# The side pages (privacy, terms, about, contact, 404). Each source file in
# pages/ holds ONLY its words; the shell below wraps them. That is deliberate:
# the footer has to link to all four legal pages from every page, and building
# it in one place is the only way that stays true after somebody edits a page.
PAGES = {
    "privacy.html": "Privacy",
    "terms.html": "Terms",
    "about.html": "About",
    "contact.html": "Contact",
    "404.html": "Page not found",
}
# everything in the sitemap: the app itself plus the four legal pages (never 404)
SITEMAP = ["", "privacy.html", "terms.html", "about.html", "contact.html"]

PAGE_SHELL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} - BeatAss</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#fbf7ea">
{robots}{canonical}<meta property="og:type" content="website">
<meta property="og:site_name" content="beatass">
{ogurl}<meta property="og:title" content="{title} - BeatAss">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{site}/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{icon}">
<link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<style>{css}</style>
</head>
<body>
<div class="sheet">
  <header class="head">
    <a class="word" href="/">beat<em>ass</em></a>
  </header>
  <main class="doc">
{body}
  </main>
  <footer class="foot">
    <nav><a href="/privacy.html">Privacy</a> <a href="/terms.html">Terms</a> <a href="/about.html">About</a> <a href="/contact.html">Contact</a></nav>
    <p>18+ only. beatass.com sends anonymous messages to people who did not ask for them; every message carries a one-click block link.</p>
  </footer>
</div>
</body>
</html>
"""

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

    # Cloudflare serves whatever is in public/ as static files, so the same
    # build lands there as index.html. Nothing else belongs in that folder.
    public = HERE / "public"
    public.mkdir(exist_ok=True)
    (public / "index.html").write_text(html, encoding="utf-8")

    built = build_pages(public, html)

    print(f"built {OUTPUT.name} + public/index.html — {len(html) / 1024:.0f} KB")
    print(f"built {built} side pages + robots.txt + sitemap.xml")
    return 0


def build_pages(public: pathlib.Path, app_html: str) -> int:
    """Writes the side pages, robots.txt and sitemap.xml into public/."""
    css = (HERE / "pages" / "_shared.css").read_text(encoding="utf-8")

    # reuse the app's own favicon so the side pages carry the same doll
    marker = '<link rel="icon" href="'
    if marker not in app_html:
        raise SystemExit(f"!! {marker!r} is missing from template.html — the side pages have no favicon")
    icon = app_html.split(marker, 1)[1].split('"', 1)[0]

    for slug, title in PAGES.items():
        src = (HERE / "pages" / slug).read_text(encoding="utf-8").strip()
        # first line of the source file is its meta description, then a blank line
        if "\n\n" not in src:
            raise SystemExit(
                f"!! pages/{slug} needs a one-line description, a blank line, then the page"
            )
        desc, body = src.split("\n\n", 1)
        is404 = slug == "404.html"
        (public / slug).write_text(
            PAGE_SHELL.format(
                title=title,
                desc=html_mod.escape(desc.strip(), quote=True),
                body=body.rstrip(),
                css=css,
                icon=icon,
                # A 404 lives at every wrong URL, so it gets neither a canonical
                # nor an og:url — pointing those at the homepage while the page
                # is noindex is a contradiction search engines resolve badly.
                canonical="" if is404 else f'<link rel="canonical" href="{SITE}/{slug}">\n',
                ogurl="" if is404 else f'<meta property="og:url" content="{SITE}/{slug}">\n',
                robots='<meta name="robots" content="noindex">\n' if is404 else "",
                site=SITE,
            ),
            encoding="utf-8",
        )

    (public / "robots.txt").write_text(
        "# beatass.com — the pages here are meant to be found.\n"
        "User-agent: *\n"
        "Allow: /\n"
        "# These two act on a click; a crawler must never follow one. The media\n"
        "# is deliberately NOT disallowed here — mail clients fetch those images\n"
        "# through their own proxies, and the way to keep them out of search is\n"
        "# the X-Robots-Tag: noindex header the Worker sends, which cannot\n"
        "# accidentally stop an email from rendering.\n"
        "Disallow: /block\n"
        "Disallow: /report\n"
        f"\nSitemap: {SITE}/sitemap.xml\n",
        encoding="utf-8",
    )

    # lastmod comes from the source file each page is built from, not from
    # today. Stamping every URL with the build date teaches crawlers that this
    # sitemap's dates mean nothing, and then they stop reading them.
    def lastmod(slug: str) -> str:
        src = TEMPLATE if slug == "" else HERE / "pages" / slug
        return datetime.date.fromtimestamp(src.stat().st_mtime).isoformat()

    locs = "\n".join(
        f"  <url>\n    <loc>{SITE}/{s}</loc>\n    <lastmod>{lastmod(s)}</lastmod>\n"
        f"    <changefreq>{'weekly' if s == '' else 'yearly'}</changefreq>\n"
        f"    <priority>{'1.0' if s == '' else '0.4'}</priority>\n  </url>"
        for s in SITEMAP
    )
    # the share card every pasted link shows. Regenerate with: node tools/make-og.mjs
    og = HERE / "og.png"
    if not og.is_file():
        raise SystemExit(
            "!! og.png is missing — every shared link would show a blank box. "
            "Regenerate it with: node tools/make-og.mjs"
        )
    (public / "og.png").write_bytes(og.read_bytes())

    # The email's masthead. It is fetched from the live site by every email we
    # send, so if it stops shipping, every email loses its head and nobody finds
    # out until someone opens one. Regenerate with: node tools/make-email-header.mjs
    header = HERE / "email-header.png"
    if not header.is_file():
        raise SystemExit(
            "!! email-header.png is missing — every email would arrive headless. "
            "Regenerate it with: node tools/make-email-header.mjs"
        )
    (public / "email-header.png").write_bytes(header.read_bytes())

    # Home-screen icon, straight from the design system. The <head> links to
    # /apple-touch-icon.png, so skipping this copy would 404 it in production.
    touch = HERE / "design" / "assets" / "brand" / "png" / "apple-touch-180.png"
    if not touch.is_file():
        raise SystemExit("!! design/assets/brand/png/apple-touch-180.png is missing")
    (public / "apple-touch-icon.png").write_bytes(touch.read_bytes())

    # The doll's sound effects. Made once with ElevenLabs by
    # tools/sfx/generate.mjs and committed like any other asset - the site must
    # never depend on an outside service being up to make a noise.
    sfx_src = HERE / "design" / "assets" / "sfx"
    if sfx_src.is_dir():
        sfx_out = public / "sfx"
        sfx_out.mkdir(exist_ok=True)
        n = 0
        for f in sorted(sfx_src.glob("*.mp3")):
            (sfx_out / f.name).write_bytes(f.read_bytes())
            n += 1
        print(f"copied {n} sound effects into public/sfx/")
    else:
        print("!! no design/assets/sfx - the doll will fall back to synthesised sound")

    # The bug reporter, copied rather than inlined. Everything else the page
    # needs is baked in, because it has to work as one file. This is the
    # deliberate exception: almost nobody opens the report sheet, so making
    # every visitor download it would be a tax paid by the wrong people. The
    # page carries a small stub instead and fetches these two on first click.
    # bugreport.js ships with the screenshot library glued on the front, the
    # same way vendor/gif.js is baked into the page: the library is committed
    # pre-built, so a normal build stays "python3 build.py" with no bundler.
    # Rebuild the vendored file only when the dependency changes:
    #   npx esbuild <entry> --bundle --minify --format=iife \
    #     --outfile=bugreport/vendor-screenshot.js
    parts = []
    for name in ("vendor-screenshot.js", "bugreport.js"):
        src = HERE / "bugreport" / name
        if not src.is_file():
            raise SystemExit(
                f"!! bugreport/{name} is missing - the report button would break. "
                "It is a real file, not generated; restore it from git."
            )
        parts.append(src.read_text(encoding="utf-8"))
    (public / "bugreport.js").write_text("\n;\n".join(parts), encoding="utf-8")

    css = HERE / "bugreport" / "bugreport.css"
    if not css.is_file():
        raise SystemExit("!! bugreport/bugreport.css is missing")
    (public / "bugreport.css").write_text(css.read_text(encoding="utf-8"), encoding="utf-8")

    size = (public / "bugreport.js").stat().st_size / 1024
    print(f"copied the bug reporter into public/ ({size:.0f} KB js + css, loaded on demand)")

    # Real favicon files: Google's favicon crawler cannot read the inline
    # data-URI icon, so search results show a grey globe without these.
    png = HERE / "design" / "assets" / "brand" / "png"
    for src, dst in [
        ("icon-512.png", "icon-512.png"),
        ("favicon-32.png", "favicon-32.png"),
        ("favicon-48.png", "favicon-48.png"),
        ("favicon.ico", "favicon.ico"),
    ]:
        f = png / src
        if not f.is_file():
            raise SystemExit(f"!! design/assets/brand/png/{src} is missing")
        (public / dst).write_bytes(f.read_bytes())

    (public / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{locs}\n</urlset>\n",
        encoding="utf-8",
    )
    return len(PAGES)


if __name__ == "__main__":
    sys.exit(main())
