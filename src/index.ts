/**
 * Cloudflare Worker for cert.lab.fikua.com.
 *
 * Cloudflare terminates mTLS at the edge: when a client presents a TLS
 * client certificate, the request arrives here with `request.cf.tlsClientAuth`
 * populated. The frontend (app.js) calls GET /cert-info and reads the
 * X-Client-* headers — we keep the exact same header contract that the old
 * nginx setup used, so the static page does not need to change.
 *
 * All other paths fall through to the static assets bound under [assets].
 */

export interface Env {
    ASSETS: Fetcher;
}

interface TlsClientAuth {
    certPresented: '0' | '1';
    certVerified: 'NONE' | 'SUCCESS' | 'FAILED:expired' | 'FAILED:revoked'
        | 'FAILED:bad_signature' | 'FAILED:bad_purpose' | 'FAILED:other';
    certIssuerDN?: string;
    certSubjectDN?: string;
    certSerial?: string;
    certFingerprintSHA256?: string;
    certNotBefore?: string;
    certNotAfter?: string;
}

function headersForCertInfo(auth: TlsClientAuth | undefined): HeadersInit {
    if (!auth || auth.certPresented !== '1') {
        // Same shape nginx used when no client cert was presented.
        return {
            'X-Client-Verify': 'NONE',
            'X-Client-Subject': '-',
            'X-Client-Issuer': '-',
            'X-Client-Serial': '-',
            'X-Client-Fingerprint': '-',
            'X-Client-Valid-From': '-',
            'X-Client-Valid-To': '-',
            // Tell browsers / fetch they can read these from a CORS response.
            'Access-Control-Expose-Headers':
                'X-Client-Verify, X-Client-Subject, X-Client-Issuer, X-Client-Serial, X-Client-Fingerprint, X-Client-Valid-From, X-Client-Valid-To',
            'Cache-Control': 'no-store',
        };
    }
    // We do not validate the chain (matches the old `optional_no_ca` mode),
    // so we report SUCCESS as long as the cert parses correctly. Anything
    // beyond that is up to the frontend to display.
    return {
        'X-Client-Verify': auth.certVerified === 'NONE' ? 'NONE' : 'SUCCESS',
        'X-Client-Subject': auth.certSubjectDN ?? '-',
        'X-Client-Issuer': auth.certIssuerDN ?? '-',
        'X-Client-Serial': auth.certSerial ?? '-',
        'X-Client-Fingerprint': auth.certFingerprintSHA256 ?? '-',
        'X-Client-Valid-From': auth.certNotBefore ?? '-',
        'X-Client-Valid-To': auth.certNotAfter ?? '-',
        'Access-Control-Expose-Headers':
            'X-Client-Verify, X-Client-Subject, X-Client-Issuer, X-Client-Serial, X-Client-Fingerprint, X-Client-Valid-From, X-Client-Valid-To',
        'Cache-Control': 'no-store',
    };
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === '/cert-info') {
            const auth = (request as Request & { cf?: { tlsClientAuth?: TlsClientAuth } })
                .cf?.tlsClientAuth;
            return new Response(null, {
                status: 204,
                headers: headersForCertInfo(auth),
            });
        }

        // Everything else is a static asset (index.html, app.js, style.css,
        // favicon.svg, shared/*). Workers Static Assets handles the binding.
        return env.ASSETS.fetch(request);
    },
};
