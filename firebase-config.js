import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
const firebaseConfig={apiKey:"AIzaSyBY2VslIG_hNSxm2_ImUwvHGK8W7B704Q8",authDomain:"challengercup-63049.firebaseapp.com",projectId:"challengercup-63049",storageBucket:"challengercup-63049.firebasestorage.app",messagingSenderId:"703139081412",appId:"1:703139081412:web:7ecc96136ea37cc91e2d91",measurementId:"G-YE8JWZRMXC"};
export const app=initializeApp(firebaseConfig);export const auth=getAuth(app);export const db=getFirestore(app);export const ADMIN="cnsh32_1218@g.cnees.kr";

