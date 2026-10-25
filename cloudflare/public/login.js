document.getElementById('f').onsubmit = async (e) => {
  e.preventDefault();
  const msg = document.getElementById('msg'); msg.textContent = '';
  try {
    const r = await fetch('/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: document.getElementById('email').value, contrasena: document.getElementById('pass').value }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'No se pudo entrar.');
    location.href = '/';
  } catch (x) { msg.textContent = x.message; }
};
