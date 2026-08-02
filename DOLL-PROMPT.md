# Claude Design brief — the beatass doll character

Copy everything below the line into a new Claude Design project. When the art
comes back, bring the SVG files to a coding session and they get wired into the
site (the six faces below map one-to-one onto states the code already has).

---

## What this is for

beatass.com is a small web toy. A visitor types the thing they would never say
to someone's face, takes their feelings out on a little voodoo doll (punch it,
stick pins in it, set it on fire, or be kind to it), and the site emails the
recording plus the message anonymously to the person it is about.

The whole site looks like a page from a school notebook: cream paper, printed
ruled lines, ballpoint pen, a red margin line, a yellow highlighter for
emphasis. Everything looks drawn by a bored student during a lesson. Nothing
looks like an app.

## The job

Design the doll himself — the single most important thing in the product. This
is a character sheet plus final vector art, not a mockup of a website. We will
rebuild him in code from your art, so the delivery format section at the bottom
matters as much as the looks.

## Who he is

A small hand-sewn plush voodoo doll who was yanked out of nowhere onto this
page one second ago and does not know why he is here.

His resting mood is anxious and a little scared: eyes slightly wide, brows up
and tilted, small startled posture, feet dangling — like someone who just heard
their name called in a room full of strangers. He suspects something is about
to happen to him. He is right.

He is cute, but homemade-cute: a stuffed doll somebody sewed and then drew in
ballpoint pen. Never a glossy cartoon.

He hangs from a thin string attached to the BACK of his head — a puppet, not a
noose. This distinction is load-bearing; he must never read as hanged.

Body plan (keep this — it is already live as the brand): big round head, two
solid dot eyes, pink cheek blush, small mouth; a chubby bean-shaped body with a
stitched seam down the tummy; stubby rounded arms and legs. Blue ballpoint
outline, soft off-white plush fill.

## The six faces he must have

The site swaps his face depending on what the visitor does to him. Draw all six
on the same body:

1. **Just arrived (the default).** Anxious, startled, "where am I?" — wide-ish
   dot eyes, raised uneven worried brows, a small uncertain mouth, optionally
   one tiny sweat drop by his temple. This is the face people see first and the
   heart of the character.
2. **Flinch.** Braced for an incoming hit: eyes pressed low or squeezed,
   shoulders up, mouth a tight little o.
3. **Hurt.** X's for eyes, a wobbly frown. He has taken too much.
4. **Loved.** Heart eyes, a real smile, cheeks glowing. Someone chose to be
   kind to him instead.
5. **Panic.** He is on fire: round open mouth, eyes wide, both arms thrown up.
6. **Blink.** The default face with the eyes as short horizontal lines, for the
   idle animation.

## Hard rules — color and line

| Use | Hex |
|---|---|
| Ballpoint blue — every outline and the eyes | `#26356e` |
| Paper cream — the page behind him | `#fbf7ea` |
| Plush off-white — his fill | `#fffdf5` |
| Red pen — accents, tiny stitches, marks | `#cf3a2d` |
| Blush pink — cheeks, used at roughly 30% opacity | `#e0507f` |
| Highlighter yellow — only if a swatch needs it | `#ffe873` |

- Wobbly hand-drawn line with slightly uneven weight. No corner is perfect, no
  circle is a true circle. It must look drawn in one sitting with a pen.
- Flat color and line only. No gradients, no soft shadows, no blurs, no filters
  — the art gets redrawn on an HTML canvas and anything but flat shapes breaks.
- No emoji, nothing 3D, nothing glossy.

## What to deliver — the format is half the job

- **SVG, pure vector.** viewBox `0 0 150 210` preferred (that is what the site
  uses today); if you change it, keep every state on the identical viewBox so
  the faces can be swapped without anything shifting.
- Every part in its own named group: `string`, `head`, `blush`,
  `face-default`, `face-flinch`, `face-hurt`, `face-loved`, `face-panic`,
  `face-blink`, `body`, `stitches`, `arm-left`, `arm-right`, `leg-left`,
  `leg-right`.
- Limbs drawn as separate pieces that connect under the body — he is animated:
  he swings on his string, his legs dangle, his arms rise when he panics.
- Keep his tummy relatively clean. The site paints bruises, plasters, pins,
  scorch marks and lipstick kisses onto his body while the visitor plays; busy
  texture there fights with the damage.
- One extra: his head alone, simplified until it survives at 16 pixels, for the
  favicon (the tiny icon in a browser tab).

## What NOT to do

- Pixar-cute: giant sparkly eyes, gloss, rim light, mascot poses, merch smile.
  He was drawn by a bored student; keep him that way.
- Perfect geometry or clean vector minimalism. If it looks like a logo kit, it
  is wrong.
- The noose read. String from the back of the head, body hanging at a slight
  tilt, clearly alive and worried.
- Anything gory. Wounds and damage are the site's job at runtime, not the
  art's.
