'use strict';

const COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#14b8a6'];
const PRIO_RANK = { high: 0, med: 1, low: 2 };
const PRIO_LABEL = { high: 'High', med: 'Medium', low: 'Low' };

const $ = (sel) => document.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const SPACES = ['personal', 'work'];

const defaultState = () => ({
  theme: 'dark',
  space: 'personal',
  lists: [
    { id: 'personal', name: 'Personal', color: '#8b5cf6', space: 'personal' },
    { id: 'work', name: 'Work', color: '#06b6d4', space: 'work' },
  ],
  tasks: [],
});

let state = defaultState();
const ui = { view: 'all', filter: 'all', search: '', sort: 'created', prio: 'med', newListColor: COLORS[0] };
const freshIds = new Set();

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => window.api.save(state), 300);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDue(due) {
  const today = todayStr();
  if (due === today) return 'Today';
  const d = new Date(due + 'T00:00:00');
  const diff = Math.round((d - new Date(today + 'T00:00:00')) / 86400000);
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

function inView(task, view = ui.view) {
  if (listById(task.listId)?.space !== state.space) return false;
  const today = todayStr();
  if (view === 'all') return true;
  if (view === 'today') return !!task.due && task.due <= today && (!task.done || task.due === today);
  if (view === 'upcoming') return !!task.due && task.due > today;
  return task.listId === view.slice(5);
}

function visibleTasks() {
  const q = ui.search.trim().toLowerCase();
  const tasks = state.tasks.filter((t) =>
    inView(t) &&
    (ui.filter === 'all' || (ui.filter === 'done' ? t.done : !t.done)) &&
    (!q || t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q))
  );
  const byCreated = (a, b) => b.createdAt - a.createdAt;
  const cmp = {
    created: byCreated,
    due: (a, b) => (a.due || '9999') .localeCompare(b.due || '9999') || byCreated(a, b),
    priority: (a, b) => PRIO_RANK[a.priority] - PRIO_RANK[b.priority] || byCreated(a, b),
  }[ui.sort];
  return tasks.sort((a, b) => a.done - b.done || cmp(a, b));
}

const listById = (id) => state.lists.find((l) => l.id === id);
const spaceLists = () => state.lists.filter((l) => l.space === state.space);

function render() {
  renderSidebar();
  renderHeader();
  renderTasks();
}

function renderSidebar() {
  document.querySelectorAll('#smartNav .nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === ui.view);
  });
  for (const v of ['all', 'today', 'upcoming']) {
    const n = state.tasks.filter((t) => !t.done && inView(t, v)).length;
    document.querySelector(`[data-count="${v}"]`).textContent = n || '';
  }

  const nav = $('#listNav');
  nav.innerHTML = '';
  for (const list of spaceLists()) {
    const btn = document.createElement('button');
    btn.className = 'nav-item' + (ui.view === 'list:' + list.id ? ' active' : '');
    btn.dataset.view = 'list:' + list.id;
    btn.dataset.listId = list.id;
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = list.color;
    dot.style.color = list.color;
    const label = document.createElement('span');
    label.className = 'nav-label';
    label.textContent = list.name;
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = state.tasks.filter((t) => !t.done && t.listId === list.id).length || '';
    btn.append(dot, label, count);
    nav.append(btn);
  }

  const sel = $('#listSelect');
  const prev = sel.value;
  sel.innerHTML = '';
  const lists = spaceLists();
  for (const list of lists) sel.add(new Option(list.name, list.id));
  sel.value = ui.view.startsWith('list:') ? ui.view.slice(5) : (lists.some((l) => l.id === prev) ? prev : lists[0]?.id);
}

function renderHeader() {
  const titles = { all: 'All tasks', today: 'Today', upcoming: 'Upcoming' };
  $('#viewTitle').textContent = titles[ui.view] || listById(ui.view.slice(5))?.name || 'Tasks';

  const scoped = state.tasks.filter((t) => inView(t));
  const done = scoped.filter((t) => t.done).length;
  const pct = scoped.length ? Math.round((done / scoped.length) * 100) : 0;
  const circ = 2 * Math.PI * 52;
  $('#ring').style.strokeDashoffset = circ - (circ * pct) / 100;
  $('#pct').textContent = pct + '%';
  const left = scoped.length - done;
  $('#subtitle').textContent = scoped.length
    ? `${left} task${left === 1 ? '' : 's'} left · ${done} completed`
    : 'A clean slate ✨';

  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  $('#greeting').textContent = `${part} · ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`;
}

