// Acceso. Enter envía (es un <form>); el error sale en una región role=alert; la contraseña se puede mostrar. Tras entrar, '/' ya es la oficina.
const $ = (id) => document.getElementById(id);
const f = $('f'), msg = $('msg'), boton = $('entrar'), pass = $('pass');
$('ojo').addEventListener('click', (e) => {
  const ver = pass.type === 'password';
  pass.type = ver ? 'text' : 'password';
  e.currentTarget.setAttribute('aria-pressed', String(ver));
});
f.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  const email = $('email').value.trim();
  if (!email || !pass.value) { msg.textContent = !email ? 'Escribe tu correo.' : 'Escribe tu contraseña.'; (!email ? $('email') : pass).focus(); return; }
  boton.disabled = true; boton.textContent = 'Entrando…'; f.setAttribute('aria-busy', 'true');
  try {
    const r = await fetch('/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, contrasena: pass.value }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'No se pudo entrar. Inténtalo otra vez.');
    location.replace('/'); // sin dejar el acceso en el historial: «atrás» no vuelve a pedir la contraseña
  } catch (x) {
    msg.textContent = x instanceof TypeError ? 'Sin conexión con la oficina. Revisa tu internet.' : x.message;
    boton.disabled = false; boton.textContent = 'Entrar'; f.removeAttribute('aria-busy'); pass.select();
  }
});
