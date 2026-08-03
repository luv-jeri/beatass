# SEO and launch research

Research date: 2026-08-03

## Research access note

Live web research could not be completed from this workspace on 2026-08-03. Curl could not resolve external hosts, and browser access to Google was denied. Every external claim below is therefore marked **From-memory, verify live**. The URLs are the primary or first-party sources to check before publishing or submitting. Do not turn an unverified rule into a claim that a directory or community has approved a post.

This note builds on the decisions already taken in VENTURE.md and DESIGN-PROMPT.md:

- beatass.com stays the domain
- the product email includes the full confession and a personalised subject
- never fake messages, user counts, or testimonials
- report and block links stay prominent
- a personal-link flow is lower-priority product work, not a launch prerequisite

## What SEO can realistically do

SEO is the slow layer. A new domain normally has no earned links, no query history, and no reason to outrank established anonymous-messaging and entertainment sites quickly. Reels, reposts, and recipient sharing are the fast acquisition layer. Treat search as compounding discoverability, not a 30-day traffic promise.

Do not repeat the common claim that every new domain is in a fixed "Google sandbox" for 6-12 months. Google does not publish such a rule. The honest version is: indexing can be quick, but durable rankings for competitive queries usually need time, useful pages, and independent signals.

Google's helpful-content guidance says to make people-first content, not pages built mainly to capture search visits. Its spam policies specifically prohibit scaled content abuse and doorway abuse. That means a situation-page strategy should start with a handful of genuinely useful, clearly different pages, then stop if they do not earn impressions or clicks.

Sources, all **From-memory, verify live**:

- Google Search Central, Creating helpful, reliable, people-first content, https://developers.google.com/search/docs/fundamentals/creating-helpful-content, accessed unsuccessfully 2026-08-03.
- Google Search Central, Spam policies for Google web search, https://developers.google.com/search/docs/essentials/spam-policies, accessed unsuccessfully 2026-08-03.
- Google Search Central, Sitemaps overview, https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview, accessed unsuccessfully 2026-08-03.
- Google Search Central, Introduction to structured data markup, https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data, accessed unsuccessfully 2026-08-03.

## Keyword targets and how to validate them

No live keyword-volume or keyword-difficulty database was accessible on 2026-08-03. Do not invent numeric volume, difficulty, or CPC. Before building pages, run this small list through Google Ads Keyword Planner, Google Trends, Search Console once the site is verified, and one third-party tool with a free look-up allowance. Record date, country, volume range, and source next to every number.

Primary tools to use:

- Google Ads Keyword Planner, https://ads.google.com/home/tools/keyword-planner/, **From-memory, verify live**, accessed unsuccessfully 2026-08-03. This is the best free starting point for approximate search-demand ranges.
- Google Trends, https://trends.google.com/trends/, **From-memory, verify live**, accessed unsuccessfully 2026-08-03. Compare wording and seasonality rather than treating it as volume.
- Google Search Console, https://search.google.com/search-console/about, **From-memory, verify live**, accessed unsuccessfully 2026-08-03. Use actual impressions and queries after launch.
- Ahrefs Free Keyword Generator, https://ahrefs.com/keyword-generator, **From-memory, verify live**, accessed unsuccessfully 2026-08-03. Third-party estimate, not ground truth.
- Semrush Keyword Overview, https://www.semrush.com/analytics/keywordoverview/, **From-memory, verify live**, accessed unsuccessfully 2026-08-03. Third-party estimate, not ground truth.

Start with intent clusters, not a promise that each phrase has demand:

| Cluster | Candidate phrases to validate | Searcher need | Best destination |
|---|---|---|---|
| Core tool | "anonymous confession", "anonymous confession generator", "send anonymous confession" | Send something anonymously | Homepage |
| Delivery | "send anonymous email", "anonymous email message", "send anonymous message online" | Find a way to deliver an unsigned message | Homepage plus a short, safety-aware FAQ |
| Visual hook | "voodoo doll online", "online voodoo doll game", "voodoo doll maker" | Play with or make a doll | Homepage, only if the page actually demonstrates the doll |
| Social language | "anonymous message for ex", "anonymous confession to crush", "message for annoying roommate" | Find words or a playful outlet for a situation | A small set of situation pages |
| Brand and artifact | "beatass", "beatass confession", "voodoo doll gif confession" | Find a shared reel, result, or brand | Homepage and indexable public explainer pages only |

