# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public GitHub issue.

Instead, email us directly at: **security@gymtech.in**

Include the following details:

- Type of issue (XSS, SQL injection, auth bypass, etc.)
- Full steps to reproduce
- Potential impact and severity assessment
- Any suggested fixes (optional)

We aim to acknowledge within 48 hours and provide a timeline for a fix.

## Security Best Practices

When self-hosting GymTech OS:

- Use a strong, unique `JWT_SECRET` (at least 32 random characters)
- Enable HTTPS everywhere (Cloudflare Proxy or your own TLS)
- Rotate secrets regularly
- Keep `NODE_ENV=production` in deployed environments
- Never expose `.env` or `.dev.vars` publicly
