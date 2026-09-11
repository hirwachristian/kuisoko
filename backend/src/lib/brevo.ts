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

export function sendDeliveryArrivingEmail(to: string, name: string, orderNumber: string): Promise<boolean> {
  return sendEmail({
    to,
    toName: name,
    subject: `Your order ${orderNumber} is almost there!`,
    htmlContent: `
      <p>Hi ${name},</p>
      <p>Your delivery rider has arrived near your address for order ${orderNumber}. Please get ready to receive it!</p>
    `,
  });
}

export function sendBackInStockEmail(to: string, productName: string, productUrl: string, variantLabel?: string): Promise<boolean> {
  return sendEmail({
    to,
    subject: `Back in stock: ${productName}`,
    htmlContent: `
      <p>Hi,</p>
      <p>Good news - "${productName}"${variantLabel ? ` (${variantLabel})` : ''} is back in stock at KuISOKO.</p>
      <p><a href="${productUrl}">View the product</a> before it sells out again.</p>
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
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;background-color:#f8fafc;padding:24px 16px;">
        <div style="background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <div style="background-color:#065f46;padding:24px 32px;">
            <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.3px;">Ku<span style="color:#f97316;">I</span>SOKO</span>
          </div>
          <div style="padding:32px;">
            <p style="font-size:16px;color:#0f172a;margin:0 0 8px;">Hi ${name},</p>
            <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 24px;">
              We received a request to reset the password for your KuISOKO account. Click the button below to choose a new one.
            </p>
            <div style="text-align:center;margin:0 0 28px;">
              <a href="${resetUrl}" style="display:inline-block;background-color:#065f46;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">Reset Password</a>
            </div>
            <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 4px;">This link expires in <strong>1 hour</strong> and can only be used once.</p>
            <p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:0 0 24px;">Didn't request this? You can safely ignore this email - your password won't change.</p>
            <p style="font-size:12px;color:#cbd5e1;line-height:1.5;margin:0;word-break:break-all;">
              Button not working? Paste this link into your browser:<br/>
              <a href="${resetUrl}" style="color:#94a3b8;">${resetUrl}</a>
            </p>
          </div>
        </div>
        <p style="text-align:center;font-size:12px;color:#94a3b8;margin:20px 0 0;">© ${new Date().getFullYear()} KuISOKO. All rights reserved.</p>
      </div>
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

export function sendTwoFactorCodeEmail(to: string, name: string, code: string): Promise<boolean> {
  return sendEmail({
    to,
    toName: name,
    subject: `${code} is your KuISOKO verification code`,
    htmlContent: `
      <p>Hi ${name},</p>
      <p>Your two-factor authentication code is:</p>
      <p style="font-size:32px;font-weight:800;letter-spacing:6px;margin:16px 0;">${code}</p>
      <p>This code expires in 10 minutes. If you didn't request this, someone may have your password - consider changing it.</p>
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

export function sendCheckoutVerificationEmail(to: string, name: string, code: string): Promise<boolean> {
  const digits = code.split('');
  return sendEmail({
    to,
    toName: name,
    subject: `${code} is your KuISOKO verification code`,
    htmlContent: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;background-color:#f8fafc;padding:24px 16px;">
        <div style="background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <div style="background-color:#065f46;padding:24px 32px;">
            <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.3px;">Ku<span style="color:#f97316;">I</span>SOKO</span>
          </div>
          <div style="padding:32px;">
            <p style="font-size:16px;color:#0f172a;margin:0 0 8px;">Hi ${name},</p>
            <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 24px;">
              Enter this code to confirm your order on KuISOKO. It confirms the order is really coming from you.
            </p>
            <div style="display:flex;justify-content:center;gap:10px;margin:0 0 24px;">
              ${digits.map((d) => `<span style="display:inline-block;width:48px;height:56px;line-height:56px;text-align:center;font-size:26px;font-weight:800;color:#065f46;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">${d}</span>`).join('')}
            </div>
            <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 4px;">This code expires in <strong>10 minutes</strong>.</p>
            <p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:0;">Didn't request this? You can safely ignore this email - no order will be placed without it.</p>
          </div>
        </div>
        <p style="text-align:center;font-size:12px;color:#94a3b8;margin:20px 0 0;">© ${new Date().getFullYear()} KuISOKO. All rights reserved.</p>
      </div>
    `,
  });
}

export { isConfigured as isBrevoConfigured };
