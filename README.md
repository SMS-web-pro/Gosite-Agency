# GoSite Digital

Application d'agence web automatisée avec Next.js, Drizzle et PostgreSQL embarqué via PGlite.

## Démarrage local

```bash
npm install
npm run dev
```

La base PostgreSQL est créée et initialisée automatiquement dans `.local-data/postgres`. Aucune installation de PostgreSQL, aucun compte cloud et aucune variable `DATABASE_URL` ne sont nécessaires. Les données restent sur cette machine entre les redémarrages.

Pour stocker la base ailleurs, définissez `PGLITE_DATA_DIR` avant de lancer l'application. Sauvegardez ce dossier pour conserver les données ; ne le supprimez pas pour réinitialiser la base sans avoir d'abord sauvegardé ce qui doit être conservé.

Les services externes (LLM, Telegram, Vercel, Brevo, Whop et Serper) restent facultatifs pour démarrer l'interface et se configurent depuis l'application. Un déploiement serverless ne fournit pas de stockage local durable : une base PostgreSQL hébergée avec stockage persistant est requise pour la production sur Vercel.
