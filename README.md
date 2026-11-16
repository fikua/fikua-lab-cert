# Fikua Lab — Certificate enrollment (mTLS)

Certificate-enrollment UI for the Fikua Lab. Served at
**<https://cert.fikua.com>**.

The page asks the browser to present a client X.509 certificate (mutual
TLS), reads it back from a `/cert-info` endpoint, and shows the user
what the certificate looks like to a relying party.

## How mTLS works here

mTLS is terminated by **Traefik on the VPS** (recovers the original
`ssl_verify_client optional_no_ca` semantics — Cloudflare's mTLS modes
all validate against a specific CA, which is infeasible with the EU
LoTL of ~400 CAs; see ADR 0008r1).

1. Cloudflare DNS for `cert.fikua.com` is set to **DNS-only** (grey
   cloud) so the TLS+mTLS handshake reaches our Traefik directly.
2. Traefik terminates TLS with a Let's Encrypt cert (DNS-01) and
   requests a client certificate via the `mtls-optional-no-ca` TLS
   option (`clientAuthType: RequestClientCert` — asks but never
   validates).
3. The `cert-passtls` middleware (`passTLSClientCert`) parses whatever
   the client presented and injects it into the
   `X-Forwarded-Tls-Client-Cert-Info` request header.
4. nginx in this container (`nginx.conf`) maps those fields into the
   historical `X-Client-Subject` / `X-Client-Issuer` / `X-Client-Serial`
   / `X-Client-Valid-From` / `X-Client-Valid-To` headers that `app.js`
   already reads, and serves the static frontend for every other path.

## What lives here

```text
.
├── Dockerfile                  nginx:alpine + nginx.conf + public/
├── nginx.conf                  /cert-info mapper + static fallback
├── compose.yaml                Local dev compose (builds + runs on :8080)
├── traefik-dynamic.yml         Traefik tls.options + passTLSClientCert middleware
├── .github/workflows/
│   ├── ci.yml                  gitleaks + multi-arch image to GHCR (shared workflows)
│   └── codeql.yml              CodeQL (shared workflow)
├── public/
│   ├── index.html
│   ├── app.js                  Reads /cert-info headers and renders the cert
│   ├── style.css
│   ├── favicon.svg
│   └── shared/                 Vendored shared assets (error pages)
├── src/index.ts                Legacy Cloudflare Worker (kept for reference)
├── wrangler.toml               Legacy Worker config (kept for reference)
├── tsconfig.json
└── package.json
```

## Local development

The frontend is plain static HTML/CSS/JS. Two options:

```bash
# Frontend only (no /cert-info backend):
python3 -m http.server --directory public 8080

# Full container (builds the image, runs nginx on :8080):
docker compose up --build
```

`/cert-info` will not return real cert data locally — that requires
Traefik in front of the container with mTLS configured. To test end to
end, deploy a build through `fikua-platform-iac` (see below).

## Deployment

### One-time bootstrap on the VPS

These steps cannot be automated from CI and must be done once:

1. Copy `traefik-dynamic.yml` into the shared Traefik dynamic config:

   ```bash
   ssh vps.fikua.com
   sudo cp /tmp/traefik-dynamic.yml /opt/vps/platform/traefik/dynamic/cert-mtls.yml
   ```

   (scp the file there first; Traefik picks it up live, no restart needed.)
   Today this file lives in `fikua-platform-iac`
   (`platform-services/traefik/dynamic/cert-mtls.yml`) and Ansible syncs it.

2. Ensure the Cloudflare DNS record for `cert.fikua.com` is **DNS-only**
   (grey cloud). Managed via OpenTofu in `fikua-platform-iac` — already
   applied.

### Releases and deploys

This repository only publishes the image; it never touches the VPS.

1. **Build**: every push to `main` publishes `ghcr.io/fikua/fikua-lab-cert`
   as `latest` and `sha-<short>` (`.github/workflows/ci.yml`, shared
   workflows from `fikua-ci-workflows`).
2. **Release**: `gh release create vX.Y.Z` publishes the image as `X.Y.Z`.
3. **Deploy**: `fikua-platform-iac` pins the version in
   `projects/fikua-lab/cert/compose.yaml` (the production compose; there is
   no copy here). Dependabot there opens a pull request for each new
   `X.Y.Z`; merging it deploys (fikua-docs ADR 0019).

No VPS or registry secret is needed here: the image is pushed with
`GITHUB_TOKEN`.

## Architecture decisions

- ADR 0008r1 — Fikua Lab paths under `lab.fikua.com`; mTLS recovered on
  the VPS via Traefik `RequestClientCert` + `passTLSClientCert`.

## License

Apache-2.0. See [LICENSE](LICENSE).
