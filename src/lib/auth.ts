import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function isUserAllowed(email: string): Promise<boolean> {
  const docRef = doc(db, "config", "allowedUsers");
  const snap = await getDoc(docRef);
  if (!snap.exists()) return false;
  const data = snap.data();
  const list: string[] = data?.emails ?? [];
  return list.includes(email);
}
