/**
 * RFC 822 message for Gmail `messages/send` raw base64url encoding.
 * With `htmlBody`, builds multipart/alternative (plain + HTML).
 */
export function buildRfc822Message(
  to: string,
  from: string,
  subject: string,
  textBody: string,
  htmlBody?: string,
): string {
  if (!htmlBody) {
    const lines = [
      `To: ${to}`,
      `From: ${from}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      textBody,
    ];
    return lines.join("\r\n");
  }
  const boundary = `signflow_${crypto.randomUUID().replace(/-/g, "")}`;
  const parts = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
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
  ];
  return parts.join("\r\n");
}