function renderTasks() {
  const ul = $('#taskList');
  const tasks = visibleTasks();
  ul.innerHTML = '';
  for (const t of tasks) ul.append(taskEl(t));
  freshIds.clear();

  const empty = $('#emptyState');
  empty.classList.toggle('hidden', tasks.length > 0);
  if (!tasks.length) {
    const [emoji, title, msg] = ui.search
      ? ['🔍', 'No matches', 'Try a different search term.']
      : ui.filter === 'done'
        ? ['🌱', 'Nothing completed yet', 'Check off a task and it will show up here.']
        : ui.filter === 'active' && state.tasks.some((t) => inView(t))
          ? ['🎉', 'All done!', 'You crushed it. Time for a break.']
          : [null, 'Nothing here yet', 'Add a task above and get things rolling.'];
    empty.querySelector('.mascot').classList.toggle('hidden', emoji !== null);
    empty.querySelector('.empty-emoji').classList.toggle('hidden', emoji === null);
    empty.querySelector('.empty-emoji').textContent = emoji ?? '';
    empty.querySelector('h3').textContent = title;
    empty.querySelector('p').textContent = msg;
  }
}

const ICON_EDIT = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
const ICON_DEL = '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
const ICON_MOVE = '<svg viewBox="0 0 24 24"><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>';
const ICON_OPEN = '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
const ICON_FOLDER = '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const SPACE_LABEL = { personal: 'Personal', work: 'Work' };
const otherSpace = (s) => (s === 'work' ? 'personal' : 'work');

function taskEl(t) {
  const li = document.createElement('li');
  li.className = 'task' + (t.done ? ' done' : '') + (freshIds.has(t.id) ? ' enter' : '') +
    (ui.openId === t.id ? ' selected' : '');
  li.dataset.id = t.id;
  li.dataset.prio = t.priority;

  const check = document.createElement('button');
  check.className = 'check';
  check.title = t.done ? 'Mark as not done' : 'Mark as done';
  check.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  const body = document.createElement('div');
  body.className = 'task-body';
  const title = document.createElement('span');
  title.className = 'task-title';
  title.textContent = t.title;
  title.title = 'Click for details';
  const meta = document.createElement('div');
  meta.className = 'task-meta';

  const list = listById(t.listId);
  if (list && !ui.view.startsWith('list:')) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = list.color;
    chip.append(dot, list.name);
    meta.append(chip);
  }
  if (t.due) {
    const chip = document.createElement('span');
    const today = todayStr();
    chip.className = 'chip' + (t.due < today ? ' overdue' : t.due === today ? ' today' : '');
    chip.textContent = '📅 ' + formatDue(t.due);
    meta.append(chip);
  }
  const prio = document.createElement('span');
  prio.className = 'chip';
  prio.textContent = PRIO_LABEL[t.priority];
  prio.style.color = `var(--${t.priority})`;
  meta.append(prio);
  if (t.notes.trim()) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = '📝 Notes';
    chip.title = t.notes.slice(0, 300);
    meta.append(chip);
  }
  if (t.attachments.length) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = '📎 ' + t.attachments.length;
    chip.title = t.attachments.map((a) => a.name).join('\n');
    meta.append(chip);
  }

  body.append(title, meta);

  const actions = document.createElement('div');
  actions.className = 'task-actions';
  const target = SPACE_LABEL[otherSpace(state.space)];
  actions.innerHTML =
    `<button class="move" title="Move to ${target}">${ICON_MOVE}</button>` +
    `<button class="edit" title="Rename">${ICON_EDIT}</button>` +
    `<button class="del" title="Delete">${ICON_DEL}</button>`;

  li.append(check, body, actions);
  return li;
}

