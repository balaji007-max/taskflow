/* ══════════════════════════════════════════════════
   TaskFlow – app.js  (Part 1: Core, Auth, Dashboard)
══════════════════════════════════════════════════ */

const API = '/api';
let currentUser = null;
let currentProjectId = null;
let currentTaskId = null;
let memberSearchTimeout = null;

// ── Helpers ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const token = () => localStorage.getItem('tf_token');

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${API}${path}`, opts);
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️'}</span> ${msg}`;
  $('toast-container').appendChild(t);
  setTimeout(() => { t.style.animation = 'slideOut .3s forwards'; setTimeout(() => t.remove(), 300); }, 3500);
}

function setLoading(btnId, loading) {
  const btn = $(btnId);
  if (!btn) return;
  btn.querySelector('.btn-text')?.classList.toggle('hidden', loading);
  btn.querySelector('.btn-loader')?.classList.toggle('hidden', !loading);
  btn.disabled = loading;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(d) {
  const diff = Date.now() - new Date(d);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function priorityBadge(p) {
  return `<span class="p-${p}">${p.charAt(0).toUpperCase() + p.slice(1)}</span>`;
}

function statusBadge(s) {
  const labels = { todo: 'Todo', in_progress: 'In Progress', review: 'Review', done: 'Done' };
  return `<span class="s-${s}">${labels[s] || s}</span>`;
}

function isOverdue(due) {
  return due && new Date(due) < new Date() && true;
}

// ── Routing ──────────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const pg = document.getElementById(`page-${name}`);
  if (pg) { pg.classList.remove('hidden'); pg.classList.add('active'); }
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === name));
  $('page-title').textContent = ({ dashboard: 'Dashboard', projects: 'Projects', 'my-tasks': 'My Tasks', users: 'Users', 'project-detail': 'Project' })[name] || '';
  $('sidebar').classList.remove('open');
}

function navigate(page, extra) {
  if (page === 'project-detail' && extra) {
    currentProjectId = extra;
    loadProjectDetail(extra);
  } else if (page === 'dashboard') {
    loadDashboard();
  } else if (page === 'projects') {
    loadProjects();
  } else if (page === 'my-tasks') {
    loadMyTasks();
  } else if (page === 'users') {
    loadUsers();
  }
  showPage(page);
}

// ── Auth ─────────────────────────────────────────────────────
function showAuth() {
  $('auth-section').classList.remove('hidden');
  $('app-shell').classList.add('hidden');
}

function showApp() {
  $('auth-section').classList.add('hidden');
  $('app-shell').classList.remove('hidden');
  if (currentUser) {
    $('sidebar-avatar').textContent = currentUser.avatar || '👤';
    $('sidebar-name').textContent = currentUser.name;
    $('sidebar-role').textContent = currentUser.role;
    $('sidebar-role').className = `badge ${currentUser.role}`;
    $('topbar-avatar').textContent = currentUser.avatar || '👤';
    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('hidden', currentUser.role !== 'admin');
    });
  }
}

async function tryAutoLogin() {
  if (!token()) return showAuth();
  try {
    const data = await req('GET', '/auth/me');
    currentUser = data.user;
    showApp();
    navigate('dashboard');
  } catch { localStorage.removeItem('tf_token'); showAuth(); }
}

// Tab switching
document.querySelectorAll('.auth-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    $('login-form').classList.toggle('hidden', tab !== 'login');
    $('signup-form').classList.toggle('hidden', tab !== 'signup');
  });
});

$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  $('login-error').classList.add('hidden');
  setLoading('login-btn', true);
  try {
    const data = await req('POST', '/auth/login', {
      email: $('login-email').value,
      password: $('login-password').value
    });
    localStorage.setItem('tf_token', data.token);
    currentUser = data.user;
    showApp();
    navigate('dashboard');
    toast(`Welcome back, ${data.user.name}! 👋`);
  } catch (err) {
    $('login-error').textContent = err.message;
    $('login-error').classList.remove('hidden');
  } finally { setLoading('login-btn', false); }
});

