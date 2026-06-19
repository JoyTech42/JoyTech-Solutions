// Universal Session Hooks
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

// Dynamic Layout Navigation State adjustments
if (token && user && document.getElementById('auth-zone')) {
  document.getElementById('auth-zone').innerHTML = `
    <a href="/dashboard" class="btn btn-accent">My Dashboard</a>
    <button class="btn" onclick="logout()">Sign Out</button>
  `;
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function logout() { localStorage.clear(); window.location.href = '/'; }

// Content Loader logic
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById('services-grid')) loadServices();
  if (document.getElementById('dashboard-tbody')) loadDashboardData();
});

async function loadServices() {
  const res = await fetch('/api/services');
  const services = await res.json();
  const grid = document.getElementById('services-grid');
  grid.innerHTML = services.map(s => `
    <div class="card">
      <span class="category-tag">${s.category}</span>
      <h3>${s.title}</h3>
      <p>${s.description}</p>
      <div class="card-footer">
        <span class="price">KES ${parseFloat(s.price).toFixed(2)}</span>
        <button class="btn btn-accent" onclick="initiateOrder(${s.id}, '${s.title}')">Order Online</button>
      </div>
    </div>
  `).join('');
}

function initiateOrder(id, title) {
  if (!token) return openModal('login-modal');
  document.getElementById('order-service-id').value = id;
  document.getElementById('order-title').innerText = `Order: ${title}`;
  openModal('order-modal');
}

// Submissions Event Bindings
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: document.getElementById('login-email').value, password: document.getElementById('login-password').value })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/dashboard';
    } else alert(data.message);
  });
}

const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: document.getElementById('reg-name').value, email: document.getElementById('reg-email').value, password: document.getElementById('reg-password').value })
    });
    if (res.ok) { alert('Registration Successful! Please Log in.'); closeModal('register-modal'); openModal('login-modal'); }
    else alert('Registration failed.');
  });
}

const orderForm = document.getElementById('order-form');
if (orderForm) {
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ serviceId: document.getElementById('order-service-id').value, details: document.getElementById('order-details').value })
    });
    if (res.ok) { alert('Your service instruction has been submitted successfully!'); window.location.href = '/dashboard'; }
    else alert('Failed to create order entry.');
  });
}

// Dashboard Hydration Workflow
async function loadDashboardData() {
  if (!token) { window.location.href = '/'; return; }
  document.getElementById('user-greeting').innerText = `Active User: ${user.name}`;

  const res = await fetch('/api/requests/dashboard', { headers: { 'Authorization': `Bearer ${token}` } });
  const data = await res.json();

  const headers = document.getElementById('table-headers');
  const tbody = document.getElementById('dashboard-tbody');
  document.getElementById('dashboard-view-title').innerText = data.role === 'admin' ? 'Global System Operations Control' : 'Your Personal Request Pipeline';

  if (data.role === 'admin') {
    headers.innerHTML = `<th>ID</th><th>Customer</th><th>Service</th><th>Job Instructions/Details</th><th>Processing Status</th>`;
    tbody.innerHTML = data.requests.map(r => `
      <tr>
        <td>#00${r.id}</td>
        <td><strong>${r.customer_name}</strong><br><small>${r.customer_email}</small></td>
        <td>${r.title}</td>
        <td><p class="table-details">${r.details}</p></td>
        <td>
          <select class="status-select status-${r.status}" onchange="updateStatus(${r.id}, this.value)">
            <option value="pending" ${r.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="processing" ${r.status === 'processing' ? 'selected' : ''}>Processing</option>
            <option value="completed" ${r.status === 'completed' ? 'selected' : ''}>Completed</option>
            <option value="cancelled" ${r.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
      </tr>
    `).join('');
  } else {
    headers.innerHTML = `<th>Request ID</th><th>Service Catalog Job</th><th>Your Custom Details</th><th>Job Pipeline Status</th>`;
    tbody.innerHTML = data.requests.map(r => `
      <tr>
        <td>#00${r.id}</td>
        <td><strong>${r.title}</strong><br><small>Cost: KES ${r.price}</small></td>
        <td><p class="table-details">${r.details}</p></td>
        <td><span class="status-badge status-${r.status}">${r.status.toUpperCase()}</span></td>
      </tr>
    `).join('');
  }
}

async function updateStatus(id, newStatus) {
  const res = await fetch(`/api/requests/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ status: newStatus })
  });
  if (res.ok) loadDashboardData();
}
