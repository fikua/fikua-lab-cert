# Fikua Lab — Certificate enrollment (mTLS)

Certificate-enrollment UI for the Fikua Lab. Served at
**<https://cert.lab.fikua.com>**.

This hostname is the only one of the lab that uses **mutual TLS**: the
client may present an X.509 certificate, the page reads back the
subject/issuer/serial via headers, and the UI shows the user what their
client cert looks like to a relying party.

In the old nginx setup, mTLS was terminated with
`ssl_verify_client optional_no_ca` and the cert fields were exposed
through `$ssl_client_*` variables. Under ADR 0008 the handshake moves
to **Cloudflare API Shield / mTLS** at the edge, and the
`/cert-info` endpoint becomes a tiny Worker function that reads the
`Cf-Cert-Subject-Dn` / `Cf-Cert-Issuer-Dn` / … headers Cloudflare
sets on every authenticated request.

## What lives here

```text
.
├── index.html
├── style.css
├── app.js
├── favicon.svg
└── shared/         Vendored shared assets (consent banner, error pages)
```

Pure static (the `/cert-info` Worker function will be added when mTLS
is wired up at the Cloudflare edge).

## Hosting

- **Production:** Cloudflare Workers Static Assets (project
  `fikua-lab-cert`), custom domain `cert.lab.fikua.com`.
- **mTLS:** terminated by Cloudflare API Shield; the hostname must be
  registered there with the appropriate authentication scheme.

## Architecture decisions

- ADR 0008 — Fikua Lab frontends on Cloudflare Workers; mTLS migrated
  to the edge.

## License

Apache-2.0. See [LICENSE](LICENSE).
