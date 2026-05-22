# Fikua Lab — Certificate enrollment (mTLS)

Certificate-enrollment UI for the Fikua Lab. Served at
**<https://cert.lab.fikua.com>**.

The page asks the browser to present a client X.509 certificate (mutual
TLS), reads it back from a `/cert-info` endpoint, and shows the user
what the certificate looks like to a relying party.

## How mTLS works here

mTLS is terminated by **Cloudflare** at the edge (ADR 0008):

1. Cloudflare → SSL/TLS → Client Certificates is enabled for
   `cert.lab.fikua.com`, in **"request, no CA validation"** mode (matches
   the old nginx `optional_no_ca` behaviour).
2. When the client presents a cert, Cloudflare attaches the parsed
   fields to `request.cf.tlsClientAuth`.
3. A tiny Worker function in `src/index.ts` answers `GET /cert-info`
   with the same `X-Client-*` headers the old nginx setup emitted —
   `X-Client-Subject`, `X-Client-Issuer`, `X-Client-Serial`, etc. —
   so the frontend (`app.js`) does not have to change.
4. Every other path falls through to the static assets binding
   (`index.html`, `style.css`, `app.js`, `shared/*`).

## What lives here

```text
.
├── src/
│   └── index.ts      Worker function: /cert-info + static assets fallback
├── index.html        Frontend
├── style.css
├── app.js            Reads /cert-info headers and renders the cert details
├── favicon.svg
├── shared/           Vendored shared assets (consent banner, error pages)
├── wrangler.toml     Worker + Static Assets binding
├── tsconfig.json
└── package.json      wrangler + @cloudflare/workers-types
```

## Local development

```bash
npm ci
npm run dev          # wrangler dev — opens the Worker locally
npm run typecheck
```

`wrangler dev` does not perform real mTLS termination locally, so
`/cert-info` will return the "no certificate presented" shape. Test
mTLS end-to-end by deploying a preview build.

## Hosting

- **Production:** Cloudflare Workers (project `fikua-lab-cert`), custom
  domain `cert.lab.fikua.com`.
- **mTLS:** terminated at the Cloudflare edge — see "How mTLS works"
  above. The hostname must be added under SSL/TLS → Client
  Certificates → Hosts.

## Architecture decisions

- ADR 0008 — Fikua Lab frontends on Cloudflare Workers; mTLS migrated
  to the edge.

## License

Apache-2.0. See [LICENSE](LICENSE).