function addTask(title) {
  const task = {
    id: uid(),
    title,
    done: false,
    priority: ui.prio,
    due: $('#dueInput').value || null,
    listId: $('#listSelect').value || spaceLists()[0]?.id,
    notes: '',
    attachments: [],
    createdAt: Date.now(),
  };
  state.tasks.push(task);
  freshIds.add(task.id);
  if (ui.filter === 'done') setFilter('all');
  if (!inView(task)) ui.view = 'all';
  save();
  render();
}

function toggleTask(li) {
  const t = state.tasks.find((x) => x.id === li.dataset.id);
  if (!t) return;
  t.done = !t.done;
  li.classList.toggle('done', t.done);
  if (t.done) {
    const r = li.querySelector('.check').getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2);
  }
  save();
  renderSidebar();
  renderHeader();
  setTimeout(renderTasks, 550);
}

function removeTasks(pred) {
  const gone = state.tasks.filter(pred);
  if (!gone.length) return;
  state.tasks = state.tasks.filter((t) => !pred(t));
  const withFiles = gone.filter((t) => t.attachments.length).map((t) => t.id);
  if (withFiles.length) window.api.purgeAttachments(withFiles);
  if (gone.some((t) => t.id === ui.openId)) closeDrawer();
  save();
}

function collapseCard(li, done) {
  if (!li) return done();
  li.style.height = li.offsetHeight + 'px';
  li.classList.add('removing');
  li.addEventListener('animationend', done, { once: true });
}

function deleteTask(id) {
  collapseCard(cardFor(id), () => {
    removeTasks((t) => t.id === id);
    render();
  });
}

const cardFor = (id) => document.querySelector(`.task[data-id="${id}"]`);
const taskById = (id) => state.tasks.find((t) => t.id === id);

function moveTask(id, space, listId) {
  const t = taskById(id);
  const target = listId || state.lists.find((l) => l.space === space)?.id;
  if (!t || !target || t.listId === target) return;
  const fromSpace = listById(t.listId)?.space;
  const prevList = t.listId;
  const apply = () => {
    t.listId = target;
    save();
    render();
    if (ui.openId === id) fillDrawer();
  };
  if (space !== fromSpace && space !== state.space) {
    collapseCard(cardFor(id), apply);
    showToast(`Moved to ${SPACE_LABEL[space]}`, [
      { label: 'Undo', run: () => moveTask(id, fromSpace, prevList) },
      { label: `Go to ${SPACE_LABEL[space]}`, run: () => { setSpace(space); openDrawer(id); } },
    ]);
  } else {
    apply();
  }
}

function startEdit(li) {
  const t = state.tasks.find((x) => x.id === li.dataset.id);
  const title = li.querySelector('.task-title');
  if (!t || !title) return;
  const input = document.createElement('input');
  input.className = 'task-edit';
  input.value = t.title;
  input.maxLength = 200;
  title.replaceWith(input);
  input.focus();
  input.select();

  let finished = false;
  const finish = (commit) => {
    if (finished) return;
    finished = true;
    const v = input.value.trim();
    if (commit && v) {
      t.title = v;
      save();
    }
    renderTasks();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
}

function setFilter(filter) {
  ui.filter = filter;
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.filter === filter));
  moveIndicator();
}

function moveIndicator() {
  const active = document.querySelector('.tab.active');
  const ind = $('#tabIndicator');
  ind.style.width = active.offsetWidth + 'px';
  ind.style.transform = `translateX(${active.offsetLeft - 4}px)`;
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.space = state.space;
}

function setSpace(space) {
  if (space === state.space) return;
  closeDrawer();
  state.space = space;
  ui.view = 'all';
  applyTheme();
  moveSpaceIndicator();
  visibleTasks().forEach((t) => freshIds.add(t.id));
  save();
  render();
}

function moveSpaceIndicator() {
  const btns = document.querySelectorAll('.space-btn');
  btns.forEach((b) => b.classList.toggle('active', b.dataset.space === state.space));
  const active = document.querySelector('.space-btn.active');
  const ind = $('#spaceIndicator');
  ind.style.width = active.offsetWidth + 'px';
  ind.style.transform = `translateX(${active.offsetLeft - 3}px)`;
}

