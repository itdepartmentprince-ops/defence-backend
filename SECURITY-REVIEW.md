# Website Security Review

## Scope

Source and configuration review of `defence-frontend`, `defence-admin`, and
`defence-backend`. No files or configuration were changed as part of the audit.
Environment-file values were not inspected, and deployed response headers were
not independently verified. Hosting infrastructure may provide protections
that are not represented in this repository.

## Finding

### MEDIUM — Admin UI may be vulnerable to clickjacking

- **Affected file:** `defence-admin/next.config.mjs` (lines 2–46)
- **Related file:** `defence-backend/src/controllers/authController.js`
  (lines 201–225)
- **Confidence:** 8/10
- **Details:** The admin Next.js configuration does not define an
  `X-Frame-Options` header or an enforced Content Security Policy
  `frame-ancestors` directive. The backend configures the production
  authentication cookie with `SameSite=None; Secure`. If a signed-in
  administrator visits an attacker-controlled page that embeds the admin
  interface, deceptive framing could trick them into activating administrative
  controls. The CSRF token does not by itself prevent a user from being
  tricked into interacting with the legitimate interface.
- **Recommendation:** Configure the admin application or hosting layer to send
  `Content-Security-Policy: frame-ancestors 'none'` (or a narrowly scoped
  allowlist), and `X-Frame-Options: DENY` as a legacy-browser fallback.

## Scope notes

Public blog, gallery, achiever, contact-submission, and quiz endpoints were
treated as intended public functionality. This source review does not assess
whether published personal information has the required consent, nor does it
confirm deployed access controls or headers. No other confirmed exploitable
issues were identified in the reviewed source/configuration.
