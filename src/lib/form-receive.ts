// form-receive.ts — réception des demandes envoyées depuis les sites clients
// (v6, POST /api/site-form/{prospectId}). validateFormSubmission est PUR
// (copié tel quel dans tests/_lib) ; insertSiteLead fait des imports DB
// dynamiques comme le reste des modules de réception.

export type FormValues = {
  name: string;
  phone: string;
  email: string | null;
  zip: string;
  service: string;
  message: string;
};

const PHONE_RE = /^[\d+()\-\s.]{7,25}$/;

const s = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function validateFormSubmission(
  body: unknown,
  allowedServices?: string[]
): { ok: boolean; errors: string[]; values?: FormValues } {
  const errors: string[] = [];
  if (!body || typeof body !== "object") return { ok: false, errors: ["Invalid request body"] };
  const b = body as Record<string, unknown>;

  const name = s(b.name, 80);
  if (name.length < 2) errors.push("Please enter your name.");

  const phone = s(b.phone, 25);
  if (!PHONE_RE.test(phone) || (phone.match(/\d/g) || []).length < 7) errors.push("Please enter a valid phone number.");

  const emailRaw = s(b.email, 120);
  let email: string | null = null;
  if (emailRaw) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailRaw)) errors.push("Please enter a valid email address.");
    else email = emailRaw;
  }

  const zip = s(b.zip, 12);
  if (zip.length < 3) errors.push("Please enter your ZIP code.");

  const service = s(b.service, 80);
  if (!service) errors.push("Please choose a service.");
  else if (allowedServices && allowedServices.length && !allowedServices.some((t) => t.toLowerCase() === service.toLowerCase()))
    errors.push("Please choose a service from the list.");

  const message = s(b.message, 2000);
  if (message.length < 10) errors.push("Please describe what you need (at least 10 characters).");

  if (b.consent !== true) errors.push("Please agree to be contacted.");

  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], values: { name, phone, email, zip, service, message } };
}

/** Insert en base (site_leads) — imports dynamiques, jamais bloquant. */
export async function insertSiteLead(
  prospectId: number,
  values: FormValues,
  ip: string
): Promise<void> {
  const [{ db }, { siteLeads }] = await Promise.all([import("@/db"), import("@/db/schema")]);
  await db.insert(siteLeads).values({ prospectId, payload: values as unknown as Record<string, string>, ip });
}
