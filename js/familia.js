/* Vista familia: hijos → materias con actividades, notas y plazos */
window.Views.familia = function (view, ctx) {
  var sb = A.sb, esc = A.esc, el = A.el;
  var state = { hijos: [], hijo: null, data: null, term: null };

  function cargar() {
    sb.from('guardian_links')
      .select('student_id, students(id,last_name,first_name,course_id, courses(name))')
      .eq('guardian_account_id', ctx.user.id)
      .then(function (r) {
        if (r.error || !r.data || !r.data.length) {
          view.innerHTML = '<div class="vacio">' + A.icon('libro')
            + 'Tu cuenta todavía no está vinculada a un estudiante.<br>'
            + 'Avisá a dirección para recibir tu código de invitación.</div>';
          return;
        }
        var todos = r.data.map(function (x) { return x.students; });
        state.hijos = ctx.course ? todos.filter(function (s) { return s.course_id === ctx.course.id; }) : todos;
        if (!state.hijos.length) {
          view.innerHTML = '<div class="vacio">' + A.icon('libro')
            + 'Ningún estudiante vinculado está en ' + esc(ctx.course.name) + '.<br>'
            + 'Tocá el nombre del curso arriba para cambiar.</div>';
          return;
        }
        if (!state.hijos.filter(function (h) { return h.id === state.hijo; }).length)
          state.hijo = state.hijos[0].id;
        cargarHijo();
      });
  }

  function cargarHijo() {
    var sid = state.hijo;
    Promise.all([
      sb.from('enrollments')
        .select('subject_id, subjects(id,name,short_name)')
        .eq('student_id', sid),
      sb.from('terms').select('id,name,ordinal').order('ordinal', { ascending: false })
    ]).then(function (rs) {
      var materias = (rs[0].data || []).map(function (e) { return e.subjects; });
      var termsList = rs[1].data || [];
      var terms = {};
      termsList.forEach(function (t) { terms[t.id] = t; });
      if (!state.term && termsList.length) state.term = 0; // 0 = todos
      var mids = materias.map(function (m) { return m.id; });
      if (!mids.length) { state.data = { materias: [], acts: {}, grades: {}, finals: {}, terms: {}, termsList: [] }; dibujar(); return; }
      Promise.all([
        sb.from('activities').select('id,subject_id,term_id,title,kind,description,due_date,weight')
          .in('subject_id', mids).order('due_date', { ascending: true }),
        sb.from('grades').select('activity_id,value,status').eq('student_id', sid),
        sb.from('final_grades').select('subject_id,value').eq('student_id', sid),
        sb.from('term_grades').select('subject_id,term_id,value,computed').eq('student_id', sid)
      ]).then(function (r2) {
        var acts = {}, grades = {}, finals = {}, termg = {};
        (r2[0].data || []).forEach(function (a) {
          (acts[a.subject_id] = acts[a.subject_id] || []).push(a);
        });
        (r2[1].data || []).forEach(function (g) { grades[g.activity_id] = g; });
        (r2[2].data || []).forEach(function (f) { finals[f.subject_id] = f.value; });
        (r2[3].data || []).forEach(function (t) { termg[t.subject_id + '_' + t.term_id] = t.value; });
        state.data = { materias: materias, acts: acts, grades: grades, finals: finals, termg: termg, terms: terms, termsList: termsList };
        dibujar();
      });
    });
  }

  function dibujar() {
    var hijo = state.hijos.filter(function (h) { return h.id === state.hijo; })[0];
    var d = state.data;
    var hoy = A.hoy();

    // métricas del hijo
    var nProx = 0, nBajas = 0, nFinal = 0, nVencidas = 0;
    d.materias.forEach(function (m) {
      if (d.finals[m.id] != null) nFinal++;
      (d.acts[m.id] || []).forEach(function (a) {
        var g = d.grades[a.id];
        if (a.due_date && a.due_date >= hoy) nProx++;
        if (a.due_date && a.due_date < hoy && (!g || g.status === 'sin_calificar')) nVencidas++;
        if (g && g.status === 'calificada' && g.value != null && g.value <= 5) nBajas++;
      });
    });

    var html = '<div class="seccion-titulo"><h2>' + esc(hijo.first_name) + ' ' + esc(hijo.last_name)
      + '</h2><span class="nota">' + esc(hijo.courses ? hijo.courses.name : '') + '</span></div>';
    if (state.hijos.length > 1) html += '<div class="hijos-tabs" id="tabs"></div>';
    html += '<div class="stats">'
      + '<div class="stat"><div class="n">' + nProx + '</div><div class="l">entregas próximas</div></div>'
      + '<div class="stat' + (nVencidas ? ' alerta' : '') + '"><div class="n">' + nVencidas + '</div><div class="l">vencidas sin nota</div></div>'
      + '<div class="stat' + (nBajas ? ' alerta' : '') + '"><div class="n">' + nBajas + '</div><div class="l">notas ≤ 5</div></div>'
      + '<div class="stat"><div class="n">' + nFinal + '</div><div class="l">finales cargadas</div></div></div>'
      + '<div id="agenda"></div>'
      + '<div class="pills grupo" id="pillsT" style="margin-bottom:14px"></div>'
      + '<div id="materias"></div>'
      + '<div class="leyenda"><span><b>0</b> = pendiente de entrega</span>'
      + '<span><b>1</b> = no presentado</span><span><b>—</b> = sin calificación</span></div>';
    view.innerHTML = html;

    if (state.hijos.length > 1) {
      var tabs = view.querySelector('#tabs');
      state.hijos.forEach(function (h) {
        var b = el('button', 'pill' + (h.id === state.hijo ? ' activa' : ''), h.first_name);
        b.addEventListener('click', function () { state.hijo = h.id; cargarHijo(); });
        tabs.appendChild(b);
      });
    }

    if (!d.materias.length) { view.querySelector('#materias').innerHTML = '<div class="vacio">Sin materias.</div>'; return; }

    // filtro por trimestre
    var pillsT = view.querySelector('#pillsT');
    var bTodos = el('button', 'pill' + (state.term === 0 ? ' activa' : ''), 'Todos');
    bTodos.addEventListener('click', function () { state.term = 0; dibujar(); });
    pillsT.appendChild(bTodos);
    d.termsList.forEach(function (t) {
      var b = el('button', 'pill' + (t.id === state.term ? ' activa' : ''), t.name.replace('trimestre', 'T'));
      b.addEventListener('click', function () { state.term = t.id; dibujar(); });
      pillsT.appendChild(b);
    });

    // Próximas entregas (todas las materias, plazo >= hoy)
    var proximas = [];
    d.materias.forEach(function (m) {
      (d.acts[m.id] || []).forEach(function (a) {
        if (a.due_date && a.due_date >= hoy) proximas.push({ m: m, a: a });
      });
    });
    proximas.sort(function (x, y) { return x.a.due_date < y.a.due_date ? -1 : 1; });
    var ag = view.querySelector('#agenda');
    if (proximas.length) {
      var html2 = '<h3 class="subt">Próximas entregas</h3>';
      proximas.slice(0, 6).forEach(function (p) {
        var f = p.a.due_date.split('-');
        var cl = p.a.due_date === hoy ? ' entrega hoy' : '';
        html2 += '<div class="entrega' + cl + '"><div class="cal"><div class="dia">' + Number(f[2])
          + '</div><div class="mes">' + ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][Number(f[1])]
          + '</div></div><div class="info"><div class="materia-tag">' + esc(p.m.short_name || p.m.name)
          + '</div><div class="tit">' + esc(p.a.title) + '</div></div>'
          + A.chipDias(p.a.due_date) + '</div>';
      });
      ag.innerHTML = html2;
    }

    var mats = view.querySelector('#materias');
    d.materias.forEach(function (m) {
      var acts = (d.acts[m.id] || []).filter(function (a) { return state.term === 0 || a.term_id === state.term; });
      var todas = d.acts[m.id] || [];
      var tg = state.term !== 0 ? d.termg[m.id + '_' + state.term] : null;
      if (state.term !== 0 && !acts.length && tg == null) return; // ocultar materias sin actividades del trimestre
      var det = document.createElement('details');
      det.className = 'materia';
      var conNota = acts.filter(function (a) { var g = d.grades[a.id]; return g && g.status === 'calificada'; }).length;
      var noPres = acts.filter(function (a) { var g = d.grades[a.id]; return g && g.status === 'no_presentado'; }).length;
      var bajas = acts.some(function (a) { var g = d.grades[a.id]; return g && g.status === 'calificada' && g.value != null && g.value <= 5; });
      var chips = '';
      if (d.finals[m.id] != null) chips += '<span class="chip final">Final ' + d.finals[m.id] + '</span>';
      if (tg != null) chips += '<span class="chip final">Trimestre ' + tg + '</span>';
      if (conNota) chips += '<span class="chip">' + conNota + ' calificada' + (conNota > 1 ? 's' : '') + '</span>';
      if (noPres) chips += '<span class="chip aviso">' + noPres + ' no presentada' + (noPres > 1 ? 's' : '') + '</span>';
      var cuerpo = '';
      if (!acts.length) cuerpo = '<div class="vacio" style="padding:18px">Sin actividades todavía.</div>';
      acts.slice().reverse().forEach(function (a) {
        var g = d.grades[a.id];
        var nota = A.notaTexto(g);
        var cl = 'nota-box';
        if (nota === '—') cl += ' vacia';
        else if (g && g.status === 'calificada' && g.value <= 5) cl += ' alerta';
        var tname = d.terms[a.term_id] ? d.terms[a.term_id].name : '';
        cuerpo += '<div class="fila-act"><div class="info"><div class="titulo">' + esc(A.tipoActividad(a) + a.title) + '</div>'
          + '<div class="meta">' + esc(tname)
          + (a.weight != null ? ' · peso ' + a.weight + '%' : '')
          + (a.due_date ? ' · entrega ' + A.fmtFecha(a.due_date)
          + (A.textoDias(a.due_date) ? ' (' + A.textoDias(a.due_date) + ')' : '') : '') + '</div></div>'
          + '<div class="' + cl + '">' + nota + '<small>' + esc(A.notaDetalle(g).toUpperCase().slice(0, 9)) + '</small></div></div>';
      });
      det.innerHTML = '<summary><div><div class="nombre">' + esc(m.short_name || m.name) + '</div></div>'
        + '<div class="sumchips">' + chips + '</div>'
        + '<svg class="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></summary>'
        + '<div class="cuerpo">' + cuerpo + '</div>';
      if (bajas || noPres) det.classList.add('alerta');
      mats.appendChild(det);
    });
    if (!mats.children.length) mats.innerHTML = '<div class="vacio">' + A.icon('libro') + 'Nada en este trimestre todavía.</div>';
  }

  // tiempo real: recargar cuando cambian notas o actividades
  sb.channel('familia-' + ctx.user.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'grades' }, function () { if (state.hijo) cargarHijo(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, function () { if (state.hijo) cargarHijo(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'term_grades' }, function () { if (state.hijo) cargarHijo(); })
    .subscribe();

  cargar();
};
