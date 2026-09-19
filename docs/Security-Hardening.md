# Security hardening

`SECURITY.md` in the root is the pre-launch checklist. This file is the deeper technical
detail: what each control actually does, how to strengthen it, and what to do when
something goes wrong.

---

## Threat model

Being specific about what you are defending against, because a threat model you have not
written down is one you are guessing at.

| Threat | Realistic? | Defence |
|--------|-----------|---------|
| Stripe key leaked in git | **Very** — bots scan continuously | `.gitignore`, env vars, rotation |
| Forged webhook → free downloads | **Yes**, if the URL is known | Signature verification |
| Download link shared publicly | **Yes**, routinely | Expiry + use limits |
| Admin token brute-forced | Low | Rate limit + constant-time compare + 256-bit token |
| Price tampering at checkout | **Yes**, trivial to attempt | Server decides the price |
| SQL injection | Low here | Prepared statements throughout |
| Customer list enumeration | **Yes** — competitors | Identical responses on resend |
| XSS in the dashboard | Low | Escaping on all rendered values |
| Open redirect via email links | **Yes** — phishing via your domain | Destination allow-list |
| DoS / cost exhaustion | Moderate | Rate limits, body size caps |
| Data loss | **The most likely of all** | Persistent volume + backups |

Note that last row. The most probable bad outcome is not an attacker — it is you deploying
over an ephemeral filesystem.

---

## Secrets

### The two secrets, and what each one is worth

| Secret | If leaked | Rotation cost |
|--------|-----------|---------------|
| `STRIPE_SECRET_KEY` | Charge cards as you, refund to themselves | Low — roll in dashboard |
| `STRIPE_WEBHOOK_SECRET` | Forge payments, mint free downloads | Low — roll in dashboard |
| `ADMIN_TOKEN` | Every customer email, issue refunds | Low — regenerate |
| `TOKEN_SECRET` | Forge download links | **High — invalidates all outstanding links** |

`TOKEN_SECRET` is the one to treat as permanent. Rotating it means every customer
mid-download gets an error.

### Checking git history

```bash
git log --all -p | grep -E "sk_live_|sk_test_|whsec_" | head
```

If you find one: **roll it in the Stripe dashboard immediately.** Rewriting history does
not help — the commit has been cloned, cached and indexed.

### Scanning automatically

```bash
npx secretlint "**/*"
```

Or enable GitHub's secret scanning (free on public repos, and it notifies Stripe directly,
who will often disable a leaked key for you).

---

## Content Security Policy

The default policy is in `middleware/security.js`. It allows `'unsafe-inline'` for scripts
and styles because the pages ship as self-contained HTML files — which is the point of
being able to drop them on any host.

That is the only meaningful weakening. To remove it:

### Nonce-based CSP

1. Generate a nonce per request:

```js
const crypto = require('crypto');
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});
```

2. Reference it in the policy instead of `'unsafe-inline'`:

