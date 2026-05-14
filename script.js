/* =============================================
   PokéVault — script.js
   ============================================= */

'use strict';

// =============================================
// STATE
// =============================================
const STORAGE_KEY = 'pokevault_cards';

let state = {
  cards: [],
  view: 'home',
  search: '',
  filter: 'all',
  sort: 'recent',
  pendingDeleteId: null,
  draftImageData: '',
};

// =============================================
// LOCALSTORAGE
// =============================================
function saveCards() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cards));
  } catch (_) {}
}

function loadCards() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      state.cards = [];
      return;
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      state.cards = [];
      return;
    }

    state.cards = parsed.map(normalizeCard);
    saveCards();
  } catch (_) {
    state.cards = [];
  }
}

function normalizeCard(card) {
  const marketValue = card.marketValue || card.value || '';
  const purchaseCost = card.purchaseCost || '';

  return {
    id: card.id || generateId(),
    name: card.name || 'Untitled Card',
    imageUrl: card.imageUrl || '',
    imageData: card.imageData || '',
    type: card.type || 'Normal',
    status: String(card.status || 'owned').toLowerCase(),
    favorite: !!card.favorite,
    conditionType: card.conditionType || 'Raw',
    grade: card.grade || '',
    collection: card.collection || 'Personal',
    intent: String(card.intent || 'hold').toLowerCase(),
    purchaseCost: String(purchaseCost || ''),
    marketValue: String(marketValue || ''),
    notes: card.notes || '',
    acquisitionDate: card.acquisitionDate || '',
    soldPrice: card.soldPrice || '',
    soldDate: card.soldDate || '',
    createdAt: card.createdAt || new Date().toISOString(),
    updatedAt: card.updatedAt || new Date().toISOString(),
  };
}

