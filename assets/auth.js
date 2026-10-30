// Comunión · Autenticación con Firebase (correo, Google y Apple) + perfil en Firestore.
// Expone window.Auth para login.html, registro.html y assets/guard.js.
// Guárdalo como assets/auth.js

// ─── 1) PEGA AQUÍ LA CONFIGURACIÓN DE TU APP WEB DE FIREBASE ───────────────────────────
// Firebase Console → Configuración del proyecto (⚙) → Tus apps → Configuración del SDK.
// Estos valores son públicos por diseño: la seguridad la dan las reglas y los dominios autorizados.
const firebaseConfig = {
  apiKey: "AIzaSyACqpAlSGOkDEB85_LTUpXS3PWe7VAWWAE",
  authDomain: "comunion-4fcf3.firebaseapp.com",
  projectId: "comunion-4fcf3",
  storageBucket: "comunion-4fcf3.firebasestorage.app",
  messagingSenderId: "715720379264",
  appId: "1:715720379264:web:bebd5adcc9284dd0e1cf65",
  measurementId: "G-CR8WS35Q8H"
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

const mapPub = x => { const v = x.data(); return { id: x.id, uid: v.uid, autor: v.autor || 'Usuario', tipo: v.tipo, texto: v.texto || '', img: v.img || '', ms: v.ms || 0, expira: v.expira || 0, likes: Array.isArray(v.likes) ? v.likes : [], nCom: v.nCom || 0, oran: Array.isArray(v.oran) ? v.oran : [], cat: v.cat || '', catTxt: v.catTxt || '', sub: v.sub || '', titulo: v.titulo || '' }; };
const myName = u => u.displayName || Auth.profile?.nombre || (u.email || '').split('@')[0] || 'Usuario';
const CATS = ['gratitud', 'familia', 'sanacion', 'vocacion', 'otros'];

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

  // ── Perfil: foto, publicaciones, historias e intenciones (se guardan en Firestore) ──
  async setPhoto(dataUrl) {
    if (!F) return NOCFG;
    const u = F.auth.currentUser;
    if (!u) return { error: 'Inicia sesión primero.' };
    if (typeof dataUrl !== 'string' || !/^data:image\/jpeg;base64,/.test(dataUrl) || dataUrl.length > 300000) return { error: 'La imagen no es válida o es demasiado grande.' };
    try {
      await F.setDoc(F.doc(F.db, 'publico', u.uid), { foto: dataUrl }, { merge: true });
      return { ok: true };
    } catch (e) { return fail(e); }
  },

  async publish({ tipo, texto, img, cat, catTxt, sub, titulo }) {
    if (!F) return NOCFG;
    const u = F.auth.currentUser;
    if (!u) return { error: 'Inicia sesión primero.' };
    if (!['post', 'intencion', 'historia'].includes(tipo)) return { error: 'Tipo de publicación no válido.' };
    texto = String(texto || '').trim().slice(0, 500);
    img = img || '';
    if (img && (!/^data:image\/jpeg;base64,/.test(img) || img.length > 700000)) return { error: 'La imagen no es válida o es demasiado grande.' };
    if (!texto && !img) return { error: 'Escribe algo o agrega una imagen.' };
    const d = { uid: u.uid, autor: myName(u), tipo, texto, img, ms: Date.now(), likes: [], nCom: 0, oran: [] };
    if (tipo === 'historia') d.expira = d.ms + 864e5;
    if (tipo === 'intencion') {
      if (!CATS.includes(cat)) return { error: 'Elige el tipo de intención.' };
      d.cat = cat;
      if (cat === 'otros') {
        catTxt = String(catTxt || '').trim().slice(0, 30);
        if (!catTxt) return { error: 'Escribe el tipo de intención.' };
        d.catTxt = catTxt;
      }
    }
    if (tipo === 'post' && sub === 'testimonio') { d.sub = 'testimonio'; d.titulo = String(titulo || '').trim().slice(0, 80); }
    try {
      const r = await F.addDoc(F.collection(F.db, 'publicaciones'), { ...d, creado: F.serverTimestamp() });
      return { ok: true, item: { id: r.id, ...d } };
    } catch (e) { return fail(e); }
  },

  async mine(uid) {
    if (!F) return NOCFG;
    const u = F.auth.currentUser;
    if (!u) return { items: [] };
    try {
      const s = await F.getDocs(F.query(F.collection(F.db, 'publicaciones'), F.where('uid', '==', uid || u.uid)));
      const items = s.docs.map(mapPub);
      items.sort((a, b) => b.ms - a.ms);
      return { items };
    } catch (e) { return { ...fail(e), items: [] }; }
  },

  async remove(id) {
    if (!F) return NOCFG;
    try { await F.deleteDoc(F.doc(F.db, 'publicaciones', id)); return { ok: true }; } catch (e) { return fail(e); }
  },

  // ── Comunidad: publicaciones e intenciones de todos, me gusta y comentarios ──
  async list(tipo) {
    if (!F) return NOCFG;
    try {
      const s = await F.getDocs(F.query(F.collection(F.db, 'publicaciones'), F.where('tipo', '==', tipo)));
      const items = s.docs.map(mapPub);
      items.sort((a, b) => b.ms - a.ms);
      return { items };
    } catch (e) { return { ...fail(e), items: [] }; }
  },

  async like(id, on) {
    if (!F) return NOCFG;
    const u = F.auth.currentUser;
    if (!u) return { error: 'Inicia sesión primero.' };
    try { await F.updateDoc(F.doc(F.db, 'publicaciones', id), { likes: on ? F.arrayUnion(u.uid) : F.arrayRemove(u.uid) }); return { ok: true }; }
    catch (e) { return fail(e); }
  },

  async comments(id) {
    if (!F) return NOCFG;
    try {
      const s = await F.getDocs(F.collection(F.db, 'publicaciones', id, 'comentarios'));
      const items = s.docs.map(x => { const v = x.data(); return { id: x.id, uid: v.uid, autor: v.autor || 'Usuario', texto: v.texto || '', ms: v.ms || 0 }; });
      items.sort((a, b) => a.ms - b.ms);
      return { items };
    } catch (e) { return { ...fail(e), items: [] }; }
  },

  async comment(id, texto) {
    if (!F) return NOCFG;
    const u = F.auth.currentUser;
    if (!u) return { error: 'Inicia sesión primero.' };
    texto = String(texto || '').trim().slice(0, 300);
    if (!texto) return { error: 'Escribe un comentario.' };
    const d = { uid: u.uid, autor: myName(u), texto, ms: Date.now() };
    try {
      const r = await F.addDoc(F.collection(F.db, 'publicaciones', id, 'comentarios'), d);
      F.updateDoc(F.doc(F.db, 'publicaciones', id), { nCom: F.increment(1) }).catch(() => {});
      return { ok: true, item: { id: r.id, ...d } };
    } catch (e) { return fail(e); }
  },

  async removeComment(id, cid) {
    if (!F) return NOCFG;
    try {
      await F.deleteDoc(F.doc(F.db, 'publicaciones', id, 'comentarios', cid));
      F.updateDoc(F.doc(F.db, 'publicaciones', id), { nCom: F.increment(-1) }).catch(() => {});
      return { ok: true };
    } catch (e) { return fail(e); }
  },

  // ── Perfiles ajenos, seguidores y notificaciones ──
  // Tarjeta pública: nombre y foto de cada persona (colección "publico", más lo que ya hubiera en "usuarios").
  async userInfo(uid) {
    if (!F) return {};
    const rd = async col => { try { const s = await F.getDoc(F.doc(F.db, col, uid)); return s.exists() ? s.data() : {}; } catch (e) { return {}; } };
    const [pu, us] = await Promise.all([rd('publico'), rd(COLLECTION)]);
    return { nombre: pu.nombre || us.nombre || '', foto: pu.foto || us.foto || '', fotoG: pu.fotoG || us.fotoG || '', tipo: pu.rol || us.tipo || 'laico', bio: pu.bio || '', username: pu.username || '' };
  },

  async follows(uid) {
    if (!F) return { seg: [], sig: [] };
    const rd = async sub => {
      try {
        const s = await F.getDocs(F.collection(F.db, COLLECTION, uid, sub));
        return s.docs.map(x => ({ uid: x.id, nombre: x.data().nombre || '', ms: x.data().ms || 0 }));
      } catch (e) { return []; }
    };
    const [seg, sig] = await Promise.all([rd('seguidores'), rd('siguiendo')]);
    return { seg, sig };
  },

  async follow(target, nombreTarget, on) {
    if (!F) return NOCFG;
    const u = F.auth.currentUser;
    if (!u) return { error: 'Inicia sesión primero.' };
    if (u.uid === target) return { error: 'No puedes seguirte a ti mismo.' };
    const yo = myName(u), ms = Date.now();
    try {
      const a = F.doc(F.db, COLLECTION, target, 'seguidores', u.uid), b = F.doc(F.db, COLLECTION, u.uid, 'siguiendo', target);
      if (on) {
        await F.setDoc(a, { nombre: yo, ms });
        await F.setDoc(b, { nombre: String(nombreTarget || 'Usuario').slice(0, 60), ms });
        Auth.notify(target, { tipo: 'follow' });
      } else { await F.deleteDoc(a); await F.deleteDoc(b); }
      return { ok: true };
    } catch (e) { return fail(e); }
  },

  async notify(to, { tipo, post }) {
    if (!F || !to) return;
    const u = F.auth.currentUser;
    if (!u || to === u.uid) return;
    try {
      await F.addDoc(F.collection(F.db, COLLECTION, to, 'notifs'), { tipo, de: u.uid, nombre: myName(u), post: post || '', ms: Date.now(), leido: false });
    } catch (e) { /* una notificación fallida no debe romper la acción */ }
  },

  watchNotifs(cb) {
    const u = F && F.auth.currentUser;
    if (!u) return () => {};
    return F.onSnapshot(F.collection(F.db, COLLECTION, u.uid, 'notifs'), s => {
      const items = s.docs.map(x => { const v = x.data(); return { id: x.id, tipo: v.tipo, de: v.de, nombre: v.nombre || 'Usuario', post: v.post || '', ms: v.ms || 0, leido: !!v.leido }; });
      items.sort((a, b) => b.ms - a.ms);
      cb(items.slice(0, 40));
    }, () => {});
  },

  async markRead(ids) {
    const u = F && F.auth.currentUser;
    if (!u) return;
    await Promise.all(ids.map(id => F.updateDoc(F.doc(F.db, COLLECTION, u.uid, 'notifs', id), { leido: true }).catch(() => {})));
  },

  watchWall(cb) {
    if (!F) return () => {};
    return F.onSnapshot(F.query(F.collection(F.db, 'publicaciones'), F.where('tipo', '==', 'intencion')), s => {
      const items = s.docs.map(mapPub);
      items.sort((a, b) => b.ms - a.ms);
      cb(items);
    }, () => {});
  },

  // Publica tu nombre, tu foto de Google y (si no tienes) un @usuario, para que otras personas te encuentren.
  async syncPublic() {
    const u = F && F.auth.currentUser;
    if (!u) return;
    const nombre = myName(u);
    try {
      const ref = F.doc(F.db, 'publico', u.uid);
      const cur = (await F.getDoc(ref)).data() || {};
      await F.setDoc(ref, { nombre, nombreLower: nombre.toLowerCase(), fotoG: u.photoURL || '', ms: Date.now() }, { merge: true });
      if (!cur.username) await Auth.autoUsername(nombre);
    } catch (e) { /* no es crítico */ }
  },

  // Reserva un @usuario único en la colección "usernames" (id = usuario, uid = dueño).
  async autoUsername(nombre) {
    const u = F && F.auth.currentUser;
    if (!u) return '';
    let base = String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
    if (base.length < 3) base = (base + 'user').slice(0, 14);
    for (let i = 0; i < 6; i++) {
      const cand = i ? base + Math.floor(100 + Math.random() * 9000) : base;
      try {
        if ((await F.getDoc(F.doc(F.db, 'usernames', cand))).exists()) continue;
        const b = F.writeBatch(F.db);
        b.set(F.doc(F.db, 'usernames', cand), { uid: u.uid, ms: Date.now() });
        b.set(F.doc(F.db, 'publico', u.uid), { username: cand }, { merge: true });
        await b.commit();
        return cand;
      } catch (e) { /* probamos con otro */ }
    }
    return '';
  },

  // Editar perfil: @usuario, biografía y rol.
  async saveMyProfile({ username, bio, tipo }) {
    if (!F) return NOCFG;
    const u = F.auth.currentUser;
    if (!u) return { error: 'Inicia sesión primero.' };
    if (!TIPOS.includes(tipo)) return { error: 'Elige un rol válido.' };
    username = String(username || '').trim().toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return { error: 'El @usuario debe tener de 3 a 20 caracteres: letras, números o guion bajo.' };
    bio = String(bio || '').trim().slice(0, 160);
    try {
      const ref = F.doc(F.db, 'publico', u.uid);
      const old = ((await F.getDoc(ref)).data() || {}).username || '';
      if (username !== old) {
        const t = await F.getDoc(F.doc(F.db, 'usernames', username));
        if (t.exists() && t.data().uid !== u.uid) return { error: 'Ese @usuario ya está en uso. Prueba con otro.' };
      }
      const b = F.writeBatch(F.db);
      if (username !== old) {
        b.set(F.doc(F.db, 'usernames', username), { uid: u.uid, ms: Date.now() });
        if (old) b.delete(F.doc(F.db, 'usernames', old));
      }
      const nombre = myName(u);
      b.set(ref, { username, bio, rol: tipo, nombre, nombreLower: nombre.toLowerCase() }, { merge: true });
      await b.commit();
      if (Auth.profile && Auth.profile.tipo !== tipo) {
        await F.setDoc(F.doc(F.db, COLLECTION, u.uid), { tipo }, { merge: true });
        Auth.profile = { ...Auth.profile, tipo };
      }
      return { ok: true, username, bio, tipo };
    } catch (e) { return fail(e); }
  },

  // Buscar perfiles por @usuario (prefijo) o por nombre (prefijo).
  async searchUsers(q) {
    if (!F) return [];
    const raw = String(q || '').trim().toLowerCase();
    const soloUser = raw.startsWith('@');
    const h = raw.replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
    const uids = new Set(), jobs = [];
    if (h.length >= 2) jobs.push(F.getDocs(F.query(F.collection(F.db, 'usernames'), F.where(F.documentId(), '>=', h), F.where(F.documentId(), '<=', h + '\uf8ff'), F.limit(10)))
      .then(s => s.docs.forEach(d => d.data().uid && uids.add(d.data().uid))).catch(() => {}));
    if (!soloUser && raw.length >= 2) jobs.push(F.getDocs(F.query(F.collection(F.db, 'publico'), F.where('nombreLower', '>=', raw), F.where('nombreLower', '<=', raw + '\uf8ff'), F.limit(10)))
      .then(s => s.docs.forEach(d => uids.add(d.id))).catch(() => {}));
    await Promise.all(jobs);
    return Promise.all([...uids].slice(0, 15).map(async uid => ({ uid, ...(await Auth.userInfo(uid)) })));
  },

  // Unirse en oración a una intención
  async join(id, on) {
    if (!F) return NOCFG;
    const u = F.auth.currentUser;
    if (!u) return { error: 'Inicia sesión primero.' };
    try { await F.updateDoc(F.doc(F.db, 'publicaciones', id), { oran: on ? F.arrayUnion(u.uid) : F.arrayRemove(u.uid) }); return { ok: true }; }
    catch (e) { return fail(e); }
  },

  async logout() { if (F) await F.signOut(F.auth); }
});

init();
