// ===================================================================
// Firebase sync layer (auth + firestore), loaded as an ES module.
// Exposes window.MedPrepSync for app.js (a classic script) to use.
// ===================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCnQ0CQsNtK9Cxz8hGsGxD3HgihQcr2TOo",
  authDomain: "med-prep-shana-alef.firebaseapp.com",
  projectId: "med-prep-shana-alef",
  storageBucket: "med-prep-shana-alef.firebasestorage.app",
  messagingSenderId: "480322947107",
  appId: "1:480322947107:web:bf2ce9e3e6766c01f28996",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

window.MedPrepSync = {
  signIn(){
    return signInWithPopup(auth, provider).catch(err => {
      console.error("Google sign-in failed", err);
      alert("שגיאה בהתחברות עם Google: " + err.message);
    });
  },
  signOutUser(){
    return signOut(auth);
  },
  onAuthChange(cb){
    return onAuthStateChanged(auth, cb);
  },
  async loadRemote(uid){
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  },
  async saveRemote(uid, stateObj, updatedAt){
    await setDoc(doc(db, "users", uid), { state: stateObj, updatedAt });
  },
};

window.dispatchEvent(new Event("medprep-sync-ready"));