Avoid targeting phrases that imply stalking, threats, revenge, blackmail, harassment, or evading blocks. They attract the wrong use, increase abuse risk, and make the brand harder to distribute.

## One-page SEO checklist

The homepage can rank for the core product intent if it has crawlable, human-readable content around the tool. It should not need a blog to launch.

1. Give the page one plain title tag such as "Send an Anonymous Confession With a Voodoo Doll | beatass.com". Keep it accurate to the real product.
2. Use one visible H1 that says what it does in ordinary language, then short H2 sections for "How it works", "What the recipient gets", "Keep it funny, not cruel", "Block or report", and a concise FAQ.
3. Include a unique meta description, canonical URL, Open Graph image, and a share preview that is legible without sound. The current venture notes say the referenced og.png needs verification before launch.
4. Make the essential explanation available in the initial HTML, not only after a client-side interaction. A crawler should be able to understand the tool without submitting a confession.
5. Keep robots.txt and sitemap.xml valid, list only canonical public URLs in the sitemap, and submit the sitemap in Search Console after deployment.
6. Add honest WebApplication or SoftwareApplication structured data only for facts visible on the page. Structured data may help machines understand a page but does not guarantee a rich result.
7. Link the homepage, help pages, privacy, terms, contact, report, and block pages together with normal links. Do not hide necessary policy pages from indexing merely because they are unglamorous.
8. Test the live page on mobile, with JavaScript delayed, and with an unfurled social preview. Measure Core Web Vitals only after the public deployment exists.
9. Use descriptive image alt text for the doll and generated example media. Never label dramatized sample content as a customer result.
10. Connect Search Console and review weekly: indexed pages, queries, impressions, clicks, CTR, and crawl errors. Change one title, page, or internal-link hypothesis at a time.

Google sources for items 4-8 are listed in the access note above. Canonical guidance to verify: Google Search Central, Consolidate duplicate URLs, https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls, **From-memory, verify live**, accessed unsuccessfully 2026-08-03.

## Situation pages: small, hand-made, useful

Create 4-6 pages only after the homepage is technically clean. Suggested slugs:

- /confession/to-my-ex
- /confession/to-my-crush
- /confession/to-my-boss
- /confession/to-my-roommate
- /confession/to-my-best-friend
- /confession/after-a-breakup

Every page needs a distinct purpose, a brief situation-specific introduction, an embedded route into the real tool, 3-5 practical writing prompts, a safety reminder, unique FAQ copy, and a clearly labelled fictional example. The example is entertainment copy, never a real submission or testimonial.

Do not generate hundreds of city, name, synonym, relationship, or "letter to [person]" variants. Pages that differ only by swapped terms look like scaled content or doorway pages and provide no reason to rank. Start with the six above, index only pages with at least one useful unique section, and remove or noindex thin experiments.

## Directories and launch surfaces

Directory eligibility, pricing, and rules change. Check the current submission screen on the day of launch. None of these should receive fabricated traction, invented testimonials, or coordinated upvote requests.

| Surface | Fit and recommended action | Current-rule source to verify |
|---|---|---|
| Product Hunt | Good one-day launch surface if the product is publicly usable. Prepare real screenshots, a short maker comment, support contact, and a truthful "free" description. Do not ask people to create accounts or trade votes. | https://www.producthunt.com/launch, **From-memory, verify live**, accessed unsuccessfully 2026-08-03 |
| Hacker News Show HN | Potential fit only with a candid maker post about the unusual technical and design hook. The site must work without a waitlist. Answer criticism, especially around anonymous delivery and abuse controls. | https://news.ycombinator.com/yli.html, **From-memory, verify live**, accessed unsuccessfully 2026-08-03 |
| Uneed | A lightweight startup directory worth testing if its current free submission is available. Use the one-sentence product description and direct URL. | https://www.uneed.best/submit, **From-memory, verify live**, accessed unsuccessfully 2026-08-03 |
| Fazier | A lightweight launch directory worth testing if its current free submission is available. Do not pay to list under the zero-new-spend rule. | https://fazier.com/submit, **From-memory, verify live**, accessed unsuccessfully 2026-08-03 |
| SaaSHub | Submit only if the current taxonomy has a truthful consumer-web-tool category. Do not force an irrelevant SaaS category. | https://www.saashub.com/submit, **From-memory, verify live**, accessed unsuccessfully 2026-08-03 |
| AlternativeTo | Low priority. It is comparison-led, so add beatass only if it has a real comparable category and the listing can be factual. It is not a substitute for a launch. | https://alternativeto.net, **From-memory, verify live**, accessed unsuccessfully 2026-08-03 |
| BetaList | Check first, but skip if the current route requires payment or the site is no longer pre-launch oriented. | https://betalist.com/submit, **From-memory, verify live**, accessed unsuccessfully 2026-08-03 |

