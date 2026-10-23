// Comunión · Autenticación con Firebase (correo, Google y Apple) + perfil en Firestore.
// Expone window.Auth para login.html, registro.html y assets/guard.js.
// Guárdalo como assets/auth.js

// ─── 1) PEGA AQUÍ LA CONFIGURACIÓN DE TU APP WEB DE FIREBASE ───────────────────────────
// Firebase Console → Configuración del proyecto (⚙) → Tus apps → Configuración del SDK.
// Estos valores son públicos por diseño: la seguridad la dan las reglas y los dominios autorizados.
const firebaseConfig = {
  apiKey: 'TU_API_KEY',
  authDomain: 'TU_PROYECTO.firebaseapp.com',
  projectId: 'TU_PROYECTO',
  appId: 'TU_APP_ID'
};
// ────────────────────────────────────────────────────────────────────────────────────────

const V = 'https://www.gstatic.com/firebasejs/10.14.1/';
const COLLECTION = 'usuarios';
const TIPOS = ['laico', 'sacerdote', 'religioso'];
const configured = !!firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('TU_');

// Estado público. "user" solo se asigna cuando el perfil ya se cargó.
const Auth = { configured, ready: false, user: null, profile: null };
window.Auth = Auth;
const ping = () => window.dispatchEvent(new CustomEvent('authchange'));

const MSG = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Inicia sesión.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/too-many-requests': 'Demasiados intentos. Inténtalo de nuevo más tarde.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu internet e inténtalo de nuevo.',
  'auth/popup-closed-by-user': 'Cerraste la ventana antes de terminar.',
  'auth/cancelled-popup-request': 'Cerraste la ventana antes de terminar.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).',
  'auth/operation-not-allowed': 'Este método de acceso no está activado en Firebase.',
  'auth/account-exists-with-different-credential': 'Ese correo ya está registrado con otro método de acceso.',
  'permission-denied': 'Firebase rechazó el guardado. Revisa las reglas de Firestore.'
};
const fail = e => ({ error: MSG[e?.code] || 'No pudimos completar la acción. Inténtalo de nuevo.' });
const NOCFG = { error: 'Firebase todavía no está configurado en assets/auth.js.' };

let F = null;       // SDK de Firebase ya cargado
let hold = false;   // pausa la sincronización mientras se crea una cuenta

async function sync(u) {
  if (hold) return;
  let profile = null;
  if (u) {
    try {
      const s = await F.getDoc(F.doc(F.db, COLLECTION, u.uid));
      profile = s.exists() ? s.data() : null;
    } catch (e) { console.warn('Comunión: no se pudo leer el perfil', e); }
  }
  Auth.profile = profile;
  Auth.user = u ? { uid: u.uid, email: u.email || '', nombre: u.displayName || '', photo: u.photoURL || '', emailVerified: u.emailVerified } : null;
  Auth.ready = true;
  ping();
}

async function init() {
  if (!configured) { Auth.ready = true; return ping(); }
  try {
    const [app, au, fs] = await Promise.all([import(V + 'firebase-app.js'), import(V + 'firebase-auth.js'), import(V + 'firebase-firestore.js')]);
    const a = app.initializeApp(firebaseConfig);
    F = { ...au, ...fs, auth: au.getAuth(a), db: fs.getFirestore(a) };
    F.onAuthStateChanged(F.auth, sync);
  } catch (e) {
    console.error('Comunión: no se pudo cargar Firebase', e);
    Auth.ready = true; ping();
  }
}

Object.assign(Auth, {
  async login(email, password) {
    if (!F) return NOCFG;
    try { await F.signInWithEmailAndPassword(F.auth, email, password); return { ok: true }; } catch (e) { return fail(e); }
  },

  async register(nombre, email, password) {
    if (!F) return NOCFG;
    hold = true;
    try {
      const c = await F.createUserWithEmailAndPassword(F.auth, email, password);
      await F.updateProfile(c.user, { displayName: nombre });
      F.sendEmailVerification(c.user).catch(() => {});
      return { ok: true };
    } catch (e) { return fail(e); }
    finally { hold = false; await sync(F.auth.currentUser); }
  },

  async social(kind) {
    if (!F) return NOCFG;
    const p = kind === 'apple' ? new F.OAuthProvider('apple.com') : new F.GoogleAuthProvider();
    if (kind === 'apple') { p.addScope('email'); p.addScope('name'); }
    try { await F.signInWithPopup(F.auth, p); return { ok: true }; }
    catch (e) {
      if (e.code === 'auth/popup-blocked') { await F.signInWithRedirect(F.auth, p); return { ok: true }; }
      return fail(e);
    }
  },

  async reset(email) {
    if (!F) return NOCFG;
    try { await F.sendPasswordResetEmail(F.auth, email); } catch (e) { if (e.code !== 'auth/user-not-found') return fail(e); }
    return { ok: true }; // misma respuesta exista o no el correo
  },

  async saveProfile({ tipo, nacimiento }) {
    if (!F) return NOCFG;
    const u = F.auth.currentUser;
    if (!u) return { error: 'Inicia sesión para guardar tu perfil.' };
    if (!TIPOS.includes(tipo) || !/^\d{4}-\d{2}-\d{2}$/.test(nacimiento || '')) return { error: 'Los datos del perfil no son válidos.' };
    try {
      await F.setDoc(F.doc(F.db, COLLECTION, u.uid), { nombre: u.displayName || '', email: u.email || '', tipo, nacimiento, creado: F.serverTimestamp() }, { merge: true });
      Auth.profile = { nombre: u.displayName || '', email: u.email || '', tipo, nacimiento };
      ping();
      return { ok: true };
    } catch (e) { return fail(e); }
  },

  async logout() { if (F) await F.signOut(F.auth); }
});

init();
