# Engineering Tools — how this project is put together

Written because the layout raises questions on first contact. Most of what looks odd is
migration history rather than design, and this note says which is which, so you know
what to follow and what to leave alone.

## Origin

This was a PHP site. The calculators were rewritten in Node without redesigning them,
so the shape of the original still shows: the tools were independent pages then, and
they are independent routes now. Nothing here is PHP any more — not one file — but the
old URLs still resolve.

```
/catenary                              ← canonical
/Catenary_Calculator.php               → 301 to /catenary,  POST → 308
```

The redirects exist because bookmarks, emails and documents point at the old addresses.
`308` rather than `301` on POST: 308 preserves the method and the body, so a form
somebody still has open on an old URL submits correctly instead of being turned into a
GET that drops their input.

## Runtime

A plain Express server. No build step, no bundler, no framework on the client.

```
server.js          32 lines: middleware, static files, mounts the four routers
auth.js           Entra SSO gate + allowlist (see below)
routes/           one file per tool — HTTP handling only
lib/              the actual engineering maths and PDF generation
views/            EJS templates, server-rendered
public/           static assets served as-is
```

The split that matters: **`routes/` does HTTP, `lib/` does the work.** A route reads the
form, calls a solver, hands the result to a PDF writer, and sends it. The solvers know
nothing about Express and can be tested on their own. Keep it that way — if you find
yourself writing engineering logic inside a route, it belongs in `lib/`.

## Two patterns, not one

This is the thing that confuses people. The tools do not all work the same way.

### Pattern A — server-rendered form (catenary, reel)

```
GET  /catenary   → render the form
POST /catenary   → readReportInputs → calculate → createPdf → send the PDF
```

No client-side JavaScript at all. The browser submits a form, the server does the
arithmetic and returns a PDF download. `lib/catenary-solver.js` and
`lib/pdf-catenary.js` are the whole implementation.

Forms use `action=""` deliberately — they post back to whatever URL served the page,
which is why the `.php` redirects work for POST without any change to the templates.

### Pattern B — client-side app (operational limit)

```
GET /operational-limit → server injects data.json into the page, then gets out of the way
```

`public/src/app.js` is 1,135 lines and does everything in the browser. It makes **zero**
calls back to the server. The reference data lives in `public/src/data.json` and is
injected as `window.OPERATION_LIMIT_DATA` at render time.

That is why this one tool has its own `styles.css`, its own `app.js`, and cache-busting
query strings built from file modification time:

```js
const styleVersion = fs.statSync(stylePath).mtimeMs;   // routes/index.js
```

Without that, browsers keep serving an old `app.js` after a deploy. The other tools do
not need it because they have no client-side assets to go stale.

### Which pattern for a new tool

Use **A** unless the tool needs to respond without a round trip. A is smaller, testable,
and produces a PDF for free. B exists because the operational-limit assessment is
interactive — the user changes inputs and expects the result to move immediately.

## Styling, three sheets and what each is for

| Page | Stylesheet(s) | Inline `<style>` |
|---|---|---|
| catenary, reel, tensioner | `nseastyle.css` | none |
| index (dashboard) | `nseastyle.css` + `dashboard.css` | none |
| operational-limit | `src/styles.css` | 96 lines |

`public/nseastyle.css` is the house style: brand header, footer, colours, type,
form controls, buttons. Every server-rendered page loads it and it is the only
place shared chrome is defined.

`public/dashboard.css` holds what belongs to the dashboard alone, essentially the
tool-card grid, plus two deliberate overrides of the house sheet. The house sheet
lays `<main>` out as a two-column grid because that is what a tool page is; the
dashboard is one full-width column of cards, so it sets `display: block` back.
And `h2` on a tool page is a section label above a form, while on the dashboard
it is the opening line of the page, so it stays at display size.

`src/styles.css` is genuinely separate and should stay that way: it styles a
client-side application with its own layout, not a form page.

### History, because the shape of this is not obvious

Until September 2026 the dashboard loaded no stylesheet at all and carried 231
lines of inline CSS, of which 16 selectors were byte-for-byte copies of
`nseastyle.css`. That was a trap rather than untidiness. A change to the brand
header updated the three tool pages and silently left the dashboard behind, and
the two copies had already drifted.

The consolidation was checked rather than eyeballed: both versions were rendered
and every element compared for computed style and box geometry in a headless
browser at 1440, 900 and 420 pixels. All 53 elements came out identical except
the logo, which went from 74px to 72px high because that is what the house sheet
says and what the tool pages were already showing.

That 72px is worth a second look some day. The logo SVG is 39x74, so the house
sheet squashes it by about 3% on every page. Fixing it means changing
`nseastyle.css` and accepting that all four pages shift by two pixels, which is
a separate decision and a separate change.

### If you are changing styling

- Shared chrome, header, footer, buttons, form controls: `nseastyle.css`. Every
  server-rendered page picks it up, including the dashboard.
- Something that exists only on the dashboard: `dashboard.css`.
- The operational-limit tool: `src/styles.css`.
- A new tool page: load `nseastyle.css` and write no inline CSS. Follow
  `views/catenary.ejs`.

## Access

Entra SSO, with an allowlist, in `auth.js`:

1. `ALLOWED_EMAILS` set → only those exact addresses.
2. Otherwise → any signed-in account whose domain is in `ALLOWED_DOMAINS`.

Currently `ALLOWED_EMAILS` is empty and `ALLOWED_DOMAINS` is `n-sea.com,n-sea.nl`, so
every N-Sea account has access. The single-tenant sign-in URL already restricts this to
the N-Sea tenant; the domain check additionally keeps out guest accounts invited in with
an external address.

The app **fails closed**. Without Entra configuration it serves a 503 and nothing else,
because the Cloudflare tunnel makes this host publicly reachable and a missing secret
must not mean an open door.

For local work `AUTH_DEV_BYPASS=1` skips all of that — see README. It refuses to start
if it detects a deployed host.

## Deployment

The container is stateless apart from `pdf/`, which the app creates on boot and writes
generated reports into. `pdf/` is gitignored on purpose: deploy does `git reset --hard`
in the working directory, so tracking it would delete reports as they are being
downloaded.

There is no database. Everything is computed per request.

## What to leave alone

**The `.php` redirect routes.** They look like leftovers. They are load-bearing —
external documents point at those URLs.

**`action=""` on the forms.** It looks like an omission. It is what makes the redirects
work for POST.

**The fail-closed branch in `auth.js`.** It looks defensive to the point of being
unhelpful. It is the reason a missing secret cannot expose the tools to the internet.
