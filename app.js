const input = document.getElementById('search');
const clear = document.getElementById('clear');
const sections = [...document.querySelectorAll('section[id]')];
const tabLinks = [...document.querySelectorAll('.tabs a')];
const stickyOffset = 76;

function filter() {
  const q = input.value.trim().toLowerCase();
  document.querySelectorAll('.card').forEach((card) => {
    card.classList.toggle('hidden', q && !card.dataset.search.includes(q));
  });
  document.querySelectorAll('section').forEach((section) => {
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
