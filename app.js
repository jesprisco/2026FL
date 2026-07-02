const input = document.getElementById('search');
const clear = document.getElementById('clear');
const sections = [...document.querySelectorAll('section[id]')];
const tabLinks = [...document.querySelectorAll('.tabs a')];
const topSticky = document.querySelector('.top-sticky');
let stickyOffset = topSticky ? topSticky.offsetHeight + 4 : 132;
function refreshStickyOffset() {
  stickyOffset = topSticky ? topSticky.offsetHeight + 4 : 132;
}
window.addEventListener('resize', refreshStickyOffset);

function decodeSearch(raw) {
  const json = raw
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'");
  return JSON.parse(json);
}

function isMapsUrl(url) {
  return url && url.includes('google.com/maps');
}

function websiteFromData(data) {
  const skip = new Set(['pin', 'directions', 'google maps']);
  const preferred = ['menu', 'website', 'name'];

  for (const key of preferred) {
    const field = data[key];
    if (!field?.link || isMapsUrl(field.link)) continue;
    if (key === 'menu') return { href: field.link, label: '📋 Menu' };
    return { href: field.link, label: '🌐 Website' };
  }

  for (const [key, field] of Object.entries(data)) {
    if (!field?.link || isMapsUrl(field.link) || skip.has(key)) continue;
    return { href: field.link, label: '🌐 Website' };
  }

  return null;
}

function websiteFromDetails(card) {
  const link = card.querySelector('.details a[href]:not([href*="google.com/maps"])');
  if (!link) return null;
  const text = link.textContent.trim().toLowerCase();
  return {
    href: link.getAttribute('href'),
    label: text.includes('menu') ? '📋 Menu' : '🌐 Website',
  };
}

function websiteFromActions(actions) {
  for (const anchor of actions.querySelectorAll('a')) {
    const href = anchor.getAttribute('href');
    if (href && !isMapsUrl(href)) {
      return { href, label: anchor.textContent.trim() };
    }
  }
  return null;
}

function rebuildCardActions(card) {
  const actions = card.querySelector('.actions');
  if (!actions) return;

  let data = {};
  if (card.dataset.search) {
    try {
      data = decodeSearch(card.dataset.search);
    } catch {
      return;
    }
  }

  const website =
    websiteFromData(data) ||
    websiteFromDetails(card) ||
    websiteFromActions(actions);

  const dirAnchor = [...actions.querySelectorAll('a')].find(
    (anchor) => isMapsUrl(anchor.href) && anchor.href.includes('/dir/')
  );
  const directionsHref = data.directions?.link || dirAnchor?.getAttribute('href');

  const parts = [];
  if (website?.href) {
    parts.push(
      `<a class="btn" href="${website.href}" target="_blank" rel="noopener">${website.label}</a>`
    );
  }
  if (directionsHref) {
    const cls = website?.href ? 'btn secondary' : 'btn';
    parts.push(
      `<a class="${cls}" href="${directionsHref}" target="_blank" rel="noopener">🚗 Directions</a>`
    );
  }

  if (parts.length) actions.innerHTML = parts.join('');
  attachItineraryButton(card);
}

const ITINERARY_KEY = 'fl2026-itinerary';
const ITINERARY_SKIP = new Set(['packing', 'itinerary', 'check-in']);
const ITINERARY_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', ''];
const ITINERARY_DAY_LABELS = {
  Monday: 'Monday · Jul 6',
  Tuesday: 'Tuesday',
  Wednesday: 'Wednesday',
  Thursday: 'Thursday',
  '': 'Unscheduled',
};

const itineraryList = document.getElementById('itinerary-list');
const itineraryEmpty = document.getElementById('itinerary-empty');
const itineraryBadge = document.getElementById('itinerary-badge');
const itineraryClear = document.getElementById('itinerary-clear');

