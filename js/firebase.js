// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDCnK36b-6u16j9YTXYvzpj_uR2_E6gOPM",
  authDomain: "wh-management-11c29.firebaseapp.com",
  projectId: "wh-management-11c29",
  storageBucket: "wh-management-11c29.firebasestorage.app",
  messagingSenderId: "163490490102",
  appId: "1:163490490102:web:650931c42fd54f699c2ed7",
};

// Initialize Firebase (مرة واحدة فقط)
const app = initializeApp(firebaseConfig);

// Exports
export const auth = getAuth(app);
export const db = getFirestore(app);
