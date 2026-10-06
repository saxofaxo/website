import nodemailer from "nodemailer";

/* Saxofaxo – Bestätigungsmail an Anfragende
 *
 * Netlify ruft diese Event-Function automatisch nach jeder verifizierten
 * Formular-Einsendung auf (reservierter Name "submission-created", also erst
 * NACH bestandenem reCAPTCHA). Sie schickt der anfragenden Person eine kurze
 * Eingangsbestätigung per SMTP über das eigene Postfach.
 *
 * Benötigte Environment-Variablen (Netlify → Site settings → Environment):
 *   SMTP_HOST  z. B. smtp.strato.de / smtp.ionos.de / …
 *   SMTP_PORT  587 (STARTTLS) oder 465 (TLS)
 *   SMTP_USER  Postfach-Login, i. d. R. info@saxofaxo.com
 *   SMTP_PASS  Postfach-Passwort
 *   MAIL_FROM  optional, Standard: "Saxofaxo · Felix Tönnies <info@saxofaxo.com>"
 *
 * Fehlen die Variablen, passiert schlicht nichts – die Einsendung selbst
 * ist davon nie betroffen (sie ist zu diesem Zeitpunkt längst gespeichert).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function templates(lang, name, summary) {
  const anrede = name ? (lang === "en" ? `Hello ${name},` : `Hallo ${name},`) : (lang === "en" ? "Hello," : "Hallo,");
  if (lang === "en") {
    return {
      subject: "Your enquiry has been received | Saxofaxo",
      text: `${anrede}

thank you for your enquiry – it has arrived safely.
${summary ? `\nYour request: ${summary}\n` : ""}
You will usually receive a personal offer within 24 hours. If anything is urgent, you can reach me directly:

info@saxofaxo.com · +49 173 9265526

Best regards
Felix Tönnies · Saxofaxo
https://saxofaxo.com`,
    };
  }
  return {
    subject: "Ihre Anfrage ist eingegangen | Saxofaxo",
    text: `${anrede}

vielen Dank für Ihre Anfrage – sie ist sicher bei mir angekommen.
${summary ? `\nIhre Anfrage: ${summary}\n` : ""}
In der Regel erhalten Sie innerhalb von 24 Stunden ein persönliches Angebot. Wenn es eilig ist, erreichen Sie mich auch direkt:

info@saxofaxo.com · +49 173 9265526

Herzliche Grüße
Felix Tönnies · Saxofaxo
https://saxofaxo.com`,
  };
}

export const handler = async (event) => {
  try {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.log("submission-created: SMTP nicht konfiguriert – keine Bestätigungsmail versendet.");
      return { statusCode: 200, body: "ok" };
    }

    const payload = JSON.parse(event.body || "{}").payload || {};
    if (payload.form_name && payload.form_name !== "event-anfrage") {
      return { statusCode: 200, body: "ok" };
    }
    const data = payload.data || {};
    const to = (data.email || "").trim();
    if (!EMAIL_RE.test(to)) {
      console.log("submission-created: keine gültige E-Mail-Adresse im Formular.");
      return { statusCode: 200, body: "ok" };
    }

    const lang = data.sprache === "en" ? "en" : "de";
    const name = (data.name || "").trim().slice(0, 80);
    const summary = (data.zusammenfassung || "").trim().slice(0, 300);
    const mail = templates(lang, name, summary);

    const port = Number(SMTP_PORT || 587);
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM || "Saxofaxo · Felix Tönnies <info@saxofaxo.com>",
      to,
      replyTo: "info@saxofaxo.com",
      subject: mail.subject,
      text: mail.text,
    });
    console.log("submission-created: Bestätigungsmail versendet an", to.replace(/(.).+(@.+)/, "$1***$2"));
  } catch (err) {
    // Niemals die Einsendung gefährden – nur protokollieren.
    console.error("submission-created:", err && err.message ? err.message : err);
  }
  return { statusCode: 200, body: "ok" };
};