function loadItinerary() {
  try {
    const items = JSON.parse(localStorage.getItem(ITINERARY_KEY) || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function saveItinerary(items) {
  localStorage.setItem(ITINERARY_KEY, JSON.stringify(items));
  renderItinerary();
  updateItineraryButtons();
}

function cardId(card) {
  const section = card.closest('section')?.id || 'item';
  const name = card.querySelector('h3')?.textContent.trim() || 'stop';
  return `${section}::${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function inferDay(card) {
  if (!card.dataset.search) return '';
  try {
    const data = decodeSearch(card.dataset.search);
    const raw = `${data.day?.value || ''} ${data.trip?.value || ''}`.toLowerCase();
    if (raw.includes('mon')) return 'Monday';
    if (raw.includes('tue')) return 'Tuesday';
    if (raw.includes('wed')) return 'Wednesday';
    if (raw.includes('thu')) return 'Thursday';
  } catch {
    return '';
  }
  return '';
}

function cardMeta(card) {
  const section = card.closest('section');
  const townChip = [...card.querySelectorAll('.chip')].find((chip) =>
    /town:/i.test(chip.textContent)
  );
  const town = townChip
    ? townChip.textContent.replace(/^town:\s*/i, '').trim()
    : '';
  const links = [...(card.querySelector('.actions')?.querySelectorAll('a') || [])];
  const directions =
    links.find((anchor) => isMapsUrl(anchor.href) && anchor.href.includes('/dir/'))?.href ||
    '';
  const website = links.find((anchor) => !isMapsUrl(anchor.href))?.href || '';

  return {
    id: cardId(card),
    name: card.querySelector('h3')?.textContent.trim() || 'Stop',
    section: section?.id || '',
    sectionLabel: section?.querySelector('h2')?.textContent.trim() || '',
    town,
    directions,
    website,
    day: inferDay(card),
  };
}

function attachItineraryButton(card) {
  if (ITINERARY_SKIP.has(card.closest('section')?.id || '')) return;
  if (card.querySelector('.pack-list')) return;

  let actions = card.querySelector('.actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'actions';
    card.appendChild(actions);
  }

  actions.querySelector('.btn-itinerary')?.remove();

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn itinerary secondary btn-itinerary';
  button.addEventListener('click', () => toggleItinerary(card));
  actions.appendChild(button);
  refreshItineraryButton(card, button);
}

function refreshItineraryButton(card, button = card.querySelector('.btn-itinerary')) {
  if (!button) return;
  const added = loadItinerary().some((item) => item.id === cardId(card));
  button.textContent = added ? '✓ In itinerary' : '+ Add to itinerary';
  button.classList.toggle('added', added);
}

function updateItineraryButtons() {
  document.querySelectorAll('article.card').forEach((card) => refreshItineraryButton(card));
  const count = loadItinerary().length;
  if (itineraryBadge) {
    itineraryBadge.textContent = String(count);
    itineraryBadge.classList.toggle('hidden', count === 0);
  }
}

function toggleItinerary(card) {
  const id = cardId(card);
  const items = loadItinerary();
  const index = items.findIndex((item) => item.id === id);
  if (index >= 0) {
    items.splice(index, 1);
  } else {
    items.push({ ...cardMeta(card), addedAt: Date.now() });
  }
  saveItinerary(items);
}

function moveItineraryItem(id, direction) {
  const items = loadItinerary();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return;

  const day = items[index].day || '';
  const dayIndexes = items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => (item.day || '') === day)
    .map(({ i }) => i);

  const pos = dayIndexes.indexOf(index);
  const targetPos = pos + direction;
  if (targetPos < 0 || targetPos >= dayIndexes.length) return;

  const a = dayIndexes[pos];
  const b = dayIndexes[targetPos];
  [items[a], items[b]] = [items[b], items[a]];
  saveItinerary(items);
}

function setItineraryDay(id, day) {
  const items = loadItinerary();
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  item.day = day;
  saveItinerary(items);
}

function removeItineraryItem(id) {
  saveItinerary(loadItinerary().filter((item) => item.id !== id));
}

function renderItinerary() {
  const items = loadItinerary();
  if (!itineraryList || !itineraryEmpty) return;

  itineraryEmpty.hidden = items.length > 0;
  itineraryList.hidden = items.length === 0;
  itineraryList.innerHTML = '';

  ITINERARY_DAYS.forEach((day) => {
    const groupItems = items.filter((item) => (item.day || '') === day);
    if (!groupItems.length) return;

    const group = document.createElement('div');
    group.className = 'itinerary-day-group';
    group.innerHTML = `<h3 class="itinerary-day-title">${ITINERARY_DAY_LABELS[day]}</h3>`;

    groupItems.forEach((item) => {
      const row = document.createElement('article');
      row.className = 'itinerary-item';
      row.dataset.id = item.id;

      const meta = [item.sectionLabel, item.town].filter(Boolean).join(' · ');
      const links = [];
      if (item.website) {
        links.push(
          `<a class="btn" href="${item.website}" target="_blank" rel="noopener">🌐 Website</a>`
        );
      }
      if (item.directions) {
        links.push(
          `<a class="btn secondary" href="${item.directions}" target="_blank" rel="noopener">🚗 Directions</a>`
        );
      }

      row.innerHTML = `
        <div class="itinerary-item-main">
          <h3>${item.name}</h3>
          ${meta ? `<p class="itinerary-meta">${meta}</p>` : ''}
          <div class="itinerary-item-actions">
            <label class="visually-hidden" for="day-${item.id}">Day</label>
            <select id="day-${item.id}" class="itinerary-day-select" aria-label="Assign day for ${item.name}">
              <option value="">Unscheduled</option>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
            </select>
            ${links.join('')}
            <button type="button" class="itinerary-remove" aria-label="Remove ${item.name}">✕</button>
          </div>
        </div>
        <div class="itinerary-move">
          <button type="button" class="itinerary-up" aria-label="Move ${item.name} up">↑</button>
          <button type="button" class="itinerary-down" aria-label="Move ${item.name} down">↓</button>
        </div>`;

      row.querySelector('.itinerary-day-select').value = item.day || '';
      row.querySelector('.itinerary-day-select').addEventListener('change', (event) => {
        setItineraryDay(item.id, event.target.value);
      });
      row.querySelector('.itinerary-up').addEventListener('click', () => moveItineraryItem(item.id, -1));
      row.querySelector('.itinerary-down').addEventListener('click', () => moveItineraryItem(item.id, 1));
      row.querySelector('.itinerary-remove').addEventListener('click', () => removeItineraryItem(item.id));
      group.appendChild(row);
    });

    itineraryList.appendChild(group);
  });
}

document.querySelectorAll('article.card').forEach(rebuildCardActions);

itineraryClear?.addEventListener('click', () => {
  if (!loadItinerary().length) return;
  if (window.confirm('Clear your whole itinerary?')) saveItinerary([]);
});

renderItinerary();
updateItineraryButtons();

function filter() {
  const q = input.value.trim().toLowerCase();
  document.querySelectorAll('.card').forEach((card) => {
    card.classList.toggle('hidden', q && !card.dataset.search.includes(q));
  });
  document.querySelectorAll('section').forEach((section) => {
    if (section.id === 'itinerary') return;
    const visible = section.querySelectorAll('.card:not(.hidden)').length;
    section.classList.toggle('hidden', q && visible === 0);
  });
}

function setActiveTab() {
  let current = sections[0]?.id;
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= stickyOffset) current = section.id;
  }
  tabLinks.forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
  });
}

tabLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const id = link.getAttribute('href').slice(1);
    const section = document.getElementById(id);
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY - stickyOffset + 4;
    window.scrollTo({ top, behavior: 'smooth' });
    history.replaceState(null, '', `#${id}`);
    setActiveTab();
  });
});

