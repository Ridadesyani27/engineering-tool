# Working on this project

Written for someone coming from PHP. It covers what each file is, how to run the
app, and how to make a change and get it onto the live site.

Two companion documents, so you know when to look elsewhere:

- [ARCHITECTURE.md](ARCHITECTURE.md) explains *why* the project is shaped the way
  it is, including the parts that look inconsistent on purpose.
- [README.md](README.md) is the operations view: hosting, access, deployment.

## The one thing that is different from PHP

In PHP, a file **is** a URL. `Catenary_Calculator.php` sat on disk and the web
server ran it when somebody asked for that path. There was no application: there
was a directory, and Apache started a fresh copy of your script on every request.

Here there is one program, `server.js`, that starts once and keeps running. It
holds a list of URLs and what to do for each. A file is only a URL if some line
of code says so. Nothing is reachable because of where it sits on disk.

That single difference explains almost everything else. Files are now grouped by
*what they do* instead of by *what address they answer on*, which is why there is
a `routes/` folder, a `lib/` folder and a `views/` folder rather than one file
per calculator.

The old `.php` addresses still work. Each route file ends with a redirect, so
bookmarks and links in old emails keep working; see `routes/catenary.js`.

## The map

| PHP | Here |
|---|---|
| One `.php` file per page | One entry in a file under `routes/` |
| `$_POST['wetWeight']` | `req.body.wetWeight` |
| `echo` / HTML mixed into the script | A file in `views/`, rendered with `res.render` |
| `<?= $value ?>` | `<%= value %>` |
| `include 'functions.php'` | `require('../lib/helpers')` |
| Apache serves `style.css` from disk | `express.static` serves everything in `public/` |
| A fresh process per request | One process, started once, handling every request |
| `session_start()` | `express-session`, set up in `auth.js` |
| Restart nothing, just save the file | `npm run dev` restarts for you on save |

## What each file is

**The program**

| File | What it is |
|---|---|
| `server.js` | The starting point, 32 lines. Sets EJS as the template engine, turns on form parsing, installs the login gate, serves `public/`, and hands the URL list to the four route files. Read this first; the whole shape of the app is visible in it. |
| `auth.js` | The Entra sign-in gate and the allow list. Everything registered after `auth.install(app)` in `server.js` requires a signed-in N-Sea account, static files included. |
| `package.json` | Which libraries the project uses and the three commands you can run. |

**URLs: `routes/`**

Mostly one file per tool. Each says which addresses exist and what happens on GET and
POST. They stay thin on purpose: they read the form, call a solver, and render a
view. No arithmetic lives here.

| File | URLs |
|---|---|
| `routes/index.js` | `/` the dashboard and the list of tool cards on it, **and** `/operational-limit`. That tool has no route file of its own because it used to be a query parameter on `index.php` rather than a page, and the redirect that keeps the old address working lives here too. |
| `routes/catenary.js` | `/catenary`, GET renders the form, POST returns a PDF |
| `routes/reel.js` | `/reel`, same shape |
| `routes/tensioner.js` | `/tensioner`, GET only; this tool calculates in the browser |

**Calculations and PDFs: `lib/`**

| File | What it is |
|---|---|
| `lib/catenary-solver.js` | Reads and checks the form inputs, then does the catenary maths. No Express, no HTML. |
| `lib/reel-solver.js` | The same for the reel calculator. |
| `lib/pdf-catenary.js`, `lib/pdf-reel.js` | Build the PDF reports with pdfkit. |
| `lib/helpers.js` | Three small shared functions: number formatting, a date stamp for filenames, and the feedback mailto link. |

Solvers are separate from routes so they can be tested without starting a web
server. `test/catenary-solver.test.js` calls the solver directly.

**Pages: `views/`**

`.ejs` is HTML with `<% %>` tags, the same idea as PHP's `<?php ?>`. `<%= x %>`
prints a value and escapes it. Each tool has one file.

| File | Note |
|---|---|
| `views/index.ejs` | The dashboard. 59 lines; it loops over the tool list from `routes/index.js`. |
| `views/catenary.ejs`, `views/reel.ejs` | Server-rendered forms. Submit, the server calculates, a PDF comes back. |
| `views/tensioner.ejs`, `views/operational-limit.ejs` | These calculate in the browser with JavaScript in the page. Nothing is posted. |

**Styling: `public/`**

Anything in here is served as-is at the matching URL, like a normal web folder.

| File | What it covers |
|---|---|
| `public/nseastyle.css` | The house style: brand header, footer, colours, type, form controls, buttons. Every server-rendered page loads it. |
| `public/dashboard.css` | Only the dashboard's tool-card grid. |
| `public/src/` | Belongs to the operational-limit tool, which is a small browser application with its own layout. |

Changing shared chrome means `nseastyle.css`. `ARCHITECTURE.md` has the detail
and the reason there are three stylesheets rather than one.

**Everything else**