```js
scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`, 'https://js.stripe.com'],
```

3. Add `nonce="..."` to every inline `<script>` and `<style>`, which means templating the
   HTML rather than serving it statically.

**Worth it?** Only if you accept user-generated content into a page. For a static sales
page, the risk `'unsafe-inline'` creates is close to theoretical — there is no injection
point. Removing it costs you the single-file simplicity.

### Reporting

Catch violations without breaking anything:

```js
reportUri: ['/api/csp-report'],
reportOnly: true,   // log, don't block, while you tune it
```

---

## Rate limiting

Six named limiters, each sized to what it protects:

| Limiter | Window | Max | Protects against |
|---------|--------|-----|------------------|
| general | 15 min | 300 | Broad floods |
| checkout | 10 min | 10 | Stripe session spam |
| download | 1 hour | 30 | Bandwidth exhaustion |
| admin | 15 min | 20 | Token brute-forcing |
| submission | 1 hour | 5 | Ticket and testimonial spam |
| analytics | 10 min | 120 | Events table flooding |

**The webhook is deliberately unlimited.** Stripe can legitimately burst, and dropping a
webhook means a paying customer receives nothing. It is protected by signature
verification, which is stronger than a rate limit.

### Distributed rate limiting

The default store is in-memory, so limits are per-instance. With one instance — which is
what SQLite requires anyway — that is correct.

If you ever run multiple instances, move to a shared store:

```bash
npm install rate-limit-redis
```

```js
const RedisStore = require('rate-limit-redis');
store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) })
```

### Getting `trust proxy` right

```js
app.set('trust proxy', 1);   // exactly one proxy hop
```

- **One proxy** (Railway, Render, Fly, single nginx) → `1`
- **Two** (Cloudflare + nginx) → `2`
- **Never `true`** — that trusts any `X-Forwarded-For` the client sends, letting them spoof
  an IP and bypass rate limiting entirely

Verify:

```bash
curl https://yourdomain.com/api/health -v 2>&1 | grep -i ratelimit
```

Then check your logs show real client IPs, not the proxy's.

---

## Protecting the dashboard further

The bearer token is adequate for a solo operator. Two ways to strengthen it:

### Platform-level auth in front

Cloudflare Access, or nginx basic auth:

```nginx
location /admin.html {
  auth_basic "Restricted";
  auth_basic_user_file /etc/nginx/.htpasswd;
  proxy_pass http://localhost:3000;
}
```

Two independent factors — someone needs both.

### IP allow-listing

If you always administer from known addresses:

```nginx
location /api/admin/ {
  allow 203.0.113.0/24;
  deny all;
  proxy_pass http://localhost:3000;
}
```

Effective, and locks you out when your home IP changes. Keep a fallback.

### Multi-user auth

Before sharing access with anyone, replace the single token with per-user credentials.
Minimum viable version:

1. A `users` table: id, email, password hash (argon2id or bcrypt cost 12+), role
2. Session tokens in the database, revocable individually
3. An audit log of admin actions — the `events` table already has `admin_login_failed`;
   extend it

Do not share one token between people. You lose the ability to revoke one person's access
or know who did what.

---

## Download tokens — how they work

```
base64url(payload).base64url(HMAC-SHA256(payload, TOKEN_SECRET))
```

Payload: `{ sub: customerId, typ: 'download', iat, exp, nonce }`

**Why not a JWT?** A JWT here means a dependency, handling `alg: none` attacks, and
explaining header/claim semantics for a 5-field payload. The verification in
`utils/tokens.js` is short enough to audit by eye, which is worth more than library
familiarity at this size.

**Why both a signature and a database row?** The signature proves authenticity without a
lookup. The row provides what a signature cannot: use counting and revocation.

**Constant-time comparison** is used throughout — `crypto.timingSafeEqual`, with a length
check first because it throws on mismatched lengths. Never `===` for a secret.

### Tuning the limits

```
DOWNLOAD_TOKEN_TTL_HOURS=72
DOWNLOAD_MAX_USES=25
```

Be generous. The people who would share a link were not going to buy, so the revenue loss
is near zero — while a locked-out paying customer costs you a refund, a support thread and
sometimes a chargeback.

---

## Input validation

Allow-list, not deny-list. Decide what valid looks like and reject everything else; trying
to enumerate bad inputs is unwinnable.

Specific defences worth knowing about:

**Email header injection.** `\r` and `\n` in an address are rejected outright — a crafted
value could otherwise append its own `Bcc:` header to outgoing mail.

**Control characters** are stripped from free text before storage.

**CSV injection.** Values starting `=`, `+`, `-` or `@` are prefixed with a quote in
exports. Otherwise a customer whose "name" is `=HYPERLINK(...)` runs code in your
spreadsheet when you open your own export.

**Open redirect.** The email click tracker only redirects to an allow-list. Without it, you
hand an attacker a link on **your** domain that forwards to their phishing page — your
domain then gets flagged and your delivery email stops arriving.

**Body size.** 64 KB on JSON, 1 MB on the webhook raw body. An unbounded parser is a
trivial memory-exhaustion vector.

---

## SQL injection

Every statement is prepared with bound parameters. There is no string concatenation of user
input into SQL anywhere.

The one place a value cannot be bound is a column name in `ORDER BY`. That is handled with
a whitelist:

```js
const SORTABLE_COLUMNS = { created_at: 'created_at', amount: 'amount_cents', ... };
const column = SORTABLE_COLUMNS[sort] || 'created_at';
```

User input selects a key; only a column name we control reaches the SQL. If you add
sorting elsewhere, do it the same way.

---

## Dependencies

```bash
npm audit
npm audit fix
npm outdated
```

Monthly. The dependency list here is deliberately small — nine production packages — which
is itself a security property.

Enable Dependabot on GitHub for automatic PRs.

**Before adding a dependency, ask whether you can write it in twenty lines.** Most of the
utilities in `utils/` exist for exactly that reason.

---

## Logging

The logger redacts on **both** key name and value shape:

- Key names containing `password`, `secret`, `token`, `key`, `authorization`, `card`, etc.
- Values matching `sk_live_…`, `sk_test_…`, `whsec_…`, `Bearer …` **wherever they appear**

The second is the important one — a Stripe key that ends up in an unexpected field is
still masked.

**Query strings are stripped from request logs**, because a download token in a URL would
otherwise be logged in plain text.

Do not add `console.log(req.body)` while debugging and forget to remove it.

---

## Incident response

### A secret leaked

1. **Rotate it first.** Investigate second. Minutes matter.
2. Stripe → Developers → API keys → roll
3. Regenerate `ADMIN_TOKEN` / `TOKEN_SECRET` as applicable
4. Check Stripe logs for charges or refunds you did not make
5. If `TOKEN_SECRET` changed, expect resend requests — handle them cheerfully

### Suspicious admin activity

1. Rotate `ADMIN_TOKEN` immediately
2. Check `admin_login_failed` events in the dashboard
3. Review recent refunds in Stripe
4. Consider IP allow-listing

### Customer data exposed

1. Contain — rotate secrets, take the service down if necessary
2. Determine what was exposed and for how long
3. **Check your notification duty.** GDPR gives 72 hours in the EU/UK. Find out what
   applies to you *before* you need to know.
4. Notify affected customers plainly — what happened, what you have done, what they should
   do

---

## What this system deliberately does not store

Data you do not hold cannot leak:

- **No card details** — Stripe hosted checkout, they never touch your server
- **No passwords** — bearer token only
- **No names or addresses** unless Stripe collects them for tax
- **No IP addresses against analytics events**
- **No third-party trackers**

Stored: email, tier, amount, timestamp, UTM source, download count. That is what is needed
to deliver the product and honour a refund.

Keep it that way. Every field you add is a field you have to protect.
