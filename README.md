# N-Sea Engineering Tools

Express + EJS app with four calculators (Cable Catenary, Reel Drive Volume,
Tensioner Squeeze Pressure, Operational Limit Assessment), each able to produce a
PDF report. Runs as a Docker container behind a Cloudflare tunnel on
**https://engineering.n-sea.nl**, gated by Entra (Azure AD) SSO..

## Layout

| File | Purpose |
|---|---|
| `server.js` | app bootstrap; installs the SSO gate before any route |
| `auth.js` | Entra OIDC login + access rules |
| `routes/`, `lib/`, `views/`, `public/` | the application itself (unchanged from the original zip) |
| `docker-compose.yml` | `engtools-app` + `engtools-cloudflared` on their own bridge network |
| `.env` | secrets and access rules (not in git, mode 600) |

## Access model

`auth.js` decides in this order:

1. `ALLOWED_EMAILS` non-empty → only those exact addresses may enter.
2. Otherwise → any account from the N-Sea tenant whose email domain is listed in
   `ALLOWED_DOMAINS` (default `n-sea.com,n-sea.nl`).

So today it is "everyone with an N-Sea account"; to narrow it to specific people
later, fill `ALLOWED_EMAILS` in `.env` and run `docker compose up -d`. No code
change needed.

The domain check exists because a tenant can contain invited guest accounts with
external addresses — single-tenant SSO alone would let those in.

If the Entra variables are missing the app serves 503 for everything except
`/healthz`, rather than exposing the tools publicly through the tunnel.

## Bringing it up

Two values must be created by hand in the respective portals; everything else is
already in place.

1. **Cloudflare tunnel** — Zero Trust → Networks → Tunnels → create a tunnel
   (e.g. `engineering-tools`), add public hostname `engineering.n-sea.nl` with
   service `http://app:3000`, then put the tunnel token in `.env` as
   `CLOUDFLARE_TUNNEL_TOKEN`.
2. **Entra app registration** — new registration, platform *Web*, redirect URI
   `https://engineering.n-sea.nl/auth/callback`, response type *code* (implicit
   grant not needed). Create a client secret. Put the values in `.env` as
   `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET`. The tenant ID is already filled.
3. `docker compose up -d --build`
4. Check: `curl -sI https://engineering.n-sea.nl/` should redirect to
   `login.microsoftonline.com`, and `/healthz` should return `ok`.

## Notes

* Generated PDFs are streamed to the browser and also archived in `./pdf`
  (bind-mounted as a directory).
* The portal landing page (`/home/nsea/apps/portal`) has an **Engineering**
  department with a tile pointing at this app; that link only works once step 1
  above is done.

## How the project is put together

New to this project, or coming from the PHP version of the site? Start with
[DEVELOPER-GUIDE.md](DEVELOPER-GUIDE.md). It maps PHP habits onto how this works,
says what every file is, and walks through running it and getting a change live.

If the layout raises questions, why two different patterns or why three stylesheets,
read [ARCHITECTURE.md](ARCHITECTURE.md). It explains what is deliberate, what is
migration history from the original PHP site, and what to leave alone.

## Local development

You do not need Docker, Entra values or a client secret to work on this app.

```
git clone https://n-sea.ghe.com/N-Sea/engineering-tools.git
cd engineering-tools
npm install
cp .env.example .env
```

In `.env` set only these two lines and leave the rest empty:

```
AUTH_DEV_BYPASS=1
AUTH_DEV_USER=your.name@n-sea.com
```

Then `npm run dev` and open http://localhost:3000. The server restarts on save.

With the bypass on there is **no authentication at all** — every request is
signed in as `AUTH_DEV_USER`. That is why the app refuses to start with the flag
set if `CLOUDFLARE_TUNNEL_TOKEN` is present or `NODE_ENV=production`: those mean
a deployed host, and a bypass that silently declined to engage would be worse
than one that stops the process.

`.env` is gitignored. Never commit it, and never set `AUTH_DEV_BYPASS` anywhere
but your own machine.

## Contributing

`main` is protected: no direct pushes, no force pushes. Work on a branch, open a
pull request, and it needs one approval plus a passing `check` run before it can
merge. Merging to `main` deploys to engineering.n-sea.nl automatically.
