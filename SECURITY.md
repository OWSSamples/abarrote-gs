# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, **do not open a public issue**.
Instead, report it privately to: **security@opendex.dev**

We aim to acknowledge reports within 48 hours and provide a remediation timeline within 5 business days.

---

## Secrets Management

### Where secrets live

| Environment | Source of truth | Notes |
|---|---|---|
| Local dev | `.env.local` (gitignored) | Copy from `.env.example` |
| Preview / Production | Vercel → Project → Settings → Environment Variables | Pull with `vercel env pull .env.local` |
| CI (GitHub Actions) | Repo → Settings → Secrets and variables → Actions | Use only for CI-specific tokens |

### Hard rules

1. **Never** commit `.env.local`, `.env.*.local`, or any `.env` file other than `.env.example`.
2. **Never** paste real secrets into chat, issues, PRs, or commit messages.
3. **Never** log secrets to stdout, Sentry, or any external service. Use redaction in logger middleware.
4. `.env.example` is the only env file allowed in git — it must contain placeholders only.
5. All new secrets MUST be added to `.gitleaks.toml` if they have a recognizable prefix/format.

### Pre-commit protection

`.husky/pre-commit` runs **gitleaks** on staged changes. It blocks any commit containing a secret pattern.

Install gitleaks locally:
```bash
brew install gitleaks         # macOS
# or download from https://github.com/gitleaks/gitleaks/releases
```

CI also runs gitleaks on every push/PR (`.github/workflows/security.yml`) and a full-history scan weekly.

---

## Secret Rotation Runbook

Trigger this runbook if a secret is suspected to be leaked (commit pushed, screenshot shared, log file uploaded, laptop lost, employee offboarding, etc.).

### Priority 0 — Production database

**Neon Postgres** (`DATABASE_URL`):
1. Console → Project → Branches → main → Roles → `neondb_owner` → Reset password
2. Update `DATABASE_URL` in Vercel (Production + Preview).
3. Trigger redeploy: `vercel --prod` or merge to `main`.

### Priority 0 — AWS

**Access Keys** (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`):
1. AWS Console → IAM → Users → your user → Security credentials → Make leaked key inactive.
2. Create new access key → update Vercel + `.env.local`.
3. Delete the old key after 24h confirmation everything works.

**Cognito User Pool**:
- User Pool ID and Client ID are not strictly secret (they appear in browser bundles), but if compromised:
- Console → User pool → App integration → App clients → Edit → rotate any secret if used.

### Priority 1 — Payment providers

| Provider | Where to rotate |
|---|---|
| Stripe | Dashboard → Developers → API keys → Roll secret key |
| MercadoPago | Panel → Tus integraciones → Credenciales → Generar nuevas |
| Conekta | Dashboard → Configuración → API Keys → Regenerar |
| Clip | Portal de Comercios → API → Regenerar |

### Priority 1 — Auth & Webhooks

- **CRON_SECRET / TELEGRAM_WEBHOOK_SECRET / MP_WEBHOOK_SECRET / STRIPE_WEBHOOK_SECRET**:
  Generate new with `openssl rand -hex 32` → update at provider AND in Vercel.
- **OAUTH_ENCRYPTION_KEY**: rotating this invalidates all encrypted OAuth tokens stored in DB. Plan migration before rotating.

### Priority 2 — Observability & infra

- **SENTRY_AUTH_TOKEN**: sentry.io → Settings → Account → Auth Tokens → Revoke + regenerate.
- **UPSTASH_REDIS_REST_TOKEN / QSTASH_TOKEN**: Upstash console → Database → Reset token.
- **SMTP_PASSWORD**: rotate at email provider (Spacemail), update Vercel.

### Post-rotation checklist

- [ ] All env values updated in **Vercel** (Prod, Preview, Dev).
- [ ] All env values updated in local `.env.local` for affected developers.
- [ ] Old credentials revoked at provider (not just disabled).
- [ ] Redeploy triggered and smoke-tested.
- [ ] Incident logged in `/docs/incidents/YYYY-MM-DD-secret-rotation.md` (if customer-facing).
- [ ] If secret was committed: history scrubbed with `git filter-repo` (see below).

---

## Scrubbing leaked secrets from git history

If a secret was **actually committed and pushed** (rare — pre-commit hooks should prevent this):

```bash
# 1. Install git-filter-repo: https://github.com/newren/git-filter-repo
brew install git-filter-repo

# 2. Make a backup
git clone --mirror git@github.com:OWSSamples/abarrote-gs.git abarrote-gs-backup

# 3. Remove file from all history
git filter-repo --path .env.local --invert-paths

# 4. Or replace specific string in all history
echo 'LEAKED_SECRET_VALUE==>REDACTED' > /tmp/replace.txt
git filter-repo --replace-text /tmp/replace.txt

# 5. Force-push (coordinate with team — destructive)
git push --force --all
git push --force --tags

# 6. ALL collaborators must re-clone. Open PRs need rebase.
# 7. Rotate the secret at provider IMMEDIATELY (rewriting history does NOT remove it from forks/clones).
```

**Important**: rotating the secret is more important than scrubbing history. GitHub mirrors and forks may retain the old version forever.

---

## Dependency Vulnerabilities

- `bun audit` runs in CI on every PR (`.github/workflows/security.yml`).
- Dependabot is enabled for npm + GitHub Actions (configured in `.github/dependabot.yml` if applicable).
- High/Critical CVEs must be patched within 7 days; Medium within 30 days.

---

## Authentication Hardening

- All auth flows go through **AWS Cognito**.
- Sessions use HTTP-only `__session` cookie with `Secure` + `SameSite=Strict` in production.
- ID tokens are verified server-side via `aws-jwt-verify` against Cognito's JWKS endpoint.
- MFA: should be enabled at the User Pool level (Cognito console → Sign-in experience → MFA).
- Password policy: enforced by Cognito (min 8 chars, requires upper/lower/number/symbol — configurable in console).

---

## Contact

- Security: `security@opendex.dev`
- General: `dev@opendex.dev`
