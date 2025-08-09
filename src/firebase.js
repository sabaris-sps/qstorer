// Replace with your Firebase config
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAYH1kOuKmzcwcr7nnM_FlR64NgI4D8NQ0",
  authDomain: "qstorer-efd72.firebaseapp.com",
  projectId: "qstorer-efd72",
  storageBucket: "qstorer-efd72.firebasestorage.app",
  messagingSenderId: "775037678598",
  appId: "1:775037678598:web:1aae3ac23b6592edcf7f87",
  measurementId: "G-WSD1PK04HB",
};
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
