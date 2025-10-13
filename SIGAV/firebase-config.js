// Configuração do Firebase (use esta configuração para o SDK modular)
const firebaseConfig = {
  apiKey: "AIzaSyAO1pwMojeJNeTk-UsTeKgoSkX4nvD_S00",
  authDomain: "hub-de-conhecimento.firebaseapp.com",
  databaseURL: "https://hub-de-conhecimento-default-rtdb.firebaseio.com/",
  projectId: "hub-de-conhecimento",
  storageBucket: "hub-de-conhecimento.firebasestorage.app",
  messagingSenderId: "321994679921",
  appId: "1:321994679921:web:86f79366129aca2fcb5dd0",
  measurementId: "G-J4SDEJX8S8"
};

// Expor como string JSON para que páginas em modo modular (imports dinamicos) possam
// detectar a configuração via `typeof __firebase_config !== 'undefined'` e usar
// `JSON.parse(__firebase_config)` para inicializar o Firebase modularmente.
// Isso evita dependência no namespace global `firebase` (SDK compat v8) que não está
// necessariamente carregado nesta página.
window.__firebase_config = JSON.stringify(firebaseConfig);

// Compatibilidade com páginas antigas que carregam o SDK v8 (global `firebase`):
// - Se `firebase` estiver disponível, inicializamos (se ainda não iniciado) e expomos
//   `auth`, `db` (Realtime Database) e `firestore` como variáveis globais para que
//   o código existente continue funcionando.
// - Se `firebase` não existir, não tentamos inicializar nada: páginas que usam o
//   SDK modular devem ler `window.__firebase_config` e inicializar via imports.
if (typeof window.firebase !== 'undefined' && window.firebase) {
  try {
    if (!window.firebase.apps || window.firebase.apps.length === 0) {
      window.firebase.initializeApp(firebaseConfig);
    }

    // Expor compatibilidade para os scripts que esperam estas variáveis globais
    try { window.auth = window.firebase.auth ? window.firebase.auth() : null; } catch (e) { window.auth = null; }
    try { window.db = window.firebase.database ? window.firebase.database() : null; } catch (e) { window.db = null; }
    try { window.firestore = window.firebase.firestore ? window.firebase.firestore() : null; } catch (e) { window.firestore = null; }
  } catch (err) {
    // Não interromper execução se algo falhar aqui — manter __firebase_config disponível
    console.error('firebase-config: erro ao inicializar firebase v8 global:', err);
  }
}

