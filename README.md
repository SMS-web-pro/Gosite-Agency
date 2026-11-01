# GoSite Digital

Application d'agence web automatisée avec Next.js, Drizzle et PostgreSQL embarqué via PGlite.

## Démarrage local

```bash
npm install
npm run dev
```

Sans variable d'environnement, la base PostgreSQL est créée et initialisée automatiquement dans `.local-data/postgres`. Aucune installation de PostgreSQL, aucun compte cloud et aucune variable `DATABASE_URL` ne sont nécessaires. Les données restent sur cette machine entre les redémarrages.

Pour stocker la base ailleurs, définissez `PGLITE_DATA_DIR` avant de lancer l'application. Sauvegardez ce dossier pour conserver les données ; ne le supprimez pas pour réinitialiser la base sans avoir d'abord sauvegardé ce qui doit être conservé.

## Base PostgreSQL hébergée (optionnel)

Si `DATABASE_URL` est définie, l'application se connecte à cette base PostgreSQL (Neon, Supabase, Vercel Postgres…) au lieu de PGlite. Le SSL est activé automatiquement pour les hôtes distants et désactivé en local (`localhost`, `127.0.0.1`, ou `sslmode=disable` dans l'URL).

Un déploiement serverless (Vercel) ne fournit pas de stockage local durable : définissez `DATABASE_URL` vers une base hébergée avec stockage persistant pour la production. Sans elle, l'application s'appuie sur `.local-data/postgres`, dont le contenu disparaît à chaque cold start.

### Importer une base existante

Pour reprendre les données d'une base hébergée dans la base locale PGlite :

```bash
pg_dump "$DATABASE_URL" --no-owner --no-privileges -f dump.sql
node -e "const {PGlite}=require('@electric-sql/pglite');const fs=require('fs');(async()=>{const db=new PGlite('.local-data/postgres');await db.exec(fs.readFileSync('dump.sql','utf8'));await db.close();console.log('Import terminé');})().catch(e=>{console.error(e);process.exit(1);})"
```

Ou l'inverse (PGlite → base hébergée) avec `pg_dump`/`psql` via un export intermédiaire. Le schéma est appliqué automatiquement au démarrage par `src/db/bootstrap.ts`, qui fait foi pour les évolutions de schéma (`drizzle-kit push` n'est plus utilisé).

Les services externes (LLM, Telegram, Vercel, Brevo, Whop et Serper) restent facultatifs pour démarrer l'interface et se configurent depuis l'application.
