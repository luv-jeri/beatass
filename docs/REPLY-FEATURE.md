# The reply relay — spec (Sanjay, 2026-08-02, in conversation)

The recipient of a confession can answer it, and the answer reaches the sender
without the sender ever being named. One side of the conversation stays
anonymous; we are the post office in the middle.

## What the sender sees

- A new optional field on the send form: **"your email — only if you want to
  hear back"**. Nothing else changes. If they skip it, everything works as
  today and no reply path exists.
- The sender's address is never shown to the recipient, never in the email,
  never in a link. It lives only in our D1 row.

## What the recipient sees

Two ways to answer, both only doing anything when the sender left an address:

1. **The Reply button in the email.** Rendered ONLY when a sender email exists
   for that message (emailHtml gets a flag). It links to
   `https://beatass.com/reply?id=<message id>&t=<token>` — a small page with
   one text box and a send button. POST goes to the Worker, which mails the
   text to the stored sender address via Resend, from someone@beatass.com.
2. **Just hitting reply in their mail app.** The outgoing mail's `Reply-To`
   becomes `reply+<id>@beatass.com`. Cloudflare Email Routing catches that
   address and hands the inbound mail to an **Email Worker**:
   - sender email on file → forward the reply body to the sender (via Resend),
     stripping the recipient's quoted text is NOT needed — forward as-is, but
     never expose the sender's address in headers back to the recipient.
   - no sender email on file → auto-reply once: "This sender chose to stay
     anonymous, so this reply cannot be delivered. That is a privacy rule, not
     a bug."

## Rules that must hold

- The recipient's reply must never leak the sender's address (check the
  forwarded headers: From = someone@beatass.com, no CC of the sender visible
  to the recipient side).
- Same rate limits as sending. A reply chain is still two strangers; the block
  link in the original email must also kill the reply path for that address.
- Token `t` on the /reply page prevents id-guessing (same token scheme as
  /block).
- D1: add `sender_email TEXT` (nullable) to the messages table; keep it out of
  every API response.

## Build order

1. D1 migration + accept `senderEmail` in POST /api/send (validate like the
   recipient email; optional).
2. Reply-To per message: `reply+<id>@beatass.com` when sender email exists,
   else keep someone@ (plain replies then get the anonymity auto-answer).
3. `/reply` page (GET form, POST send) + emailHtml flag for the button.
4. Cloudflare Email Routing rule `reply+*@beatass.com` → Email Worker
   (needs `email` handler in the Worker + a routing rule in the dashboard —
   the dashboard step is Sanjay's, document it).
5. Tests: send with/without sender email → button presence, reply POST path,
   auto-answer path.
