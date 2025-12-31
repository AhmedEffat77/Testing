import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDCnK36b-6u16j9YTXYvzpJ_uR2_E6gOPM",
  authDomain: "wh-management-11c29.firebaseapp.com",
  projectId: "wh-management-11c29",
  storageBucket: "wh-management-11c29.firebasestorage.app",
  messagingSenderId: "163490490102",
  appId: "1:163490490102:web:c1353380a71f2fdc9c2ed7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ exports المطلوبة
export const auth = getAuth(app);
export const db = getFirestore(app);

