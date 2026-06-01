import { docusealBaseUrl, ensureHttpUrlBase } from "@/services/docuseal-client";
import type { SigningRequest } from "@/types/models";

/** Public DocuSeal web origin (signing links, PDF downloads). Not the /api mount. */
export function docusealPublicBaseUrl(): string {
  const admin = process.env.DOCUSEAL_ADMIN_BASE_URL?.trim();
  if (admin) return ensureHttpUrlBase(admin);
  return docusealBaseUrl().replace(/\/api\/?$/i, "");
}

const SIGNING_PATH = /\/s\/[A-Za-z0-9_-]+/;

/**
 * Rewrite DocuSeal-hosted URLs to the configured public base.
 * Signing links use the /s/{slug} path; document URLs keep path + query.
 */
export function normalizeDocusealPublicUrl(
  url: string | null | undefined,
  slug?: string | null,
): string | null {
  const base = docusealPublicBaseUrl();
  const slugToken = slug?.trim().replace(/^\/s\//, "").replace(/^\/+|\/+$/g, "");
  if (slugToken) return `${base}/s/${slugToken}`;

  const raw = url?.trim();
  if (!raw) return null;

  const signingPath = raw.match(SIGNING_PATH);
  if (signingPath) return `${base}${signingPath[0]}`;

  try {
    const configured = new URL(base.endsWith("/") ? base : `${base}/`);
    const parsed = new URL(raw);
    if (parsed.hostname.toLowerCase() === configured.hostname.toLowerCase()) {
      return raw.replace(/\/$/, "");
    }
    parsed.protocol = configured.protocol;
    parsed.host = configured.host;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

export function normalizeSigningRequestDocusealUrls(req: SigningRequest): SigningRequest {
  const signingUrl = normalizeDocusealPublicUrl(req.signingUrl);
  const signedPdfUrl = normalizeDocusealPublicUrl(req.signedPdfUrl);
  const auditCertificateUrl = normalizeDocusealPublicUrl(req.auditCertificateUrl);
  if (
    signingUrl === req.signingUrl &&
    signedPdfUrl === req.signedPdfUrl &&
    auditCertificateUrl === req.auditCertificateUrl
  ) {
    return req;
  }
  return { ...req, signingUrl, signedPdfUrl, auditCertificateUrl };
}
