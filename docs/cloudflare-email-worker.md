# Installation — Worker Cloudflare de réception email

Le système lit les réponses clients reçues sur **contact@gosite.digital** grâce
à un Worker Cloudflare. Le Worker fait deux choses, dans cet ordre :

1. il **transfère l'email à `siteup.services@gmail.com`** (tu continues à tout
   lire dans Gmail, comme aujourd'hui) ;
2. il **envoie l'email parsé à notre webhook** — c'est ce qui déclenche la
   réponse automatique de Saler / Paymer / Support.

Durée : ~5 minutes. Aucun identifiant Google, aucune clé API à créer.

---

## 1. Récupérer le secret du webhook

Dans l'app : **Réglages & API → Réception — Cloudflare Email → Secret webhook**
(clic sur l'œil pour l'afficher).

## 2. Coller le code du Worker

1. Dashboard Cloudflare → **Email & Domaines → Email Routing → Email Workers**.
2. **Create** → *Hello World* → nomme-le `gsd-inbound` → Deploy.
3. **Edit code** : remplace tout par :

```js
// Aucun import : l editeur Cloudflare ne resolve pas les modules distants.
// Le Worker envoie le MIME brut ; le parsing se fait cote app.
const WEBHOOK_URL = "https://gosite.digital/api/webhooks/email?secret=COLLE_ICI_LE_SECRET";
const GMAIL_BOX = "siteup.services@gmail.com";

const toB64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
};

export default {
  async email(message, env, ctx) {
    // 1) TOUJOURS forwarder d abord : la boite Gmail ne depend jamais du webhook.
    try {
      await message.forward(GMAIL_BOX);
    } catch (e) {
      console.error("forward gmail echoue", e);
    }

    // 2) MIME brut -> webhook (le serveur parse : adresses, texte, fil).
    try {
      const buf = new Uint8Array(await new Response(message.raw).arrayBuffer());
      const h = (n) => message.headers.get(n) || undefined;
      ctx.waitUntil(
        fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawB64: toB64(buf.subarray(0, 3000000)),
            messageId: h("message-id"),
            fromEmail: message.from || "",
            subject: h("subject"),
            headers: {
              autoSubmitted: h("auto-submitted"),
              precedence: h("precedence"),
              autoReplySuppressed: h("x-auto-response-suppress"),
              autorespond: h("x-autorespond"),
              listId: h("list-id"),
              contentType: h("content-type"),
              xFailedRecipients: h("x-failed-recipients"),
            },
          }),
        }).catch((e) => console.error("webhook fetch", e)),
      );
    } catch (e) {
      console.error("lecture MIME echouee", e);
    }
  },
};
```

4. Remplace `COLLE_ICI_LE_SECRET` par le secret de l'étape 1. **Deploy**.

## 3. Router l'adresse vers le Worker

1. **Email Routing → Routes** (ou Email Workers → Routing rules).
2. La règle existante `contact@gosite.digital → siteup.services@gmail.com`
   devient : action **Send to a Worker → `gsd-inbound`**.
   (Le forward Gmail est fait par le Worker lui-même — ne garde pas deux
   règles pour la même adresse, sinon double traitement.)
3. Enregistre. Teste : envoie un email à contact@gosite.digital — il doit
   arriver dans Gmail comme avant.

## 4. Vérifier la détection côté app

- Dans **Réglages & API**, remplis **Email de réception**
  (`contact@gosite.digital`).
- Les entrants apparaissent dans la table `inbound_emails` :
  - clients déjà contactés → traités par les agents (statut `replied`) ;
  - inconnus / spam → `unmatched` ou `ignored`, jamais de réponse ;
  - notifications Telegram à chaque entrant de client connu.

## 5. Activer les réponses automatiques

Par sécurité, **Réponses automatiques = `off`** à l'installation : pendant la
première semaine tu reçois les notifications Telegram et tu réponds depuis
Gmail. Quand tu es confiant : **Réglages → Réponses automatiques → `on`**.

---

## Ops — délivrabilité (important)

Les réponses automatiques partent de **`BREVO_SENDER_EMAIL`** (Réglages →
Brevo). Mets-le à `contact@gosite.digital` et valide ce sender dans Brevo :
le domaine doit avoir les enregistrements **SPF/DKIM Brevo** (+ DMARC) —
sinon tes emails atterrissent en spam et la conversation meurt. Les
enregistrements à copier sont affichés dans Brevo (Senders & Domains),
à coller dans Cloudflare DNS.

## Dépannage rapide

| Symptôme | Cause probable |
|---|---|
| Email dans Gmail mais rien dans `inbound_emails` | Secret faux dans `WEBHOOK_URL`, ou route non passée en « Send to Worker » |
| Entrant en `unmatched` | Adresse From ≠ email du prospect ET aucun fil existant |
| Entrant en `human` | Rate-limit atteint, question insolite, ou LLM indisponible 3 fois |
| Deux réponses envoyées | Retry Cloudflare sur la même seconde — le dédoublonnage par Message-Id est là pour ça ; vérifie l'index unique |
| Bounce reçu | Adresse client morte → nettoie le lead (aucune réponse auto n'est envoyée) |