| File | What it is |
|---|---|
| `test/` | Tests for the two solvers. `npm test` runs them. |
| `Dockerfile`, `docker-compose.yml` | How the app is packaged and run on the server. You do not need these to develop. |
| `.github/workflows/check.yml` | Runs the tests on every pull request. |
| `.github/workflows/deploy.yml` | Deploys to engineering.n-sea.nl when something reaches `main`. |
| `.env.example` | The list of settings. Copy it to `.env` and fill in. |
| `.env` | Your own settings. Never committed; it is in `.gitignore`. |

## One request, end to end

Somebody opens `/catenary` and presses Generate Report PDF.

1. `server.js` has already registered `routes/catenary.js`.
2. `auth.js` checks there is a signed-in user. Locally, with the dev bypass on,
   this always passes.
3. `router.get('/catenary')` runs `res.render('catenary', ...)`, which turns
   `views/catenary.ejs` into HTML and sends it.
4. The browser shows the form. It posts back to the same URL.
5. `router.post('/catenary')` runs. `readReportInputs(req.body)` reads and checks
   the fields, `calculateCatenary` does the maths, `createCatenaryPdf` builds the
   file, and it is sent back as a download.
6. If any of that throws, the route catches it and re-renders the same page with
   the message in `reportError`, so the user sees what was wrong instead of a
   crash.

That shape repeats for every server-rendered tool: route reads, lib calculates,
view displays.

## Running it on your own machine

You do not need Docker, Entra values or a client secret.

```
git clone https://n-sea.ghe.com/N-Sea/engineering-tools.git
cd engineering-tools
npm install
cp .env.example .env
```

In `.env`, set only these two and leave the rest empty:

```
AUTH_DEV_BYPASS=1
AUTH_DEV_USER=rdesyani@n-sea.com
```

Then:

```
npm run dev
```

Open http://localhost:3000. The server restarts by itself when you save a file.

`npm install` reads `package.json` and downloads the libraries into
`node_modules/`. That folder is never committed; anyone can recreate it from
`package.json`. Run it again when you pull changes that add a library.

With the bypass on there is **no login at all**: every request is signed in as
`AUTH_DEV_USER`. That is why the app refuses to start with the flag set if
`CLOUDFLARE_TUNNEL_TOKEN` is present or `NODE_ENV=production`. Those mean a real
server, and a bypass that quietly declined to work would be worse than one that
stops the program.

### Three commands

| Command | What it does |
|---|---|
| `npm run dev` | Runs the app and restarts on save. Use this while working. |
| `npm test` | Runs the solver tests. Takes about a second. |
| `npm start` | Runs the app without the restart-on-save. This is what the server uses. |

## Making a change

**Change a label or some text.** It is in the `.ejs` file for that page. Save,
and the browser shows it after a refresh.

**Change how something is calculated.** It is in `lib/`, not in `routes/` and not
in the view. Change it, then run `npm test`. If a test fails, read it before
changing it: both solvers have tests that were written because they found real
bugs.

**Add a new tool.** Follow `routes/catenary.js` and `views/catenary.ejs`, which
are the pattern to copy. Four steps:

1. `lib/your-tool-solver.js` for the calculation, with no Express in it.
2. `routes/your-tool.js` with a GET that renders and, if it needs one, a POST.
3. `views/your-tool.ejs`, loading `nseastyle.css` and writing no inline CSS.
4. Register it in `server.js` and add a card to the list in `routes/index.js`.

Copy `views/catenary.ejs` rather than `views/index.ejs`. The dashboard is a
different kind of page and has its own stylesheet.

## Getting your change onto the live site

`main` is protected: nobody pushes to it directly, including admins. Everything
goes through a pull request that Hubert reviews.

```
git checkout main
git pull
git checkout -b your-change-name
```

Make the change, then:

```
npm test
git add -A
git commit -m "Say what changed and why, in one line"
git push -u origin your-change-name
```

Open the pull request on https://n-sea.ghe.com/N-Sea/engineering-tools. Then:

1. The **Checks** workflow runs the tests. It must pass.
2. Hubert reviews and approves.
3. You merge.
4. The **Deploy** workflow puts it on engineering.n-sea.nl by itself, and checks
   the site answers afterwards. If it does not, it rolls back to the previous
   version automatically. Nobody has to do anything on the server.

A few minutes after merging, your change is live.

Keep one branch to one change. It makes the review short, and if something has to
be undone later it can be undone on its own.

## Things that catch people out coming from PHP

**A new file does nothing until you register it.** Adding `views/thing.ejs` or
`routes/thing.js` does not create a URL. Something has to `require` it. This is
the one that costs the most time at first.

**The running program does not see your edit unless it restarts.** `npm run dev`
handles that. If you used `npm start`, stop it and start it again.

**`node_modules/` is not yours to edit or commit.** It is generated from
`package.json`.

**`.env` never gets committed.** If you need a new setting, add it to
`.env.example` with an empty value so the next person knows it exists.

**Errors show up in the terminal, not in the browser.** In PHP a mistake often
appeared on the page. Here it appears where you started the app, and the browser
may just show nothing. When something is odd, look at the terminal first.

**The `pdf/` folder is generated.** Reports are written there and it is not
committed. Do not put anything in it you want to keep.
