const $ = (id) => document.getElementById(id);
const msg = (t) => { $('msg').textContent = t || ''; };
async function api(ruta, opts = {}) {
  const r = await fetch(ruta, { ...opts, headers: { 'content-type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || `Error ${r.status}`), { estado: r.status });
  return d;
}
const lista = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
async function conectores() {
  const { conectores: cs } = await api('/api/conectores');
  const raiz = $('conectores'); raiz.textContent = '';
  if (!cs.length) { raiz.textContent = 'Todavía no hay conectores.'; return; }
  for (const c of cs) {
    const d = document.createElement('div'); d.className = 'card';
    const t = document.createElement('strong'); t.textContent = c.nombre;
    const p = document.createElement('div'); p.className = 'mut';
    p.textContent = `${c.url} · ${c.departamentos.join(', ') || 'sin departamentos'} · ${c.secreto ? (c.tokenPuesto ? 'token puesto' : 'FALTA el secreto ' + c.secreto) : 'sin token'}`;
    const b = document.createElement('button'); b.className = 'sec'; b.textContent = 'Quitar';
    b.onclick = async () => { await api('/api/conectores/' + c.nombre, { method: 'DELETE' }); conectores(); };
    d.append(t, p, b); raiz.append(d);
  }
}
async function entrar() {
  try {
    const { usuario } = await api('/api/yo');
    $('login').hidden = true; $('app').hidden = false; $('quien').textContent = `${usuario.email} (${usuario.rol})`;
    const { agentes } = await api('/api/agentes');
    $('agente').replaceChildren(...agentes.map((a) => Object.assign(document.createElement('option'), { value: a.id, textContent: `${a.name} — ${a.role}` })));
    await conectores();
  } catch { $('login').hidden = false; $('app').hidden = true; }
}
$('login').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/acceso', { method: 'POST', body: { email: $('email').value, contrasena: $('pass').value } }); msg(''); entrar(); } catch (x) { msg(x.message); } };
$('salir').onclick = async () => { await api('/api/salir', { method: 'POST' }); entrar(); };
$('ir').onclick = async () => {
  msg('Trabajando…'); $('resultado').hidden = true;
  try {
    const r = await api(`/api/agentes/${$('agente').value}/ejecutar`, { method: 'POST', body: { texto: $('texto').value, aprobada: $('aprob').checked } });
    $('salida').textContent = (r.aviso ? r.aviso + '\n\n' : '') + r.texto; $('resultado').hidden = false; msg('');
  } catch (x) { msg(x.message); }
};
$('nuevo').onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api('/api/conectores', { method: 'POST', body: { nombre: $('c-nombre').value, url: $('c-url').value, secreto: $('c-secreto').value, departamentos: lista($('c-deps').value), herramientas_lectura: lista($('c-lect').value), herramientas_envio: lista($('c-env').value) } });
    e.target.reset(); msg('Conector guardado.'); conectores();
  } catch (x) { msg(x.message); }
};
entrar();
