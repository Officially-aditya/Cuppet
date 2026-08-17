# Cuppet web

The browser client for Cuppet. It is a Next.js 16 application that keeps API,
auth, upload, OAuth, and realtime calls same-origin through the `/api` proxy.

## Local development

1. Start `sydney-backend` on `http://localhost:3000`.
2. Add these values to the backend environment:

   ```env
   WEB_APP_URL=http://localhost:5173
   WEB_AUTH_BASE_PATH=/api/auth
   TRUSTED_ORIGINS=http://localhost:3000,http://localhost:5173
   ```

3. In this directory, copy `.env.example` to `.env.local` and run:

   ```sh
   npm install
   npm run dev
   ```

The web app opens on `http://localhost:5173`. Add `?demo=1` to explore the
complete interface without a backend session.

## Production

Set `BACKEND_URL` to the public backend origin. On the backend, set
`WEB_APP_URL` to the deployed web origin and include that origin in
`TRUSTED_ORIGINS`. Google, GitHub, Slack, and Notion provider callback URLs stay
pointed at the backend; it safely returns browser OAuth flows to
`/oauth/callback` on the web origin.

Firebase web credentials are optional. When the `NEXT_PUBLIC_FIREBASE_*`
variables in `.env.example` are configured, users can register browser push
notifications from Settings.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run build:sites
npm run stage:sites
```
