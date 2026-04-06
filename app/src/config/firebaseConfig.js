
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase, ref, push, set } from 'firebase/database';
const firebaseConfig = {
  apiKey: "AIzaSyDlMlFrpJTHNV7M8o7mV0CiV4wWs2pe4v4",
  authDomain: "barmanpedidos.firebaseapp.com",
  projectId: "barmanpedidos",
  storageBucket: "barmanpedidos.firebasestorage.app",
  messagingSenderId: "404526241133",
  appId: "1:404526241133:web:39461db9084c4f1b253664",
  measurementId: "G-HE1ZECMK73"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getDatabase(app);