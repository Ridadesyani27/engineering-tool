// auth.js — Entra (Azure AD) SSO gate for the Engineering Tools app.
//
// Access model, in order of precedence:
//   1. ALLOWED_EMAILS set  -> only those exact addresses may enter.
//   2. otherwise           -> any signed-in account whose email domain is in
//                             ALLOWED_DOMAINS (default: the N-Sea domains).
// The single-tenant identityMetadata URL already limits sign-in to the N-Sea
// tenant; the domain check additionally keeps out guest accounts invited into
// the tenant with an external address.
const session          = require('express-session');
const passport         = require('passport');
const crypto           = require('crypto');
const { OIDCStrategy } = require('passport-azure-ad');

const {
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  AZURE_CALLBACK_URL,
  SESSION_SECRET,
  ALLOWED_EMAILS  = '',
  ALLOWED_DOMAINS = 'n-sea.com,n-sea.nl',
} = process.env;

// --- Local development only -------------------------------------------------
// AUTH_DEV_BYPASS=1 skips Entra entirely and signs every request in as
// AUTH_DEV_USER. It exists so a developer can run the tools on a laptop without
// a client secret on disk and without a per-person app registration.
//
// It refuses to start if anything suggests this is not a laptop: a Cloudflare
// tunnel token means the host is publicly reachable, and NODE_ENV=production
// means somebody deployed it. Crashing is deliberate — a bypass that silently
// declines to engage is worse than one that stops the process, because the first
// failure mode is "running open and nobody noticed".
const DEV_BYPASS = process.env.AUTH_DEV_BYPASS === '1';
const DEV_USER   = (process.env.AUTH_DEV_USER || 'dev@n-sea.com').toLowerCase();

const list = s => s.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
const allowedEmails  = new Set(list(ALLOWED_EMAILS));
const allowedDomains = new Set(list(ALLOWED_DOMAINS));

// Fail closed rather than serving the tools to the open internet: a missing
// secret means SSO cannot work, and the tunnel makes this host public.
const ssoConfigured = Boolean(AZURE_TENANT_ID && AZURE_CLIENT_ID &&
                              AZURE_CLIENT_SECRET && AZURE_CALLBACK_URL);

function emailOf(user) {
  const j = user?._json || {};
  return (user?.preferred_username || j.preferred_username || j.email ||
          j.upn || user?.upn || '').toLowerCase();
}

function isAllowed(user) {
  const email = emailOf(user);
  if (!email) return false;
  if (allowedEmails.size) return allowedEmails.has(email);
  const domain = email.split('@')[1] || '';
  return allowedDomains.has(domain);
}

function install(app) {
  // cloudflared terminates TLS, so req.secure must come from X-Forwarded-Proto
  // for the Secure session cookie below to be set at all.
  app.set('trust proxy', 1);

  if (DEV_BYPASS) {
    const unsafe = [];
    if (process.env.CLOUDFLARE_TUNNEL_TOKEN) unsafe.push('CLOUDFLARE_TUNNEL_TOKEN is set');
    if (process.env.NODE_ENV === 'production') unsafe.push('NODE_ENV=production');
    if (unsafe.length) {
      console.error('[auth] AUTH_DEV_BYPASS refused: ' + unsafe.join(', ') +
                    '. This looks like a deployed host, not a development machine.');
      process.exit(1);
    }
    console.warn('='.repeat(72));
    console.warn('[auth] DEVELOPMENT BYPASS ACTIVE — no authentication is performed.');
    console.warn(`[auth] Every request is signed in as ${DEV_USER}.`);
    console.warn('[auth] Never set AUTH_DEV_BYPASS on a deployed host.');
    console.warn('='.repeat(72));

    const devUser = { preferred_username: DEV_USER, displayName: 'Local development', _json: { email: DEV_USER } };
    app.use((req, _res, next) => {
      req.user = devUser;
      req.isAuthenticated = () => true;
      next();
    });
    app.get('/logout', (_req, res) => res.redirect('/'));
    return;
  }

  if (!ssoConfigured) {
    console.error('[auth] Entra SSO is not configured (AZURE_* / callback URL ' +
                  'missing) — refusing all requests except /healthz.');
    app.get('/healthz', (req, res) => res.type('text/plain').send('ok (sso unconfigured)'));
    app.use((req, res) => res.status(503).type('text/plain')
        .send('Engineering Tools is not available: SSO is not configured.'));
    return;
  }

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));

  passport.use(new OIDCStrategy({
        identityMetadata: `https://login.microsoftonline.com/${AZURE_TENANT_ID}/v2.0/.well-known/openid-configuration`,
        clientID:                AZURE_CLIENT_ID,
        clientSecret:            AZURE_CLIENT_SECRET,
        responseType:            'code',
        responseMode:            'form_post',
        redirectUrl:             AZURE_CALLBACK_URL,
        allowHttpForRedirectUrl: false,
        scope:                   ['openid', 'profile', 'email'],
      },
      (issuer, sub, profile, accessToken, refreshToken, done) => {
        if (!profile.oid) return done(new Error('No oid claim.'), null);
        return done(null, profile);
      }
  ));

  // SameSite=None + Secure: the Entra callback is a cross-site POST from
  // login.microsoftonline.com. With Lax the cookie set during /login is not
  // sent back, the OIDC state/nonce is lost and passport loops on /login.
  app.use(session({
    secret:            SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave:            false,
    saveUninitialized: false,
    cookie: { secure: true, sameSite: 'none', httpOnly: true },
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  app.get('/healthz', (req, res) => res.type('text/plain').send('ok'));

  app.get('/login',
      passport.authenticate('azuread-openidconnect', { failureRedirect: '/denied' }));

  const finish = (req, res) => res.redirect('/');
  app.post('/auth/callback',
      passport.authenticate('azuread-openidconnect', { failureRedirect: '/denied' }), finish);
  app.get('/auth/callback',
      passport.authenticate('azuread-openidconnect', { failureRedirect: '/denied' }), finish);

  app.get('/denied', (req, res) => res.status(403).type('text/plain')
      .send('Sign-in failed or this account has no access to Engineering Tools.'));

  app.get('/logout', (req, res) => {
    req.logout(() => req.session.destroy(() => res.redirect('/')));
  });

  app.use((req, res, next) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    if (!isAllowed(req.user)) {
      return res.status(403).type('text/plain').send(
        `Access denied for ${emailOf(req.user) || 'this account'}. ` +
        'Engineering Tools is restricted to N-Sea accounts.');
    }
    return next();
  });
}

module.exports = { install };
