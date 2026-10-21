const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let categories = [];
let files = [];
let toastTimer;

const configured = window.EXITO_SUPABASE_URL && window.EXITO_SUPABASE_ANON_KEY &&
  !window.EXITO_SUPABASE_URL.includes('PEGA_AQUI') && !window.EXITO_SUPABASE_ANON_KEY.includes('PEGA_AQUI');
const db = configured && window.supabase ? window.supabase.createClient(window.EXITO_SUPABASE_URL, window.EXITO_SUPABASE_ANON_KEY) : null;
const BUCKET = 'portal-archivos';

function ensureConfigured() {
  if (!db) throw new Error('Falta configurar Supabase. Sigue los pasos del README y completa public/js/config.js.');
}
function throwIf(error) { if (error) throw new Error(error.message || 'Ocurrió un error.'); }
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
async function loadCategories() {
  ensureConfigured();
  const { data, error } = await db.from('categories').select('id,name,description,created_at').order('name');
  throwIf(error);
  const counts = {};
  files.forEach(f => counts[f.category_id] = (counts[f.category_id] || 0) + 1);
  categories = (data || []).map(c => ({...c, file_count: counts[c.id] || 0}));
  optionsForCategories();
}
async function loadFiles() {
  ensureConfigured();
  const { data, error } = await db.from('files').select('id,title,original_name,mime_type,size,created_at,category_id,storage_path,public_url,categories(name)').order('created_at', {ascending:false});
  throwIf(error);
  files = (data || []).map(f => ({...f, category_name: f.categories?.name || '', preview_url: f.public_url, size_label: formatBytes(Number(f.size))}));
  renderHome(); renderGallery(); renderDocuments(); renderAdminFiles(); renderCategories();
}
async function refresh() { await loadFiles(); await loadCategories(); renderHome(); renderGallery(); renderDocuments(); renderAdminFiles(); renderCategories(); }
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function formatDate(value) {
  if (!value) return 'Guardado en la nube';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Guardado en la nube' : date.toLocaleDateString('es-CO',{year:'numeric',month:'short',day:'numeric'});
}
function notify(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
function view(name) {
  const labels = {inicio:'Inicio',galeria:'Galería de imágenes',documentos:'Documentos',categorias:'Categorías',admin:'Subir archivos'};
  if (!labels[name]) name = 'inicio';
  $$('.view').forEach(el => el.classList.toggle('active', el.id === `view-${name}`));
  $$('.nav-link').forEach(el => el.classList.toggle('active', el.dataset.view === name));
  $('#crumbTitle').textContent = labels[name]; $('#sidebar').classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
  if (name === 'galeria') renderGallery(); if (name === 'documentos') renderDocuments();
  if (name === 'categorias') renderCategories(); if (name === 'admin') renderAdminFiles();
}
function optionsForCategories() {
  const options = categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('#galleryCategory').innerHTML = `<option value="">Todas las categorías</option>${options}`;
  $('#documentCategory').innerHTML = `<option value="">Todas las categorías</option>${options}`;
  $('#uploadCategory').innerHTML = `<option value="">Selecciona una categoría</option>${options}`;
}
function fileRow(f, admin = false) {
  const type = f.mime_type === 'application/pdf' ? 'PDF' : 'IMG';
  return `<div class="file-row"><div class="file-type ${type === 'IMG' ? 'image' : ''}">${type}</div><div class="file-info"><b>${esc(f.title)}</b><small>${esc(f.category_name || '')} · ${esc(f.size_label || '')} · ${esc(formatDate(f.created_at))}</small></div><span class="file-category">${esc(f.category_name || '')}</span><button class="icon-action" data-preview="${f.id}">Ver</button>${admin ? `<button class="icon-action" data-delete="${f.id}" aria-label="Eliminar ${esc(f.title)}">Eliminar</button>` : ''}</div>`;
}
function imageCard(f) {
  const isImage = f.mime_type.startsWith('image/');
  return `<article class="gallery-card"><div class="preview-area ${isImage ? '' : 'pdf-preview'}">${isImage ? `<img loading="lazy" src="${esc(f.preview_url)}" alt="${esc(f.title)}">` : '<span class="pdf-glyph">PDF</span>'}</div><div class="gallery-meta"><div><b>${esc(f.title)}</b><small>${esc(f.category_name || 'Sin categoría')} · ${esc(f.size_label || '')}</small></div><button class="icon-action" data-preview="${f.id}">Ver</button></div></article>`;
}
function renderHome() { $('#recentFiles').innerHTML = files.slice(0,5).map(f => fileRow(f)).join('') || '<p class="empty">Todavía no hay archivos. Ve a “Subir archivos” para añadir el primero.</p>'; }
function renderGallery() {
  if (!$('#galleryGrid')) return;
  const q = ($('#galleryQuery').value || '').trim().toLowerCase(), cat = $('#galleryCategory').value;
  const list = files.filter(f => f.mime_type.startsWith('image/') && (!cat || String(f.category_id) === cat) && `${f.title} ${f.original_name} ${f.category_name}`.toLowerCase().includes(q));
  $('#galleryGrid').innerHTML = list.map(imageCard).join(''); $('#galleryEmpty').classList.toggle('hidden', list.length > 0);
}
function renderDocuments() {
  const q = ($('#documentQuery').value || '').trim().toLowerCase(), cat = $('#documentCategory').value;
  const list = files.filter(f => !f.mime_type.startsWith('image/') && (!cat || String(f.category_id) === cat) && `${f.title} ${f.original_name} ${f.category_name}`.toLowerCase().includes(q));
  $('#documentList').innerHTML = list.map(f => fileRow(f)).join(''); $('#documentEmpty').classList.toggle('hidden', list.length > 0);
}
function renderCategories() {
  $('#categoryGrid').innerHTML = categories.map(c => `<button class="category-card" data-category="${c.id}"><span class="category-icon">▦</span><b>${esc(c.name)}</b><p>${esc(c.description || 'Recursos de esta categoría.')}</p><small>${c.file_count || 0} archivo(s) →</small></button>`).join('');
}
function renderAdminFiles() { $('#adminFileList').innerHTML = files.map(f => fileRow(f, true)).join('') || '<p class="empty">No hay archivos cargados todavía.</p>'; }
function openPreview(f) {
  const isImage = f.mime_type.startsWith('image/');
  $('#modalBody').innerHTML = `<h2 id="modalTitle">${esc(f.title)}</h2><p>${esc(f.category_name || '')} · ${esc(f.size_label || '')}</p>${isImage ? `<img src="${esc(f.preview_url)}" alt="${esc(f.title)}">` : `<iframe title="Vista previa de ${esc(f.title)}" src="${esc(f.preview_url)}#toolbar=0&navpanes=0" loading="lazy"></iframe>`}<p>Archivo alojado en la nube. Los archivos de este prototipo se guardan en un bucket público: cualquier persona con el enlace directo podría abrirlos.</p>`;
  $('#overlay').classList.remove('hidden'); $('#modalClose').focus();
}
document.addEventListener('click', async e => {
  const nav = e.target.closest('[data-view]'); if (nav) { e.preventDefault(); view(nav.dataset.view); return; }
  const preview = e.target.closest('[data-preview]');
  if (preview) { const f = files.find(x => x.id === Number(preview.dataset.preview)); if (f) openPreview(f); return; }
  const del = e.target.closest('[data-delete]');
  if (del) {
    const f = files.find(x => x.id === Number(del.dataset.delete)); if (!f || !confirm(`¿Eliminar "${f.title}" del portal?`)) return;
    try {
      ensureConfigured();
      const {error:storageError} = await db.storage.from(BUCKET).remove([f.storage_path]); throwIf(storageError);
      const {error} = await db.from('files').delete().eq('id', f.id); throwIf(error);
      await refresh(); notify('Archivo eliminado.');
    } catch (err) { notify(err.message); }
    return;
  }
  const cat = e.target.closest('[data-category]');
  if (cat) { const id = cat.dataset.category; const category = categories.find(c => c.id === Number(id)); if (!category) return;
    $('#galleryCategory').value = id; $('#documentCategory').value = id;
    const hasImages = files.some(f => f.category_id === Number(id) && f.mime_type.startsWith('image/'));
    view(hasImages ? 'galeria' : 'documentos'); if (!hasImages) renderDocuments(); else renderGallery(); }
});
$('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#galleryQuery').addEventListener('input', renderGallery); $('#galleryCategory').addEventListener('change', renderGallery);
$('#documentQuery').addEventListener('input', renderDocuments); $('#documentCategory').addEventListener('change', renderDocuments);
$('#globalSearch').addEventListener('submit', e => { e.preventDefault(); const q = $('#globalQuery').value.trim(); $('#documentQuery').value = q; $('#galleryQuery').value = q; view('documentos'); renderDocuments(); if (!$('#documentList').children.length) { view('galeria'); renderGallery(); } });
$('#uploadForm').addEventListener('submit', async e => {
  e.preventDefault(); const file = $('#fileInput').files[0], categoryId = $('#uploadCategory').value;
  if (!file || !categoryId) { $('#uploadStatus').textContent = 'Selecciona un archivo y una categoría.'; return; }
  const allowed = ['image/jpeg','image/png','image/webp','image/gif','application/pdf'];
  if (!allowed.includes(file.type)) { $('#uploadStatus').textContent = 'Solo se permiten JPG, PNG, WebP, GIF y PDF.'; return; }
  if (file.size > 15 * 1024 * 1024) { $('#uploadStatus').textContent = 'El archivo supera el límite de 15 MB.'; return; }
  $('#uploadStatus').textContent = 'Subiendo archivo a la nube...';
  try {
    ensureConfigured();
    const ext = (file.name.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
    const storagePath = `${crypto.randomUUID()}.${ext}`;
    const {error:uploadError} = await db.storage.from(BUCKET).upload(storagePath, file, {contentType:file.type,upsert:false}); throwIf(uploadError);
    const {data:publicData} = db.storage.from(BUCKET).getPublicUrl(storagePath);
    const title = $('#fileTitle').value.trim() || file.name.replace(/\.[^.]+$/,'');
    const {error:insertError} = await db.from('files').insert({title,category_id:Number(categoryId),original_name:file.name,storage_path:storagePath,public_url:publicData.publicUrl,mime_type:file.type,size:file.size});
    if (insertError) { await db.storage.from(BUCKET).remove([storagePath]); throw insertError; }
    $('#uploadStatus').textContent = 'Archivo guardado en la nube correctamente.'; $('#uploadForm').reset(); await refresh(); notify('Archivo guardado.');
  } catch (err) { $('#uploadStatus').textContent = err.message; }
});
$('#categoryForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    ensureConfigured(); const name = $('#newCategoryName').value.trim(), description = $('#newCategoryDescription').value.trim();
    if (!name) throw new Error('El nombre de la categoría es obligatorio.');
    const {error} = await db.from('categories').insert({name,description}); throwIf(error);
    $('#categoryStatus').textContent = 'Categoría creada.'; $('#categoryForm').reset(); await refresh(); notify('Categoría creada.');
  } catch (err) { $('#categoryStatus').textContent = err.message; }
});
$('#modalClose').addEventListener('click', () => $('#overlay').classList.add('hidden'));
$('#overlay').addEventListener('click', e => { if (e.target === $('#overlay')) $('#overlay').classList.add('hidden'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#overlay').classList.add('hidden'); });
(async function init() {
  if (!db) { notify('Configura Supabase siguiendo el README.'); return; }
  try { await refresh(); } catch (err) { notify(`No se pudo conectar con Supabase: ${err.message}`); }
})();
