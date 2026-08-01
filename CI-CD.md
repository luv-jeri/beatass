# Automatic deploys

**What this does:** once it is switched on, pushing to `main` builds the site, runs the real browser test, and — only if that test passed — deploys to Cloudflare and then checks the live site actually came back correctly. If anything fails, nothing ships.

Pull requests are built and tested but never deployed.

The workflow lives at `.github/workflows/deploy.yml`.

---

## The one thing only you can do — about 3 minutes

GitHub needs permission to deploy on your behalf. That means one secret, created once.

### Step 1 of 2 — make a Cloudflare API token (2 min)

1. Open **https://dash.cloudflare.com/profile/api-tokens**
2. Click **Create Token**
3. Find **Edit Cloudflare Workers** in the template list and click **Use template**
4. Leave the defaults alone. Scroll down, click **Continue to summary**, then **Create Token**
5. Copy the token that appears. **It is shown once.** If you lose it, delete it and make another.

> An *API token* is a long password that lets a program do one specific job on your account — here, deploying this Worker. It is not your Cloudflare login, and it can be deleted at any time from that same page without affecting anything else.

### Step 2 of 2 — give it to GitHub (1 min)

1. Open **https://github.com/luv-jeri/beatass/settings/secrets/actions**
2. Click **New repository secret**
3. Name: `CLOUDFLARE_API_TOKEN` — exactly that, capitals and underscores included
4. Value: paste the token
5. Click **Add secret**

That is it. The next push to `main` deploys by itself.

> The token is stored encrypted by GitHub. It never appears in the repo, in the logs, or in this file — which is what constitutional rule 5 requires (secrets never live in a repo).

---

## How to tell it worked

After a push, open **https://github.com/luv-jeri/beatass/actions**. A green tick means built, tested, deployed, and the live site was checked afterwards. A red cross means it stopped, and the step that failed will say why.

You can also deploy by hand without pushing anything: **Actions → deploy → Run workflow**.

---

## What the run actually checks

| Step | What it proves |
|---|---|
| `npm test` | A real browser opens the site, beats the doll, encodes a GIF, exports an MP4, and posts it all to a stand-in for the live API. Runs at 7 screen sizes and fails if the page scrolls anywhere it should not |
| Legal and crawl files | Privacy, terms, about, contact, 404, robots.txt and sitemap.xml are all present and consistent with each other |
| Deploy | Publishes the Worker and the static site |
| Check the live site | Fetches the homepage, all four legal pages, robots.txt, sitemap.xml and og.png and requires 200 on every one; requires a made-up URL to return 404; and confirms the homepage really is the app. **This is the important one** — a deploy that says "success" while serving the wrong thing is the failure this catches |

## Known non-blocking failure

The legal-and-crawl step reports a failure on check **L6** and is deliberately allowed to continue. The checker turns a sitemap URL into a filename by splitting it on slashes, so the homepage's own address (`https://beatass.com/`) is read as a file named `beatass.com`. The site is correct; the checker is wrong. The two-line fix is written up in the Banyan trunk at `evolution/inbox/2026-08-02-legal-crawl-gate-cannot-parse-root-url.md`. Once that lands, delete the `|| true` on that step so it blocks properly.

## Note on URLs

`wrangler.jsonc` sets `html_handling: "none"`, which means every file is served at exactly the name it has: `/privacy.html` stays `/privacy.html` instead of redirecting to `/privacy`. Without it, every internal link and every sitemap entry costs a redirect hop and Google reports the listed pages as "page with redirect".

The cost of that setting is that Cloudflare stops mapping `/` to `index.html`, so the Worker serves the homepage itself (`src/index.js`, at the end of the request handler). If you ever remove `html_handling`, remove that block too — otherwise it is dead code.
