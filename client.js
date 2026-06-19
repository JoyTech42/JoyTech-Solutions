// Auth State Management
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (token && user) {
  document.getElementById('auth-zone').innerHTML = `
    <a href="/dashboard" class="btn-dash">Dashboard</a>
    <button onclick="logout()">Logout</button>
  `;
}

function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }

// Handle Login Form Submission
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/dashboard';
    } else {
      alert(data.message || 'Login Failed');
    }
  });
}

function logout() {
  localStorage.clear();
  window.location.href = '/';
}
