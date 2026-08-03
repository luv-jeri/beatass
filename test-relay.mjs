/*
 * The reply relay's one job: pass on what somebody actually typed, and nothing
 * else. Mail clients staple the entire original message onto every reply, so
 * without stripping, a two-letter answer arrives buried under a wall of "> ".
 * That shipped once (2026-08-03) and looked terrible; these cases are the
 * receipts that it cannot come back.
 *
 * Run: node test-relay.mjs
 */
import assert from 'node:assert';
import { stripQuoted, htmlToText } from './src/index.js';

let n = 0;
const check = (label, got, want) => {
  n++;
  assert.strictEqual(got, want, `${label}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`);
};

/* the exact shape Gmail produced in the live report: the reply, a blank line,
   the attribution wrapped across two lines, then the whole email quoted */
check('gmail reply keeps only the answer', stripQuoted(
`ok

On Mon, Aug 3, 2026 at 2:05 PM Someone
<someone@beatass.com> wrote:

> You probably don't even remember doing it. I do. Every single day.
>   [image: beatass - say the thing you'd never say] <https://beatass.com>
>
> Hi Sanjay, someone used beatass.com to say something to you. They chose
> to stay anonymous.
> ...and this is what they did to you. (28 hits - 17 pins)
>
> Want to answer them?
`), 'ok');

check('attribution on one line', stripQuoted(
`I forgive you.

On Mon, Aug 3, 2026 at 2:05 PM Someone <someone@beatass.com> wrote:
> the original
`), 'I forgive you.');

check('multi-line answer survives intact', stripQuoted(
`first line
second line

third after a gap

On Sun, Jan 1, 2026 at 9:00 AM X <x@y.com> wrote:
> quoted
`), 'first line\nsecond line\n\nthird after a gap');

check('phone signature is cut', stripQuoted(
`ok fine

Sent from my iPhone

On Mon, Aug 3, 2026 at 2:05 PM X <x@y.com> wrote:
> quoted
`), 'ok fine');

check('outlook original-message divider', stripQuoted(
`no thanks

-----Original Message-----
From: Someone <someone@beatass.com>
the rest
`), 'no thanks');

check('outlook header block', stripQuoted(
`sure

From: Someone <someone@beatass.com>
Sent: Monday, August 3, 2026 2:05 PM
To: me
`), 'sure');

/* the conservative half: none of these may lose a word */
check('a bare reply is untouched', stripQuoted('just this'), 'just this');
check('the word "on" mid-sentence is safe', stripQuoted('I saw you on Friday and said nothing'),
  'I saw you on Friday and said nothing');
check('a line starting with On is safe when no quote follows', stripQuoted(
  'On Tuesday I will call you'), 'On Tuesday I will call you');
check('a greater-than inside a sentence is safe', stripQuoted('you > me, always'), 'you > me, always');
check('reply with nothing typed yields empty', stripQuoted(
`On Mon, Aug 3, 2026 at 2:05 PM X <x@y.com> wrote:
> everything
`), '');
check('windows line endings normalise', stripQuoted('ok\r\n\r\n> quoted\r\n'), 'ok');
check('empty input is empty', stripQuoted(''), '');
check('null input is empty', stripQuoted(null), '');

/* HTML replies hide the same chain in <blockquote> instead of "> " */
check('blockquote chain removed, line breaks kept', stripQuoted(htmlToText(
  '<div>ok<br>thanks</div><blockquote class="gmail_quote"><p>the whole original</p></blockquote>'
)), 'ok\nthanks');

check('gmail_quote div removed', stripQuoted(htmlToText(
  '<div>fine</div><div class="gmail_quote">On Mon X wrote:<div>original</div></div>'
)), 'fine');

check('entities decode, tags go', stripQuoted(htmlToText(
  '<p>caf&amp;eacute; &lt;3 &quot;you&quot;</p>'
)), 'caf&eacute; <3 "you"');

check('script and style never leak', stripQuoted(htmlToText(
  '<style>p{color:red}</style><p>hi</p><script>alert(1)</script>'
)), 'hi');

console.log(`relay quote-stripping: ${n}/${n} pass`);
