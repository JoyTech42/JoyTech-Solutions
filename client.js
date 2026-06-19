// --- THEME STATE LOGIC ---
(function applyThemeOnLoad() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
  }
})();

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// --- STANDARD EXECUTIONS COPY FROM OLD FILE ---
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (token && user && document.getElementById('auth-zone')) {
  document.getElementById('auth-zone').innerHTML = `
    <a href="/dashboard" class="btn btn-accent" style="margin-right:0.5rem">Dashboard</a>
    <button class="btn" onclick="logout()">Sign Out</button>
  `;
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function logout() { localStorage.clear(); window.location.href = '/'; }

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById('services-grid')) loadServices();
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
        <button class="btn btn-accent" onclick="initiateOrder(${s.id}, '${s.title}')">Order</button>
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