// =============================================
// HELPERS
// =============================================
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatValue(value) {
  const num = parseFloat(value);
  if (isNaN(num) || num === 0) return null;
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function getTypeEmoji(type) {
  const map = {
    Fire: '🔥', Water: '💧', Grass: '🌿', Electric: '⚡',
    Psychic: '🔮', Dark: '🌑', Steel: '⚙️', Dragon: '🐉',
    Fairy: '🧚', Fighting: '🥊', Flying: '🦅', Poison: '☠️',
    Ground: '🪨', Rock: '🪵', Bug: '🐛', Ghost: '👻',
    Ice: '❄️', Normal: '⭐',
  };
  return map[type] || '⭐';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// =============================================
// PHASE 2 HELPERS
// =============================================
function conditionLabel(card) {
  const type = card.conditionType || 'Raw';
  const grade = card.grade;
  if (!grade || type === 'Raw') return type;
  return `${type} ${grade}`;
}

function intentBadgeClass(intent) {
  const key = String(intent || 'hold').toLowerCase();

  const map = {
    hold: 'badge-intent-hold',
    sell: 'badge-intent-sell',
    trade: 'badge-intent-trade',
    grade: 'badge-intent-grade',
  };

  return map[key] || 'badge-intent-hold';
}

function collectionShort(col) {
  return col === 'Business Inventory' ? 'Business' : (col || 'Personal');
}

function formatPL(purchaseCost, marketValue) {
  const cost = parseFloat(purchaseCost);
  const market = parseFloat(marketValue);
  if (isNaN(cost) || isNaN(market)) return null;

  const diff = market - cost;
  const cls = diff > 0 ? 'pos' : diff < 0 ? 'neg' : 'zero';
  const prefix = diff > 0 ? '+' : diff < 0 ? '-' : '';
  const abs = Math.abs(diff).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  return { text: `${prefix}${abs}`, cls };
}

// =============================================
// FILTER LOGIC
// =============================================
function getFilteredCards() {
  const q = state.search.trim().toLowerCase();

  let filtered = state.cards.filter(card => {
    if (state.view === 'home') {
      return (
        card.status === 'owned' ||
        card.status === 'listed' ||
        card.status === 'trade-pending'
      );
    }

    if (state.view === 'wishlist') return card.status === 'wishlist';
    if (state.view === 'sold') return card.status === 'sold';

    return false;
  });

  if (q) {
    filtered = filtered.filter(card =>
      String(card.name || '').toLowerCase().includes(q) ||
      String(card.type || '').toLowerCase().includes(q) ||
      String(card.collection || '').toLowerCase().includes(q) ||
      String(card.intent || '').toLowerCase().includes(q)
    );
  }

  if (state.filter === 'hold') {
    filtered = filtered.filter(card => card.intent === 'hold');
  }

  if (state.filter === 'sell') {
    filtered = filtered.filter(card => card.intent === 'sell');
  }

  if (state.filter === 'trade') {
    filtered = filtered.filter(card => card.intent === 'trade');
  }

  if (state.filter === 'favorite') {
    filtered = filtered.filter(card => card.favorite);
  }

  filtered.sort((a, b) => {
    const aMarket = parseFloat(a.marketValue) || 0;
    const bMarket = parseFloat(b.marketValue) || 0;
    const aCost = parseFloat(a.purchaseCost) || 0;
    const bCost = parseFloat(b.purchaseCost) || 0;
    const aSold = parseFloat(a.soldPrice) || 0;
    const bSold = parseFloat(b.soldPrice) || 0;

    if (state.sort === 'highValue') return bMarket - aMarket;
    if (state.sort === 'lowValue') return aMarket - bMarket;

    if (state.sort === 'profit') {
      const aProfit = a.status === 'sold' ? aSold - aCost : aMarket - aCost;
      const bProfit = b.status === 'sold' ? bSold - bCost : bMarket - bCost;
      return bProfit - aProfit;
    }

    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  return filtered;
}

// =============================================
// RENDER
// =============================================
function render() {
  const filtered = getFilteredCards();
  renderGrid(filtered);
  renderSectionHeader(filtered.length);
  renderHeaderStats();
  renderNavActive();
  renderFilterActive();
  renderEmptyState(filtered.length);
}

function renderGrid(cards) {
  const grid = document.getElementById('card-grid');
  const existing = {};

  for (const el of grid.children) {
    existing[el.dataset.id] = el;
  }

  const fragment = document.createDocumentFragment();
  const newIds = new Set();

  for (const card of cards) {
    newIds.add(card.id);

    let el = existing[card.id];

    if (!el) {
      el = buildCardElement(card);
    } else {
      updateCardElement(el, card);
    }

    fragment.appendChild(el);
  }

  for (const id in existing) {
    if (!newIds.has(id)) existing[id].remove();
  }

  grid.appendChild(fragment);
}

function buildCardElement(card) {
  const el = document.createElement('div');
  el.className = 'poke-card';
  el.dataset.id = card.id;
  el.setAttribute('data-type', card.type);
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `View ${card.name}`);
  updateCardElement(el, card);
  return el;
}

function updateCardElement(el, card) {
  el.dataset.id = card.id;
  el.setAttribute('data-type', card.type);
  el.classList.toggle('is-favorite', !!card.favorite);
  el.classList.toggle('is-sold', card.status === 'sold');

  const formattedValue = formatValue(card.marketValue);
  const isSold = card.status === 'sold';
  const isListed = card.status === 'listed';
  const isTradePending = card.status === 'trade-pending';

  el.innerHTML = `
    <div class="card-image-wrap">
      ${(card.imageData || card.imageUrl)
        ? `<img class="card-image" src="${escapeHtml(card.imageData || card.imageUrl)}" alt="${escapeHtml(card.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="card-placeholder" style="display:none">${getTypeEmoji(card.type)}</div>`
        : `<div class="card-placeholder">${getTypeEmoji(card.type)}</div>`
      }
      <span class="card-type-badge">${escapeHtml(card.type)}</span>
      ${isSold ? '<span class="card-sold-badge">Sold</span>' : ''}
      ${isListed ? '<span class="card-listed-badge">Listed</span>' : ''}
      ${isTradePending ? '<span class="card-trade-badge">Trade</span>' : ''}
      ${card.favorite ? '<span class="card-fav-dot">⭐</span>' : ''}
    </div>

    <div class="card-info">
      <div class="card-name">${escapeHtml(card.name)}</div>

      <div class="card-badges">
        <span class="card-badge badge-condition">${escapeHtml(conditionLabel(card))}</span>
        <span class="card-badge ${intentBadgeClass(card.intent)}">${escapeHtml((card.intent || 'hold').toUpperCase())}</span>
        <span class="card-badge badge-collection">${escapeHtml(collectionShort(card.collection || 'Personal'))}</span>
      </div>

      <div class="card-meta">
        ${formattedValue
          ? `<span class="card-value">${formattedValue}</span>`
          : `<span class="card-value-empty">No value</span>`
        }
      </div>

      <div class="card-actions">
        <button class="card-action-btn btn-edit" data-action="edit" data-id="${card.id}">Edit</button>
        <button class="card-action-btn btn-fav ${card.favorite ? 'is-active' : ''}" data-action="fav" data-id="${card.id}">${card.favorite ? '⭐' : '☆'}</button>
        <button class="card-action-btn btn-sell ${isSold ? 'is-sold' : ''}" data-action="sell" data-id="${card.id}">${isSold ? '↩' : '💰'}</button>
      </div>
    </div>
  `;
}

function renderSectionHeader(count) {
  const titles = { home: 'My Collection', wishlist: 'Wishlist', sold: 'Sold Cards' };
  document.getElementById('section-title').textContent = titles[state.view] || 'Cards';
  document.getElementById('section-count').textContent = `${count} card${count !== 1 ? 's' : ''}`;
}

function renderHeaderStats() {
  const total = state.cards.filter(c => c.status === 'owned').length;

  const value = state.cards
    .filter(c => c.status !== 'sold')
    .reduce((sum, c) => sum + (parseFloat(c.marketValue) || 0), 0);

  const el = document.getElementById('header-stats');

  if (total === 0) {
    el.textContent = '';
    return;
  }

  el.textContent = `${total} owned · ${formatValue(value) || '$0'}`;
}

function renderNavActive() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === state.view);
  });
}

function renderFilterActive() {
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === state.filter);
  });

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.value = state.sort;
}

function renderEmptyState(count) {
  document.getElementById('empty-state').hidden = count > 0;
}

// =============================================
// DETAIL VIEW
// =============================================
function openDetail(id) {
  const card = state.cards.find(c => c.id === id);
  if (!card) return;

  const formattedValue = formatValue(card.marketValue);
  const isSold = card.status === 'sold';
  const isWishlist = card.status === 'wishlist';
  const isListed = card.status === 'listed';
  const isTradePending = card.status === 'trade-pending';

  const pl = isSold
    ? formatPL(card.purchaseCost, card.soldPrice)
    : formatPL(card.purchaseCost, card.marketValue);

  const plLabel = isSold ? 'Realized Profit / Loss' : 'Est. Profit / Loss';

  const plHTML = pl
    ? `<div class="detail-profit">
        <span class="detail-profit-label">${plLabel}</span>
        <span class="detail-profit-value ${pl.cls}">${pl.text}</span>
       </div>`
    : '';

  const notesHTML = card.notes
    ? `<div class="detail-notes-wrap">
        <div class="detail-notes-label">Notes</div>
        <div class="detail-notes-text">${escapeHtml(card.notes)}</div>
       </div>`
    : '';

  function fmtDate(d) {
    if (!d) return null;
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const acqDateStr = fmtDate(card.acquisitionDate);
  const soldDateStr = fmtDate(card.soldDate);

  const content = document.getElementById('detail-content');

  content.innerHTML = `
    <div class="detail-image-wrap">
      ${(card.imageData || card.imageUrl)
        ? `<img class="detail-image" src="${escapeHtml(card.imageData || card.imageUrl)}" alt="${escapeHtml(card.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="detail-placeholder" style="display:none">${getTypeEmoji(card.type)}</div>`
        : `<div class="detail-placeholder">${getTypeEmoji(card.type)}</div>`
      }
    </div>

    <div class="detail-name">${escapeHtml(card.name)}</div>

    <div class="detail-badges">
      <span class="detail-badge">${getTypeEmoji(card.type)} ${escapeHtml(card.type)}</span>
      ${card.favorite ? '<span class="detail-badge badge-fav">⭐ Favorite</span>' : ''}
      ${isSold ? '<span class="detail-badge badge-sold">💰 Sold</span>' : ''}
      ${isListed ? '<span class="detail-badge badge-listed">📋 Listed</span>' : ''}
      ${isTradePending ? '<span class="detail-badge badge-trade">🔄 Trade Pending</span>' : ''}
      ${isWishlist ? '<span class="detail-badge badge-wishlist">❤️ Wishlist</span>' : ''}
    </div>

    ${formattedValue
      ? `<div class="detail-value">${formattedValue}</div>`
      : `<div class="detail-value-empty">No value set</div>`
    }

    <div class="detail-divider"></div>

    <div class="detail-meta-grid">
      <div class="detail-meta-item">
        <div class="detail-meta-label">Condition</div>
        <div class="detail-meta-value">${escapeHtml(conditionLabel(card))}</div>
      </div>

      <div class="detail-meta-item">
        <div class="detail-meta-label">Collection</div>
        <div class="detail-meta-value">${escapeHtml(card.collection || 'Personal')}</div>
      </div>

      <div class="detail-meta-item">
        <div class="detail-meta-label">Intent</div>
        <div class="detail-meta-value ${isSold ? 'value-empty' : ''}">${isSold ? '—' : escapeHtml((card.intent || 'hold').toUpperCase())}</div>
      </div>

      <div class="detail-meta-item">
        <div class="detail-meta-label">Purchase Cost</div>
        <div class="detail-meta-value ${!card.purchaseCost ? 'value-empty' : ''}">${card.purchaseCost ? (formatValue(card.purchaseCost) || '—') : '—'}</div>
      </div>

      ${isSold
        ? `<div class="detail-meta-item"><div class="detail-meta-label">Sold Price</div><div class="detail-meta-value ${!card.soldPrice ? 'value-empty' : ''}">${card.soldPrice ? (formatValue(card.soldPrice) || '—') : '—'}</div></div>`
        : `<div class="detail-meta-item"><div class="detail-meta-label">Market Value</div><div class="detail-meta-value ${!card.marketValue ? 'value-empty' : ''}">${card.marketValue ? (formatValue(card.marketValue) || '—') : '—'}</div></div>`
      }

      ${acqDateStr ? `<div class="detail-meta-item"><div class="detail-meta-label">Acquired</div><div class="detail-meta-value">${acqDateStr}</div></div>` : ''}
      ${isSold && soldDateStr ? `<div class="detail-meta-item"><div class="detail-meta-label">Sold On</div><div class="detail-meta-value">${soldDateStr}</div></div>` : ''}
    </div>

    ${plHTML}
    ${notesHTML}

    <div class="detail-actions">
      <button class="detail-action-btn btn-edit" data-action="detail-edit" data-id="${card.id}">✏️ Edit</button>
      <button class="detail-action-btn btn-fav ${card.favorite ? 'is-active' : ''}" data-action="detail-fav" data-id="${card.id}">${card.favorite ? '⭐ Favorited' : '☆ Favorite'}</button>
      <button class="detail-action-btn btn-sell" data-action="detail-sell" data-id="${card.id}">${isSold ? '↩ Unmark Sold' : '💰 Mark Sold'}</button>
      <button class="detail-action-btn btn-delete" data-action="detail-delete" data-id="${card.id}">🗑 Delete</button>
    </div>
  `;

  document.getElementById('detail-overlay').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeDetail() {
  document.getElementById('detail-overlay').hidden = true;
  document.body.style.overflow = '';
}

// =============================================
// IMAGE COMPRESSION
// =============================================
function compressImage(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const MAX_W = 800;
      let w = img.width;
      let h = img.height;

      if (w > MAX_W) {
        h = Math.round(h * MAX_W / w);
        w = MAX_W;
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      URL.revokeObjectURL(url);

      const webp = canvas.toDataURL('image/webp', 0.7);
      resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.75));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('');
    };

    img.src = url;
  });
}

function switchImgTab(tab) {
  const isUrl = tab === 'url';

  document.getElementById('img-tab-url').classList.toggle('is-active', isUrl);
  document.getElementById('img-tab-upload').classList.toggle('is-active', !isUrl);
  document.getElementById('img-panel-url').hidden = !isUrl;
  document.getElementById('img-panel-upload').hidden = isUrl;
}

// =============================================
// MODAL
// =============================================
function openModal(card = null) {
  const isEdit = !!card;

  document.getElementById('modal-title').textContent = isEdit ? 'Edit Card' : 'Add Card';
  document.getElementById('field-id').value = card ? card.id : '';
  document.getElementById('field-name').value = card ? card.name : '';
  document.getElementById('field-type').value = card ? card.type : 'Normal';
  document.getElementById('field-market-value').value = card ? (card.marketValue || '') : '';
  document.getElementById('field-status').value = card ? card.status : 'owned';
  document.getElementById('field-image').value = card ? (card.imageUrl || '') : '';

  const hasUpload = !!(card && card.imageData);

  state.draftImageData = card ? (card.imageData || '') : '';

  switchImgTab(hasUpload ? 'upload' : 'url');

  const previewEl = document.getElementById('img-upload-preview');
  const promptEl = document.getElementById('img-upload-prompt');
  const previewImg = document.getElementById('img-preview-img');

  if (hasUpload) {
    previewEl.hidden = false;
    promptEl.hidden = true;
    previewImg.src = card.imageData;
  } else {
    previewEl.hidden = true;
    promptEl.hidden = false;
    previewImg.src = '';
  }

  document.getElementById('field-favorite').checked = card ? !!card.favorite : false;
  document.getElementById('field-condition').value = card ? (card.conditionType || 'Raw') : 'Raw';
  document.getElementById('field-grade').value = card ? (card.grade || '') : '';
  document.getElementById('field-collection').value = card ? (card.collection || 'Personal') : 'Personal';
  document.getElementById('field-intent').value = card ? (card.intent || 'hold') : 'hold';
  document.getElementById('field-purchase-cost').value = card ? (card.purchaseCost || '') : '';
  document.getElementById('field-notes').value = card ? (card.notes || '') : '';
  document.getElementById('field-acquisition-date').value = card ? (card.acquisitionDate || '') : '';
  document.getElementById('field-sold-price').value = card ? (card.soldPrice || '') : '';
  document.getElementById('field-sold-date').value = card ? (card.soldDate || '') : '';

  document.getElementById('btn-delete').hidden = !isEdit;
  document.getElementById('modal-overlay').hidden = false;
  document.body.style.overflow = 'hidden';

  updateSoldFieldsVisibility();

  setTimeout(() => document.getElementById('field-name').focus(), 80);
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
  document.body.style.overflow = '';
}

function updateSoldFieldsVisibility() {
  const status = document.getElementById('field-status').value;
  const isSold = status === 'sold';

  document.getElementById('sold-fields-wrap').hidden = !isSold;

  const intentField = document.getElementById('field-intent');
  intentField.disabled = isSold;

  if (isSold) {
    const soldDateField = document.getElementById('field-sold-date');

    if (!soldDateField.value) {
      soldDateField.value = new Date().toISOString().slice(0, 10);
    }
  }
}

function getFormData() {
  return {
    id: document.getElementById('field-id').value || generateId(),
    name: document.getElementById('field-name').value.trim(),
    type: document.getElementById('field-type').value,
    status: document.getElementById('field-status').value,
    imageUrl: document.getElementById('field-image').value.trim(),
    imageData: state.draftImageData,
    favorite: document.getElementById('field-favorite').checked,
    conditionType: document.getElementById('field-condition').value,
    grade: document.getElementById('field-grade').value,
    collection: document.getElementById('field-collection').value,
    intent: document.getElementById('field-intent').value.toLowerCase(),
    purchaseCost: document.getElementById('field-purchase-cost').value || '',
    marketValue: document.getElementById('field-market-value').value || '',
    notes: document.getElementById('field-notes').value.trim(),
    acquisitionDate: document.getElementById('field-acquisition-date').value || '',
    soldPrice: document.getElementById('field-sold-price').value || '',
    soldDate: document.getElementById('field-sold-date').value || '',
  };
}

function validateForm(data) {
  if (!data.name) {
    const field = document.getElementById('field-name');
    field.style.borderColor = 'var(--danger)';
    field.focus();

    setTimeout(() => {
      field.style.borderColor = '';
    }, 2000);

    return false;
  }

  return true;
}

// =============================================
// CARD CRUD
// =============================================
function saveCard(data) {
  data = normalizeCard(data);
  data.updatedAt = new Date().toISOString();

  const existing = state.cards.findIndex(c => c.id === data.id);

  if (existing >= 0) {
    state.cards[existing] = data;
  } else {
    state.cards.unshift(data);
  }

  saveCards();

  return existing === -1;
}

function deleteCard(id) {
  state.cards = state.cards.filter(c => c.id !== id);
  saveCards();
}

function toggleFavorite(id) {
  const card = state.cards.find(c => c.id === id);
  if (!card) return;

  card.favorite = !card.favorite;
  card.updatedAt = new Date().toISOString();

  saveCards();
}

function toggleSold(id) {
  const card = state.cards.find(c => c.id === id);
  if (!card) return;

  if (card.status === 'sold') {
    card.status = 'owned';
  } else {
    card.status = 'sold';

    if (!card.soldDate) {
      card.soldDate = new Date().toISOString().slice(0, 10);
    }
  }

  card.updatedAt = new Date().toISOString();

  saveCards();
}

// =============================================
// BACKUP / EXPORT
// =============================================
const BACKUP_KEY = 'pokevault_lastbackup';

function updateBackupUI() {
  const raw = localStorage.getItem(BACKUP_KEY);
  const dot = document.getElementById('backup-reminder-dot');
  const line = document.getElementById('backup-last-backup');

  if (!raw) {
    if (dot) dot.hidden = false;

    if (line) {
      line.textContent = 'Last backup: Never';
      line.className = 'backup-last-backup is-stale';
    }

    return;
  }

  const backupDate = new Date(raw + 'T00:00:00');
  const daysSince = Math.floor((Date.now() - backupDate.getTime()) / 86400000);
  const dateStr = backupDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isStale = daysSince > 7;

  if (dot) dot.hidden = !isStale;

  if (line) {
    const ago =
      daysSince === 0
        ? 'today'
        : daysSince === 1
          ? 'yesterday'
          : `${daysSince} days ago`;

    line.textContent = `Last backup: ${dateStr} (${ago})`;
    line.className = 'backup-last-backup' + (isStale ? ' is-stale' : '');
  }
}

function showBackupToast(msg, type) {
  const el = document.getElementById('backup-toast');
  if (!el) return;

  el.textContent = msg;
  el.className = `backup-toast is-${type}`;
  el.hidden = false;

  clearTimeout(el._toastTimer);

  if (type === 'success') {
    el._toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 3500);
  }
}

function openBackupMenu() {
  updateBackupUI();

  const toast = document.getElementById('backup-toast');
  if (toast) toast.hidden = true;

  document.getElementById('backup-overlay').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeBackupMenu() {
  document.getElementById('backup-overlay').hidden = true;
  document.body.style.overflow = '';
}

function exportJSON() {
  const data = JSON.stringify(state.cards.map(normalizeCard), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `pokevault-backup-${new Date().toISOString().slice(0, 10)}.json`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);

  localStorage.setItem(BACKUP_KEY, new Date().toISOString().slice(0, 10));
  updateBackupUI();
  closeBackupMenu();
}

function handleImportFile(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);

      if (!Array.isArray(imported)) throw new Error('Not an array');
      if (!imported.every(c => c.id && c.name && c.type)) throw new Error('Invalid cards');

      state.cards = imported.map(normalizeCard);

      saveCards();
      render();

      showBackupToast(
        `✓ Imported ${state.cards.length} card${state.cards.length === 1 ? '' : 's'} successfully.`,
        'success'
      );
    } catch (_) {
      showBackupToast('Import failed: not a valid PokéVault backup file.', 'error');
    }

    document.getElementById('import-file-input').value = '';
  };

  reader.readAsText(file);
}

function openClearConfirm() {
  const hasBackup = !!localStorage.getItem(BACKUP_KEY);
  const warn = document.getElementById('confirm-no-backup-warn');

  if (warn) warn.hidden = hasBackup;

  closeBackupMenu();

  document.getElementById('confirm-clear-overlay').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeClearConfirm() {
  document.getElementById('confirm-clear-overlay').hidden = true;
  document.body.style.overflow = '';
}

function clearAllCards() {
  state.cards = [];
  saveCards();
  render();
  closeClearConfirm();
}

// =============================================
// CONFIRM DIALOG
// =============================================
function openConfirm(id) {
  state.pendingDeleteId = id;
  document.getElementById('confirm-overlay').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeConfirm() {
  state.pendingDeleteId = null;
  document.getElementById('confirm-overlay').hidden = true;
  document.body.style.overflow = '';
}

// =============================================
// EVENT LISTENERS
// =============================================
function initEvents() {
  document.getElementById('filter-pills')?.addEventListener('click', e => {
    const btn = e.target.closest('.filter-pill');
    if (!btn) return;

    state.filter = btn.dataset.filter;
    render();
  });

  document.getElementById('sort-select')?.addEventListener('change', e => {
    state.sort = e.target.value;
    render();
  });

  document.getElementById('field-status').addEventListener('change', updateSoldFieldsVisibility);

  document.getElementById('img-tab-url').addEventListener('click', () => switchImgTab('url'));
  document.getElementById('img-tab-upload').addEventListener('click', () => switchImgTab('upload'));

  document.getElementById('img-upload-area').addEventListener('click', () => {
    document.getElementById('img-file-input').click();
  });

  document.getElementById('img-file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;

    const dataUrl = await compressImage(file);
    if (!dataUrl) return;

    state.draftImageData = dataUrl;

    document.getElementById('img-preview-img').src = dataUrl;
    document.getElementById('img-upload-preview').hidden = false;
    document.getElementById('img-upload-prompt').hidden = true;

    e.target.value = '';
  });

  document.getElementById('img-upload-clear').addEventListener('click', e => {
    e.stopPropagation();

    state.draftImageData = '';

    document.getElementById('img-preview-img').src = '';
    document.getElementById('img-upload-preview').hidden = true;
    document.getElementById('img-upload-prompt').hidden = false;
  });

  document.getElementById('fab').addEventListener('click', () => openModal());

  document.getElementById('bottom-nav').addEventListener('click', e => {
    const btn = e.target.closest('.nav-btn');
    if (!btn) return;

    state.view = btn.dataset.view;
    render();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');

  searchInput.addEventListener('input', e => {
    state.search = e.target.value;
    searchClear.hidden = !state.search;
    render();
  });

  searchClear.addEventListener('click', () => {
    state.search = '';
    searchInput.value = '';
    searchClear.hidden = true;
    searchInput.focus();
    render();
  });

  document.getElementById('card-grid').addEventListener('click', e => {
    const actionBtn = e.target.closest('[data-action]');

    if (actionBtn) {
      e.stopPropagation();

      const { action, id } = actionBtn.dataset;

      if (action === 'edit') {
        openModal(state.cards.find(c => c.id === id));
        return;
      }

      if (action === 'fav') {
        toggleFavorite(id);
        render();
        return;
      }

      if (action === 'sell') {
        toggleSold(id);
        render();
        return;
      }
    }

    const card = e.target.closest('.poke-card');
    if (card) openDetail(card.dataset.id);
  });

  document.getElementById('card-grid').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.poke-card');

      if (card) {
        e.preventDefault();
        openDetail(card.dataset.id);
      }
    }
  });

  document.getElementById('detail-close').addEventListener('click', closeDetail);

  document.getElementById('detail-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDetail();
  });

  document.getElementById('detail-content').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const { action, id } = btn.dataset;

    if (action === 'detail-edit') {
      closeDetail();
      openModal(state.cards.find(c => c.id === id));
      return;
    }

    if (action === 'detail-fav') {
      toggleFavorite(id);
      render();
      openDetail(id);
      return;
    }

    if (action === 'detail-sell') {
      toggleSold(id);
      render();
      openDetail(id);
      return;
    }

    if (action === 'detail-delete') {
      closeDetail();
      openConfirm(id);
      return;
    }
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);

  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  document.getElementById('btn-save').addEventListener('click', () => {
    const data = getFormData();

    if (!validateForm(data)) return;

    const wasNewCard = saveCard(data);

    if (wasNewCard) {
      openModal();
    } else {
      closeModal();
    }

    render();
  });

  document.getElementById('btn-delete').addEventListener('click', () => {
    const id = document.getElementById('field-id').value;
    if (!id) return;

    closeModal();
    openConfirm(id);
  });

  document.getElementById('btn-confirm-cancel').addEventListener('click', closeConfirm);

  document.getElementById('confirm-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeConfirm();
  });

  document.getElementById('btn-confirm-delete').addEventListener('click', () => {
    if (state.pendingDeleteId) {
      deleteCard(state.pendingDeleteId);
      closeConfirm();
      render();
    }
  });

  document.getElementById('btn-backup').addEventListener('click', openBackupMenu);
  document.getElementById('backup-close').addEventListener('click', closeBackupMenu);

  document.getElementById('backup-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeBackupMenu();
  });

  document.getElementById('btn-export').addEventListener('click', exportJSON);

  document.getElementById('btn-import-trigger').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });

  document.getElementById('import-file-input').addEventListener('change', e => {
    handleImportFile(e.target.files[0]);
  });

  document.getElementById('btn-clear-trigger').addEventListener('click', openClearConfirm);
  document.getElementById('btn-confirm-clear-cancel').addEventListener('click', closeClearConfirm);

  document.getElementById('confirm-clear-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeClearConfirm();
  });

  document.getElementById('btn-confirm-clear-ok').addEventListener('click', clearAllCards);

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;

    if (!document.getElementById('confirm-clear-overlay').hidden) {
      closeClearConfirm();
      return;
    }

    if (!document.getElementById('backup-overlay').hidden) {
      closeBackupMenu();
      return;
    }

    if (!document.getElementById('confirm-overlay').hidden) {
      closeConfirm();
      return;
    }

    if (!document.getElementById('modal-overlay').hidden) {
      closeModal();
      return;
    }

    if (!document.getElementById('detail-overlay').hidden) {
      closeDetail();
      return;
    }
  });

  document.getElementById('card-form').addEventListener('submit', e => e.preventDefault());
}

// =============================================
// SEED DATA
// =============================================
function seedIfEmpty() {
  if (state.cards.length > 0) return;

  state.cards = [
    {
      id: generateId(),
      name: 'Charizard',
      imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png',
      marketValue: '350',
      type: 'Fire',
      status: 'owned',
      favorite: true,
      conditionType: 'PSA',
      grade: '10',
      collection: 'Charizard',
      intent: 'hold',
      purchaseCost: '120',
      notes: 'Gem mint, first edition.',
      acquisitionDate: '2023-06-15',
      soldPrice: '',
      soldDate: '',
    },
    {
      id: generateId(),
      name: 'Pikachu',
      imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
      marketValue: '45',
      type: 'Electric',
      status: 'listed',
      favorite: false,
      conditionType: 'Raw',
      grade: '',
      collection: 'Personal',
      intent: 'trade',
      purchaseCost: '20',
      notes: '',
      acquisitionDate: '2024-01-10',
      soldPrice: '',
      soldDate: '',
    },
    {
      id: generateId(),
      name: 'Mewtwo',
      imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png',
      marketValue: '220',
      type: 'Psychic',
      status: 'owned',
      favorite: false,
      conditionType: 'CGC',
      grade: '9',
      collection: 'Personal',
      intent: 'sell',
      purchaseCost: '80',
      notes: '',
      acquisitionDate: '2023-11-20',
      soldPrice: '',
      soldDate: '',
    },
    {
      id: generateId(),
      name: 'Blastoise',
      imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/9.png',
      marketValue: '180',
      type: 'Water',
      status: 'wishlist',
      favorite: true,
      conditionType: 'Raw',
      grade: '',
      collection: 'Personal',
      intent: 'grade',
      purchaseCost: '',
      notes: 'Want to get this graded.',
      acquisitionDate: '',
      soldPrice: '',
      soldDate: '',
    },
    {
      id: generateId(),
      name: 'Gengar',
      imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png',
      marketValue: '95',
      type: 'Ghost',
      status: 'sold',
      favorite: false,
      conditionType: 'PSA',
      grade: '8',
      collection: 'Business Inventory',
      intent: 'sell',
      purchaseCost: '30',
      notes: '',
      acquisitionDate: '2023-03-05',
      soldPrice: '92',
      soldDate: '2024-02-14',
    },
    {
      id: generateId(),
      name: 'Dragonite',
      imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/149.png',
      marketValue: '130',
      type: 'Dragon',
      status: 'trade-pending',
      favorite: false,
      conditionType: 'Raw',
      grade: '',
      collection: 'Personal',
      intent: 'trade',
      purchaseCost: '50',
      notes: '',
      acquisitionDate: '2024-03-22',
      soldPrice: '',
      soldDate: '',
    },
  ].map(normalizeCard);

  saveCards();
}

// =============================================
// INIT
// =============================================
function init() {
  loadCards();
  seedIfEmpty();
  initEvents();
  render();
  updateBackupUI();
}

document.addEventListener('DOMContentLoaded', init);
