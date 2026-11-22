# Static frontend + /cert-info endpoint for cert.fikua.com.
#
# Why this exists: Cloudflare's mTLS modes all validate against a specific
# CA, and pulling the EU LoTL (~400 CAs) is infeasible. The original
# behaviour (nginx `ssl_verify_client optional_no_ca`) is only recoverable
# by terminating mTLS on our own infrastructure. Traefik on the VPS does
# the mTLS request via tls.options (clientAuthType=RequestClientCert) and
# forwards the parsed cert to this container in the
# `X-Forwarded-Tls-Client-Cert-Info` header. See ADR 0008r1.

# The -otel variant ships ngx_otel_module (traces over OTLP/gRPC to the
# Collector, fikua-docs conv-observability.md); its nginx.conf does not
# load it, hence the sed.
FROM nginx:1.30.7-alpine-otel@sha256:a05474d618c6a5da1081380cb54728f53743bc295b04f6dc5378a6282c90d190

RUN sed -i '1i load_module modules/ngx_otel_module.so;' /etc/nginx/nginx.conf \
 && rm /etc/nginx/conf.d/default.conf
# The image's entrypoint runs envsubst on templates/*.template into
# conf.d/ at start, replacing only the variables defined here or in the
# compose file (nginx's own $variables are left alone).
ENV OTEL_TRACE=off \
    OTEL_EXPORTER_OTLP_GRPC_ENDPOINT=localhost:4317 \
    DEPLOYMENT_ENVIRONMENT=dev
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY public/    /usr/share/nginx/html/

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
