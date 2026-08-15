# Directed approval - build the self-healing bug loop POC on beatass (2026-08-15)

Sanjay, in conversation, 2026-08-15, answering the three decisions put to him in
`PLAN-SELFHEAL.md`:

> "we want to do on beatass - as we want to show this end to end - on beatass only
> please turn on brnach protections later not now it will be the last step
> i confirm 2 human aget"

## What this approves

Building the self-healing bug loop proof-of-concept **in this venture**, on
beatass itself, rather than on Game Night Owl. The recommendation in
`PLAN-SELFHEAL.md` was Game Night Owl (its widget and intake Worker already run,
and a captured bug report there cannot expose anybody's private message). He
overrode that deliberately: he wants the end-to-end demonstration on beatass.

Cost of the override, stated so it is not a surprise later: roughly two extra
hours of privacy hardening before the loop itself can be built, because on this
product a captured bug report can otherwise carry a confession, a recipient's
contact details, or a permanent `/m` view token.

## The three answers

| Decision | His answer |
|---|---|
| A. Which product for the POC | **beatass**, end to end, this venture only |
| B. Branch protection on `main` | **Later** - explicitly the last step, not now |
| C. Two human gates (publish issue, open PR) | **Confirmed** |

## Standing conditions that remain law

1. **The two human gates are law, by his own confirmation.** Publishing a GitHub
   issue and opening a pull request each wait for his yes. Nothing in the POC
   fires either one; the POC renders drafts only.
2. **Nothing outward.** No real email to any reporter, no real GitHub issue, no
   real PR, no deploy, and no unattended edit of product code. Rule 3 and rule 8
   are untouched by this approval.
3. **Branch protection is deferred, not waived.** It stays off for now at his
   instruction. It becomes a hard precondition before the fixer lane is ever
   allowed to open a real PR, because `main` currently auto-deploys on push
   (`.github/workflows/deploy.yml:64`) and nothing but convention stops a merged
   agent PR from shipping the same minute. To be raised again at that point.
4. **The privacy canary test is the POC's first gate.** A unique string typed
   into the confession box must appear nowhere in the report JSON, the multipart
   body, or the screenshot pixels. If a canary escapes, the build fails. This is
   the condition that makes running the POC on beatass acceptable at all.
5. The widget is **off on `/admin` and `/m`** - the two pages that render other
   people's private messages.

## Related

- `PLAN-SELFHEAL.md` - the converged plan, with the debate against GPT-5.6 Sol
- `PLAN-SELFHEAL-SOL.md` - Sol's full argument, including the three points where
  it changed my position
- `STABILITY-REPORT.md` - the audit run alongside this, same session