$('signup-form').addEventListener('submit', async e => {
  e.preventDefault();
  $('signup-error').classList.add('hidden');
  setLoading('signup-btn', true);
  try {
    const data = await req('POST', '/auth/signup', {
      name: $('signup-name').value,
      email: $('signup-email').value,
      password: $('signup-password').value,
      role: $('signup-role').value
    });
    localStorage.setItem('tf_token', data.token);
    currentUser = data.user;
    showApp();
    navigate('dashboard');
    toast(`Account created! Welcome, ${data.user.name}! 🎉`);
  } catch (err) {
    $('signup-error').textContent = err.message;
    $('signup-error').classList.remove('hidden');
  } finally { setLoading('signup-btn', false); }
});

$('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('tf_token');
  currentUser = null;
  showAuth();
  toast('Logged out successfully', 'warn');
});

// ── Sidebar / hamburger ───────────────────────────────────────
$('hamburger').addEventListener('click', () => $('sidebar').classList.toggle('open'));
$('sidebar-close').addEventListener('click', () => $('sidebar').classList.remove('open'));
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => navigate(item.dataset.page));
});
document.querySelectorAll('.link-btn[data-page]').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.page));
});
$('back-to-projects').addEventListener('click', () => navigate('projects'));

// ── Modal helpers ─────────────────────────────────────────────
function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) { $(id).classList.add('hidden'); }
document.querySelectorAll('.modal-close, [data-modal]').forEach(el => {
  el.addEventListener('click', () => closeModal(el.dataset.modal || el.closest('.modal-overlay').id));
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
});

// ── Dashboard ─────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await req('GET', '/dashboard');
    const s = data.stats;
    $('stat-projects').textContent = s.projects;
    $('stat-tasks').textContent = s.tasks;
    $('stat-overdue').textContent = s.overdue;
    $('stat-completed').textContent = s.completed;
    $('dash-greeting').textContent = `Welcome back, ${currentUser?.name || 'there'}! 👋`;

    // My tasks
    const myEl = $('dash-my-tasks');
    myEl.innerHTML = data.myTasks.length
      ? data.myTasks.map(t => `
          <div class="task-mini" onclick="openTaskById('${t.id}','${t.project_id||''}')">
            <div class="task-mini-title">${t.title}</div>
            <div class="task-mini-meta">
              ${priorityBadge(t.priority)} ${statusBadge(t.status)}
              <span style="margin-left:auto;color:${isOverdue(t.due_date)?'var(--danger)':'var(--muted)'}">${formatDate(t.due_date)}</span>
              <span style="font-size:11px;color:var(--muted)">${t.project_name}</span>
            </div>
          </div>`).join('')
      : '<div class="empty-state">🎉 No pending tasks!</div>';

    // Overdue
    const odEl = $('dash-overdue');
    odEl.innerHTML = data.overdueTasks.length
      ? data.overdueTasks.map(t => `
          <div class="task-mini" style="border-color:var(--danger)">
            <div class="task-mini-title">${t.title}</div>
            <div class="task-mini-meta">
              ${priorityBadge(t.priority)}
              <span class="overdue-badge">⚠️ ${formatDate(t.due_date)}</span>
              <span>${t.project_name}</span>
            </div>
          </div>`).join('')
      : '<div class="empty-state">✅ No overdue tasks!</div>';

    // Recent projects
    const rpEl = $('dash-projects');
    rpEl.innerHTML = data.recentProjects.length
      ? data.recentProjects.map(p => `
          <div class="project-mini-card" style="border-color:${p.color}" onclick="navigate('project-detail','${p.id}')">
            <div class="project-mini-name">${p.name}</div>
            <div class="project-mini-stats">${p.task_count} tasks · ${p.done_count} done</div>
          </div>`).join('')
      : '<div class="empty-state">No projects yet</div>';

    // Activity
    const actEl = $('dash-activity');
    actEl.innerHTML = data.recentActivity.length
      ? data.recentActivity.map(a => `
          <div class="activity-item">
            <div class="activity-avatar">${a.user_avatar || '👤'}</div>
            <div class="activity-body">
              <span>${a.user_name || 'Someone'}</span> – ${a.details || a.action}
              <div class="activity-time">${timeAgo(a.created_at)}</div>
            </div>
          </div>`).join('')
      : '<div class="empty-state">No activity yet</div>';

    // Status chart
    const total = data.statusBreakdown.reduce((s, r) => s + Number(r.cnt), 0) || 1;
    const colors = { todo: '#94a3b8', in_progress: '#22d3ee', review: '#f59e0b', done: '#10b981' };
    const labels = { todo: 'Todo', in_progress: 'In Progress', review: 'Review', done: 'Done' };
    $('dash-status-chart').innerHTML = ['todo','in_progress','review','done'].map(s => {
      const row = data.statusBreakdown.find(r => r.status === s);
      const cnt = row ? Number(row.cnt) : 0;
      const pct = Math.round(cnt / total * 100);
      return `<div class="status-bar-row">
        <div class="status-bar-label">${labels[s]}</div>
        <div class="status-bar-track"><div class="status-bar-fill" style="width:${pct}%;background:${colors[s]}"></div></div>
        <div class="status-bar-count">${cnt}</div>
      </div>`;
    }).join('');
  } catch (err) { toast(err.message, 'error'); }
}

