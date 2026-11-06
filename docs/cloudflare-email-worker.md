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
import PostalMime from "https://esm.sh/postal-mime";

// Colle ici l'URL complète du webhook (avec le secret) :
const WEBHOOK_URL = "https://gosite.digital/api/webhooks/email?secret=COLLE_ICI_LE_SECRET";
const GMAIL_BOX = "siteup.services@gmail.com";

export default {
  async email(message, env, ctx) {
    // 1) TOUJOURS forwarder d'abord : la boîte Gmail ne dépend jamais du webhook.
    try {
      await message.forward(GMAIL_BOX);
    } catch (e) {
      console.error("forward gmail échoué", e);
    }

    // 2) Parse + POST au webhook (échecs silencieux : le webhook a son propre retry).
    try {
      const mime = await PostalMime.parse(message.raw);
      // postal-mime expose headers en TABLEAU de {key, value} (key deja en minuscules)
      const headers = {};
      for (const h of mime.headers ?? []) headers[h.key] = h.value;
      const body = {
        messageId: mime.messageId || `<${Date.now()}.${Math.random().toString(36).slice(2)}@inbound>`,
        fromEmail: mime.from?.address || message.from || "",
        fromName: mime.from?.name || "",
        subject: mime.subject || "",
        text: mime.text || "",
        html: mime.html || "",
        headers: {
          autoSubmitted: headers["auto-submitted"],
          precedence: headers["precedence"],
          autoReplySuppressed: headers["x-auto-response-suppress"],
          autorespond: headers["x-autorespond"],
          listId: headers["list-id"],
          contentType: headers["content-type"],
          xFailedRecipients: headers["x-failed-recipients"],
          inReplyTo: mime.inReplyTo || headers["in-reply-to"],
          references: mime.references || headers["references"],
        },
      };
      ctx.waitUntil(
        fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(async (r) => {
          if (!r.ok) console.error("webhook HTTP", r.status, await r.text().catch(() => ""));
        }).catch((e) => console.error("webhook fetch", e)),
      );
    } catch (e) {
      console.error("parse échoué", e);
    }
  },
};
```

4. Remplace `COLLE_ICI_LE_SECRET` par le secret de l'étape 1. **Deploy**.
   (L'import passe par **esm.sh** : l'éditeur Cloudflare ne bundle pas les
   modules npm, une URL absolue est la seule forme fiable.)

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
