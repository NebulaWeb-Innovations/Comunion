// Comunión · Perfil: cerrar sesión, foto editable, publicaciones, historias e intenciones.
// Guárdalo como assets/perfil.js. Se carga ANTES de app.js (ver index.html).
// Depende de window.Auth (assets/auth.js) y del evento "authchange".
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const safeImg = s => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s || '') ? s : '';
  const ic = (n, k = 'w-4 h-4') => `<i data-lucide="${n}" class="${k}"></i>`;
  const A = () => window.Auth;
  const PF = { items: [], loaded: false, uid: null, feedItems: [], wall: [], fLoaded: false, shown: 10, open: new Set(), cm: {}, users: {}, notifs: [], bellOpen: false, wallNew: false, vu: null, fol: { seg: [], sig: [] }, unsub: [], sub: null };
  window.PF = PF;
  const upd = () => dispatchEvent(new Event('pf-update'));
  const say = t => {
    const e = document.createElement('div');
    e.className = 'fixed left-1/2 -translate-x-1/2 z-[90] bg-card border rounded-xl shadow-lg px-4 py-3 text-sm font-medium';
    e.style.bottom = 'calc(6rem + env(safe-area-inset-bottom,0px))';
    e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), 2800);
  };
  const fecha = ms => new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  const TIPO = { laico: 'Laico', sacerdote: 'Sacerdote', religioso: 'Religioso' };
  const CATL = { gratitud: 'Gratitud', familia: 'Familia', sanacion: 'Sanación', vocacion: 'Vocación', otros: 'Intención' };
  const catLabel = i => (i.cat === 'otros' && i.catTxt) ? i.catTxt : (CATL[i.cat] || 'Intención');
  const okId = s => /^[A-Za-z0-9]{6,60}$/.test(s || '');
  const rel = ms => { const s = Math.max(1, Math.floor((Date.now() - ms) / 1000)); if (s < 60) return 'ahora'; const m = Math.floor(s / 60); if (m < 60) return m + ' min'; const h = Math.floor(m / 60); return h < 24 ? h + ' h' : Math.floor(h / 24) + ' d'; };

  // Foto actual de cada persona (la de su perfil; si no, la de Google; si no, su inicial)
  const avatar = (uid, nombre, cls, big) => {
    const me = (A() || {}).user, u = PF.users[uid] || {};
    let f = '';
    if (me && uid === me.uid) f = safeImg(u.foto) || safeImg((A().profile || {}).foto) || (/^https:\/\//.test(me.photo || '') ? me.photo : '');
    else f = safeImg(u.foto);
    if (!f && /^https:\/\//.test(u.fotoG || '')) f = u.fotoG;
    return f ? `<img src="${esc(f)}" alt="" referrerpolicy="no-referrer" class="${cls} rounded-full object-cover shrink-0">`
      : `<div class="${cls} rounded-full bg-secondary flex items-center justify-center text-primary font-display ${big ? 'text-4xl' : 'text-lg'} shrink-0">${esc((nombre || 'U')[0].toUpperCase())}</div>`;
  };
  const who = (uid, nombre) => {
    const me = (A() || {}).user;
    return okId(uid) ? `<a href="#${me && uid === me.uid ? 'perfil' : 'u-' + uid}" data-pf="irperfil" class="font-semibold hover:underline">${esc(nombre)}</a>` : `<span class="font-semibold">${esc(nombre)}</span>`;
  };
  PF.who = who;
  PF.avatar = avatar;
  const statsRow = (np, ns, ng, w) => `<div class="grid grid-cols-3 gap-3 mt-4">${[['Publicaciones', np, ''], ['Seguidores', ns, 'seg'], ['Seguidos', ng, 'sig']].map(([l, n, k]) => {
    const tag = k ? 'button' : 'div', at = k ? ` data-pf="lista" data-k="${k}" data-w="${w}"` : '';
    return `<${tag}${at} class="bg-card rounded-2xl border p-4 text-center"><p class="font-display text-3xl gold-text">${n}</p><p class="text-xs text-muted-foreground mt-1">${l}</p></${tag}>`;
  }).join('')}</div>`;
  const tileHtml = i => i.img
    ? `<button data-pf="ver" data-id="${esc(i.id)}" class="aspect-[4/5] bg-secondary overflow-hidden"><img src="${safeImg(i.img)}" alt="" class="w-full h-full object-cover"></button>`
    : `<button data-pf="ver" data-id="${esc(i.id)}" class="aspect-[4/5] bg-secondary p-3 text-left text-xs overflow-hidden">${esc(i.texto).slice(0, 140)}</button>`;

  PF.loadUsers = async uids => {
    const need = [...new Set(uids)].filter(x => okId(x) && !PF.users[x]);
    if (!need.length) return;
    need.forEach(x => { PF.users[x] = {}; });
    await Promise.all(need.map(async x => { PF.users[x] = await A().userInfo(x); }));
    upd();
  };

  // ── Manita de oraciones: se ilumina cuando alguien más publica una intención ──
  const seenKey = 'cp_wall_seen';
  const getSeen = () => { try { return +localStorage.getItem(seenKey) || 0; } catch (e) { return 0; } };
  const setSeen = v => { try { localStorage.setItem(seenKey, String(v)); } catch (e) {} };
  PF.markWallSeen = () => { setSeen(Date.now()); if (PF.wallNew) { PF.wallNew = false; upd(); } };
  function wallCheck() {
    const me = (A() || {}).user;
    let s = getSeen(); if (!s) { s = Date.now(); setSeen(s); }
    if (typeof S !== 'undefined' && S.page === 'oraciones') { setSeen(Date.now()); PF.wallNew = false; return; }
    PF.wallNew = PF.wall.some(i => i.ms > s && me && i.uid !== me.uid);
  }

  // ── Suscripciones en tiempo real (notificaciones e intenciones) ──
  function stop() {
    PF.unsub.forEach(f => { try { f(); } catch (e) {} });
    PF.unsub = []; PF.sub = null; PF.notifs = []; PF.wall = []; PF.wallNew = false; PF.bellOpen = false;
    PF.fol = { seg: [], sig: [] }; PF.users = {}; PF.feedItems = []; PF.fLoaded = false; PF.cm = {}; PF.open = new Set(); PF.vu = null;
  }
  function start() {
    const a = A();
    if (!a || !a.user) { if (PF.sub) stop(); return; }
    if (PF.sub === a.user.uid) return;
    stop(); PF.sub = a.user.uid;
    PF.unsub = [
      a.watchNotifs(l => { PF.notifs = l; PF.loadUsers(l.map(n => n.de)); upd(); }),
      a.watchWall(l => { PF.wall = l; wallCheck(); PF.loadUsers(l.map(i => i.uid)); upd(); })
    ];
    a.syncPublic().then(() => a.userInfo(a.user.uid)).then(i => { PF.users[a.user.uid] = i; upd(); });
    a.follows(a.user.uid).then(f => { PF.fol = f; upd(); });
  }

  // ── Carga de datos al iniciar sesión (Google, correo o registro nuevo) ──
  PF.load = async () => {
    const a = A();
    if (!a || !a.user) { PF.items = []; PF.loaded = false; PF.uid = null; return upd(); }
    if (PF.uid === a.user.uid && PF.loaded) return upd();
    PF.uid = a.user.uid; PF.loaded = false; upd();
    const r = await a.mine();
    if (r.error) say(r.error);
    PF.items = r.items || []; PF.loaded = true; upd();
    PF.loadCommunity();
  };

  // Publicaciones e intenciones de toda la comunidad
  PF.loadCommunity = async () => {
    const a = A();
    if (!a || !a.user) return;
    const po = await a.list('post');
    if (po.error) say(po.error);
    PF.feedItems = po.items || []; PF.fLoaded = true; upd();
    PF.loadUsers(PF.feedItems.slice(0, PF.shown + 10).map(i => i.uid));
  };
  const boot = () => { start(); PF.load(); };
  addEventListener('authchange', boot);
  if (A() && A().ready) boot();

  // Unirse en oración: se guarda en la intención y se avisa a quien la publicó
  PF.join = async (id, autorUid) => {
    const a = A(), me = a && a.user;
    if (!me) return { error: 'Inicia sesión primero.' };
    const it = PF.wall.find(x => x.id === id);
    if (it && !(it.oran || []).includes(me.uid)) it.oran = [...(it.oran || []), me.uid];
    const r = await a.join(id, true);
    if (r.ok) a.notify(autorUid, { tipo: 'oracion', post: id });
    else if (it) it.oran = (it.oran || []).filter(x => x !== me.uid);
    return r;
  };

  PF.add = async (tipo, texto, img, extra) => {
    const r = await A().publish({ tipo, texto, img, ...(extra || {}) });
    if (r.ok) {
      PF.items.unshift(r.item);
      if (tipo === 'post') PF.feedItems.unshift(r.item);
      upd();
    }
    return r;
  };

  // ── Sección "Publicaciones" del inicio ──
  PF.feed = () => {
    const a = A() || {}, u = a.user;
    const head = `<div class="flex items-center justify-between"><h2 class="font-display text-xl">Publicaciones</h2><span class="flex gap-2"><button data-pf="refrescar" aria-label="Actualizar" class="rounded-full border px-3 py-1.5 text-sm">${ic('refresh-cw')}</button><button data-pf="nuevo-post" class="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-1.5 text-sm font-semibold">${ic('image-plus')} Publicar</button></span></div>`;
    if (!u) return head + '<p class="text-sm text-muted-foreground">Inicia sesión para ver las publicaciones.</p>';
    if (!PF.fLoaded) return head + '<p class="text-sm text-muted-foreground">Cargando publicaciones…</p>';
    const card = i => {
      const likes = i.likes || [], liked = likes.includes(u.uid), open = PF.open.has(i.id), cm = PF.cm[i.id], id = esc(i.id);
      return `<article class="bg-card rounded-2xl border overflow-hidden">
        <div class="flex items-center gap-3 p-4">${avatar(i.uid, i.autor, 'w-10 h-10')}<div class="flex-1 min-w-0"><p class="text-sm truncate">${who(i.uid, i.autor)}</p><p class="text-xs text-muted-foreground">${fecha(i.ms)}</p></div>${i.uid === u.uid ? `<button data-pf="borrar" data-id="${id}" class="text-xs text-muted-foreground underline">Eliminar</button>` : ''}</div>
        ${i.img ? `<img src="${safeImg(i.img)}" alt="" class="w-full block">` : ''}
        ${i.texto ? `<p class="px-4 pt-3 text-base leading-relaxed whitespace-pre-wrap">${esc(i.texto)}</p>` : ''}
        <div class="flex items-center gap-5 px-4 py-3">
          <button data-pf="like" data-id="${id}" aria-pressed="${liked}" class="inline-flex items-center gap-1.5 text-sm ${liked ? 'text-primary font-semibold' : 'text-muted-foreground'}">${ic('heart', liked ? 'w-5 h-5 fill-current' : 'w-5 h-5')} ${likes.length}</button>
          <button data-pf="coment" data-id="${id}" class="inline-flex items-center gap-1.5 text-sm text-muted-foreground">${ic('message-circle', 'w-5 h-5')} ${i.nCom || 0}</button>
        </div>
        ${open ? `<div class="border-t px-4 py-3 space-y-3">${cm === undefined ? '<p class="text-xs text-muted-foreground">Cargando…</p>' : cm.map(c => `<p class="text-sm">${who(c.uid, c.autor)} · ${esc(c.texto)}${c.uid === u.uid ? ` <button data-pf="borrar-c" data-id="${id}" data-c="${esc(c.id)}" class="text-xs text-muted-foreground underline ml-1">Eliminar</button>` : ''}</p>`).join('')}<div class="flex gap-2"><input data-cin="${id}" maxlength="300" placeholder="Escribe un comentario…" class="flex-1 h-10 rounded-md border bg-transparent px-3 text-sm"><button data-pf="comentar" data-id="${id}" class="rounded-full bg-primary text-primary-foreground px-4 text-sm font-semibold">Enviar</button></div></div>` : ''}
      </article>`;
    };
    const list = PF.feedItems.slice(0, PF.shown);
    return head + (list.length ? list.map(card).join('') : '<p class="text-sm text-muted-foreground">Aún no hay publicaciones. ¡Sé la primera persona en publicar!</p>')
      + (PF.feedItems.length > PF.shown ? '<button data-pf="mas" class="w-full rounded-full border py-2.5 text-sm font-medium">Ver más</button>' : '');
  };

  // ── Vista del perfil (la usa app.js) ──
  PF.view = () => {
    const a = A() || {}, u = a.user, p = a.profile || {};
    const wrap = body => `<div class="flex-1 min-w-0 flex justify-center"><div class="w-full max-w-2xl px-4 py-6 lg:py-10 pb-24 lg:pb-10">${body}</div></div>`;
    if (!u) return wrap('<p class="text-sm text-muted-foreground text-center">Inicia sesión para ver tu perfil.</p>');
    const nombre = u.nombre || p.nombre || (u.email || '').split('@')[0] || 'Usuario';
    const foto = safeImg((PF.users[u.uid] || {}).foto) || safeImg(p.foto) || (/^https:\/\//.test(u.photo || '') ? u.photo : '');
    const now = Date.now();
    const posts = PF.items.filter(i => i.tipo === 'post');
    const ints = PF.items.filter(i => i.tipo === 'intencion');
    const hist = PF.items.filter(i => i.tipo === 'historia' && i.expira > now);
    const btn = (k, i, t, cls) => `<button data-pf="${k}" class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${cls}">${ic(i)} ${t}</button>`;
    const tile = i => i.img
      ? `<button data-pf="ver" data-id="${esc(i.id)}" class="aspect-[4/5] bg-secondary overflow-hidden"><img src="${safeImg(i.img)}" alt="" class="w-full h-full object-cover"></button>`
      : `<button data-pf="ver" data-id="${esc(i.id)}" class="aspect-[4/5] bg-secondary p-3 text-left text-xs overflow-hidden">${esc(i.texto).slice(0, 140)}</button>`;
    return wrap(`
      <div class="bg-card rounded-2xl border p-6 text-center">
        <div class="relative w-24 h-24 mx-auto">
          <div class="w-24 h-24 rounded-full overflow-hidden bg-secondary flex items-center justify-center font-display text-4xl text-primary ${hist.length ? 'ring-4 ring-accent' : ''}">${foto ? `<img src="${esc(foto)}" alt="Foto de perfil" class="w-full h-full object-cover">` : esc(nombre[0].toUpperCase())}</div>
          <button data-pf="foto" aria-label="Cambiar foto de perfil" class="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow">${ic('camera')}</button>
        </div>
        <h1 class="font-display text-2xl mt-3">${esc(nombre)}</h1>
        <p class="text-sm text-muted-foreground">${esc(u.email)}</p>
        ${TIPO[p.tipo] ? `<span class="inline-block mt-2 text-xs px-3 py-1 rounded-full bg-secondary text-muted-foreground">${TIPO[p.tipo]}</span>` : ''}
        <div class="flex flex-wrap justify-center gap-2 mt-5">
          ${btn('nuevo-post', 'image-plus', 'Publicar', 'bg-primary text-primary-foreground')}
          ${btn('nuevo-historia', 'circle-plus', 'Historia', 'bg-accent/15 text-accent-foreground')}
          ${btn('salir', 'log-out', 'Cerrar sesión', 'border')}
        </div>
      </div>
      ${statsRow(posts.length, PF.fol.seg.length, PF.fol.sig.length, 'mi')}
      ${!PF.loaded ? '<p class="text-sm text-muted-foreground text-center mt-8">Cargando tu perfil…</p>' : `
      ${hist.length ? `<h2 class="font-display text-xl mt-8 mb-3">Historias activas <span class="text-xs text-muted-foreground font-body">(duran 24 h)</span></h2><div class="flex gap-3 overflow-x-auto pb-1">${hist.map(i => `<button data-pf="ver" data-id="${esc(i.id)}" class="shrink-0 w-16 h-16 rounded-full overflow-hidden ring-2 ring-accent"><img src="${safeImg(i.img)}" alt="" class="w-full h-full object-cover"></button>`).join('')}</div>` : ''}
      <h2 class="font-display text-xl mt-8 mb-3">Mis publicaciones</h2>
      ${posts.length ? `<div class="grid grid-cols-3 gap-1 rounded-2xl overflow-hidden">${posts.map(tile).join('')}</div>` : '<p class="text-sm text-muted-foreground">Aún no has publicado nada.</p>'}
      <h2 class="font-display text-xl mt-8 mb-3">Mis intenciones</h2>
      ${ints.length ? `<div class="space-y-3">${ints.map(i => `<article class="bg-card rounded-2xl border p-4"><span class="inline-block text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground mb-2">${esc(catLabel(i))}</span><p class="text-sm">${esc(i.texto)}</p><div class="flex items-center justify-between mt-3"><span class="text-xs text-muted-foreground">${fecha(i.ms)}</span><button data-pf="borrar" data-id="${esc(i.id)}" class="text-xs text-muted-foreground underline">Eliminar</button></div></article>`).join('')}</div>` : '<p class="text-sm text-muted-foreground">Cuando pidas oración desde el inicio, tus intenciones aparecerán aquí.</p>'}`}`);
  };

  // ── Perfil de otra persona (#u-UID) ──
  PF.showUser = async uid => {
    const a = A();
    if (!okId(uid)) return;
    if (a && a.user && uid === a.user.uid) { location.hash = 'perfil'; return; }
    if (PF.vu && PF.vu.uid === uid && PF.vu.loaded) return;
    const vu = PF.vu = { uid, loaded: false, info: null, items: [], seg: [], sig: [] };
    if (!a || !a.user) return;
    const [info, mine, fol] = await Promise.all([a.userInfo(uid), a.mine(uid), a.follows(uid)]);
    if (PF.vu !== vu) return;
    PF.users[uid] = info; vu.info = info; vu.items = mine.items || []; vu.seg = fol.seg; vu.sig = fol.sig; vu.loaded = true; upd();
  };

  PF.userView = () => {
    const a = A() || {}, me = a.user, vu = PF.vu;
    const wrap = body => `<div class="flex-1 min-w-0 flex justify-center"><div class="w-full max-w-2xl px-4 py-6 lg:py-10 pb-24 lg:pb-10">${body}</div></div>`;
    if (!me) return wrap('<p class="text-sm text-muted-foreground text-center">Inicia sesión para ver este perfil.</p>');
    const volver = '<a href="#inicio" class="text-sm text-muted-foreground">← Volver al inicio</a>';
    if (!vu || !vu.loaded) return wrap(volver + '<p class="text-sm text-muted-foreground mt-6 text-center">Cargando perfil…</p>');
    const nombre = (vu.info && vu.info.nombre) || (vu.items[0] && vu.items[0].autor) || ((PF.fol.sig.find(x => x.uid === vu.uid) || vu.seg.find(x => x.uid === vu.uid) || {}).nombre) || 'Usuario';
    const posts = vu.items.filter(i => i.tipo === 'post');
    const sigo = vu.seg.some(x => x.uid === me.uid);
    return wrap(`${volver}
      <div class="bg-card rounded-2xl border p-6 text-center mt-3">
        ${avatar(vu.uid, nombre, 'w-24 h-24 mx-auto', true)}
        <h1 class="font-display text-2xl mt-3">${esc(nombre)}</h1>
        ${TIPO[vu.info && vu.info.tipo] ? `<span class="inline-block mt-2 text-xs px-3 py-1 rounded-full bg-secondary text-muted-foreground">${TIPO[vu.info.tipo]}</span>` : ''}
        <div class="mt-5"><button data-pf="seguir" class="rounded-full px-7 py-2 text-sm font-semibold ${sigo ? 'border' : 'bg-primary text-primary-foreground'}">${sigo ? 'Siguiendo' : 'Seguir'}</button></div>
      </div>
      ${statsRow(posts.length, vu.seg.length, vu.sig.length, 'vu')}
      <h2 class="font-display text-xl mt-8 mb-3">Publicaciones</h2>
      ${posts.length ? `<div class="grid grid-cols-3 gap-1 rounded-2xl overflow-hidden">${posts.map(tileHtml).join('')}</div>` : '<p class="text-sm text-muted-foreground">Aún no ha publicado nada.</p>'}`);
  };

  // ── Campanita de notificaciones ──
  function closeBell() {
    PF.bellOpen = false;
    const ids = PF.notifs.filter(n => !n.leido).map(n => n.id);
    if (ids.length) A().markRead(ids);
    upd();
  }
  PF.bell = () => {
    const a = A();
    if (!a || !a.user) return '';
    const n = PF.notifs.filter(x => !x.leido).length;
    const TXT = { follow: 'empezó a seguirte', comment: 'comentó tu publicación', oracion: 'se unió en oración a tu intención', reply: 'respondió en una publicación donde comentaste' };
    const panel = PF.bellOpen ? `<div class="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-card border rounded-2xl shadow-xl max-h-[70vh] overflow-y-auto">
        <p class="font-display text-lg px-4 py-3 border-b">Notificaciones</p>
        ${PF.notifs.length ? PF.notifs.map(x => `<div class="flex items-center gap-3 px-4 py-3 border-b ${x.leido ? '' : 'bg-primary/5'}">${avatar(x.de, x.nombre, 'w-9 h-9')}<p class="text-sm flex-1 min-w-0">${who(x.de, x.nombre)} ${esc(TXT[x.tipo] || '')}</p><span class="text-xs text-muted-foreground shrink-0">${rel(x.ms)}</span></div>`).join('') : '<p class="text-sm text-muted-foreground px-4 py-6 text-center">No tienes notificaciones.</p>'}
      </div>` : '';
    return `<div class="fixed z-40 right-3" style="top:calc(.75rem + env(safe-area-inset-top,0px))">
      ${PF.bellOpen ? '<div data-pf="bell-close" class="fixed inset-0"></div>' : ''}
      <button data-pf="bell" aria-label="Notificaciones${n ? ' (' + n + ' sin leer)' : ''}" class="relative w-11 h-11 rounded-full bg-card border shadow flex items-center justify-center"><span class="${n ? 'bell-wiggle' : 'inline-flex'}">${ic('bell', 'w-5 h-5')}</span>${n ? '<span class="absolute top-1.5 right-2 w-3 h-3 rounded-full bg-red-500 border-2 border-card"></span>' : ''}</button>
      ${panel}</div>`;
  };

  // ── Lista de seguidores / seguidos ──
  function listaModal(titulo, list) {
    const me = (A() || {}).user;
    const ov = document.createElement('div');
    ov.className = 'fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4';
    ov.innerHTML = `<div class="bg-card rounded-2xl border w-full max-w-sm p-4 max-h-[80vh] overflow-y-auto"><div class="flex items-center justify-between mb-2"><h2 class="font-display text-2xl">${titulo}</h2><button data-x="no" class="text-sm font-semibold">Cerrar</button></div>${list.length ? list.map(x => { const nm = (PF.users[x.uid] && PF.users[x.uid].nombre) || x.nombre || 'Usuario'; return `<a href="#${me && x.uid === me.uid ? 'perfil' : 'u-' + esc(x.uid)}" class="flex items-center gap-3 py-2">${avatar(x.uid, nm, 'w-10 h-10')}<span class="text-sm font-semibold">${esc(nm)}</span></a>`; }).join('') : '<p class="text-sm text-muted-foreground py-4">Nadie por ahora.</p>'}</div>`;
    document.body.appendChild(ov);
    ov.onclick = e => { if (e.target === ov || e.target.closest('[data-x],a')) ov.remove(); };
  }

  // ── Selector de imagen (galería del celular o archivos del PC) ──
  let inp = null;
  function pick(kind) {
    if (!inp) {
      inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.hidden = true;
      document.body.appendChild(inp);
    }
    inp.value = '';
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) edit(f, kind); };
    inp.click();
  }

  // ── Editor: encuadre, zoom y giro. Exporta JPEG comprimido ──
  const SPEC = {
    foto: { w: 320, h: 320, t: 'Foto de perfil', round: true, cap: false, max: 70000 },
    post: { w: 720, h: 900, t: 'Nueva publicación', cap: true, max: 220000 },
    historia: { w: 540, h: 960, t: 'Nueva historia', cap: true, max: 240000 }
  };
  function edit(file, kind) {
    if (!file.type.startsWith('image/')) return say('Selecciona un archivo de imagen.');
    if (file.size > 25e6) return say('La imagen pesa demasiado (máximo 25 MB).');
    const sp = SPEC[kind], url = URL.createObjectURL(file), img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); say('No pudimos abrir esa imagen.'); };
    img.onload = () => {
      const st = { z: 1, rot: 0, ox: 0, oy: 0 };
      const ov = document.createElement('div');
      ov.className = 'fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4';
      ov.innerHTML = `<div class="bg-card rounded-2xl border w-full max-w-sm p-4 max-h-[94vh] overflow-y-auto" role="dialog" aria-modal="true">
        <h2 class="font-display text-2xl mb-3">${sp.t}</h2>
        <canvas class="mx-auto rounded-xl touch-none bg-black" style="max-width:100%;max-height:52vh;cursor:grab"></canvas>
        <div class="flex items-center gap-3 mt-3"><label class="text-xs text-muted-foreground" for="pf-z">Zoom</label><input id="pf-z" type="range" min="1" max="3" step="0.01" value="1" class="flex-1"><button data-x="rot" class="rounded-full border px-3 py-1.5 text-sm" aria-label="Girar">↻</button></div>
        <p class="text-xs text-muted-foreground mt-1">Arrastra la imagen para encuadrarla.</p>
        ${sp.cap ? '<textarea id="pf-c" maxlength="300" rows="2" class="w-full rounded-md border bg-transparent p-3 text-sm mt-3" placeholder="Escribe algo (opcional)"></textarea>' : ''}
        <div class="flex justify-end gap-2 mt-4"><button data-x="no" class="rounded-full border px-5 py-2 text-sm font-medium">Cancelar</button><button data-x="ok" class="rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm font-semibold">${kind === 'foto' ? 'Guardar foto' : 'Publicar'}</button></div></div>`;
      document.body.appendChild(ov);
      const cv = ov.querySelector('canvas'), cx = cv.getContext('2d');
      cv.width = sp.w; cv.height = sp.h; cv.style.aspectRatio = sp.w + '/' + sp.h; cv.style.width = kind === 'historia' ? '210px' : '100%';
      const dims = () => st.rot % 2 ? [img.naturalHeight, img.naturalWidth] : [img.naturalWidth, img.naturalHeight];
      const scale = () => { const [iw, ih] = dims(); return Math.max(sp.w / iw, sp.h / ih) * st.z; };
      const clamp = () => { const [iw, ih] = dims(), s = scale(), mx = Math.max(0, (iw * s - sp.w) / 2), my = Math.max(0, (ih * s - sp.h) / 2); st.ox = Math.min(mx, Math.max(-mx, st.ox)); st.oy = Math.min(my, Math.max(-my, st.oy)); };
      function draw(guide) {
        clamp(); cx.fillStyle = '#000'; cx.fillRect(0, 0, sp.w, sp.h);
        cx.save(); cx.translate(sp.w / 2 + st.ox, sp.h / 2 + st.oy); cx.rotate(st.rot * Math.PI / 2);
        const s = scale(); cx.scale(s, s); cx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2); cx.restore();
        if (guide && sp.round) { cx.fillStyle = 'rgba(0,0,0,.55)'; cx.beginPath(); cx.rect(0, 0, sp.w, sp.h); cx.arc(sp.w / 2, sp.h / 2, sp.w / 2 - 4, 0, 7); cx.fill('evenodd'); }
      }
      draw(true);
      ov.querySelector('#pf-z').oninput = e => { st.z = +e.target.value; draw(true); };
      let drag = null;
      cv.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY, ox: st.ox, oy: st.oy }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; };
      cv.onpointermove = e => { if (!drag) return; const k = sp.w / cv.getBoundingClientRect().width; st.ox = drag.ox + (e.clientX - drag.x) * k; st.oy = drag.oy + (e.clientY - drag.y) * k; draw(true); };
      cv.onpointerup = cv.onpointercancel = () => { drag = null; cv.style.cursor = 'grab'; };
      const close = () => { URL.revokeObjectURL(url); ov.remove(); };
      ov.onclick = async e => {
        const x = e.target.closest('[data-x]'); if (!x) return;
        if (x.dataset.x === 'no') return close();
        if (x.dataset.x === 'rot') { st.rot = (st.rot + 1) % 4; st.ox = st.oy = 0; return draw(true); }
        x.disabled = true; x.textContent = 'Subiendo…';
        draw(false);
        let q = .86, data = cv.toDataURL('image/jpeg', q);
        while (data.length > sp.max && q > .4) { q -= .08; data = cv.toDataURL('image/jpeg', q); }
        const texto = (ov.querySelector('#pf-c')?.value || '').trim();
        let r;
        if (kind === 'foto') {
          r = await A().setPhoto(data);
          if (r.ok) { PF.users[A().user.uid] = { ...(PF.users[A().user.uid] || {}), foto: data }; say('Foto actualizada'); upd(); }
        } else {
          r = await PF.add(kind === 'post' ? 'post' : 'historia', texto, data);
          if (r.ok) say(kind === 'post' ? 'Publicación subida' : 'Historia subida (dura 24 h)');
        }
        if (r.error) { say(r.error); x.disabled = false; x.textContent = kind === 'foto' ? 'Guardar foto' : 'Publicar'; return; }
        close();
      };
    };
    img.src = url;
  }

  // ── Visor de publicaciones e historias ──
  function viewer(id) {
    const i = PF.items.find(x => x.id === id) || (PF.vu && PF.vu.items.find(x => x.id === id)) || PF.feedItems.find(x => x.id === id); if (!i) return;
    const ov = document.createElement('div');
    ov.className = 'fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-4';
    ov.innerHTML = `<div class="bg-card rounded-2xl border w-full max-w-sm overflow-hidden max-h-[94vh] overflow-y-auto">${i.img ? `<img src="${safeImg(i.img)}" alt="" class="w-full block">` : ''}<div class="p-4">${i.texto ? `<p class="text-sm">${esc(i.texto)}</p>` : ''}<div class="flex items-center justify-between mt-3"><span class="text-xs text-muted-foreground">${fecha(i.ms)}</span><span class="flex gap-4">${i.uid === A().user.uid ? '<button data-x="del" class="text-xs text-muted-foreground underline">Eliminar</button>' : ''}<button data-x="no" class="text-xs font-semibold">Cerrar</button></span></div></div></div>`;
    document.body.appendChild(ov);
    ov.onclick = async e => {
      const x = e.target.closest('[data-x]');
      if (x && x.dataset.x === 'del') { if (!confirm('¿Eliminar esto?')) return; await borrar(id); ov.remove(); }
      else if (x || e.target === ov) ov.remove();
    };
  }
  async function borrar(id) {
    const r = await A().remove(id);
    if (r.error) return say(r.error);
    PF.items = PF.items.filter(x => x.id !== id);
    PF.feedItems = PF.feedItems.filter(x => x.id !== id);
    PF.wall = PF.wall.filter(x => x.id !== id);
    upd(); say('Eliminado');
  }
  const findPost = id => PF.feedItems.find(x => x.id === id);

  async function enviarComentario(id) {
    const inp = [...document.querySelectorAll('[data-cin]')].find(x => x.dataset.cin === id);
    const txt = inp ? inp.value.trim() : '';
    if (!txt) return;
    inp.disabled = true;
    const r = await A().comment(id, txt);
    if (r.error) { say(r.error); inp.disabled = false; return; }
    {
      const it0 = findPost(id), yo = A().user.uid, hecho = new Set([yo]);
      const previos = [...new Set((PF.cm[id] || []).map(c => c.uid))];
      if (it0 && it0.uid && !hecho.has(it0.uid)) { A().notify(it0.uid, { tipo: 'comment', post: id }); hecho.add(it0.uid); }
      previos.forEach(u => { if (u && !hecho.has(u)) { A().notify(u, { tipo: 'reply', post: id }); hecho.add(u); } });
    }
    (PF.cm[id] = PF.cm[id] || []).push(r.item);
    const it = findPost(id); if (it) it.nCom = (it.nCom || 0) + 1;
    upd();
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.cin) { e.preventDefault(); enviarComentario(e.target.dataset.cin); }
  });

  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-pf]'); if (!t) return;
    const k = t.dataset.pf, id = t.dataset.id;
    if (k === 'foto') pick('foto');
    else if (k === 'nuevo-post') pick('post');
    else if (k === 'nuevo-historia') pick('historia');
    else if (k === 'ver') viewer(id);
    else if (k === 'borrar') { if (confirm('¿Eliminar esto?')) borrar(id); }
    else if (k === 'refrescar') { PF.fLoaded = false; upd(); PF.loadCommunity(); }
    else if (k === 'mas') { PF.shown += 10; upd(); PF.loadUsers(PF.feedItems.slice(0, PF.shown).map(i => i.uid)); }
    else if (k === 'like') {
      const it = findPost(id), uid = A().user.uid; if (!it) return;
      const had = (it.likes || []).includes(uid);
      it.likes = had ? it.likes.filter(x => x !== uid) : [...(it.likes || []), uid]; upd();
      const r = await A().like(id, !had);
      if (r.error) { it.likes = had ? [...it.likes, uid] : it.likes.filter(x => x !== uid); upd(); say(r.error); }
    }
    else if (k === 'coment') {
      if (PF.open.has(id)) { PF.open.delete(id); return upd(); }
      PF.open.add(id); upd();
      if (!PF.cm[id]) { const r = await A().comments(id); if (r.error) say(r.error); PF.cm[id] = r.items || []; upd(); }
    }
    else if (k === 'comentar') enviarComentario(id);
    else if (k === 'borrar-c') {
      const r = await A().removeComment(id, t.dataset.c);
      if (r.error) return say(r.error);
      PF.cm[id] = (PF.cm[id] || []).filter(x => x.id !== t.dataset.c);
      const it = findPost(id); if (it) it.nCom = Math.max(0, (it.nCom || 0) - 1);
      upd();
    }
    else if (k === 'irperfil') { if (PF.bellOpen) closeBell(); }
    else if (k === 'bell') {
      if (PF.bellOpen) return closeBell();
      PF.bellOpen = true; PF.loadUsers(PF.notifs.map(n => n.de)); upd();
    }
    else if (k === 'bell-close') closeBell();
    else if (k === 'lista') {
      const src = t.dataset.w === 'vu' ? PF.vu : PF.fol;
      if (!src) return;
      const list = (t.dataset.k === 'seg' ? src.seg : src.sig) || [];
      await PF.loadUsers(list.map(x => x.uid));
      listaModal(t.dataset.k === 'seg' ? 'Seguidores' : 'Seguidos', list);
    }
    else if (k === 'seguir') {
      const vu = PF.vu, yo = A().user; if (!vu || !yo) return;
      const nombre = (vu.info && vu.info.nombre) || (vu.items[0] && vu.items[0].autor) || 'Usuario';
      const on = !vu.seg.some(x => x.uid === yo.uid);
      const antes = [vu.seg, PF.fol.sig];
      vu.seg = on ? [...vu.seg, { uid: yo.uid, nombre: yo.nombre || (yo.email || '').split('@')[0] || 'Usuario', ms: Date.now() }] : vu.seg.filter(x => x.uid !== yo.uid);
      PF.fol.sig = on ? [...PF.fol.sig, { uid: vu.uid, nombre, ms: Date.now() }] : PF.fol.sig.filter(x => x.uid !== vu.uid);
      upd();
      const r = await A().follow(vu.uid, nombre, on);
      if (r.error) { vu.seg = antes[0]; PF.fol.sig = antes[1]; upd(); say(r.error); }
    }
    else if (k === 'salir') { await A().logout(); }   // guard.js te lleva a login.html al cambiar la sesión
  });
})();
