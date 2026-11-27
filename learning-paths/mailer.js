// Sends the few emails the app needs (password reset). With RESEND_API_KEY and MAIL_FROM set
// it sends through Resend's HTTP API; otherwise it writes the message to the server log, so a
// self-hosted install still works (the admin can also make a link with `npm run admin`).

export function createMailer(env = process.env) {
  if (env.RESEND_API_KEY && env.MAIL_FROM) {
    return {
      kind: 'resend',
      async send({ to, subject, text }) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text }),
        });
        if (!res.ok) throw new Error(`mail send failed: ${res.status} ${await res.text().catch(() => '')}`);
      },
    };
  }
  return {
    kind: 'log',
    async send({ to, subject, text }) {
      console.log(`[mail to ${to}] ${subject}\n${text}`);
    },
  };
}
