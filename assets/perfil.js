// Comunión · Perfil: cerrar sesión, foto editable, publicaciones, historias e intenciones.
// Guárdalo como assets/perfil.js. Se carga ANTES de app.js (ver index.html).
// Depende de window.Auth (assets/auth.js) y del evento "authchange".
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const safeImg = s => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s || '') ? s : '';
  const ic = (n, k = 'w-4 h-4') => `<i data-lucide="${n}" class="${k}"></i>`;
  const A = () => window.Auth;
  const PF = { items: [], loaded: false, uid: null };
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

  // ── Carga de datos al iniciar sesión (Google, correo o registro nuevo) ──
  PF.load = async () => {
    const a = A();
    if (!a || !a.user) { PF.items = []; PF.loaded = false; PF.uid = null; return upd(); }
    if (PF.uid === a.user.uid && PF.loaded) return upd();
    PF.uid = a.user.uid; PF.loaded = false; upd();
    const r = await a.mine();
    if (r.error) say(r.error);
    PF.items = r.items || []; PF.loaded = true; upd();
  };
  addEventListener('authchange', PF.load);
  if (A() && A().ready) PF.load();

  PF.add = async (tipo, texto, img) => {
    const r = await A().publish({ tipo, texto, img });
    if (r.ok) { PF.items.unshift(r.item); upd(); }
    return r;
  };

  // ── Vista del perfil (la usa app.js) ──
  PF.view = () => {
    const a = A() || {}, u = a.user, p = a.profile || {};
    const wrap = body => `<div class="flex-1 min-w-0 flex justify-center"><div class="w-full max-w-2xl px-4 py-6 lg:py-10 pb-24 lg:pb-10">${body}</div></div>`;
    if (!u) return wrap('<p class="text-sm text-muted-foreground text-center">Inicia sesión para ver tu perfil.</p>');
    const nombre = u.nombre || p.nombre || 'Usuario';
    const foto = safeImg(p.foto) || (/^https:\/\//.test(u.photo || '') ? u.photo : '');
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
      <div class="grid grid-cols-3 gap-3 mt-4">${[['Publicaciones', posts.length], ['Intenciones', ints.length], ['Historias', hist.length]].map(([l, n]) => `<div class="bg-card rounded-2xl border p-4 text-center"><p class="font-display text-3xl gold-text">${n}</p><p class="text-xs text-muted-foreground mt-1">${l}</p></div>`).join('')}</div>
      ${!PF.loaded ? '<p class="text-sm text-muted-foreground text-center mt-8">Cargando tu perfil…</p>' : `
      ${hist.length ? `<h2 class="font-display text-xl mt-8 mb-3">Historias activas <span class="text-xs text-muted-foreground font-body">(duran 24 h)</span></h2><div class="flex gap-3 overflow-x-auto pb-1">${hist.map(i => `<button data-pf="ver" data-id="${esc(i.id)}" class="shrink-0 w-16 h-16 rounded-full overflow-hidden ring-2 ring-accent"><img src="${safeImg(i.img)}" alt="" class="w-full h-full object-cover"></button>`).join('')}</div>` : ''}
      <h2 class="font-display text-xl mt-8 mb-3">Mis publicaciones</h2>
      ${posts.length ? `<div class="grid grid-cols-3 gap-1 rounded-2xl overflow-hidden">${posts.map(tile).join('')}</div>` : '<p class="text-sm text-muted-foreground">Aún no has publicado nada.</p>'}
      <h2 class="font-display text-xl mt-8 mb-3">Mis intenciones</h2>
      ${ints.length ? `<div class="space-y-3">${ints.map(i => `<article class="bg-card rounded-2xl border p-4"><p class="text-sm">${esc(i.texto)}</p><div class="flex items-center justify-between mt-3"><span class="text-xs text-muted-foreground">${fecha(i.ms)}</span><button data-pf="borrar" data-id="${esc(i.id)}" class="text-xs text-muted-foreground underline">Eliminar</button></div></article>`).join('')}</div>` : '<p class="text-sm text-muted-foreground">Cuando pidas oración desde el inicio, tus intenciones aparecerán aquí.</p>'}`}`);
  };

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
          if (r.ok) { say('Foto actualizada'); upd(); }
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
    const i = PF.items.find(x => x.id === id); if (!i) return;
    const ov = document.createElement('div');
    ov.className = 'fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-4';
    ov.innerHTML = `<div class="bg-card rounded-2xl border w-full max-w-sm overflow-hidden max-h-[94vh] overflow-y-auto">${i.img ? `<img src="${safeImg(i.img)}" alt="" class="w-full block">` : ''}<div class="p-4">${i.texto ? `<p class="text-sm">${esc(i.texto)}</p>` : ''}<div class="flex items-center justify-between mt-3"><span class="text-xs text-muted-foreground">${fecha(i.ms)}</span><span class="flex gap-4"><button data-x="del" class="text-xs text-muted-foreground underline">Eliminar</button><button data-x="no" class="text-xs font-semibold">Cerrar</button></span></div></div></div>`;
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
    PF.items = PF.items.filter(x => x.id !== id); upd(); say('Eliminado');
  }

  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-pf]'); if (!t) return;
    const k = t.dataset.pf;
    if (k === 'foto') pick('foto');
    else if (k === 'nuevo-post') pick('post');
    else if (k === 'nuevo-historia') pick('historia');
    else if (k === 'ver') viewer(t.dataset.id);
    else if (k === 'borrar') { if (confirm('¿Eliminar esta intención?')) borrar(t.dataset.id); }
    else if (k === 'salir') { await A().logout(); }   // guard.js te lleva a login.html al cambiar la sesión
  });
})();
