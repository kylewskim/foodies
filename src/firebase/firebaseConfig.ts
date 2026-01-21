import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
// TODO: Replace with your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCbi--OGrmvk34vLR21Coco5DJZDv6W_fQ",
  authDomain: "foodies-d91fa.firebaseapp.com",
  projectId: "foodies-d91fa",
  storageBucket: "foodies-d91fa.firebasestorage.app",
  messagingSenderId: "397694091110",
  appId: "1:397694091110:web:f0e08879049171cddb92a7",
  measurementId: "G-P2420KE28R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);
