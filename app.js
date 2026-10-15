// Chỉ cần sửa thông tin cá nhân ở đây; mọi trang dùng chung cấu hình này.
const profile = {
  name: 'Viet Dung Vu',
  role: 'Research Student',
  affiliation: 'School of Information and Communications Technology',
  institution: 'Hanoi University of Science and Technology',
  email: 'dung.vv220023@sis.hust.edu.vn',
  // Các mục dưới đây là thông tin mẫu từ example.html; sửa thành thông tin của bạn.
  phone: '+84 818 964 818',
  address: ['Minh Son Commune, Thanh Hoa Province', 'Vietnam'],
  links: [
    { label: 'Google Scholar', url: 'https://scholar.google.com/citations?user=ctQvvHIAAAAJ' },
    { label: 'GitHub', url: 'https://github.com/VuVietDung-bk' },
    { label: 'ORCID', url: 'https://orcid.org/0009-0008-2633-5526' }
  ]
};

const pages = [
  { label: 'Home', file: 'index.html' },
  { label: 'Publications', file: 'publications.html' },
  { label: 'Awards', file: 'awards.html' },
  { label: 'CV', file: 'cv.html' },
  { label: 'More', file: 'more.html' }
];

const currentFile = () => location.pathname.split('/').pop() || 'index.html';
const allowedFiles = new Set(pages.map(page => page.file));

function renderSharedLayout() {
  const navigation = document.querySelector('#site-header');
  const sidebar = document.querySelector('#profile-sidebar');

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Main navigation');
  const list = document.createElement('ul');
  list.className = 'top-nav';
  for (const page of pages) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = page.file;
    link.textContent = page.label;
    item.append(link);
    list.append(item);
  }
  nav.append(list);
  navigation.replaceChildren(nav);

  const name = document.createElement('a');
  name.className = 'name';
  name.href = 'index.html';
  name.textContent = profile.name;
  const role = document.createElement('p');
  role.className = 'role';
  role.textContent = profile.role;
  const affiliation = document.createElement('p');
  affiliation.className = 'affiliation';
  affiliation.append(profile.affiliation, document.createElement('br'), profile.institution);
  const section = document.createElement('section');
  const heading = document.createElement('h2');
  heading.id = 'contact-heading';
  heading.textContent = 'Contact';
  section.setAttribute('aria-labelledby', heading.id);
  const contacts = document.createElement('ul');
  contacts.className = 'contact-list';
  const emailItem = document.createElement('li');
  const emailLink = document.createElement('a');
  emailLink.href = `mailto:${profile.email}`;
  emailLink.textContent = profile.email;
  emailItem.append(emailLink);
  contacts.append(emailItem);
  if (profile.phone) {
    const phoneItem = document.createElement('li');
    const phoneLink = document.createElement('a');
    phoneLink.href = `tel:${profile.phone.replace(/[^\d+]/g, '')}`;
    phoneLink.textContent = profile.phone;
    phoneItem.append(phoneLink);
    contacts.append(phoneItem);
  }
  if (profile.address?.length) {
    const addressItem = document.createElement('li');
    addressItem.className = 'address';
    profile.address.forEach((line, index) => {
      if (index) addressItem.append(document.createElement('br'));
      addressItem.append(line);
    });
    contacts.append(addressItem);
  }
  for (const entry of profile.links) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = entry.url;
    link.textContent = entry.label;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    item.append(link);
    contacts.append(item);
  }
  section.append(heading, contacts);
  sidebar.replaceChildren(name, role, affiliation, section);
  sidebar.setAttribute('aria-label', 'Profile and contact information');
  updatePageDetails();
  updateNavigation();
  updateFooter();
}

function updatePageDetails() {
  const page = pages.find(entry => entry.file === currentFile());
  if (page) document.title = `${page.label} | ${profile.name}`;
  const introduction = document.querySelector('#home-intro');
  if (introduction) {
    introduction.textContent = `I am a ${profile.role.toLowerCase()} at the ${profile.affiliation}, ${profile.institution}.`;
  }
}

function updateNavigation() {
  for (const link of document.querySelectorAll('.top-nav a')) {
    if (link.getAttribute('href') === currentFile()) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }
}

function updateFooter() {
  let footer = document.querySelector('#main .page-footer');
  if (!footer) {
    footer = document.createElement('footer');
    footer.className = 'page-footer';
    document.querySelector('#main').append(footer);
  }
  footer.textContent = `© ${new Date().getFullYear()} ${profile.name}`;
}

// Trên GitHub Pages, chỉ nội dung <main> thay đổi khi mở trang khác.
// Khi mở trực tiếp một file HTML, trang đó vẫn tải được như bình thường.
let navigationRequest = 0;
async function loadPage(url, addHistory) {
  const request = ++navigationRequest;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const nextDocument = new DOMParser().parseFromString(html, 'text/html');
    const nextMain = nextDocument.querySelector('#main');
    if (!nextMain) throw new Error('Missing main content');
    if (request !== navigationRequest) return;

    document.querySelector('#main').innerHTML = nextMain.innerHTML;
    if (addHistory) history.pushState(null, '', url);
    const description = nextDocument.querySelector('meta[name="description"]');
    const currentDescription = document.querySelector('meta[name="description"]');
    if (description && currentDescription) currentDescription.content = description.content;
    updatePageDetails();
    updateNavigation();
    updateFooter();
    window.scrollTo(0, 0);
    const title = document.querySelector('#main h1');
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  } catch {
    location.href = url;
  }
}

renderSharedLayout();

if (location.protocol !== 'file:') {
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || event.button !== 0) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || !allowedFiles.has(url.pathname.split('/').pop()) || url.hash) return;
    event.preventDefault();
    loadPage(url.href, true);
  });
  window.addEventListener('popstate', () => loadPage(location.href, false));
}
