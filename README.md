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
├── deploy/compose.yaml         Production compose (source of truth for the VPS)
├── traefik-dynamic.yml         Traefik tls.options + passTLSClientCert middleware
├── .github/workflows/
│   ├── release.yml             Build & push multi-arch image to Docker Hub
│   └── deploy.yml              SSH via Cloudflare Access → pull + up -d on VPS
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
end, ship a preview build via the deploy workflow.

## Deployment

### One-time bootstrap on the VPS

These steps cannot be automated from CI and must be done once:

1. Copy `traefik-dynamic.yml` into the shared Traefik dynamic config:

   ```bash
   ssh vps.fikua.com
   sudo cp /tmp/traefik-dynamic.yml /opt/vps/platform/traefik/dynamic/cert-mtls.yml
   ```

   (scp the file there first; Traefik picks it up live, no restart needed.)

2. Ensure the Cloudflare DNS record for `cert.fikua.com` is **DNS-only**
   (grey cloud). Managed via OpenTofu in `fikua-platform-iac` — already
   applied.

### Per-release deploys (CI/CD)

After bootstrap, every release goes through GitHub Actions:

1. **Build**: pushing to `main` or tagging `v*.*.*` triggers
   `release.yml`, which builds a multi-arch image and pushes it to
   Docker Hub (`fikua/fikua-lab-cert`).
2. **Deploy**: a published release auto-triggers `deploy.yml`; the run
   pauses until a reviewer approves the `prd` environment. Manual
   deploys via `workflow_dispatch` are also available with a custom
   `image_tag` input.

The deploy workflow reaches the VPS through the Cloudflare Access
tunnel (`vps.fikua.com`), scp's `deploy/compose.yaml` as the source of
truth, then runs `docker compose pull && up -d`.

Required GitHub secrets (same set as the DSS repo): `DOCKER_USERNAME`,
`DOCKER_TOKEN`, `VPS_SSH_PRIVATE_KEY`, `CF_ACCESS_CLIENT_ID`,
`CF_ACCESS_CLIENT_SECRET`. The `prd` environment must be configured
with required reviewers in Settings → Environments → prd.

## Architecture decisions

- ADR 0008r1 — Fikua Lab paths under `lab.fikua.com`; mTLS recovered on
  the VPS via Traefik `RequestClientCert` + `passTLSClientCert`.

## License

Apache-2.0. See [LICENSE](LICENSE).
