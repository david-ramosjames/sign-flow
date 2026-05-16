/** Brand tokens (Sign Flow transactional email). */
const BRAND_PRIMARY = "#1e3a8a";
const BRAND_ACCENT = "#ce3678";
const TEXT_MUTED = "#64748b";
const TEXT_BODY = "#334155";

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Public site origin for `/rj-logo.svg` (no trailing slash). Server: `SIGNFLOW_EMAIL_PUBLIC_ORIGIN`. */
export function getEmailAssetBaseUrl(): string | null {
  const raw =
    process.env.SIGNFLOW_EMAIL_PUBLIC_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_SIGNFLOW_EMAIL_PUBLIC_ORIGIN?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export function splitEmailBodyAroundUrl(fullText: string, url: string): { before: string; after: string } {
  const idx = url ? fullText.indexOf(url) : -1;
  if (idx === -1) return { before: fullText.trimEnd(), after: "" };
  return {
    before: fullText.slice(0, idx).trimEnd(),
    after: fullText.slice(idx + url.length).trimStart(),
  };
}

function plainBlocksToHtmlParagraphs(plain: string): string {
  const t = plain.trim();
  if (!t) return "";
  return t
    .split(/\n\n+/)
    .map((block) => {
      const inner = escapeHtml(block).replaceAll("\n", "<br />");
      return `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:${TEXT_BODY};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${inner}</p>`;
    })
    .join("");
}

function ctaLabel(kind: "signing" | "reminder"): string {
  return kind === "signing" ? "Review &amp; sign documents →" : "Complete your documents →";
}

export type BrandedEmailHtmlOptions = {
  kind: "signing" | "reminder";
  beforeUrlPlain: string;
  afterUrlPlain: string;
  signingUrl: string;
  firm: string;
  /** If set, used as the header image (https URL). Else `/rj-logo.svg` from `assetBaseUrl`, else “RJ” mark. */
  firmLogoUrl: string | null;
  footerPlain: string;
  /** e.g. `https://your-app.com` so logo loads from `.../rj-logo.svg` when `firmLogoUrl` is unset */
  assetBaseUrl: string | null;
};

export function buildBrandedEmailHtml(opts: BrandedEmailHtmlOptions): string {
  const { kind, beforeUrlPlain, afterUrlPlain, signingUrl, firm, firmLogoUrl, footerPlain, assetBaseUrl } = opts;
  const wordmark = escapeHtml(firm);

  const hostedSvg = assetBaseUrl ? `${assetBaseUrl}/rj-logo.svg` : null;
  const resolvedLogo = firmLogoUrl?.trim() || hostedSvg;

  /** Centered logo in navy; sized for full lockup art (shield + wordmark). */
  const logoBlock = resolvedLogo
    ? `<img src="${escapeHtml(resolvedLogo)}" alt="${wordmark}" style="display:block;margin:0 auto;width:auto;max-width:280px;max-height:120px;height:auto;border:0;outline:none;text-decoration:none;" />`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
        <tr>
          <td style="width:56px;height:56px;border-radius:12px;background:#ffffff;text-align:center;vertical-align:middle;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:${BRAND_PRIMARY};">RJ</td>
        </tr>
        <tr><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td align="center" style="font-family:Georgia,'Times New Roman',Times,serif;font-size:17px;font-weight:600;color:#ffffff;letter-spacing:0.06em;line-height:1.35;">${wordmark}</td>
        </tr>
      </table>`;

  const beforeHtml = plainBlocksToHtmlParagraphs(beforeUrlPlain);
  const afterHtml = plainBlocksToHtmlParagraphs(afterUrlPlain);
  const footerHtml = plainBlocksToHtmlParagraphs(footerPlain);

  const safeUrl = escapeHtml(signingUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${wordmark}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
        <tr>
          <td align="center" style="background:${BRAND_PRIMARY};padding:36px 28px 32px 28px;">
            ${logoBlock}
          </td>
        </tr>
        <tr>
          <td align="center" style="background:#ffffff;padding:14px 28px 18px 28px;border-bottom:1px solid #e2e8f0;">
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND_ACCENT};">Secure document signing</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px 32px;">
            ${beforeHtml}
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px 0;">
              <tr>
                <td style="border-radius:10px;background:${BRAND_PRIMARY};">
                  <a href="${safeUrl}" style="display:inline-block;padding:15px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${ctaLabel(kind)}</a>
                </td>
              </tr>
            </table>
            ${afterHtml}
            <p style="margin:24px 0 0;font-size:13px;line-height:1.55;color:${TEXT_MUTED};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">If the button does not work, copy and paste this link into your browser:</p>
            <p style="margin:8px 0 0;font-size:12px;line-height:1.5;word-break:break-all;color:${TEXT_BODY};font-family:Consolas,'Courier New',monospace;">${safeUrl}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e2e8f0;">
              <tr>
                <td style="padding-top:24px;">
                  <div style="margin-top:0;">${footerHtml}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:#94a3b8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;">This is a transactional message about your documents. Please do not share the signing link with anyone you do not trust.</p>
    </td>
  </tr>
</table>
</body>
</html>`;
}
