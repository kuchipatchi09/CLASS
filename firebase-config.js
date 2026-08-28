import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBY2VslIG_hNSxm2_ImUwvHGK8W7B704Q8",
  authDomain: "challengercup-63049.firebaseapp.com",
  projectId: "challengercup-63049",
  storageBucket: "challengercup-63049.firebasestorage.app",
  messagingSenderId: "703139081412",
  appId: "1:703139081412:web:7ecc96136ea37cc91e2d91",
  measurementId: "G-YE8JWZRMXC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  hd: "g.cnees.kr",
  prompt: "select_account"
});

export {
  app,
  auth,
  db,
  provider
};
