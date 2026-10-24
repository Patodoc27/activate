/* Activate — núcleo: sesión, rol y enrutador de vistas */
(function () {
  var cfg = window.APP_CONFIG;
  var sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  var app = document.getElementById('app');
  var escudoIMG = '<img class="escudo-img" src="escudo.png" alt="Escudo del colegio">';

  var ICONS = {
    lapiz: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
    calendario: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    ojo: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    alerta: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
    alertaAlumno: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.2" cy="6.8" r="3.1"/><path d="M1.8 15.5c.6-3.2 3.3-5 6.4-5 1.9 0 3.6.7 4.8 1.9"/><path d="M14.5 12.2 18.8 5.4c.3-.5 1.1-.5 1.4 0l4.3 6.8c.35.55-.05 1.25-.7 1.25h-8.6c-.65 0-1.05-.7-.7-1.25z" transform="translate(-4.5 7.6) scale(.86)" fill="currentColor" stroke="none"/><path d="M19.4 12.6v3.1m0 2.6h.01" stroke="#fff" stroke-width="2.1"/></svg>',
    libro: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM20 22H6.5a2.5 2.5 0 0 1 0-5"/></svg>',
    campana: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    tilde: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    sobre: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m3 6 9 7 9-7"/></svg>',
    candado: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
  };
  function icon(nombre) { return ICONS[nombre] || ''; }

  var TIPO_NOMBRES = { eval: 'Evaluación escrita', oral: 'Evaluación oral',
    tp: 'Trabajo práctico', cuest: 'Cuestionario virtual', juego: 'Juego educativo',
    agust: 'Perfil agustiniano', part: 'Participación en clase', carp: 'Carpeta',
    proy: 'Proyecto', mesa: 'Mesa / instancia final', otro: 'Otra actividad' };
  function nombreTipo(k) { return TIPO_NOMBRES[k] || ''; }
  // "Historia (1° A)" y "Historia" son la misma materia para mostrar
  function nombreMateria(n) {
    return (n || '').replace(/[\(\[]?\s*1[°º]\s*[AB]\s*[\)\]]?/g, ' ')
      .replace(/\s{2,}/g, ' ').trim()
      .replace(/\bY\b/g, 'y');
  }
  var TIPO_CLAVES = { eval: ['evaluac', 'examen', 'prueba'], oral: ['oral', 'coloquio'],
    tp: ['trabajo', 'practico', 'tp'], cuest: ['cuestionario'], juego: ['juego'],
    agust: ['agust', 'perfil'], part: ['particip'], carp: ['carpeta'],
    proy: ['proyect', 'integrador'], otro: [] };
  function sinTildes(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function tipoActividad(a) {
    if (!a || !a.kind) return '';
    var t = TIPO_NOMBRES[a.kind];
    if (!t) return '';
    var tit = sinTildes(a.title);
    var claves = TIPO_CLAVES[a.kind] || [];
    for (var i = 0; i < claves.length; i++) if (tit.indexOf(claves[i]) !== -1) return '';
    return t + ' · ';
  }
  // Palabras de cada categoría: se quitan del título para no repetir
  var PALABRAS_TIPO = {
    eval: ['evaluacion', 'evaluación', 'escrita', 'escrito', 'examen', 'prueba', 'test'],
    oral: ['oral', 'coloquio', 'exposicion', 'exposición'],
    tp: ['trabajo', 'practico', 'práctico', 'tp', 'tps'],
    cuest: ['cuestionario', 'cuestionarios', 'virtual', 'virtuales', 'quiz', 'forms'],
    juego: ['juego', 'juegos', 'educativo', 'educativa', 'educativos', 'ludico', 'lúdico', 'ludica', 'lúdica', 'trivia'],
    agust: ['perfil', 'agustiniano', 'agustiniana', 'agustino'],
    part: ['participacion', 'participación', 'clase', 'clases'],
    carp: ['carpeta', 'carpetas'],
    proy: ['proyecto', 'integrador', 'integradora'],
    mesa: ['mesa', 'intensificacion', 'intensificación'],
    otro: [] };
  var STOP = { en: 1, de: 1, del: 1, el: 1, la: 1, los: 1, las: 1, y: 1, a: 1, e: 1, o: 1, u: 1, con: 1, por: 1, para: 1, un: 1, una: 1 };
  // Texto a mostrar: 'Tipo · tema' sin repetir palabras de la categoría;
  // si el tema queda vacío se muestra solo el tipo.
  function nombreActividad(a) {
    if (!a) return '';
    var tipo = nombreTipo(a.kind);
    var t = String(a.title || '').replace(/[\s:.,;\-–·"']+/g, ' ').trim();
    if (a.kind === 'mesa' || !tipo) return t ? t.charAt(0).toUpperCase() + t.slice(1) : tipo;
    var kw = PALABRAS_TIPO[a.kind] || [];
    if (kw.length) {
      t = t.replace(new RegExp('\\b(' + kw.join('|') + ')\\b', 'gi'), ' ')
        .replace(/\s{2,}/g, ' ').trim();
    }
    var queda = t.split(' ').filter(function (w) { return !STOP[w.toLowerCase()]; }).join(' ').trim();
    if (!queda) return tipo;
    t = t.charAt(0).toUpperCase() + t.slice(1);
    return tipo + ' · ' + t;
  }

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

  function diasHasta(iso) {
    if (!iso) return null;
    var h = new Date(); h.setHours(0, 0, 0, 0);
    var d = new Date(iso + 'T12:00:00'); d.setHours(0, 0, 0, 0);
    return Math.round((d - h) / 86400000);
  }
  function textoDias(iso) {
    var n = diasHasta(iso);
    if (n == null) return '';
    if (n === 0) return 'hoy';
    if (n === 1) return 'mañana';
    if (n > 1) return 'en ' + n + ' días';
    if (n === -1) return 'ayer';
    return 'hace ' + (-n) + ' días';
  }
  function chipDias(iso) {
    var n = diasHasta(iso);
    if (n == null) return '';
    var cl = n === 0 ? 'hoy' : (n < 0 ? 'vencio' : (n <= 3 ? 'pronto' : ''));
    return '<span class="dias ' + cl + '">' + textoDias(iso) + '</span>';
  }

  window.A = { sb: sb, h: h, el: el, esc: esc, fmtFecha: fmtFecha, hoy: hoy,
               notaTexto: notaTexto, notaDetalle: notaDetalle, escudoIMG: escudoIMG,
               icon: icon, diasHasta: diasHasta, textoDias: textoDias, chipDias: chipDias,
               nombreTipo: nombreTipo, tipoActividad: tipoActividad, nombreMateria: nombreMateria,
               nombreActividad: nombreActividad,
               Views: Views, boot: null };

  /* ---------- Login ---------- */
  function renderLogin() {
    app.innerHTML =
      '<div class="login-wrap">'
      + '<div class="login-hero"><div class="marca-row">' + escudoIMG
      + '<div class="marca-col"><div class="escuela">' + esc(cfg.SCHOOL_NAME) + '</div>'
      + '<h1>' + esc(cfg.APP_NAME) + '</h1></div></div>'
      + '<div class="tagline">Las notas, actividades y entregas del colegio, siempre al día — para docentes, familias, estudiantes y dirección.</div>'
      + '</div>'
      + '<div class="login-body"><div class="login-card"><div class="card-lip"></div>'
      + '<h2>Entrar</h2><div class="sub-login">Con tu cuenta del colegio</div>'
      + '<div id="login-err"></div>'
      + '<form id="flogin">'
      + '<div class="campo"><label for="email">Correo</label>'
      + '<div class="inp-wrap">' + icon('sobre') + '<input id="email" type="email" required autocomplete="username" placeholder="tu@correo.com"></div></div>'
      + '<div class="campo"><label for="pass">Contraseña</label>'
      + '<div class="inp-wrap">' + icon('candado') + '<input id="pass" type="password" required autocomplete="current-password" placeholder="••••••••"></div></div>'
      + '<button class="btn btn-block btn-entrar" type="submit">Entrar</button>'
      + '</form></div></div></div>';
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

  /* ---------- Selector de curso (2ª pantalla del acceso) ---------- */
  var ROL_ELIGE_CURSO = { docente: 1, familia: 1, preceptor: 1, direccion: 1 };

  function cursoGuardado(userId) {
    try { return Number(sessionStorage.getItem('curso-' + userId)) || null; }
    catch (e) { return null; }
  }

  function pickCourse(account, user, cb) {
    // Cursos permitidos según rol: docente = los que enseña, familia = los de sus hijos; null = todos
    var paso = Promise.resolve(null);
    if (account.role === 'docente') {
      paso = sb.from('teacher_assignments').select('subject_id').eq('account_id', user.id)
        .then(function (r) {
          var sids = (r.data || []).map(function (x) { return x.subject_id; });
          if (!sids.length) return [];
          return sb.from('subject_courses').select('course_id').in('subject_id', sids)
            .then(function (r2) { return (r2.data || []).map(function (x) { return x.course_id; }); });
        });
    } else if (account.role === 'familia') {
      paso = sb.from('guardian_links').select('students(course_id)').eq('guardian_account_id', user.id)
        .then(function (r) { return (r.data || []).map(function (x) { return x.students ? x.students.course_id : null; }); });
    }
    paso.then(function (permitidos) {
      sb.from('courses').select('id,name,sort').order('sort', { ascending: true })
      .then(function (r) {
        var cursos = r.data || [];
        if (permitidos) {
          var ok = {};
          permitidos.forEach(function (id) { if (id != null) ok[id] = 1; });
          cursos = cursos.filter(function (c) { return ok[c.id]; });
        }
        if (cursos.length === 1) { try { sessionStorage.setItem('curso-' + user.id, String(cursos[0].id)); } catch (e) {} cb(cursos[0]); return; }
        if (!cursos.length) {
          app.innerHTML = '<div class="pick-wrap"><div class="pick-head">' + escudoIMG
            + '<h2>Sin cursos asignados</h2><div class="sub">Todavía no tenés materias o estudiantes vinculados. Avisá a dirección.</div>'
            + '<div class="pick-pie"><button class="btn-salir" id="pick-salir" style="color:var(--tinta);border-color:var(--linea-fuerte)">Salir</button></div></div></div>';
          document.getElementById('pick-salir').addEventListener('click', function () { sb.auth.signOut(); });
          return;
        }
        var html = '<div class="pick-wrap"><div class="pick-head">' + escudoIMG
          + '<h2>¿Qué curso?</h2>'
          + '<div class="sub">Elegí el curso para ver sus materias y estudiantes — ' + esc(account.role === 'familia' ? 'así ves a tu hijo aunque haya otro con el mismo nombre en otro curso' : 'así te quedan solo las materias de esa división') + '</div></div>'
          + '<div class="pick-grid" id="grid"></div>'
          + '<div class="pick-pie"><button class="btn-salir" id="pick-salir" style="color:var(--tinta);border-color:var(--linea-fuerte)">Salir</button></div></div>';
        app.innerHTML = html;
        document.getElementById('pick-salir').addEventListener('click', function () { sb.auth.signOut(); });
        var grid = document.getElementById('grid');
        cursos.forEach(function (c) {
          var b = el('button', 'pick-btn');
          var p = c.name.split(' ');
          var anios = { '1°': 'primer', '2°': 'segundo', '3°': 'tercer', '4°': 'cuarto', '5°': 'quinto', '6°': 'sexto', '7°': 'séptimo' };
          var texto = (anios[p[0]] || p[0]) + ' año · división ' + p.slice(1).join(' ');
          b.innerHTML = '<span class="pk-arco"></span>'
            + '<span class="pk-fila"><span class="pk-anio">' + esc(p[0]) + '</span>'
            + '<span class="pk-div">' + esc(p.slice(1).join(' ')) + '</span></span>'
            + '<span class="pk-txt">' + esc(texto) + '</span>'
            + '<span class="pk-flecha"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
          b.addEventListener('click', function () {
            try { sessionStorage.setItem('curso-' + user.id, String(c.id)); } catch (e) {}
            cb(c);
          });
          grid.appendChild(b);
        });
      });
    });
  }

  /* ---------- Marco con topbar ---------- */
  function renderShell(account, viewEl, curso) {
    app.innerHTML =
      '<div class="topbar">' + escudoIMG
      + '<div class="marca">' + esc(cfg.APP_NAME) + '</div>'
      + '<div class="spacer"></div>'
      + (curso ? '<button class="btn-curso" id="btn-curso" title="Cambiar curso">' + esc(curso.name) + '</button>' : '')
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
  function entrar(account, user, curso) {
    var view = el('div');
    view.innerHTML = '<div class="cargando">Cargando…</div>';
    renderShell(account, view, curso);
    var ctx = { account: account, user: user, course: curso };
    if (curso) {
      document.getElementById('btn-curso').addEventListener('click', function () {
        try { sessionStorage.removeItem('curso-' + user.id); } catch (e) {}
        pickCourse(account, user, function (c) { entrar(account, user, c); });
      });
    }
    var soloLectura = account.role === 'preceptor' || account.role === 'direccion';
    var rol = soloLectura ? 'docente' : account.role;
    ctx.readonly = soloLectura;
    var fn = Views[rol] || Views.familia;
    fn(view, ctx);
  }

  function loadAndRender(session) {
    if (!session) { renderLogin(); return; }
    sb.from('accounts').select('id,role,full_name,school_id').eq('id', session.user.id).single()
      .then(function (r) {
        if (r.error || !r.data) {
          app.innerHTML = '<div class="vacio">Tu usuario no tiene un rol asignado todavía. Avisá a dirección.</div>';
          return;
        }
        var account = r.data;
        if (ROL_ELIGE_CURSO[account.role]) {
          var cid = cursoGuardado(session.user.id);
          if (cid) {
            sb.from('courses').select('id,name').eq('id', cid).single().then(function (rc) {
              if (rc.data) { entrar(account, session.user, rc.data); return; }
              pickCourse(account, session.user, function (c) { entrar(account, session.user, c); });
            });
          } else {
            pickCourse(account, session.user, function (c) { entrar(account, session.user, c); });
          }
        } else {
          entrar(account, session.user, null);
        }
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
