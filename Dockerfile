# Static frontend + /cert-info endpoint for cert.fikua.com.
#
# Why this exists: Cloudflare's mTLS modes all validate against a specific
# CA, and pulling the EU LoTL (~400 CAs) is infeasible. The original
# behaviour (nginx `ssl_verify_client optional_no_ca`) is only recoverable
# by terminating mTLS on our own infrastructure. Traefik on the VPS does
# the mTLS request via tls.options (clientAuthType=RequestClientCert) and
# forwards the parsed cert to this container in the
# `X-Forwarded-Tls-Client-Cert-Info` header. See ADR 0008r1.

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public/    /usr/share/nginx/html/

EXPOSE 80
