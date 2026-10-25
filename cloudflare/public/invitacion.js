// Aceptar una invitación: /invitacion/<testigo>. El testigo es de un solo uso; el servidor decide el correo y el rol (esta página solo muestra).
const $ = (id) => document.getElementById(id);
const testigo = location.pathname.split('/').filter(Boolean).pop() || '';
const ROL = { admin: 'administrador (puede aprobar, gastar y gestionar el equipo)', editor: 'editor (trabaja con los agentes, sin aprobar ni gastar)', lectura: 'lectura (solo mira)' };
const f = $('f'), msg = $('msg'), pass = $('pass'), pass2 = $('pass2'), boton = $('entrar');
function malo(t) { $('cargando').classList.add('oculto'); $('mala').classList.remove('oculto'); $('malaTxt').textContent = t; }
$('ojo').addEventListener('click', (e) => {
  const ver = pass.type === 'password';
  pass.type = pass2.type = ver ? 'text' : 'password';
  e.currentTarget.setAttribute('aria-pressed', String(ver));
  e.currentTarget.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
});
function reglas() {
  const ok = { largo: pass.value.length >= 12, igual: pass.value !== '' && pass.value === pass2.value };
  for (const li of document.querySelectorAll('#reglas li')) li.classList.toggle('ok', ok[li.dataset.r]);
  return ok.largo && ok.igual;
}
pass.addEventListener('input', reglas); pass2.addEventListener('input', reglas);
(async () => {
  try {
    const r = await fetch(`/api/invitacion/${encodeURIComponent(testigo)}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return malo(d.error || 'No se pudo comprobar la invitación.');
    const i = d.invitacion;
    $('quien').textContent = `${i.invita} te invita como ${ROL[i.rol] || i.rol}.`;
    $('email').value = i.email; $('nombre').value = i.nombre || '';
    $('cargando').classList.add('oculto'); f.classList.remove('oculto');
    (i.nombre ? pass : $('nombre')).focus();
  } catch { malo('Sin conexión con la oficina. Revisa tu internet y recarga.'); }
})();
f.addEventListener('submit', async (e) => {
  e.preventDefault(); msg.textContent = '';
  if (!$('nombre').value.trim()) { msg.textContent = 'Escribe tu nombre.'; return $('nombre').focus(); }
  if (!reglas()) { msg.textContent = pass.value.length < 12 ? 'La contraseña debe tener 12 caracteres como mínimo.' : 'Las contraseñas no coinciden.'; return (pass.value.length < 12 ? pass : pass2).focus(); }
  boton.disabled = true; boton.textContent = 'Creando tu cuenta…';
  try {
    const r = await fetch(`/api/invitacion/${encodeURIComponent(testigo)}/aceptar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nombre: $('nombre').value, contrasena: pass.value }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'No se pudo crear la cuenta.');
    location.replace('/');
  } catch (x) {
    msg.textContent = x instanceof TypeError ? 'Sin conexión con la oficina. Revisa tu internet.' : x.message;
    boton.disabled = false; boton.textContent = 'Crear mi cuenta y entrar';
  }
});
