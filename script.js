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
  view: 'home',       // 'home' | 'wishlist' | 'sold'
  search: '',
  pendingDeleteId: null,
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
    if (raw) state.cards = JSON.parse(raw);
  } catch (_) {
    state.cards = [];
  }
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

function getCardInitials(name) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// =============================================
// FILTER LOGIC
// =============================================
function getFilteredCards() {
  const q = state.search.trim().toLowerCase();

  let filtered = state.cards.filter(card => {
    if (state.view === 'home')     return card.status === 'owned';
    if (state.view === 'wishlist') return card.status === 'wishlist' || card.favorite;
    if (state.view === 'sold')     return card.status === 'sold';
    return false;
  });

  if (q) {
    filtered = filtered.filter(card =>
      card.name.toLowerCase().includes(q) ||
      card.type.toLowerCase().includes(q)
    );
  }

  return filtered;
}

// =============================================
// RENDER — SINGLE RENDER SYSTEM
// =============================================
function render() {
  const filtered = getFilteredCards();
  renderGrid(filtered);
  renderSectionHeader(filtered.length);
  renderHeaderStats();
  renderNavActive();
  renderEmptyState(filtered.length);
}

function renderGrid(cards) {
  const grid = document.getElementById('card-grid');

  // Build map of existing card elements by id for stable DOM updates
  const existing = {};
  for (const el of grid.children) {
    existing[el.dataset.id] = el;
  }

  // Build new order
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

  // Remove stale cards
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

  const formattedValue = formatValue(card.value);
  const isSold = card.status === 'sold';

  el.innerHTML = `
    <div class="card-image-wrap">
      ${card.imageUrl
        ? `<img class="card-image" src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="card-placeholder" style="display:none">${getTypeEmoji(card.type)}</div>`
        : `<div class="card-placeholder">${getTypeEmoji(card.type)}</div>`
      }
      <span class="card-type-badge">${escapeHtml(card.type)}</span>
      ${isSold ? '<span class="card-sold-badge">Sold</span>' : ''}
      ${card.favorite ? '<span class="card-fav-dot">⭐</span>' : ''}
    </div>
    <div class="card-info">
      <div class="card-name">${escapeHtml(card.name)}</div>
      <div class="card-meta">
        ${formattedValue
          ? `<span class="card-value">${formattedValue}</span>`
          : `<span class="card-value-empty">No value</span>`
        }
      </div>
      <div class="card-actions">
        <button class="card-action-btn btn-edit" data-action="edit" data-id="${card.id}" aria-label="Edit ${escapeHtml(card.name)}">Edit</button>
        <button class="card-action-btn btn-fav ${card.favorite ? 'is-active' : ''}" data-action="fav" data-id="${card.id}" aria-label="Toggle favorite">${card.favorite ? '⭐' : '☆'}</button>
        <button class="card-action-btn btn-sell ${isSold ? 'is-sold' : ''}" data-action="sell" data-id="${card.id}" aria-label="${isSold ? 'Mark as owned' : 'Mark as sold'}">${isSold ? '↩' : '💰'}</button>
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
    .reduce((sum, c) => sum + (parseFloat(c.value) || 0), 0);
  const el = document.getElementById('header-stats');
  if (total === 0) { el.textContent = ''; return; }
  el.textContent = `${total} owned · ${formatValue(value) || '$0'}`;
}

function renderNavActive() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === state.view);
  });
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

  const formattedValue = formatValue(card.value);
  const isSold = card.status === 'sold';
  const isWishlist = card.status === 'wishlist';

  const content = document.getElementById('detail-content');
  content.innerHTML = `
    <div class="detail-image-wrap">
      ${card.imageUrl
        ? `<img class="detail-image" src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="detail-placeholder" style="display:none">${getTypeEmoji(card.type)}</div>`
        : `<div class="detail-placeholder">${getTypeEmoji(card.type)}</div>`
      }
    </div>
    <div class="detail-name">${escapeHtml(card.name)}</div>
    <div class="detail-badges">
      <span class="detail-badge">${getTypeEmoji(card.type)} ${escapeHtml(card.type)}</span>
      ${card.favorite ? '<span class="detail-badge badge-fav">⭐ Favorite</span>' : ''}
      ${isSold ? '<span class="detail-badge badge-sold">💰 Sold</span>' : ''}
      ${isWishlist ? '<span class="detail-badge badge-wishlist">❤️ Wishlist</span>' : ''}
    </div>
    ${formattedValue
      ? `<div class="detail-value">${formattedValue}</div>`
      : `<div class="detail-value-empty">No value set</div>`
    }
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
// MODAL (Add / Edit)
// =============================================
function openModal(card = null) {
  const isEdit = !!card;

  document.getElementById('modal-title').textContent = isEdit ? 'Edit Card' : 'Add Card';
  document.getElementById('field-id').value = card ? card.id : '';
  document.getElementById('field-name').value = card ? card.name : '';
  document.getElementById('field-type').value = card ? card.type : 'Normal';
  document.getElementById('field-value').value = card ? (card.value || '') : '';
  document.getElementById('field-status').value = card ? card.status : 'owned';
  document.getElementById('field-image').value = card ? (card.imageUrl || '') : '';
  document.getElementById('field-favorite').checked = card ? !!card.favorite : false;

  document.getElementById('btn-delete').hidden = !isEdit;
  document.getElementById('modal-overlay').hidden = false;
  document.body.style.overflow = 'hidden';

  setTimeout(() => document.getElementById('field-name').focus(), 80);
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
  document.body.style.overflow = '';
}

function getFormData() {
  return {
    id: document.getElementById('field-id').value || generateId(),
    name: document.getElementById('field-name').value.trim(),
    type: document.getElementById('field-type').value,
    value: document.getElementById('field-value').value || '',
    status: document.getElementById('field-status').value,
    imageUrl: document.getElementById('field-image').value.trim(),
    favorite: document.getElementById('field-favorite').checked,
  };
}

function validateForm(data) {
  if (!data.name) {
    const field = document.getElementById('field-name');
    field.style.borderColor = 'var(--danger)';
    field.focus();
    setTimeout(() => { field.style.borderColor = ''; }, 2000);
    return false;
  }
  return true;
}

// =============================================
// CARD CRUD
// =============================================
function saveCard(data) {
  const existing = state.cards.findIndex(c => c.id === data.id);
  if (existing >= 0) {
    state.cards[existing] = data;
  } else {
    state.cards.unshift(data);
  }
  saveCards();
}

function deleteCard(id) {
  state.cards = state.cards.filter(c => c.id !== id);
  saveCards();
}

function toggleFavorite(id) {
  const card = state.cards.find(c => c.id === id);
  if (!card) return;
  card.favorite = !card.favorite;
  saveCards();
}

function toggleSold(id) {
  const card = state.cards.find(c => c.id === id);
  if (!card) return;
  card.status = card.status === 'sold' ? 'owned' : 'sold';
  saveCards();
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

  // FAB → open add modal
  document.getElementById('fab').addEventListener('click', () => openModal());

  // Bottom nav
  document.getElementById('bottom-nav').addEventListener('click', e => {
    const btn = e.target.closest('.nav-btn');
    if (!btn) return;
    state.view = btn.dataset.view;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Search input
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

  // Card grid — delegated events
  document.getElementById('card-grid').addEventListener('click', e => {
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      e.stopPropagation();
      const { action, id } = actionBtn.dataset;
      if (action === 'edit') { openModal(state.cards.find(c => c.id === id)); return; }
      if (action === 'fav')  { toggleFavorite(id); render(); return; }
      if (action === 'sell') { toggleSold(id); render(); return; }
    }
    const card = e.target.closest('.poke-card');
    if (card) openDetail(card.dataset.id);
  });

  // Card grid — keyboard
  document.getElementById('card-grid').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.poke-card');
      if (card) { e.preventDefault(); openDetail(card.dataset.id); }
    }
  });

  // Detail close
  document.getElementById('detail-close').addEventListener('click', closeDetail);
  document.getElementById('detail-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDetail();
  });

  // Detail panel — delegated actions
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
      openDetail(id); // re-render detail
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

  // Modal close button
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Modal save
  document.getElementById('btn-save').addEventListener('click', () => {
    const data = getFormData();
    if (!validateForm(data)) return;
    saveCard(data);
    closeModal();
    render();
  });

  // Modal delete → open confirm
  document.getElementById('btn-delete').addEventListener('click', () => {
    const id = document.getElementById('field-id').value;
    if (!id) return;
    closeModal();
    openConfirm(id);
  });

  // Confirm dialog
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

  // Escape key — close any open overlay
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!document.getElementById('confirm-overlay').hidden) { closeConfirm(); return; }
    if (!document.getElementById('modal-overlay').hidden) { closeModal(); return; }
    if (!document.getElementById('detail-overlay').hidden) { closeDetail(); return; }
  });

  // Form submit via Enter
  document.getElementById('card-form').addEventListener('submit', e => e.preventDefault());
}

// =============================================
// SEED DATA (first-run only)
// =============================================
function seedIfEmpty() {
  if (state.cards.length > 0) return;

  state.cards = [
    {
      id: generateId(),
      name: 'Charizard',
      imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png',
      value: '350',
      type: 'Fire',
      status: 'owned',
      favorite: true,
    },
    {
      id: generateId(),
      name: 'Pikachu',
      imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
      value: '45',
      type: 'Electric',
      status: 'owned',
      favorite: false,
    },
    {
      id: generateId(),
      name: 'Mewtwo',
      imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png',
      value: '220',
      type: 'Psychic',
      status: 'owned',
      favorite: false,
    },
    {
      id: generateId(),
      name: 'Blastoise',
      imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/9.png',
      value: '180',
      type: 'Water',
      status: 'wishlist',
      favorite: true,
    },
    {
      id: generateId(),
      name: 'Gengar',
      imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png',
      value: '95',
      type: 'Ghost',
      status: 'sold',
      favorite: false,
    },
    {
      id: generateId(),
      name: 'Dragonite',
      imageUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/149.png',
      value: '130',
      type: 'Dragon',
      status: 'owned',
      favorite: false,
    },
  ];

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
}
