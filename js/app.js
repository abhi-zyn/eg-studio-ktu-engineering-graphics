/* =====================================================================
   app.js — application controller: module registry, sidebar navigation,
   mobile menu, light/dark theme, and initial mount.
   ===================================================================== */
const App = (function () {
  const modules = [];
  function register(def) { modules.push(def); modules.sort((a, b) => a.num - b.num); }
  const pad2 = (n) => String(n).padStart(2, '0');

  function buildNav() {
    const ul = document.getElementById('moduleList');
    ul.innerHTML = '';
    modules.forEach(m => {
      const soon = m.status === 'soon';
      const li = document.createElement('li');
      li.innerHTML = `<button data-mod="${m.id}" class="${soon ? 'soon' : ''}">
        <span class="mnum">${pad2(m.num)}</span>
        <span class="mlabel">${m.title}</span>
        <span class="mstatus ${soon ? '' : 'ready'}">${soon ? 'coming soon' : ''}</span>
      </button>`;
      ul.appendChild(li);
    });
    ul.addEventListener('click', e => {
      const btn = e.target.closest('button[data-mod]'); if (!btn) return;
      selectModule(btn.dataset.mod);
      setNav(false);            // hide the module list once a module is chosen
    });
  }

  /* Sidebar: desktop = in-flow column that can be hidden; mobile = slide-in
     drawer. One state for both; the "Modules" button in the header toggles it. */
  const isMobile = () => window.matchMedia('(max-width:760px)').matches;
  let navOpen = true;
  function setNav(open) {
    navOpen = open;
    document.getElementById('sidebar').classList.toggle('open', open);
    document.body.classList.toggle('nav-hidden', !open);
    document.getElementById('navScrim').hidden = !(open && isMobile());
    const t = document.getElementById('navToggle');
    t.setAttribute('aria-expanded', String(open));
    t.setAttribute('aria-label', open ? 'Hide module list' : 'Show module list');
  }

  function selectModule(id) {
    const m = modules.find(x => x.id === id); if (!m) return;
    document.querySelectorAll('#moduleList button').forEach(b => {
      const on = b.dataset.mod === id;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    Workbench.mount(m);
    try { localStorage.setItem('eg-last', id); } catch (e) {}
  }

  /* light / dark: the UI flips; the 2D paper stays cream like a real sheet */
  function applyTheme(name) {
    document.documentElement.setAttribute('data-theme', name);
    const t = document.getElementById('themeToggle');
    t.setAttribute('aria-pressed', String(name === 'light'));
    t.querySelector('.tt-label').textContent = name === 'light' ? 'Dark' : 'Light';
    t.setAttribute('aria-label', `Switch to ${name === 'light' ? 'dark' : 'light'} theme`);
    Workbench.setTheme(name);
    try { localStorage.setItem('eg-theme', name); } catch (e) {}
  }

  function init() {
    let theme = 'dark'; try { theme = localStorage.getItem('eg-theme') || 'dark'; } catch (e) {}
    buildNav();
    Workbench.bind();
    document.getElementById('navToggle').addEventListener('click', () => setNav(!navOpen));
    setNav(!isMobile());      // open on desktop at start, closed on phones
    document.getElementById('navScrim').addEventListener('click', () => setNav(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setNav(false); });
    document.getElementById('themeToggle').addEventListener('click', () =>
      applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'));
    document.documentElement.setAttribute('data-theme', theme);
    applyTheme(theme);
    let last = null; try { last = localStorage.getItem('eg-last'); } catch (e) {}
    selectModule((last && modules.some(m => m.id === last)) ? last : modules[0].id);
  }

  return { register, init, modules };
})();
if (typeof window !== 'undefined') window.App = App;
document.addEventListener('DOMContentLoaded', App.init);
