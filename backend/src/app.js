const apiUrl = window.location.origin;

function showRegister() {
  document.getElementById("login-section").classList.add("hidden");
  document.getElementById("register-section").classList.remove("hidden");
}

function showLogin() {
  document.getElementById("register-section").classList.add("hidden");
  document.getElementById("login-section").classList.remove("hidden");
}

async function register() {
  const name = document.getElementById("reg-name").value.trim();
  const password = document.getElementById("reg-password").value.trim();
  const company = document.getElementById("reg-company").value.trim();

  if (!name || !password || !company) {
    alert('Por favor preenche todos os campos.');
    return;
  }

  try {
    const res = await fetch(`${apiUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password, company }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message || 'Conta criada com sucesso!');
      showLogin();
    } else {
      alert(data.message || 'Erro ao registar.');
    }
  } catch (err) {
    alert('Erro de ligação ao servidor: ' + err.message);
  }
}

async function login() {
  const name = document.getElementById("login-name").value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!name || !password) {
    alert('Por favor preenche o nome e a palavra-passe.');
    return;
  }

  try {
    const res = await fetch(`${apiUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });
    const data = await res.json();

    if (res.ok) {
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = 'painel.html';
      } else {
        localStorage.setItem('user', JSON.stringify({ name }));
        window.location.href = 'painel.html';
      }
    } else {
      alert(data.message || 'Erro no login.');
    }
  } catch (err) {
    alert('Erro de ligação ao servidor: ' + err.message);
  }
}