// ── Projects ──────────────────────────────────────────────────
let allProjects = [];
async function loadProjects() {
  try {
    const data = await req('GET', '/projects');
    allProjects = data.projects;
    renderProjects(allProjects);
    if (currentUser?.role === 'admin') $('btn-new-project').classList.remove('hidden');
  } catch (err) { toast(err.message, 'error'); }
}

function renderProjects(projects) {
  const grid = $('projects-grid');
  if (!projects.length) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:40px">No projects found. Create your first project!</div>'; return; }
  grid.innerHTML = projects.map(p => {
    const done = Number(p.done_count || 0);
    const total = Number(p.task_count || 0);
    const pct = total ? Math.round(done / total * 100) : 0;
    return `<div class="project-card" onclick="navigate('project-detail','${p.id}')">
      <div class="project-card-top" style="background:${p.color}"></div>
      <div class="project-card-body">
        <div class="project-card-name">${p.name}</div>
        <div class="project-card-desc">${p.description || 'No description provided.'}</div>
        <div class="project-card-meta">
          <span>👥 ${p.member_count} members</span>
          <span>📋 ${p.task_count} tasks</span>
          ${p.deadline ? `<span>📅 ${formatDate(p.deadline)}</span>` : ''}
        </div>
        <div class="project-card-progress">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:4px">
            <span>Progress</span><span>${pct}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${p.color}"></div></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

$('project-search').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  renderProjects(allProjects.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)));
});

// New project
$('btn-new-project').addEventListener('click', () => {
  $('modal-project-title').textContent = 'New Project';
  $('project-id').value = '';
  $('form-project').reset();
  $('project-color').value = '#6366f1';
  $('btn-save-project').textContent = 'Create Project';
  openModal('modal-project');
});

$('form-project').addEventListener('submit', async e => {
  e.preventDefault();
  const id = $('project-id').value;
  const body = {
    name: $('project-name').value,
    description: $('project-desc').value || null,
    deadline: $('project-deadline').value || null,
    color: $('project-color').value
  };
  try {
    if (id) {
      await req('PUT', `/projects/${id}`, body);
      toast('Project updated ✨');
    } else {
      await req('POST', '/projects', body);
      toast('Project created! 🚀');
    }
    closeModal('modal-project');
    loadProjects();
  } catch (err) { toast(err.message, 'error'); }
});

// ── My Tasks ─────────────────────────────────────────────────
let myTasksData = [];
async function loadMyTasks() {
  try {
    // Collect tasks across all user projects where assigned_to = me
    const data = await req('GET', '/dashboard');
    // Build flat list from dashboard + filter
    const projects = await req('GET', '/projects');
    let all = [];
    for (const p of projects.projects) {
      try {
        const td = await req('GET', `/projects/${p.id}/tasks`);
        all.push(...td.tasks.map(t => ({ ...t, project_name: p.name, project_color: p.color, project_id: p.id })));
      } catch {}
    }
    // filter only mine
    myTasksData = all.filter(t => t.assigned_to === currentUser?.id || t.created_by === currentUser?.id);
    renderMyTasks();
  } catch (err) { toast(err.message, 'error'); }
}

function renderMyTasks() {
  const status = $('mytask-status-filter').value;
  const priority = $('mytask-priority-filter').value;
  let tasks = myTasksData;
  if (status) tasks = tasks.filter(t => t.status === status);
  if (priority) tasks = tasks.filter(t => t.priority === priority);

  const el = $('my-tasks-list');
  if (!tasks.length) { el.innerHTML = '<div class="empty-state" style="padding:40px">No tasks found.</div>'; return; }
  el.innerHTML = tasks.map(t => `
    <div class="task-row" onclick="openTaskDetail('${t.id}','${t.project_id}')">
      <div style="font-size:18px">${t.assignee_avatar || '📋'}</div>
      <div style="flex:1">
        <div class="task-row-title">${t.title}</div>
        <div class="task-row-project">${t.project_name}</div>
      </div>
      <div class="task-row-badges">
        ${statusBadge(t.status)} ${priorityBadge(t.priority)}
        <span style="font-size:12px;color:${isOverdue(t.due_date)?'var(--danger)':'var(--muted)'}">${formatDate(t.due_date)}</span>
      </div>
    </div>`).join('');
}

$('mytask-status-filter').addEventListener('change', renderMyTasks);
$('mytask-priority-filter').addEventListener('change', renderMyTasks);

// ── Project Detail & Kanban ───────────────────────────────────
let currentProjectData = null;
let currentProjectMembers = [];

async function loadProjectDetail(projectId) {
  try {
    const data = await req('GET', `/projects/${projectId}`);
    const p = data.project;
    currentProjectData = p;
    currentProjectMembers = p.members || [];

    $('detail-project-name').textContent = p.name;
    $('detail-project-status').textContent = p.status;
    $('detail-project-status').className = `badge ${p.status === 'active' ? 'admin' : ''}`;

    $('project-meta-bar').innerHTML = `
      <span>👤 ${p.owner_name}</span>
      <span>📅 Created: ${formatDate(p.created_at)}</span>
      ${p.deadline ? `<span>⏳ Deadline: ${formatDate(p.deadline)}</span>` : ''}
      ${p.description ? `<span>📝 ${p.description}</span>` : ''}
    `;

    // Show add member / new task buttons based on role
    const isAdmin = currentUser?.role === 'admin';
    const isProjAdmin = isAdmin || currentProjectMembers.find(m => m.id === currentUser?.id && m.role === 'admin');
    $('btn-add-member').classList.toggle('hidden', !isProjAdmin);

    renderKanban(projectId);
    renderMembers(currentProjectMembers, isProjAdmin);
  } catch (err) { toast(err.message, 'error'); }
}

async function renderKanban(projectId) {
  try {
    const data = await req('GET', `/projects/${projectId}/tasks`);
    const tasks = data.tasks;
    const statuses = ['todo', 'in_progress', 'review', 'done'];

    statuses.forEach(s => {
      const col = document.getElementById(`col-${s}`);
      const cnt = document.getElementById(`count-${s}`);
      const filtered = tasks.filter(t => t.status === s);
      cnt.textContent = filtered.length;
      col.innerHTML = filtered.length
        ? filtered.map(t => taskCardHTML(t)).join('')
        : `<div style="font-size:13px;color:var(--muted);text-align:center;padding:20px">Drop tasks here</div>`;
    });
  } catch (err) { toast(err.message, 'error'); }
}

function taskCardHTML(t) {
  const due = t.due_date ? `<span class="task-due ${isOverdue(t.due_date) ? 'overdue' : ''}">${formatDate(t.due_date)}</span>` : '';
  return `<div class="task-card" onclick="openTaskDetail('${t.id}','${t.project_id}')">
    <div class="task-card-title">${t.title}</div>
    <div class="task-card-meta">
      ${priorityBadge(t.priority)}
      <div style="display:flex;align-items:center;gap:6px">
        ${due}
        <span class="task-card-assignee">${t.assignee_avatar || '👤'}</span>
      </div>
    </div>
  </div>`;
}

function renderMembers(members, canManage) {
  const el = $('project-members-list');
  if (!members.length) { el.innerHTML = '<div class="empty-state">No members yet</div>'; return; }
  el.innerHTML = members.map(m => `
    <div class="member-row">
      <div class="member-avatar">${m.avatar || '👤'}</div>
      <div class="member-info">
        <div class="member-name">${m.name}</div>
        <div class="member-email">${m.email}</div>
      </div>
      <span class="badge ${m.role}">${m.role}</span>
      ${canManage && m.id !== currentUser?.id
        ? `<button class="btn-sm btn-danger" onclick="removeMember('${m.id}')">Remove</button>`
        : ''}
    </div>`).join('');
}

async function removeMember(userId) {
  if (!confirm('Remove this member from the project?')) return;
  try {
    await req('DELETE', `/projects/${currentProjectId}/members/${userId}`);
    toast('Member removed');
    loadProjectDetail(currentProjectId);
  } catch (err) { toast(err.message, 'error'); }
}

// ── New Task ──────────────────────────────────────────────────
$('btn-new-task').addEventListener('click', async () => {
  $('modal-task-title').textContent = 'New Task';
  $('task-id').value = '';
  $('form-task').reset();
  $('task-priority').value = 'medium';
  $('task-status').value = 'todo';
  $('btn-save-task').textContent = 'Create Task';

  // Populate assignees
  const sel = $('task-assignee');
  sel.innerHTML = '<option value="">Unassigned</option>';
  currentProjectMembers.forEach(m => {
    sel.innerHTML += `<option value="${m.id}">${m.avatar || '👤'} ${m.name}</option>`;
  });

  openModal('modal-task');
});

$('form-task').addEventListener('submit', async e => {
  e.preventDefault();
  const id = $('task-id').value;
  const body = {
    title: $('task-title').value,
    description: $('task-desc').value || null,
    status: $('task-status').value,
    priority: $('task-priority').value,
    assigned_to: $('task-assignee').value || null,
    due_date: $('task-due-date').value || null
  };
  try {
    if (id) {
      await req('PUT', `/projects/${currentProjectId}/tasks/${id}`, body);
      toast('Task updated ✨');
    } else {
      await req('POST', `/projects/${currentProjectId}/tasks`, body);
      toast('Task created! 🎯');
    }
    closeModal('modal-task');
    renderKanban(currentProjectId);
    closeModal('modal-task-detail');
  } catch (err) { toast(err.message, 'error'); }
});

// ── Task Detail Modal ─────────────────────────────────────────
async function openTaskDetail(taskId, projectId) {
  if (projectId) currentProjectId = projectId;
  currentTaskId = taskId;
  try {
    const data = await req('GET', `/projects/${currentProjectId}/tasks/${taskId}`);
    const t = data.task;

    $('detail-task-title').textContent = t.title;
    $('task-detail-meta').innerHTML = `
      ${statusBadge(t.status)} ${priorityBadge(t.priority)}
      <span style="font-size:13px;color:var(--muted)">👤 ${t.assignee_name || 'Unassigned'}</span>
      ${t.due_date ? `<span style="font-size:13px;color:${isOverdue(t.due_date)?'var(--danger)':'var(--muted)'}">📅 ${formatDate(t.due_date)}</span>` : ''}
    `;
    $('task-detail-desc').textContent = t.description || 'No description provided.';

    // Comments
    const cl = $('comments-list');
    cl.innerHTML = (t.comments || []).length
      ? t.comments.map(c => `
          <div class="comment-item">
            <div class="comment-avatar">${c.user_avatar || '👤'}</div>
            <div class="comment-body">
              <div class="comment-author">${c.user_name}</div>
              <div class="comment-text">${c.content}</div>
              <div class="comment-time">${timeAgo(c.created_at)}</div>
            </div>
          </div>`).join('')
      : '<div class="empty-state" style="padding:12px">No comments yet. Be the first!</div>';

    openModal('modal-task-detail');
  } catch (err) { toast(err.message, 'error'); }
}

async function openTaskById(taskId, projectId) {
  await openTaskDetail(taskId, projectId);
}

// Edit task from detail modal
$('btn-edit-task-detail').addEventListener('click', async () => {
  closeModal('modal-task-detail');
  try {
    const data = await req('GET', `/projects/${currentProjectId}/tasks/${currentTaskId}`);
    const t = data.task;
    $('modal-task-title').textContent = 'Edit Task';
    $('task-id').value = t.id;
    $('task-title').value = t.title;
    $('task-desc').value = t.description || '';
    $('task-status').value = t.status;
    $('task-priority').value = t.priority;
    $('task-due-date').value = t.due_date ? t.due_date.split('T')[0] : '';
    $('btn-save-task').textContent = 'Update Task';

    // Populate assignees
    if (!currentProjectMembers.length) {
      const pd = await req('GET', `/projects/${currentProjectId}`);
      currentProjectMembers = pd.project.members || [];
    }
    const sel = $('task-assignee');
    sel.innerHTML = '<option value="">Unassigned</option>';
    currentProjectMembers.forEach(m => {
      sel.innerHTML += `<option value="${m.id}" ${t.assigned_to === m.id ? 'selected' : ''}>${m.avatar || '👤'} ${m.name}</option>`;
    });

    openModal('modal-task');
  } catch (err) { toast(err.message, 'error'); }
});

// Delete task from detail modal
$('btn-delete-task-detail').addEventListener('click', async () => {
  if (!confirm('Delete this task? This cannot be undone.')) return;
  try {
    await req('DELETE', `/projects/${currentProjectId}/tasks/${currentTaskId}`);
    toast('Task deleted', 'warn');
    closeModal('modal-task-detail');
    renderKanban(currentProjectId);
  } catch (err) { toast(err.message, 'error'); }
});

// Post comment
$('form-comment').addEventListener('submit', async e => {
  e.preventDefault();
  const content = $('comment-input').value.trim();
  if (!content) return;
  try {
    await req('POST', `/projects/${currentProjectId}/tasks/${currentTaskId}/comments`, { content });
    $('comment-input').value = '';
    await openTaskDetail(currentTaskId, currentProjectId);
  } catch (err) { toast(err.message, 'error'); }
});

// ── Add Member Modal ──────────────────────────────────────────
$('btn-add-member').addEventListener('click', () => {
  $('member-search').value = '';
  $('member-search-results').innerHTML = '';
  $('member-user-id').value = '';
  $('member-role').value = 'member';
  openModal('modal-add-member');
});

$('member-search').addEventListener('input', e => {
  clearTimeout(memberSearchTimeout);
  const q = e.target.value.trim();
  if (!q) { $('member-search-results').innerHTML = ''; return; }
  memberSearchTimeout = setTimeout(async () => {
    try {
      const data = await req('GET', `/users/search?q=${encodeURIComponent(q)}`);
      const res = $('member-search-results');
      res.innerHTML = data.users.length
        ? data.users.map(u => `
            <div class="search-result-item" onclick="selectMember('${u.id}','${u.name}')">
              <span>${u.avatar || '👤'}</span>
              <div>
                <div>${u.name}</div>
                <div style="font-size:11px;color:var(--muted)">${u.email}</div>
              </div>
            </div>`).join('')
        : '<div style="padding:10px;font-size:13px;color:var(--muted)">No users found</div>';
    } catch {}
  }, 300);
});

function selectMember(id, name) {
  $('member-user-id').value = id;
  $('member-search').value = name;
  $('member-search-results').innerHTML = '';
}

$('btn-confirm-add-member').addEventListener('click', async () => {
  const userId = $('member-user-id').value;
  if (!userId) { toast('Please select a user first', 'warn'); return; }
  try {
    await req('POST', `/projects/${currentProjectId}/members`, {
      userId,
      role: $('member-role').value
    });
    toast('Member added! 🎉');
    closeModal('modal-add-member');
    loadProjectDetail(currentProjectId);
  } catch (err) { toast(err.message, 'error'); }
});

// ── Users Management (Admin) ──────────────────────────────────
async function loadUsers() {
  try {
    const data = await req('GET', '/users');
    const el = $('users-list');
    if (!data.users.length) { el.innerHTML = '<div class="empty-state" style="padding:40px">No users found</div>'; return; }
    el.innerHTML = data.users.map(u => `
      <div class="user-row">
        <div class="user-row-avatar">${u.avatar || '👤'}</div>
        <div class="user-row-info">
          <div class="user-row-name">${u.name}</div>
          <div class="user-row-email">${u.email}</div>
        </div>
        <span class="badge ${u.role}">${u.role}</span>
        <div class="user-row-actions">
          <select class="filter-bar select" onchange="changeUserRole('${u.id}',this.value)" style="padding:6px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px">
            <option value="member" ${u.role==='member'?'selected':''}>Member</option>
            <option value="admin"  ${u.role==='admin' ?'selected':''}>Admin</option>
          </select>
          ${u.id !== currentUser?.id
            ? `<button class="btn-sm btn-danger" onclick="deleteUser('${u.id}')">Delete</button>`
            : '<span style="font-size:12px;color:var(--muted)">(you)</span>'}
        </div>
      </div>`).join('');
  } catch (err) { toast(err.message, 'error'); }
}

async function changeUserRole(userId, role) {
  try {
    await req('PUT', `/users/${userId}/role`, { role });
    toast('Role updated ✅');
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteUser(userId) {
  if (!confirm('Delete this user? This cannot be undone.')) return;
  try {
    await req('DELETE', `/users/${userId}`);
    toast('User deleted', 'warn');
    loadUsers();
  } catch (err) { toast(err.message, 'error'); }
}

// ── Start app ─────────────────────────────────────────────────
tryAutoLogin();
