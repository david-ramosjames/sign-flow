/**
 * RFC 822 message for Gmail `messages/send` raw base64url encoding.
 * With `htmlBody`, builds multipart/alternative (plain + HTML).
 * With `attachments`, wraps body in multipart/mixed.
 */
export type EmailAttachment = {
  filename: string;
  content: Buffer;
  mimeType?: string;
};

function wrapBase64(b64: string): string {
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));
  return lines.join("\r\n");
}

function buildBodyPart(textBody: string, htmlBody?: string): { headers: string[]; body: string } {
  if (!htmlBody) {
    return {
      headers: ["Content-Type: text/plain; charset=UTF-8"],
      body: textBody,
    };
  }
  const boundary = `alt_${crypto.randomUUID().replace(/-/g, "")}`;
  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    textBody,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    htmlBody,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return {
    headers: [`Content-Type: multipart/alternative; boundary="${boundary}"`],
    body,
  };
}

export function buildRfc822Message(
  to: string,
  from: string,
  subject: string,
  textBody: string,
  htmlBody?: string,
  attachments?: EmailAttachment[],
): string {
  const headers = [`To: ${to}`, `From: ${from}`, `Subject: ${subject}`, "MIME-Version: 1.0"];

  if (!attachments?.length) {
    const part = buildBodyPart(textBody, htmlBody);
    return [...headers, ...part.headers, "", part.body].join("\r\n");
  }

  const mixBoundary = `mix_${crypto.randomUUID().replace(/-/g, "")}`;
  const part = buildBodyPart(textBody, htmlBody);
  const chunks: string[] = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${mixBoundary}"`,
    "",
    `--${mixBoundary}`,
    ...part.headers,
    "",
    part.body,
  ];

  for (const att of attachments) {
    const mime = att.mimeType ?? "application/octet-stream";
    const encoded = wrapBase64(att.content.toString("base64"));
    const safeName = att.filename.replace(/"/g, "'");
    chunks.push(
      `--${mixBoundary}`,
      `Content-Type: ${mime}; name="${safeName}"`,
      `Content-Disposition: attachment; filename="${safeName}"`,
      "Content-Transfer-Encoding: base64",
      "",
      encoded,
      "",
    );
  }
  chunks.push(`--${mixBoundary}--`, "");
  return chunks.join("\r\n");
}
