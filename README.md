## SVR Booking (Web + Mobile)

Monorepo:

- `apps/web`: Next.js web app (admin + printable forms + API)
- `apps/mobile`: Expo React Native app (Android/iOS)
- `packages/shared`: shared types + validation

### Requirements

- Node `20.x` (see `.nvmrc`)
- PostgreSQL (recommended) or Docker

### Setup (after Node 20 is installed)

From repo root:

```bash
npm install
```

If you want a local Postgres via Docker:

```bash
docker compose up -d
```

Create `apps/web/.env` (Prisma loads `.env` for `db:push`):

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public"
NEXTAUTH_SECRET="change-me"
NEXTAUTH_URL="http://localhost:3000"
```

Optional: you can also create `apps/web/.env.local` for Next.js, but make sure `DATABASE_URL` exists in the environment when running Prisma commands.

Run Prisma:

```bash
npm -w apps/web run db:push
```

Run web:

```bash
npm run dev:web
```

Run mobile (Expo):

```bash
npm run dev:mobile
```

### Releases (Expo EAS)

Mobile app is intended for EAS Build + store submission. Configure `apps/mobile/app.json` / `eas.json` and run:

```bash
cd apps/mobile
eas build -p android
eas build -p ios
```

