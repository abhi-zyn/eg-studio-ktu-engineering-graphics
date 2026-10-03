/* =====================================================================
   app.js — registry, navigation (rail list + mobile dropdown), theme
   toggle, and the collapsible 3D drawer. Modules self-register here.
   ===================================================================== */
const App = (function () {
  const modules = [];
  function register(def) { modules.push(def); modules.sort((a, b) => a.num - b.num); }

  function buildNav() {
    const ol = document.getElementById('modNav');
    const sel = document.getElementById('modSelect');
    ol.innerHTML = ''; sel.innerHTML = '';
    modules.forEach(m => {
      const li = document.createElement('li');
      const soon = m.status === 'soon';
      li.innerHTML = `<button data-mod="${m.id}" class="${soon ? 'soon' : ''}">
        <span class="m-no">${String(m.num).padStart(2, '0')}</span>
        <span class="m-label">${m.title}</span>
        ${soon ? '<span class="m-soon">coming soon</span>' : ''}
      </button>`;
      ol.appendChild(li);
      const opt = document.createElement('option');
      opt.value = m.id; opt.textContent = `${String(m.num).padStart(2, '0')} · ${m.title}${soon ? ' (soon)' : ''}`;
      sel.appendChild(opt);
    });
    ol.addEventListener('click', e => { const b = e.target.closest('button[data-mod]'); if (b) { select(b.dataset.mod); closeRail(); } });
    sel.addEventListener('change', e => select(e.target.value));
  }

  function select(id) {
    const m = modules.find(x => x.id === id); if (!m) return;
    document.querySelectorAll('#modNav button').forEach(b => b.classList.toggle('active', b.dataset.mod === id));
    document.getElementById('modSelect').value = id;
    Workbench.mount(m);
    try { localStorage.setItem('eg-last', id); } catch (e) {}
  }

  const closeRail = () => document.getElementById('rail').classList.remove('open');

  function applyTheme(name) {
    document.documentElement.setAttribute('data-theme', name);
    document.getElementById('themeToggle').textContent = name === 'dark' ? '◑' : '◐';
    Workbench.setTheme(name);
    try { localStorage.setItem('eg-theme', name); } catch (e) {}
  }

  function initDrawer() {
    const drawer = document.getElementById('drawer');
    const reopen = document.getElementById('drawerReopen');
    const setOpen = (open) => { drawer.classList.toggle('open', open); reopen.hidden = open; };
    document.getElementById('drawerToggle').addEventListener('click', () => setOpen(false));
    reopen.addEventListener('click', () => setOpen(true));
    document.getElementById('togglePlanes').addEventListener('change', e => Workbench.setPlanesVisible(e.target.checked));
  }

  function init() {
    buildNav();
    Workbench.bind();
    initDrawer();
    document.getElementById('railToggle').addEventListener('click', () => document.getElementById('rail').classList.toggle('open'));
    document.getElementById('themeToggle').addEventListener('click', () =>
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

    let theme = 'light'; try { theme = localStorage.getItem('eg-theme') || 'light'; } catch (e) {}
    applyTheme(theme);
    let last = null; try { last = localStorage.getItem('eg-last'); } catch (e) {}
    select((last && modules.some(m => m.id === last)) ? last : modules[0].id);
  }

  return { register, init, modules };
})();
if (typeof window !== 'undefined') window.App = App;
document.addEventListener('DOMContentLoaded', App.init);
