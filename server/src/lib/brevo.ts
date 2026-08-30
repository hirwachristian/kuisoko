function isConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

async function sendEmail(params: {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  attachment?: { name: string; content: string }[]; // content = base64, no data: prefix
}): Promise<boolean> {
  if (!isConfigured()) {
    console.warn(`Brevo is not configured; skipping email "${params.subject}" to ${params.to}.`);
    return false;
  }
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME ?? 'KuISOKO' },
        to: [{ email: params.to, name: params.toName }],
        subject: params.subject,
        htmlContent: params.htmlContent,
        ...(params.attachment ? { attachment: params.attachment } : {}),
      }),
    });
    if (!res.ok) {
      console.error(`Brevo email failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    // Email delivery is best-effort - never let it break the request that triggered it.
    console.error('Error sending email via Brevo:', err);
    return false;
  }
}

export function sendWelcomeEmail(to: string, name: string): Promise<boolean> {
  return sendEmail({
    to,
    toName: name,
    subject: 'Welcome to KuISOKO!',
    htmlContent: `
      <p>Hi ${name},</p>
      <p>Your account is successfully created. Thank you for choosing KuISOKO!</p>
    `,
  });
}

export function sendOrderProcessingEmail(to: string, name: string, orderNumber: string): Promise<boolean> {
  return sendEmail({
    to,
    toName: name,
    subject: `Your order ${orderNumber} is being prepared`,
    htmlContent: `
      <p>Hi ${name},</p>
      <p>Your order is received successfully and it is in preparing process. We confirm you shortly.</p>
    `,
  });
}

export function sendInvoiceEmail(to: string, name: string, orderNumber: string, pdfBase64: string): Promise<boolean> {
  return sendEmail({
    to,
    toName: name,
    subject: `Your invoice for order ${orderNumber}`,
    htmlContent: `
      <p>Hi ${name},</p>
      <p>Please find attached the invoice for your order ${orderNumber}.</p>
    `,
    attachment: [{ name: `Invoice-${orderNumber}.pdf`, content: pdfBase64 }],
  });
}

export function sendAnnouncementEmail(to: string, subject: string, message: string): Promise<boolean> {
  const appUrl = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  const unsubscribeUrl = `${appUrl}/unsubscribe?email=${encodeURIComponent(to)}`;
  return sendEmail({
    to,
    subject,
    htmlContent: `
      <div>${message.replace(/\n/g, '<br/>')}</div>
      <p style="margin-top:32px;font-size:12px;color:#888;">
        You're receiving this because you joined the KuISOKO inner circle.
        <a href="${unsubscribeUrl}">Unsubscribe</a>
      </p>
    `,
  });
}

export function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<boolean> {
  return sendEmail({
    to,
    toName: name,
    subject: 'Reset your KuISOKO password',
    htmlContent: `
      <p>Hi ${name},</p>
      <p>We received a request to reset your KuISOKO password. Click the link below to choose a new one:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}

export function sendEnquiryReplyEmail(to: string, name: string, subject: string, replyBody: string): Promise<boolean> {
  return sendEmail({
    to,
    toName: name,
    subject: `Re: ${subject}`,
    htmlContent: `
      <p>Hi ${name},</p>
      <div>${replyBody.replace(/\n/g, '<br/>')}</div>
      <p style="margin-top:24px;font-size:12px;color:#888;">This is a reply to the message you sent us via the KuISOKO contact form.</p>
    `,
  });
}

export function sendEmailChangeVerification(to: string, name: string, confirmUrl: string): Promise<boolean> {
  return sendEmail({
    to,
    toName: name,
    subject: 'Confirm your new KuISOKO email address',
    htmlContent: `
      <p>Hi ${name},</p>
      <p>We received a request to change the email address on your KuISOKO account to this one. Click the link below to confirm it:</p>
      <p><a href="${confirmUrl}">${confirmUrl}</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email - your account email won't change.</p>
    `,
  });
}

export { isConfigured as isBrevoConfigured };
