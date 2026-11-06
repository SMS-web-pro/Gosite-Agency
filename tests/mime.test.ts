import { parseRawEmail } from "./_lib/mime.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

const RAW = [
  "From: Jean Dupont <jean@example.com>",
  "To: contact@gosite.digital",
  "Subject: Question prix",
  "Message-ID: <abc@client.example>",
  "In-Reply-To: <ourid@brevo>",
  "Content-Type: multipart/alternative; boundary=\"XYZ\"",
  "",
  "--XYZ",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Bonjour, le prix stp",
  "",
  "--XYZ",
  "Content-Type: text/html; charset=utf-8",
  "",
  "<p>Bonjour, le prix stp</p>",
  "--XYZ--",
  "",
].join("\r\n");
const B64 = Buffer.from(RAW, "utf8").toString("base64");

const FALLBACK = {
  messageId: "<fallback@x>",
  fromEmail: "fb@example.com",
  fromName: "FB",
  subject: "objet fallback",
  text: "",
  html: "",
  headers: {} as Record<string, string | undefined>,
};

const m = await parseRawEmail(B64, FALLBACK);
check("mime: messageId", (m.messageId || "").includes("abc@client.example"));
check("mime: fromEmail", m.fromEmail === "jean@example.com");
check("mime: fromName", m.fromName === "Jean Dupont");
check("mime: subject", m.subject === "Question prix");
check("mime: texte", m.text.includes("le prix stp"));
check("mime: html", m.html.includes("<p>"));
check("mime: inReplyTo", (m.headers.inReplyTo || "").includes("ourid@brevo"));
check("mime: contentType multipart", (m.headers.contentType || "").includes("multipart"));

const empty = await parseRawEmail(undefined, FALLBACK);
check("mime: pas de raw -> fallback", empty.fromEmail === "fb@example.com" && empty.messageId === "<fallback@x>");

const broken = await parseRawEmail(Buffer.from("ceci n est pas un email valide \x00\x01", "utf8").toString("base64"), FALLBACK);
check("mime: raw corrompu -> fallback", broken.fromEmail === "fb@example.com");

const partial = await parseRawEmail(B64, { ...FALLBACK, messageId: "<kept@x>" });
check("mime: fallback quand champ absent du raw", (partial.messageId || "").includes("abc@client.example"));

process.exit(fail ? 1 : 0);
