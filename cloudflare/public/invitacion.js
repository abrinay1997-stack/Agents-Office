// Aceptar una invitación: /invitacion/<testigo>. El testigo es de un solo uso; el servidor decide el correo y el rol (esta página solo muestra).
const $ = (id) => document.getElementById(id);
// El testigo se lee UNA vez de la dirección y se saca de ella (historial, capturas, «copiar enlace»); una recarga lo recupera de sessionStorage.
// Nunca viaja en la ruta de la API: va en el cuerpo de un POST.
let testigo = (location.pathname.match(/^\/invitacion\/([0-9a-f]{1,64})$/) || [])[1] || '';
try { if (testigo) { sessionStorage.setItem('ao.inv', testigo); history.replaceState(null, '', '/invitacion'); } else testigo = sessionStorage.getItem('ao.inv') || ''; } catch { /* sin almacenamiento: la dirección con el testigo se queda */ }
const post = (ruta, cuerpo) => fetch(ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ testigo, ...cuerpo }) });
const ROL = { admin: 'administrador (puede aprobar, gastar y gestionar el equipo)', editor: 'editor (trabaja con los agentes, sin aprobar ni gastar)', lectura: 'lectura (solo mira)' };
let reinicio = false;
const f = $('f'), msg = $('msg'), pass = $('pass'), pass2 = $('pass2'), boton = $('entrar');
function malo(t) { $('cargando').classList.add('oculto'); $('mala').classList.remove('oculto'); $('malaTxt').textContent = t; }
$('ojo').addEventListener('click', (e) => {
  const ver = pass.type === 'password';
  pass.type = pass2.type = ver ? 'text' : 'password';
  e.currentTarget.setAttribute('aria-pressed', String(ver));
});
function reglas() {
  const ok = { largo: pass.value.length >= 12, igual: pass.value !== '' && pass.value === pass2.value };
  for (const li of document.querySelectorAll('#reglas li')) li.classList.toggle('ok', ok[li.dataset.r]);
  return ok.largo && ok.igual;
}
pass.addEventListener('input', reglas); pass2.addEventListener('input', reglas);
(async () => {
  try {
    const r = await post('/api/invitacion/ver');
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return malo(d.error || 'No se pudo comprobar la invitación.');
    const i = d.invitacion;
    reinicio = i.tipo === 'reinicio';
    $('quien').textContent = reinicio ? `${i.invita} te dio este enlace para que pongas una contraseña nueva.` : `${i.invita} te invita como ${ROL[i.rol] || i.rol}.`;
    if (reinicio) { document.querySelector('h1').textContent = 'Pon tu contraseña nueva'; boton.textContent = 'Guardar y entrar'; $('nombre').closest('.campo').classList.add('oculto'); }
    $('email').value = i.email; $('nombre').value = i.nombre || '';
    $('cargando').classList.add('oculto'); f.classList.remove('oculto');
    (i.nombre ? pass : $('nombre')).focus();
  } catch { malo('Sin conexión con la oficina. Revisa tu internet y recarga.'); }
})();
f.addEventListener('submit', async (e) => {
  e.preventDefault(); msg.textContent = '';
  if (!reinicio && !$('nombre').value.trim()) { msg.textContent = 'Escribe tu nombre.'; return $('nombre').focus(); }
  if (!reglas()) { msg.textContent = pass.value.length < 12 ? 'La contraseña debe tener 12 caracteres como mínimo.' : 'Las contraseñas no coinciden.'; return (pass.value.length < 12 ? pass : pass2).focus(); }
  boton.disabled = true; boton.textContent = 'Creando tu cuenta…';
  try {
    const r = await post('/api/invitacion/aceptar', { nombre: $('nombre').value, contrasena: pass.value });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'No se pudo crear la cuenta.');
    try { sessionStorage.removeItem('ao.inv'); } catch { /* da igual */ }
    location.replace('/'); // con una invitación entra solo; tras restablecer la contraseña, el acceso le pide la nueva
  } catch (x) {
    msg.textContent = x instanceof TypeError ? 'Sin conexión con la oficina. Revisa tu internet.' : x.message;
    boton.disabled = false; boton.textContent = reinicio ? 'Guardar y entrar' : 'Crear mi cuenta y entrar';
  }
});
