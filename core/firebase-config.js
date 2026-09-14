// core/firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// ¡NUEVO!: Agregamos query y where a esta línea
import { getFirestore, doc, setDoc, addDoc, collection, getDocs, getDoc, query, where, updateDoc,deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyAxMzwierEJGqoB6tqOaomzwZGA3-aCZug",
    authDomain: "sistema-tecno-feria.firebaseapp.com",
    projectId: "sistema-tecno-feria",
    storageBucket: "sistema-tecno-feria.firebasestorage.app",
    messagingSenderId: "625696021827",
    appId: "1:625696021827:web:0405c5513085e572cfa3f6"
  };

const app = initializeApp(firebaseConfig);

window.auth = getAuth(app);
window.db = getFirestore(app);
window.storage = getStorage(app); 

window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.doc = doc;
window.setDoc = setDoc;
window.addDoc = addDoc; 
window.collection = collection;
window.getDocs = getDocs;
window.getDoc = getDoc;
window.ref = ref; 
window.uploadBytes = uploadBytes; 
window.getDownloadURL = getDownloadURL; 
window.query = query;
window.where = where;
window.updateDoc = updateDoc;
window.deleteDoc = deleteDoc;

console.log(" Firebase Configurado con herramientas de búsqueda (Query)");