import { getApps, initializeApp, cert, type App } from "firebase-admin/app";

/**
 * Single Firebase Admin app for Firestore, Auth token verification, etc.
 * Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.
 */
export function getFirebaseAdminApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0]!;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY for firebase-admin.");
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}
