import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    const config: any = {
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
    };
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      config.auth = {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      };
    }
    transporter = nodemailer.createTransport(config);
  }
  return transporter;
}

export async function sendMail(params: { to: string; subject: string; text: string; html?: string; attachments?: any[] }) {
  const transport = getTransporter();
  const info = await transport.sendMail({
    from: process.env.SMTP_FROM || '"Чек-лист" <noreply@example.com>',
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    attachments: params.attachments,
  });
  console.log('Email sent:', nodemailer.getTestMessageUrl(info));
  return info;
}
