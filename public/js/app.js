
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let categories = [];
let files = [];
let toastTimer;

const configured =
  window.EXITO_SUPABASE_URL &&
  window.EXITO_SUPABASE_ANON_KEY &&
  !window.EXITO_SUPABASE_URL.includes('PEGA_AQUI') &&
  !window.EXITO_SUPABASE_ANON_KEY.includes('PEGA_AQUI');

const db = configured && window.supabase
  ? window.supabase.createClient(
      window.EXITO_SUPABASE_URL,
      window.EXITO_SUPABASE_ANON_KEY
    )
  : null;

const BUCKET = 'portal-archivos';
const MAX_FILE_SIZE = 15 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'webp', 'gif',
  'pdf', 'xlsx', 'xls', 'csv'
];

const MIME_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv'
};

function ensureConfigured() {
  if (!db) {
    throw new Error(
      'Falta configurar Supabase. Revisa public/js/config.js.'
    );
  }
}

function throwIf(error) {
  if (error) throw new Error(error.message || 'Ocurrió un error.');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(filename) {
  return (filename.split('.').pop() || '').toLowerCase().trim();
}

function getMimeType(file) {
  const extension = getExtension(file.name);
  return file.type || MIME_TYPES[extension] || 'application/octet-stream';
}

function isImage(file) {
  return (file.mime_type || '').startsWith('image/');
}

function isSpreadsheet(file) {
  const mime = file.mime_type || '';
  return (
    mime.includes('spreadsheet') ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'text/csv' ||
    /\.(xlsx|xls|csv)$/i.test(file.original_name || '')
  );
}

function isPdf(file) {
  return file.mime_type === 'application/pdf' ||
    /\.pdf$/i.test(file.original_name || '');
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

function formatDate(value) {
  if (!value) return 'Guardado en la nube';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Guardado en la nube'
    : date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
}

function notify(message) {
  const el = $('#toast');
  if (!el) return;

  el.textContent = message;
  el.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

async function loadCategories() {
  ensureConfigured();

  const { data, error } = await db
    .from('categories')
    .select('id,name,description,created_at')
    .order('name');

  throwIf(error);

  const counts = {};

  files.forEach(file => {
    counts[file.category_id] = (counts[file.category_id] || 0) + 1;
  });

  categories = (data || []).map(category => ({
    ...category,
    file_count: counts[category.id] || 0
  }));

  optionsForCategories();
}

async function loadFiles() {
  ensureConfigured();

  const { data, error } = await db
    .from('files')
    .select(
      'id,title,original_name,mime_type,size,created_at,category_id,storage_path,public_url,categories(name)'
    )
    .order('created_at', { ascending: false });

  throwIf(error);

  files = (data || []).map(file => ({
    ...file,
    category_name: file.categories?.name || '',
    preview_url: file.public_url,
    size_label: formatBytes(Number(file.size))
  }));

  renderHome();
  renderGallery();
  renderDocuments();
  renderAdminFiles();
  renderCategories();
}

async function refresh() {
  await loadFiles();
  await loadCategories();

  renderHome();
  renderGallery();
  renderDocuments();
  renderAdminFiles();
  renderCategories();
}

function view(name) {
  const labels = {
    inicio: 'Inicio',
    galeria: 'Galería de imágenes',
    documentos: 'Documentos',
    categorias: 'Categorías',
    admin: 'Subir archivos'
  };

  if (!labels[name]) name = 'inicio';

  $$('.view').forEach(el => {
    el.classList.toggle('active', el.id === `view-${name}`);
  });

  $$('.nav-link').forEach(el => {
    el.classList.toggle('active', el.dataset.view === name);
  });

  if ($('#crumbTitle')) $('#crumbTitle').textContent = labels[name];
  if ($('#sidebar')) $('#sidebar').classList.remove('open');

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (name === 'galeria') renderGallery();
  if (name === 'documentos') renderDocuments();
  if (name === 'categorias') renderCategories();
  if (name === 'admin') renderAdminFiles();
}

function optionsForCategories() {
  const options = categories.map(category =>
    `<option value="${esc(category.id)}">${esc(category.name)}</option>`
  ).join('');

  if ($('#galleryCategory')) {
    $('#galleryCategory').innerHTML =
      `<option value="">Todas las categorías</option>${options}`;
  }

  if ($('#documentCategory')) {
    $('#documentCategory').innerHTML =
      `<option value="">Todas las categorías</option>${options}`;
  }

  if ($('#uploadCategory')) {
    $('#uploadCategory').innerHTML =
      `<option value="">Selecciona una categoría</option>${options}`;
  }
}

function fileTypeLabel(file) {
  if (isImage(file)) return 'IMG';
  if (isPdf(file)) return 'PDF';
  if (isSpreadsheet(file)) return 'EXCEL';
  return 'ARCHIVO';
}

function fileRow(file, admin = false) {
  const type = fileTypeLabel(file);
  const cssType =
    type === 'IMG' ? 'image' :
    type === 'EXCEL' ? 'spreadsheet' : '';

  return `
    <div class="file-row">
      <div class="file-type ${cssType}">${type}</div>
      <div class="file-info">
        <b>${esc(file.title)}</b>
        <small>
          ${esc(file.category_name || '')} ·
          ${esc(file.size_label || '')} ·
          ${esc(formatDate(file.created_at))}
        </small>
      </div>
      <span class="file-category">${esc(file.category_name || '')}</span>
      <button class="icon-action" data-preview="${esc(file.id)}">
        ${isSpreadsheet(file) ? 'Descargar' : 'Ver'}
      </button>
      ${admin ? `
        <button class="icon-action"
          data-delete="${esc(file.id)}"
          aria-label="Eliminar ${esc(file.title)}">
          Eliminar
        </button>
      ` : ''}
    </div>
  `;
}

function imageCard(file) {
  return `
    <article class="gallery-card">
      <div class="preview-area">
        <img loading="lazy"
          src="${esc(file.preview_url)}"
          alt="${esc(file.title)}">
      </div>
      <div class="gallery-meta">
        <div>
          <b>${esc(file.title)}</b>
          <small>
            ${esc(file.category_name || 'Sin categoría')} ·
            ${esc(file.size_label || '')}
          </small>
        </div>
        <button class="icon-action" data-preview="${esc(file.id)}">
          Ver
        </button>
      </div>
    </article>
  `;
}

function renderHome() {
  if (!$('#recentFiles')) return;

  $('#recentFiles').innerHTML =
    files.slice(0, 5).map(file => fileRow(file)).join('') ||
    '<p class="empty">Todavía no hay archivos. Ve a “Subir archivos” para añadir el primero.</p>';
}

function renderGallery() {
  if (!$('#galleryGrid')) return;

  const q = ($('#galleryQuery')?.value || '').trim().toLowerCase();
  const cat = $('#galleryCategory')?.value || '';

  const list = files.filter(file =>
    isImage(file) &&
    (!cat || String(file.category_id) === cat) &&
    `${file.title} ${file.original_name} ${file.category_name}`
      .toLowerCase().includes(q)
  );

  $('#galleryGrid').innerHTML = list.map(imageCard).join('');

  if ($('#galleryEmpty')) {
    $('#galleryEmpty').classList.toggle('hidden', list.length > 0);
  }
}

function renderDocuments() {
  if (!$('#documentList')) return;

  const q = ($('#documentQuery')?.value || '').trim().toLowerCase();
  const cat = $('#documentCategory')?.value || '';

  const list = files.filter(file =>
    !isImage(file) &&
    (!cat || String(file.category_id) === cat) &&
    `${file.title} ${file.original_name} ${file.category_name}`
      .toLowerCase().includes(q)
  );

  $('#documentList').innerHTML =
    list.map(file => fileRow(file)).join('');

  if ($('#documentEmpty')) {
    $('#documentEmpty').classList.toggle('hidden', list.length > 0);
  }
}

function renderCategories() {
  if (!$('#categoryGrid')) return;

  $('#categoryGrid').innerHTML = categories.map(category => `
    <button class="category-card" data-category="${esc(category.id)}">
      <span class="category-icon">▦</span>
      <b>${esc(category.name)}</b>
      <p>${esc(category.description || 'Recursos de esta categoría.')}</p>
      <small>${category.file_count || 0} archivo(s) →</small>
    </button>
  `).join('');
}

function renderAdminFiles() {
  if (!$('#adminFileList')) return;

  $('#adminFileList').innerHTML =
    files.map(file => fileRow(file, true)).join('') ||
    '<p class="empty">No hay archivos cargados todavía.</p>';
}

function openPreview(file) {
  if (isSpreadsheet(file)) {
    const link = document.createElement('a');
    link.href = file.preview_url;
    link.download = file.original_name || file.title;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  const preview = isImage(file)
    ? `<img src="${esc(file.preview_url)}" alt="${esc(file.title)}">`
    : `<iframe title="Vista previa de ${esc(file.title)}"
        src="${esc(file.preview_url)}#toolbar=0&navpanes=0"
        loading="lazy"></iframe>`;

  $('#modalBody').innerHTML = `
    <h2 id="modalTitle">${esc(file.title)}</h2>
    <p>${esc(file.category_name || '')} · ${esc(file.size_label || '')}</p>
    ${preview}
    <p>Archivo alojado en la nube. Compártelo solo con personas autorizadas.</p>
  `;

  $('#overlay').classList.remove('hidden');
  $('#modalClose').focus();
}

document.addEventListener('click', async event => {
  const nav = event.target.closest('[data-view]');

  if (nav) {
    event.preventDefault();
    view(nav.dataset.view);
    return;
  }

  const preview = event.target.closest('[data-preview]');

  if (preview) {
    const file = files.find(item =>
      String(item.id) === String(preview.dataset.preview)
    );

    if (file) openPreview(file);
    return;
  }

  const del = event.target.closest('[data-delete]');

  if (del) {
    const file = files.find(item =>
      String(item.id) === String(del.dataset.delete)
    );

    if (!file || !confirm(`¿Eliminar "${file.title}" del portal?`)) return;

    try {
      ensureConfigured();

      const { error: storageError } = await db.storage
        .from(BUCKET)
        .remove([file.storage_path]);

      throwIf(storageError);

      const { error } = await db
        .from('files')
        .delete()
        .eq('id', file.id);

      throwIf(error);

      await refresh();
      notify('Archivo eliminado.');
    } catch (err) {
      notify(err.message);
    }

    return;
  }

  const cat = event.target.closest('[data-category]');

  if (cat) {
    const id = cat.dataset.category;
    const category = categories.find(item =>
      String(item.id) === String(id)
    );

    if (!category) return;

    if ($('#galleryCategory')) $('#galleryCategory').value = id;
    if ($('#documentCategory')) $('#documentCategory').value = id;

    const hasImages = files.some(file =>
      String(file.category_id) === String(id) && isImage(file)
    );

    view(hasImages ? 'galeria' : 'documentos');

    if (hasImages) renderGallery();
    else renderDocuments();
  }
});

if ($('#menuToggle')) {
  $('#menuToggle').addEventListener('click', () =>
    $('#sidebar')?.classList.toggle('open')
  );
}

if ($('#galleryQuery')) $('#galleryQuery').addEventListener('input', renderGallery);
if ($('#galleryCategory')) $('#galleryCategory').addEventListener('change', renderGallery);
if ($('#documentQuery')) $('#documentQuery').addEventListener('input', renderDocuments);
if ($('#documentCategory')) $('#documentCategory').addEventListener('change', renderDocuments);

if ($('#globalSearch')) {
  $('#globalSearch').addEventListener('submit', event => {
    event.preventDefault();

    const q = $('#globalQuery').value.trim();

    if ($('#documentQuery')) $('#documentQuery').value = q;
    if ($('#galleryQuery')) $('#galleryQuery').value = q;

    view('documentos');
    renderDocuments();

    if ($('#documentList') && !$('#documentList').children.length) {
      view('galeria');
      renderGallery();
    }
  });
}

if ($('#uploadForm')) {
  $('#uploadForm').addEventListener('submit', async event => {
    event.preventDefault();

    const file = $('#fileInput')?.files?.[0];
    const categoryId = $('#uploadCategory')?.value;

    if (!file || !categoryId) {
      $('#uploadStatus').textContent =
        'Selecciona un archivo y una categoría.';
      return;
    }

    const extension = getExtension(file.name);

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      $('#uploadStatus').textContent =
        'Formatos permitidos: JPG, PNG, WebP, GIF, PDF, Excel (.xlsx, .xls) y CSV.';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      $('#uploadStatus').textContent =
        'El archivo supera el límite de 15 MB.';
      return;
    }

    $('#uploadStatus').textContent = 'Subiendo archivo a la nube...';

    try {
      ensureConfigured();

      const mimeType = getMimeType(file);
      const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, '');
      const storagePath = `${crypto.randomUUID()}.${safeExtension}`;

      const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(storagePath, file, {
          contentType: mimeType,
          upsert: false
        });

      throwIf(uploadError);

      const { data: publicData } = db.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);

      const title =
        $('#fileTitle')?.value.trim() ||
        file.name.replace(/\.[^.]+$/, '');

      const { error: insertError } = await db.from('files').insert({
        title,
        category_id: Number(categoryId),
        original_name: file.name,
        storage_path: storagePath,
        public_url: publicData.publicUrl,
        mime_type: mimeType,
        size: file.size
      });

      if (insertError) {
        await db.storage.from(BUCKET).remove([storagePath]);
        throw insertError;
      }

      $('#uploadStatus').textContent =
        'Archivo guardado en la nube correctamente.';

      $('#uploadForm').reset();

      await refresh();
      notify('Archivo guardado.');
    } catch (err) {
      $('#uploadStatus').textContent =
        err.message || 'No se pudo subir el archivo.';
    }
  });
}

if ($('#categoryForm')) {
  $('#categoryForm').addEventListener('submit', async event => {
    event.preventDefault();

    try {
      ensureConfigured();

      const name = $('#newCategoryName').value.trim();
      const description = $('#newCategoryDescription').value.trim();

      if (!name) {
        throw new Error('El nombre de la categoría es obligatorio.');
      }

      const { error } = await db
        .from('categories')
        .insert({ name, description });

      throwIf(error);

      $('#categoryStatus').textContent = 'Categoría creada.';
      $('#categoryForm').reset();

      await refresh();
      notify('Categoría creada.');
    } catch (err) {
      $('#categoryStatus').textContent = err.message;
    }
  });
}

if ($('#modalClose')) {
  $('#modalClose').addEventListener('click', () =>
    $('#overlay')?.classList.add('hidden')
  );
}

if ($('#overlay')) {
  $('#overlay').addEventListener('click', event => {
    if (event.target === $('#overlay')) {
      $('#overlay').classList.add('hidden');
    }
  });
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    $('#overlay')?.classList.add('hidden');
  }
});

(async function init() {
  if (!db) {
    notify('Configura Supabase siguiendo el README.');
    return;
  }

  try {
    await refresh();
  } catch (err) {
    notify(`No se pudo conectar con Supabase: ${err.message}`);
  }
})();
