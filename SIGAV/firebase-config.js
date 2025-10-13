const firebaseConfig = {
  apiKey: "AIzaSyAO1pwMojeJNeTk-UsTeKgoSkX4nvD_S00",
  authDomain: "hub-de-conhecimento.firebaseapp.com",
  databaseURL: "https://hub-de-conhecimento-default-rtdb.firebaseio.com/", // URL do Realtime Database
  projectId: "hub-de-conhecimento",
  storageBucket: "hub-de-conhecimento.firebasestorage.app",
  messagingSenderId: "321994679921",
  appId: "1:321994679921:web:86f79366129aca2fcb5dd0",
  measurementId: "G-J4SDEJX8S8"
};

// Inicializa o Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Declara as variáveis que serão usadas em outras páginas
const auth = firebase.auth();
const db = firebase.database();

