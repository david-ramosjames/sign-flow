This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Staff sign-in (Firebase Auth + Google)

1. In [Firebase Console](https://console.firebase.google.com/) → **Authentication** → **Sign-in method**, enable **Google**.
2. **Authentication** → **Settings** → **Authorized domains**: add your production host and `localhost` for dev.
3. **Project settings** → **Your apps** → add a **Web** app and copy the config into `NEXT_PUBLIC_FIREBASE_*` in `.env` (see [`.env.example`](./.env.example)).
4. Use the **same** Firebase project’s **service account** for `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` (Admin SDK) so the server can verify ID tokens and use Firestore.

The app exchanges the Firebase **ID token** for a **Sign Flow session cookie** via `POST /api/auth/session`.

## Deploy on Vercel

Add environment variables from [`.env.example`](./.env.example) in **Vercel → Settings → Environment Variables** (do not commit real secrets).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
