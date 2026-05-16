"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, type Auth } from "firebase/auth";

function firebaseWebConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error(
      "Missing NEXT_PUBLIC_FIREBASE_* env vars. Add apiKey, authDomain, projectId, and appId from Firebase Console → Project settings.",
    );
  }
  return { apiKey, authDomain, projectId, appId };
}

export function getClientFirebase(): { app: FirebaseApp; auth: Auth } {
  const cfg = firebaseWebConfig();
  const app = getApps().length ? getApps()[0]! : initializeApp(cfg);
  return { app, auth: getAuth(app) };
}

export async function signInWithGooglePopup(): Promise<string> {
  const { auth } = getClientFirebase();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(auth, provider);
  return cred.user.getIdToken();
}

export async function signOutFirebaseClient(): Promise<void> {
  try {
    const { auth } = getClientFirebase();
    await signOut(auth);
  } catch {
    /* ignore — e.g. config missing or already signed out */
  }
}
