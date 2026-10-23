/* Activate — núcleo: sesión, rol y enrutador de vistas */
(function () {
  var cfg = window.APP_CONFIG;
  var sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  var app = document.getElementById('app');
  var escudoSVG = '<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M24 3 41 9v13c0 11-7.2 19.5-17 23C14.2 41.5 7 33 7 22V9l17-6z" fill="#faf6ef"/>'
    + '<path d="M15 31l9-19 9 19h-4.2L27 26.6h-6L19.2 31H15zm7.9-7.7h2.2l-1.1-2.9-1.1 2.9z" fill="#AC3636"/>'
    + '</svg>';

  var Views = window.Views = {};

  function h(html) { var d = document.createElement('div'); d.innerHTML = html; return d; }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function fmtFecha(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T12:00:00');
    var dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    var meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return dias[d.getDay()] + ' ' + d.getDate() + ' de ' + meses[d.getMonth()];
  }
  function hoy() { return new Date().toISOString().slice(0, 10); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  // Semántica heredada: 0=pendiente, 1=no presentado, —=sin calificación
  function notaTexto(g) {
    if (!g) return '—';
    if (g.status === 'pendiente') return '0';
    if (g.status === 'no_presentado') return '1';
    if (g.status === 'calificada' && g.value != null) return String(Math.round(g.value * 10) / 10);
    return '—';
  }
  function notaDetalle(g) {
    if (!g) return 'sin calificación';
    if (g.status === 'pendiente') return 'pendiente de entrega';
    if (g.status === 'no_presentado') return 'no presentado';
    if (g.status === 'calificada' && g.value != null) return 'calificación';
    return 'sin calificación';
  }

  window.A = { sb: sb, h: h, el: el, esc: esc, fmtFecha: fmtFecha, hoy: hoy,
               notaTexto: notaTexto, notaDetalle: notaDetalle, escudoSVG: escudoSVG,
               Views: Views, boot: null };

  /* ---------- Login ---------- */
  function renderLogin() {
    app.innerHTML =
      '<div class="login-wrap"><div class="login-card">'
      + '<div class="escudo">' + escudoSVG + '</div>'
      + '<h1>' + esc(cfg.APP_NAME) + '</h1>'
      + '<div class="escuela">' + esc(cfg.SCHOOL_NAME) + '</div>'
      + '<div id="login-err"></div>'
      + '<form id="flogin">'
      + '<div class="campo"><label for="email">Correo</label>'
      + '<input id="email" type="email" required autocomplete="username" placeholder="tu@correo.com"></div>'
      + '<div class="campo"><label for="pass">Contraseña</label>'
      + '<input id="pass" type="password" required autocomplete="current-password" placeholder="••••••••"></div>'
      + '<button class="btn btn-block" type="submit">Entrar</button>'
      + '</form></div></div>';
    document.getElementById('flogin').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var btn = ev.target.querySelector('button');
      btn.disabled = true; btn.textContent = 'Entrando…';
      sb.auth.signInWithPassword({
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('pass').value
      }).then(function (r) {
        if (r.error) {
          btn.disabled = false; btn.textContent = 'Entrar';
          document.getElementById('login-err').innerHTML =
            '<div class="error-login">' + esc(r.error.message === 'Invalid login credentials'
              ? 'Correo o contraseña incorrectos.' : r.error.message) + '</div>';
        }
      });
    });
  }

  /* ---------- Marco con topbar ---------- */
  function renderShell(account, viewEl) {
    app.innerHTML =
      '<div class="topbar"><div class="escudo">' + escudoSVG + '</div>'
      + '<div><div class="marca">' + esc(cfg.APP_NAME) + '</div>'
      + '<div class="sub">' + esc(cfg.SCHOOL_NAME) + '</div></div>'
      + '<div class="spacer"></div>'
      + '<span class="chip-rol">' + esc(account.role === 'direccion' ? 'Dirección'
          : account.role.charAt(0).toUpperCase() + account.role.slice(1)) + '</span>'
      + '<button class="btn-salir" id="salir">Salir</button></div>'
      + '<div class="main" id="view"></div>';
    document.getElementById('salir').addEventListener('click', function () {
      sb.auth.signOut();
    });
    document.getElementById('view').appendChild(viewEl);
  }

  /* ---------- Arranque ---------- */
  function loadAndRender(session) {
    if (!session) { renderLogin(); return; }
    sb.from('accounts').select('id,role,full_name,school_id').eq('id', session.user.id).single()
      .then(function (r) {
        if (r.error || !r.data) {
          app.innerHTML = '<div class="vacio">Tu usuario no tiene un rol asignado todavía. Avisá a dirección.</div>';
          return;
        }
        var account = r.data;
        var view = el('div');
        view.innerHTML = '<div class="cargando">Cargando…</div>';
        renderShell(account, view);
        var fn = Views[account.role] || Views.familia;
        fn(view, { account: account, user: session.user });
      });
  }

  sb.auth.getSession().then(function (r) { loadAndRender(r.data.session); });
  sb.auth.onAuthStateChange(function (ev, session) {
    if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT' || ev === 'TOKEN_REFRESHED') {
      loadAndRender(session);
    }
  });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