function openDrawer(id) {
  if (!taskById(id)) return;
  ui.openId = id;
  fillDrawer();
  $('#drawer').classList.add('open');
  $('#drawer').setAttribute('aria-hidden', 'false');
  $('#drawerBackdrop').classList.add('open');
  document.querySelectorAll('.task').forEach((li) => li.classList.toggle('selected', li.dataset.id === id));
}

function closeDrawer() {
  if (!ui.openId) return;
  ui.openId = null;
  document.activeElement?.blur();
  $('#drawer').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
  $('#drawerBackdrop').classList.remove('open');
  document.querySelectorAll('.task.selected').forEach((li) => li.classList.remove('selected'));
}

function fillDrawer() {
  const t = taskById(ui.openId);
  if (!t) return closeDrawer();
  const active = document.activeElement;
  const space = listById(t.listId)?.space;

  if (active !== $('#dTitle')) $('#dTitle').value = t.title;
  autosize($('#dTitle'));
  document.querySelectorAll('#dSpace button').forEach((b) => b.classList.toggle('active', b.dataset.space === space));

  const sel = $('#dList');
  sel.innerHTML = '';
  for (const l of state.lists.filter((x) => x.space === space)) sel.add(new Option(l.name, l.id));
  sel.value = t.listId;

  $('#dDue').value = t.due || '';
  document.querySelectorAll('#dPrio button').forEach((b) => b.classList.toggle('active', b.dataset.prio === t.priority));
  if (active !== $('#dNotes')) $('#dNotes').value = t.notes;
  renderFiles(t);
  $('#dCreated').textContent = 'Created ' + new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function autosize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  return (bytes / 1024 ** 3).toFixed(2) + ' GB';
}

function renderFiles(t) {
  const ul = $('#dFiles');
  ul.innerHTML = '';
  for (const a of t.attachments) {
    const li = document.createElement('li');
    li.className = 'file';
    li.dataset.file = a.file;
    const dot = a.name.lastIndexOf('.');
    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = dot > 0 ? a.name.slice(dot + 1, dot + 5).toUpperCase() : 'FILE';
    const info = document.createElement('div');
    info.className = 'file-info';
    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = a.name;
    name.title = a.name;
    const size = document.createElement('span');
    size.className = 'file-size';
    size.textContent = formatSize(a.size);
    info.append(name, size);
    const actions = document.createElement('div');
    actions.className = 'file-actions';
    actions.innerHTML =
      `<button class="open" title="Open">${ICON_OPEN}</button>` +
      `<button class="reveal" title="Show in folder">${ICON_FOLDER}</button>` +
      `<button class="rm" title="Remove">${ICON_X}</button>`;
    li.append(icon, info, actions);
    ul.append(li);
  }
}

function addAttachments(taskId, added) {
  if (!added?.length) return;
  const t = taskById(taskId);
  if (!t) return window.api.purgeAttachments([taskId]);
  t.attachments.push(...added);
  save();
  renderTasks();
  if (ui.openId === taskId) fillDrawer();
  showToast(`Attached ${added.length} file${added.length === 1 ? '' : 's'}`);
}

function editOpenTask(fn, { refreshDrawer = false } = {}) {
  const t = taskById(ui.openId);
  if (!t) return;
  fn(t);
  save();
  render();
  if (refreshDrawer) fillDrawer();
}

