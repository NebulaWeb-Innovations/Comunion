// Usa window.Auth, definido por assets/auth.js (Firebase Authentication). La configuración de Firebase vive solo allí.
import { getAuth, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const $ = s => document.querySelector(s);
const em = $('#email'), pw = $('#password'), msg = $('#msg');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
lucide.createIcons();

// Si ya hay sesión, ir directo al inicio.
const goHome = () => (location.href = 'index.html');
addEventListener('authchange', () => window.Auth?.user && goHome());
if (window.Auth?.ready && window.Auth.user) goHome();

function fieldError(input, text) {
  const p = $('#' + input.id + '-err');
  input.setAttribute('aria-invalid', text ? 'true' : 'false');
  p.textContent = text || '';
  p.classList.toggle('hidden', !text);
  return !text;
}
const checkEmail = () => fieldError(em, !em.value.trim() ? 'Escribe tu correo electrónico.' : !EMAIL_RE.test(em.value.trim()) ? 'Ingresa un correo válido, por ejemplo tu@correo.com.' : '');
const checkPw = () => fieldError(pw, pw.value ? '' : 'Escribe tu contraseña.');

function setMsg(text, kind = 'error') {
  msg.textContent = text || '';
  msg.classList.toggle('hidden', !text);
  msg.className = 'text-sm rounded-xl px-3.5 py-2.5 ' + (text ? '' : 'hidden ') +
    (kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : kind === 'info' ? 'bg-accent/15 text-accent-foreground' : 'bg-red-50 text-red-700');
}

function busy(on) {
  $('#spin').classList.toggle('hidden', !on);
  $('#label').textContent = on ? 'Iniciando sesión…' : 'Iniciar sesión';
  document.querySelectorAll('button').forEach(b => (b.disabled = on));
}

const wait = ms => new Promise(r => setTimeout(r, ms));

async function run(fn, { redirect = true, ok } = {}) {
  setMsg('');
  busy(true);
  try {
    const a = window.Auth;
    if (!a) return setMsg('No se encontró assets/auth.js. Súbelo junto a login.html.', 'info');
    if (!a.configured) { await wait(900); return setMsg('Modo demostración: configura Firebase en assets/auth.js para activar el acceso.', 'info'); }
    const r = await fn(a);
    if (r && r.error) return setMsg(r.error);
    if (redirect) goHome(); else setMsg(ok, 'ok');
  } finally {
    busy(false);
  }
}

em.addEventListener('blur', () => em.value && checkEmail());
em.addEventListener('input', () => em.getAttribute('aria-invalid') === 'true' && checkEmail());
pw.addEventListener('input', () => pw.getAttribute('aria-invalid') === 'true' && checkPw());

$('#toggle').addEventListener('click', e => {
  const show = pw.type === 'password';
  pw.type = show ? 'text' : 'password';
  e.currentTarget.setAttribute('aria-pressed', show);
  e.currentTarget.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  $('#eye-on').classList.toggle('hidden', show);
  $('#eye-off').classList.toggle('hidden', !show);
});

$('#form').addEventListener('submit', e => {
  e.preventDefault();
  if (!(checkEmail() & checkPw())) return;
  run(async a => {
    try { await setPersistence(getAuth(), $('#remember').checked ? browserLocalPersistence : browserSessionPersistence); } catch {}
    return a.login(em.value.trim(), pw.value);
  });
});

$('#forgot').addEventListener('click', () => {
  if (!checkEmail()) return em.focus();
  run(a => a.reset(em.value.trim()), { redirect: false, ok: 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.' });
});

document.querySelectorAll('[data-social]').forEach(b => b.addEventListener('click', () => run(a => a.social(b.dataset.social))));
