// Registro de Comunión. Usa window.Auth (assets/auth.js): register, social y saveProfile.
const $ = s => document.querySelector(s);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_AGE = 14;
const dest = () => { const n = new URLSearchParams(location.search).get('next'); return /^(index|evangelio|santo)\.html(\?[\w=&%.\-]*)?$/.test(n || '') ? n : 'index.html'; };
document.querySelectorAll('a[href^="login.html"]').forEach(a => (a.search = location.search)); // conserva ?next=
const val = id => $('#' + id).value.trim();
const today = new Date();
$('#nacimiento').max = today.toISOString().slice(0, 10);
lucide.createIcons();

if (window.Auth?.ready && window.Auth.user) location.href = dest();

function ageOf(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  if (y < 1900) return null;
  let a = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) a--;
  return a < 0 ? null : a;
}

function fieldError(id, text) {
  const el = $('#' + id), p = $('#' + id + '-err');
  el?.setAttribute('aria-invalid', text ? 'true' : 'false');
  p.textContent = text || '';
  p.classList.toggle('hidden', !text);
  return !text;
}

const checks = {
  name: () => fieldError('name', val('name').length >= 2 ? '' : 'Escribe tu nombre.'),
  email: () => fieldError('email', !val('email') ? 'Escribe tu correo electrónico.' : !EMAIL_RE.test(val('email')) ? 'Ingresa un correo válido, por ejemplo tu@correo.com.' : ''),
  password: () => fieldError('password', $('#password').value.length >= 6 ? '' : 'La contraseña debe tener al menos 6 caracteres.'),
  confirm: () => fieldError('confirm', $('#confirm').value === $('#password').value && $('#confirm').value ? '' : 'Las contraseñas no coinciden.'),
  tipo: () => fieldError('tipo', document.querySelector('[name=tipo]:checked') ? '' : 'Elige qué tipo de usuario eres.'),
  nacimiento: () => {
    const a = ageOf($('#nacimiento').value);
    return fieldError('nacimiento', a === null ? 'Escribe una fecha de nacimiento válida.' : a < MIN_AGE ? `Debes tener al menos ${MIN_AGE} años para usar Comunión.` : '');
  },
  terms: () => fieldError('terms', $('#terms').checked ? '' : 'Debes aceptar los términos para continuar.')
};
const all = names => names.map(n => checks[n]()).every(Boolean);

function setMsg(text, kind = 'error') {
  const m = $('#msg');
  m.textContent = text || '';
  m.className = 'text-sm rounded-xl px-3.5 py-2.5 ' + (text ? '' : 'hidden ') +
    (kind === 'info' ? 'bg-accent/15 text-accent-foreground' : 'bg-red-50 text-red-700');
}

function busy(on) {
  $('#spin').classList.toggle('hidden', !on);
  $('#label').textContent = on ? 'Creando tu cuenta…' : 'Crear mi cuenta';
  document.querySelectorAll('button').forEach(b => (b.disabled = on));
}

const wait = ms => new Promise(r => setTimeout(r, ms));
const profileData = () => ({ tipo: document.querySelector('[name=tipo]:checked').value, nacimiento: $('#nacimiento').value });

// Espera a que Auth tenga al usuario (y su perfil cargado) tras un acceso social.
const whenUser = a => new Promise(res => {
  const done = () => { clearTimeout(t); removeEventListener('authchange', f); res(); };
  const f = () => a.user && a.ready && done();
  const t = setTimeout(done, 15000);
  a.user && a.ready ? done() : addEventListener('authchange', f);
});

async function run(fn) {
  setMsg('');
  busy(true);
  try {
    const a = window.Auth;
    if (!a) return setMsg('No se encontró assets/auth.js. Súbelo junto a registro.html.', 'info');
    if (!a.configured) { await wait(900); return setMsg('Modo demostración: configura Firebase en assets/auth.js para crear cuentas.', 'info'); }
    const r = await fn(a);
    if (r && r.error) return setMsg(r.error);
    location.href = dest();
  } finally {
    busy(false);
  }
}

Object.keys(checks).forEach(k => {
  const el = $('#' + k) || document.querySelector('[name=' + k + ']');
  const ev = k === 'tipo' || k === 'terms' ? 'change' : 'input';
  document.querySelectorAll('#' + k + ',[name=' + k + ']').forEach(e => e.addEventListener(ev, () => {
    if ($('#' + k + '-err') && !$('#' + k + '-err').classList.contains('hidden')) checks[k]();
  }));
});
$('#email').addEventListener('blur', () => val('email') && checks.email());
$('#nacimiento').addEventListener('change', () => checks.nacimiento());

document.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => {
  const inp = $('#' + b.dataset.toggle), show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  b.setAttribute('aria-pressed', show);
  b.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  b.children[0].classList.toggle('hidden', show);
  b.children[1].classList.toggle('hidden', !show);
}));

$('#form').addEventListener('submit', e => {
  e.preventDefault();
  if (!all(Object.keys(checks))) return;
  run(async a => {
    const r = await a.register(val('name'), val('email'), $('#password').value);
    if (r.error) return r;
    return a.saveProfile(profileData());
  });
});

document.querySelectorAll('[data-social]').forEach(b => b.addEventListener('click', () => {
  if (!all(['tipo', 'nacimiento', 'terms'])) return setMsg('Completa tu tipo de usuario, fecha de nacimiento y acepta los términos para continuar.', 'info');
  run(async a => {
    const r = await a.social(b.dataset.social);
    if (r.error) return r;
    await whenUser(a);
    if (a.user && !a.profile) return a.saveProfile(profileData()); // no pisar el perfil de quien ya tenía cuenta
  });
}));