function bindDrawer() {
  $('#drawerClose').onclick = closeDrawer;
  $('#drawerBackdrop').onclick = closeDrawer;

  const title = $('#dTitle');
  title.addEventListener('input', () => {
    autosize(title);
    const v = title.value.replace(/\s+/g, ' ').trim();
    if (v) editOpenTask((t) => (t.title = v));
  });
  title.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      title.blur();
    }
  });
  title.addEventListener('blur', () => {
    const t = taskById(ui.openId);
    if (t) title.value = t.title;
    autosize(title);
  });

  $('#dSpace').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) moveTask(ui.openId, b.dataset.space);
  });
  $('#dList').addEventListener('change', (e) => {
    moveTask(ui.openId, listById(e.target.value).space, e.target.value);
  });
  $('#dDue').addEventListener('change', (e) => editOpenTask((t) => (t.due = e.target.value || null)));
  $('#dPrio').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) editOpenTask((t) => (t.priority = b.dataset.prio), { refreshDrawer: true });
  });
  $('#dNotes').addEventListener('input', (e) => editOpenTask((t) => (t.notes = e.target.value)));

  $('#dAttach').onclick = async () => {
    const id = ui.openId;
    addAttachments(id, await window.api.pickAttachments(id));
  };
  const drop = $('#dDrop');
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', (e) => {
    if (!drop.contains(e.relatedTarget)) drop.classList.remove('over');
  });
  drop.addEventListener('drop', async (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    const id = ui.openId;
    const files = [...e.dataTransfer.files];
    if (id && files.length) addAttachments(id, await window.api.addDroppedFiles(id, files));
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

  $('#dFiles').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    const li = e.target.closest('.file');
    if (!btn || !li) return;
    const id = ui.openId;
    const file = li.dataset.file;
    if (btn.classList.contains('open')) {
      const err = await window.api.openAttachment(id, file);
      if (err) showToast("Couldn't open file: " + err);
    } else if (btn.classList.contains('reveal')) {
      window.api.revealAttachment(id, file);
    } else if (btn.classList.contains('rm')) {
      await window.api.removeAttachment(id, file);
      editOpenTask((t) => (t.attachments = t.attachments.filter((a) => a.file !== file)), { refreshDrawer: true });
    }
  });

  $('#dDelete').onclick = () => {
    const id = ui.openId;
    closeDrawer();
    deleteTask(id);
  };
}

let toastTimer;
function showToast(text, actions = []) {
  const toast = $('#toast');
  $('#toastText').textContent = text;
  const box = $('#toastActions');
  box.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button');
    b.textContent = a.label;
    b.onclick = () => {
      toast.classList.remove('show');
      a.run();
    };
    box.append(b);
  }
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), actions.length ? 6000 : 2500);
}

const canvas = $('#confetti');
const ctx = canvas.getContext('2d');
let particles = [];
let animating = false;

function burst(x, y) {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const palette = ['#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b', '#22c55e'];
  for (let i = 0; i < 36; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 4 + Math.random() * 4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: palette[i % palette.length],
      life: 1,
    });
  }
  if (!animating) {
    animating = true;
    requestAnimationFrame(tick);
  }
}

