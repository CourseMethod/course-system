# Security checklist

Work through this before you take real money. It is a checklist, not an essay — the deeper
technical guide is **[docs/Security-Hardening.md](docs/Security-Hardening.md)**.

Most of it is already done for you. This is about the handful of things only you can get
wrong.

---

## The five that would actually hurt

Everything else on this page is worth doing. These five are the ones that lose you money,
customers or the business.

### 1. A live Stripe key in git

**What happens:** bots scan public GitHub commits continuously. A leaked `sk_live_` key is
usually found and used within minutes. Someone can charge cards as you and issue refunds
to themselves.

**Check:**
```bash
git log --all -p | grep -E "sk_live_|whsec_" | head
git status --ignored | grep "\.env"
```

`.env` should appear under **ignored**. If you find a key in history, **roll it in the
Stripe dashboard immediately** — rewriting git history is not enough, it has been cloned.

- [ ] `.env` is gitignored and was never committed
- [ ] No key in any screenshot, chat message or issue
- [ ] Secrets are set as platform environment variables, not in files

### 2. A missing or wrong webhook secret

**What happens:** without `STRIPE_WEBHOOK_SECRET`, the server cannot verify webhooks are
really from Stripe. Anyone who finds the URL can POST a fake "payment succeeded" and mint
free downloads.

- [ ] `STRIPE_WEBHOOK_SECRET` is set in production
- [ ] It is the **live** endpoint's secret, not your test one or your local CLI one
- [ ] `/api/webhook` returns 400 for an unsigned request (the smoke test checks this)

### 3. A database that vanishes on deploy

**What happens:** you lose every customer record. Not a security breach, but the same
practical outcome — you cannot deliver, cannot refund, cannot prove anything in a dispute.

- [ ] `DATABASE_PATH` points at a mounted persistent volume
- [ ] You have deployed twice and confirmed data survived
- [ ] You export the customer CSV monthly and store it off the server

### 4. An unprotected admin dashboard

**What happens:** every customer email address, every sale, and the ability to issue
refunds.

- [ ] `ADMIN_TOKEN` is 32+ random characters from `npm run create-admin-token`
- [ ] It is different from `TOKEN_SECRET`
- [ ] It is in a password manager, not a note
- [ ] `/api/admin/overview` returns 401 without it (smoke test checks this)

### 5. Fake social proof or fake urgency

**What happens:** civil penalties per violation under 16 CFR Part 465, and payment
processors treat it as a fraud signal. Losing Stripe ends the business the same afternoon.

- [ ] No testimonial on the page that a real customer did not write
- [ ] No testimonial published without recorded consent
- [ ] No number quoted that you cannot evidence
- [ ] No countdown that resets on refresh
- [ ] No "only N left" for a digital file with no real cap
- [ ] No struck-through price nobody ever paid

Full treatment: `vault/01-Mindset/06-Ethics-And-Claims.md`.

---

## Configuration

- [ ] `NODE_ENV=production`
- [ ] `PUBLIC_URL` is your real `https://` domain
- [ ] `CORS_ORIGINS` lists your exact domains — never `*`
- [ ] Live Stripe keys (`sk_live_` / `pk_live_`), both from the same mode
- [ ] `npm run check-env` passes

The server refuses to start with test keys under `NODE_ENV=production`, and refuses an
empty `CORS_ORIGINS` in production. Those checks exist because both failures are silent.

---

## What is already handled

So you know what you are and are not responsible for:

| Control | Where |
|---------|-------|
| Card data never touches your server | Stripe hosted checkout |
| SQL injection | Prepared statements with bound parameters throughout |
| Webhook forgery | Signature verification, constant-time |
| Duplicate webhook processing | Event ids claimed exactly once |
| Download link forgery | HMAC-signed tokens, constant-time compare |
| Link sharing | Expiry + use limits + revocation |
| Brute-forcing the admin token | Rate limiting + constant-time compare + logged failures |
| Security headers, CSP, clickjacking | Helmet, `frame-ancestors: none` |
| Secrets in logs | Redaction on key name and value shape |
| Open redirect via email tracking | Destination allow-list |
| CSV injection in exports | Formula-prefix escaping |
| Customer enumeration | Resend endpoint returns identical responses |
| Payload flooding | 64 KB body limit, per-route rate limits |

---

## Before launch

- [ ] `npm run test:smoke` — all 17 pass
- [ ] `/api/health/ready` returns ready
- [ ] Bought your own course with a **real card** and refunded yourself
- [ ] Refund revoked the download link
- [ ] Tested a declined card (`4000 0000 0000 0002`)
- [ ] Delivery email arrives in Gmail **and** Outlook, not spam
- [ ] [mail-tester.com](https://mail-tester.com) scores 9/10+
- [ ] Stripe **statement descriptor** is recognisable
- [ ] Refund link is in the page footer and in your emails
- [ ] `npm run build-vault` verification passed — no `.env` in the ZIP

---

## Privacy and data

You are storing customer email addresses. That brings obligations.

- [ ] Privacy policy exists and says what you collect and why
- [ ] Terms of service exists
- [ ] Both linked in the footer
- [ ] You can delete a customer's data on request
- [ ] Email has an unsubscribe link, honoured
- [ ] Marketing email includes your identity and a postal address (CAN-SPAM)

**What this system stores:** email address, tier, amount, timestamp, UTM source, download
count. **Not** card details, names, or addresses unless Stripe collects them for tax.

That minimalism is deliberate — data you do not hold cannot leak.

---

## Ongoing

**Monthly, 30 minutes:**
- [ ] Dashboard → **Failures** tab. Failed webhooks or emails mean someone paid and got
      nothing
- [ ] Export the customer CSV, store it off the server
- [ ] `npm audit` and update anything with a known vulnerability
- [ ] Check the refund and dispute rate

**Quarterly:**
- [ ] Rotate `ADMIN_TOKEN`
- [ ] Review who has access to your Stripe account
- [ ] Confirm backups actually restore — an untested backup is a guess

**Immediately, if a secret leaks:**
1. Roll the key in Stripe — do not wait
2. Regenerate `ADMIN_TOKEN` and `TOKEN_SECRET`
3. Check Stripe logs for activity you do not recognise
4. If `TOKEN_SECRET` changed, outstanding download links stop working — expect resend
   requests and handle them cheerfully

---

## Things people get wrong

**Putting the secret key in the front end.** The publishable key (`pk_`) belongs in the
page. The secret key (`sk_`) never does. If you see `sk_` in browser devtools, stop and
roll it.

**Trusting the success page.** The browser redirect is not proof of payment — anyone can
type that URL. Fulfilment happens in the webhook, which is signed and retried. This system
does it correctly; do not "simplify" it.

**Letting the client send a price.** The browser sends a tier name, never an amount. If it
sent an amount, someone would buy your £97 tier for a penny and you would find out at
payout reconciliation.

**Assuming your host backs up.** Most do not, by default. Check rather than assume.

**"Nobody knows the admin URL."** That is not security. The token is.

---

## If something goes wrong

1. **Rotate the affected secret first.** Investigate second.
2. **Check Stripe's logs** for charges or refunds you did not make.
3. **Check the dashboard's Failures tab** for the operational picture.
4. **If customer data was exposed**, you likely have a legal duty to notify — GDPR gives
   72 hours in the EU/UK. Find out what applies to you before you need to know.

---

Deeper technical detail — CSP nonces, reverse proxy hardening, intrusion detection,
multi-user auth: **[docs/Security-Hardening.md](docs/Security-Hardening.md)**.
