// Guarda de sesión de Comunión. Se carga en el <head>, antes que los demás scripts.
//  · Entrada "original" (raíz o index.html sin parámetros) y sin sesión → login.html a pantalla completa.
//  · Enlace a un contenido (evangelio.html, santo.html, ?u=…, ?from=…) y sin sesión → inicio difuminado
//    con una ventana pequeña para registrarse o iniciar sesión.
// Depende de assets/auth.js (window.Auth y el evento "authchange").
(() => {
  const root = document.documentElement;
  const file = location.pathname.split('/').pop() || 'index.html';
  const q = new URLSearchParams(location.search);
  const PAGE = /^(index|evangelio|santo)\.html$/;
  const DEEP = ['u', 'p', 'from', 'oracion', 'circulo'];
  const from = PAGE.test(q.get('from') || '') ? q.get('from') : null;
  const next = from || file + location.search;          // a dónde volver después de entrar
  const qs = '?next=' + encodeURIComponent(next);
  const name = (q.get('u') || '').trim().slice(0, 40);   // cuenta que buscó la persona (opcional)

  const [title, text] = name
    ? ['Mira las oraciones y testimonios de ' + name, 'Regístrate y no te pierdas nada de ' + name + '.']
    : from === 'evangelio.html'
      ? ['Reza el Evangelio del día con la comunidad', 'Regístrate para escuchar la lectura y comentar la reflexión de hoy.']
      : from === 'santo.html'
        ? ['Conoce al santo del día', 'Regístrate para leer su biografía y unirte a la oración.']
        : ['Únete a la comunidad de Comunión', 'Regístrate para pedir oración, compartir testimonios y rezar junto a otros.'];

  root.style.visibility = 'hidden'; // evita ver la página un instante antes de decidir

  const css = `.gd-ov{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));background:hsl(var(--background,40 33% 97%)/.5);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:hsl(var(--foreground,15 6% 13%))}
.gd-card{width:100%;max-width:400px;box-sizing:border-box;background:hsl(var(--card,0 0% 100%));border:1px solid hsl(var(--border,36 19% 89%));border-radius:24px;padding:32px 28px 24px;box-shadow:0 24px 64px -12px rgba(0,0,0,.35)}
.gd-logo{display:block;width:84px;height:84px;margin:0 auto 20px}
.gd-h{font-family:'Cormorant Garamond',Georgia,serif;font-size:30px;line-height:1.1;font-weight:600;margin:0}
.gd-p{font-size:14px;line-height:1.5;margin:10px 0 0}
.gd-t{font-size:12px;line-height:1.5;margin:14px 0 0;color:hsl(var(--muted-foreground,28 6% 43%))}
.gd-t a{color:inherit;font-weight:600;text-decoration:underline}
.gd-b{display:block;box-sizing:border-box;width:100%;height:44px;line-height:44px;margin-top:22px;border-radius:12px;background:hsl(var(--primary,346 57% 27%));color:hsl(var(--primary-foreground,40 33% 97%));text-align:center;font-size:14px;font-weight:600;text-decoration:none;transition:filter .15s,transform .1s}
.gd-b:hover{filter:brightness(1.15)}.gd-b:active{transform:scale(.98)}
.gd-l{display:block;margin-top:14px;text-align:center;font-size:14px;font-weight:600;color:hsl(var(--primary,346 57% 27%));text-decoration:none}.gd-l:hover{text-decoration:underline}`;

  let gate = null;
  const el = (tag, cls, txt, attrs) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt) e.textContent = txt;
    if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  };

  function openGate() {
    if (gate) return;
    const st = el('style', '', css);
    const card = el('div', 'gd-card', '', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gd-h' });
    const btn = el('a', 'gd-b', 'Registrarte', { href: 'registro.html' + qs });
    const terms = el('p', 'gd-t', 'Al continuar, aceptas los ');
    terms.append(el('a', '', 'Términos de servicio', { href: 'terminos.html' }), ' y la ',
      el('a', '', 'Política de privacidad', { href: 'privacidad.html' }), ' de Comunión.');
    card.append(el('img', 'gd-logo', '', { src: 'assets/comunion-logo.png', alt: '' }),
      el('h2', 'gd-h', title, { id: 'gd-h' }), el('p', 'gd-p', text), terms, btn,
      el('a', 'gd-l', 'Iniciar sesión', { href: 'login.html' + qs }));
    gate = el('div', 'gd-ov');
    gate.append(st, card);
    document.body.append(gate);
    document.getElementById('app')?.setAttribute('inert', ''); // el inicio queda de fondo, sin poder usarse
    document.body.style.overflow = 'hidden';
    root.style.visibility = '';
    btn.focus();
  }

  function closeGate() {
    gate?.remove(); gate = null;
    document.getElementById('app')?.removeAttribute('inert');
    document.body.style.overflow = '';
  }

  function noSession() {
    if (file !== 'index.html') return location.replace(PAGE.test(file) ? 'index.html?from=' + file : 'login.html');
    if (DEEP.some(k => q.has(k))) return openGate();
    location.replace('login.html');
  }

  function decide() {
    const a = window.Auth;
    if (!a || !a.ready || document.readyState === 'loading') return;
    if (a.user) { closeGate(); root.style.visibility = ''; } else noSession();
  }

  addEventListener('authchange', decide);        // inicio y cierre de sesión
  addEventListener('DOMContentLoaded', decide);  // por si auth.js ya terminó de cargar

  // Si Firebase tarda demasiado, tratamos la visita como sin sesión en vez de dejar la pantalla en blanco.
  setTimeout(() => { if (root.style.visibility === 'hidden' && !window.Auth?.user) noSession(); }, 8000);
})();