function tick() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const p of particles) {
    p.vy += 0.18;
    p.vx *= 0.98;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 0.016;
    ctx.save();
    ctx.globalAlpha = Math.max(p.life, 0);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  }
  particles = particles.filter((p) => p.life > 0);
  if (particles.length) requestAnimationFrame(tick);
  else {
    animating = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function bindEvents() {
  $('#winMin').onclick = () => window.api.minimize();
  $('#winMax').onclick = () => window.api.maximize();
  $('#winClose').onclick = () => window.api.close();

  $('#spaceSwitch').addEventListener('click', (e) => {
    const btn = e.target.closest('.space-btn');
    if (btn) setSpace(btn.dataset.space);
  });

  $('#themeToggle').onclick = () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    save();
  };

  document.querySelector('.sidebar').addEventListener('click', (e) => {
    const item = e.target.closest('.nav-item');
    if (!item) return;
    ui.view = item.dataset.view;
    render();
  });

  $('#listNav').addEventListener('contextmenu', (e) => {
    const item = e.target.closest('.nav-item');
    if (!item) return;
    e.preventDefault();
    const list = listById(item.dataset.listId);
    if (spaceLists().length <= 1) {
      alert('Each space needs at least one list.');
      return;
    }
    const n = state.tasks.filter((t) => t.listId === list.id).length;
    const msg = n
      ? `Delete "${list.name}" and its ${n} task${n === 1 ? '' : 's'}?`
      : `Delete "${list.name}"?`;
    if (!confirm(msg)) return;
    state.lists = state.lists.filter((l) => l.id !== list.id);
    removeTasks((t) => t.listId === list.id);
    if (ui.view === 'list:' + list.id) ui.view = 'all';
    save();
    render();
  });

  const swatches = $('#swatches');
  for (const c of COLORS) {
    const s = document.createElement('button');
    s.type = 'button';
    s.className = 'swatch' + (c === ui.newListColor ? ' active' : '');
    s.style.background = c;
    s.dataset.color = c;
    swatches.append(s);
  }
  swatches.addEventListener('click', (e) => {
    const s = e.target.closest('.swatch');
    if (!s) return;
    ui.newListColor = s.dataset.color;
    swatches.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('active', x === s));
  });
  $('#addListBtn').onclick = () => {
    $('#newListForm').classList.toggle('hidden');
    $('#newListName').focus();
  };
  $('#cancelList').onclick = () => $('#newListForm').classList.add('hidden');
  $('#newListForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#newListName').value.trim();
    if (!name) return;
    const list = { id: uid(), name, color: ui.newListColor, space: state.space };
    state.lists.push(list);
    $('#newListName').value = '';
    $('#newListForm').classList.add('hidden');
    ui.view = 'list:' + list.id;
    save();
    render();
  });

  $('#addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('#taskInput').value.trim();
    if (!title) {
      $('#addForm').animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
        { duration: 250 }
      );
      return;
    }
    addTask(title);
    $('#taskInput').value = '';
    $('#dueInput').value = '';
  });
  $('#prioPicker').addEventListener('click', (e) => {
    const chip = e.target.closest('.prio-chip');
    if (!chip) return;
    ui.prio = chip.dataset.prio;
    document.querySelectorAll('.prio-chip').forEach((c) => c.classList.toggle('active', c === chip));
  });

  const list = $('#taskList');
  list.addEventListener('click', (e) => {
    const li = e.target.closest('.task');
    if (!li || li.classList.contains('removing') || e.target.closest('.task-edit')) return;
    if (e.target.closest('.check')) toggleTask(li);
    else if (e.target.closest('.del')) deleteTask(li.dataset.id);
    else if (e.target.closest('.edit')) startEdit(li);
    else if (e.target.closest('.move')) moveTask(li.dataset.id, otherSpace(state.space));
    else openDrawer(li.dataset.id);
  });
  bindDrawer();

  $('#tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    setFilter(tab.dataset.filter);
    renderTasks();
  });
  $('#searchInput').addEventListener('input', (e) => {
    ui.search = e.target.value;
    renderTasks();
  });
  $('#sortSelect').addEventListener('change', (e) => {
    ui.sort = e.target.value;
    renderTasks();
  });
  $('#clearDone').onclick = () => {
    const done = state.tasks.filter((t) => t.done && inView(t));
    if (!done.length) return;
    if (!confirm(`Delete ${done.length} completed task${done.length === 1 ? '' : 's'}?`)) return;
    const ids = new Set(done.map((t) => t.id));
    removeTasks((t) => ids.has(t.id));
    render();
  };

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      $('#taskInput').focus();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      $('#searchInput').focus();
    } else if (e.ctrlKey && (e.key === '1' || e.key === '2')) {
      e.preventDefault();
      setSpace(SPACES[+e.key - 1]);
    } else if (e.key === 'Escape' && ui.openId) {
      closeDrawer();
    } else if (e.key === 'Escape' && document.activeElement === $('#searchInput')) {
      $('#searchInput').value = '';
      ui.search = '';
      $('#searchInput').blur();
      renderTasks();
    }
  });

  window.addEventListener('resize', () => {
    moveIndicator();
    moveSpaceIndicator();
  });
  setInterval(() => {
    if (!document.querySelector('.task-edit')) render();
  }, 60_000);
}

(async function init() {
  const saved = await window.api.load();
  if (saved && Array.isArray(saved.tasks) && Array.isArray(saved.lists)) {
    state = { ...defaultState(), ...saved };
    if (!SPACES.includes(state.space)) state.space = 'personal';
    for (const l of state.lists) {
      if (!SPACES.includes(l.space)) l.space = l.id === 'work' ? 'work' : 'personal';
    }
    for (const def of defaultState().lists) {
      if (!state.lists.some((l) => l.space === def.space)) {
        state.lists.push(listById(def.id) ? { ...def, id: uid() } : def);
      }
    }
    for (const t of state.tasks) {
      if (typeof t.notes !== 'string') t.notes = '';
      if (!Array.isArray(t.attachments)) t.attachments = [];
    }
  }
  applyTheme();
  state.tasks.forEach((t) => freshIds.add(t.id));
  bindEvents();
  render();
  moveIndicator();
  moveSpaceIndicator();
})();