input.addEventListener('input', filter);
clear.addEventListener('click', () => {
  input.value = '';
  filter();
  input.focus();
});

document.addEventListener('scroll', setActiveTab, { passive: true });
window.addEventListener('resize', setActiveTab, { passive: true });
setActiveTab();
filter();

const VIEW_KEY = 'fl2026-view';
const viewEssentialsBtn = document.getElementById('view-essentials');
const viewFullBtn = document.getElementById('view-full');
const openFullPlanner = document.getElementById('open-full-planner');

function setPlannerView(mode) {
  const full = mode === 'full';
  document.body.classList.toggle('view-full', full);
  document.body.classList.toggle('view-essentials', !full);
  localStorage.setItem(VIEW_KEY, mode);
  viewEssentialsBtn?.classList.toggle('is-active', !full);
  viewFullBtn?.classList.toggle('is-active', full);
  viewEssentialsBtn?.setAttribute('aria-selected', String(!full));
  viewFullBtn?.setAttribute('aria-selected', String(full));
  refreshStickyOffset();
  if (full) setActiveTab();
}

setPlannerView(localStorage.getItem(VIEW_KEY) === 'full' ? 'full' : 'essentials');

viewEssentialsBtn?.addEventListener('click', () => {
  setPlannerView('essentials');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
viewFullBtn?.addEventListener('click', () => {
  setPlannerView('full');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
openFullPlanner?.addEventListener('click', () => {
  setPlannerView('full');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