Suggested directory packet:

- Product name: beatass
- One-line description: "Write an anonymous confession, take it out on a voodoo doll, then share the resulting video."
- Category: consumer web tool, entertainment, social expression, only where those categories exist
- Asset: a real 9:16 result video with beatass.com visible
- Maker note: explain the product honestly, name the free price, link the report and block controls, and do not claim traction
- Tracking: one unique URL parameter per directory, stored in a simple sheet

## Relevant Reddit communities

The live rules pages were not accessible on 2026-08-03. The memory-based summaries below are deliberately conservative. A human must open the rules page and the newest pinned threads immediately before posting. If the current rules disagree, the current rules win.

| Community | From-memory rule summary, verify live before posting | Safe posting approach | Rule URL |
|---|---|---|---|
| r/SideProject | Intended for showing side projects, but promotional spam and repeat link drops are unwelcome. | One honest build post with the live project, a short demo, and lessons. Stay to answer comments. No reposting. | https://www.reddit.com/r/SideProject/about/rules/ |
| r/startups | Direct self-promotion is commonly restricted to designated recurring threads or requires substantial discussion value. | Use only a current self-promo or "share your startup" thread if one exists, and lead with a concrete launch learning. | https://www.reddit.com/r/startups/about/rules/ |
| r/Entrepreneur | Direct product promotion and link dumping are commonly restricted; recurring promotion threads may be the only place. | Do not make a standalone launch post unless current moderators explicitly allow it. A useful story without a link is safer. | https://www.reddit.com/r/Entrepreneur/about/rules/ |
| r/SaaS | The community is B2B-oriented and usually restricts unsolicited product promotion. | Low fit. Use only a designated feedback or self-promotion thread if the current rules allow consumer tools. | https://www.reddit.com/r/SaaS/about/rules/ |
| r/InternetIsBeautiful | From-memory: self-promotion is generally not allowed or is tightly restricted. | Treat as no-go unless the current rules clearly permit the exact post. Do not post a disguised launch. | https://www.reddit.com/r/InternetIsBeautiful/about/rules/ |
| r/webdev | From-memory: self-promotion is restricted and posts must be development discussion, not advertising. | Only post if there is a real technical write-up and the current rules allow the link. The customer launch itself is not a fit. | https://www.reddit.com/r/webdev/about/rules/ |

Reddit posting rules:

1. Make one post where a current rule explicitly permits it. Do not cross-post the same link into every community.
2. Say "I made this" in the title or first line. Do not pose as a random user.
3. Do not use fictional confession content as evidence that people use the product. Label it "fictional example" if included.
4. Do not solicit upvotes, award exchanges, coordinated comments, or off-platform brigading.
5. Respond as the maker, including to safety criticism. Remove the post if a moderator asks.

## Measurement and decision rules

For the first 60 days, measure:

- Search Console: indexed pages, non-brand impressions, non-brand clicks, query CTR, and query-to-send conversion.
- Analytics: landing page source, tool-start rate, completed-send rate, native-share click rate, and directory-specific visits.
- Page quality: the number of situation pages with impressions after 28 days, versus zero-impression pages.

Scale a situation page only when it receives impressions and its visitors start the tool at a rate comparable to the homepage. Improve an underperformer once. Noindex or remove it if it remains thin, unclicked, or duplicative after a fair crawl period. Do not scale page count merely because it is easy to generate.

