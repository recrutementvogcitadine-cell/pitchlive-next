# PITCH LIVE NEXT

Application de live streaming web/mobile inspiree de TikTok:
- video verticale immersive,
- live creator via Agora,
- chat temps reel,
- likes double tap et coeurs animes,
- cadeaux gratuits,
- dashboard admin temps reel.

## Stack

- Next.js (App Router)
- TailwindCSS
- Supabase (DB, auth, realtime)
- Agora SDK (RTC)
- Vercel (deployment)

## Architecture

Le projet suit la structure demandee:
- `src/components`
- `src/pages`
- `src/hooks`
- `src/lib`
- `src/styles`

Routes principales:
- `/watch` experience live verticale pour spectateurs
- `/creator/studio` pilotage camera/micro et demarrage live
- `/dashboard` stats admin en temps reel

APIs:
- `POST /api/agora/token`
- `POST /api/live/start`
- `POST /api/live/end`

## Setup local

1. Copier `.env.example` vers `.env.local`
2. Renseigner les cles Supabase + Agora
3. Executer le schema SQL `supabase/schema.sql` dans Supabase SQL Editor
4. Lancer le projet

```bash
npm install
npm run dev
```

## Variables d'environnement

Voir `.env.example`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_AGORA_APP_ID`
- `AGORA_APP_CERTIFICATE`
- `NEXT_PUBLIC_APP_URL`

## Tables Supabase incluses

- `users`
- `live_sessions`
- `messages`
- `likes`
- `gifts`
- `followers`

Table additionnelle:
- `live_presence` (compteur spectateurs connectes)

## Deployment Vercel

1. Push du dossier `pitchlive-next` vers un nouveau repo Git
2. Import repo dans Vercel
3. Configurer les variables d'environnement
4. Deploy production

## Notes production

- Les policies SQL sont ouvertes pour MVP. Renforcer RLS avant gros trafic.
- Ajouter notifications push web/mobile (FCM/APNS) pour notification live hors app.
