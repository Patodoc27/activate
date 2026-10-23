/* Vista estudiante: agenda de entregas + mis notas */
window.Views.estudiante = function (view, ctx) {
  var sb = A.sb, esc = A.esc;
  var state = { me: null };

  function cargar() {
    sb.from('students')
      .select('id,last_name,first_name,course_id, courses(name)')
      .eq('account_id', ctx.user.id).single()
      .then(function (r) {
        if (r.error || !r.data) {
          view.innerHTML = '<div class="vacio">Tu cuenta todavía no está vinculada.<br>Avisá a dirección.</div>';
          return;
        }
        state.me = r.data;
        Promise.all([
          sb.from('enrollments').select('subject_id, subjects(id,name,short_name)').eq('student_id', state.me.id),
          sb.from('terms').select('id,name,ordinal')
        ]).then(function (rs) {
          var materias = (rs[0].data || []).map(function (e) { return e.subjects; });
          var terms = {};
          (rs[1].data || []).forEach(function (t) { terms[t.id] = t; });
          var mids = materias.map(function (m) { return m.id; });
          Promise.all([
            sb.from('activities').select('id,subject_id,term_id,title,description,due_date,weight')
              .in('subject_id', mids).order('due_date', { ascending: true }),
            sb.from('grades').select('activity_id,value,status').eq('student_id', state.me.id),
            sb.from('final_grades').select('subject_id,value').eq('student_id', state.me.id),
            sb.from('term_grades').select('subject_id,term_id,value').eq('student_id', state.me.id)
          ]).then(function (r2) {
            dibujar(materias, terms, r2[0].data || [], r2[1].data || [], r2[2].data || [], r2[3].data || []);
          });
        });
      });
  }

  function dibujar(materias, terms, acts, grades, finals, termg) {
    var mname = {};
    materias.forEach(function (m) { mname[m.id] = m.short_name || m.name; });
    var gmap = {}, fmap = {}, tmap = {};
    grades.forEach(function (g) { gmap[g.activity_id] = g; });
    finals.forEach(function (f) { fmap[f.subject_id] = f.value; });
    termg.forEach(function (t) { tmap[t.subject_id + '_' + t.term_id] = t.value; });
    var hoy = A.hoy();

    var prox = [], vencidas = [], calif = [];
    acts.forEach(function (a) {
      var g = gmap[a.id];
      if (a.due_date && a.due_date >= hoy) prox.push(a);
      else if (a.due_date && a.due_date < hoy && (!g || g.status !== 'calificada')) vencidas.push(a);
      if (g && g.status === 'calificada') calif.push(a);
    });

    var html = '<div class="seccion-titulo"><h2>Hola, ' + esc(state.me.first_name) + '</h2>'
      + '<span class="nota">' + esc(state.me.courses ? state.me.courses.name : '') + '</span></div>';

    html += '<div class="stats">'
      + '<div class="stat' + (prox.length ? '' : '') + '"><div class="n">' + prox.length + '</div><div class="l">por entregar</div></div>'
      + '<div class="stat' + (vencidas.length ? ' alerta' : '') + '"><div class="n">' + vencidas.length + '</div><div class="l">vencidas</div></div>'
      + '<div class="stat"><div class="n">' + calif.length + '</div><div class="l">calificadas</div></div></div>';

    html += '<h3 class="subt">Próximas entregas</h3>';
    if (!prox.length) html += '<div class="vacio">' + A.icon('tilde') + 'Nada por vencer. Bien ahí.</div>';
    prox.forEach(function (a) {
      var f = a.due_date.split('-');
      var cl = a.due_date === hoy ? ' entrega hoy' : '';
      html += '<div class="entrega' + cl + '"><div class="cal"><div class="dia">' + Number(f[2])
        + '</div><div class="mes">' + ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][Number(f[1])]
        + '</div></div><div class="info"><div class="materia-tag">' + esc(mname[a.subject_id] || '')
        + '</div><div class="tit">' + esc(a.title) + '</div>'
        + (a.weight != null ? '<div class="meta">peso ' + a.weight + '%</div>' : '')
        + (a.description ? '<div class="meta">' + esc(a.description) + '</div>' : '')
        + '</div>' + A.chipDias(a.due_date) + '</div>';
    });

    if (vencidas.length) {
      html += '<h3 class="subt">Pasaron sin calificar</h3>';
      vencidas.forEach(function (a) {
        html += '<div class="entrega vencida"><div class="info"><div class="materia-tag">' + esc(mname[a.subject_id] || '')
          + '</div><div class="tit">' + esc(a.title) + '</div></div>'
          + '<span class="est badge-estado b-nopres">venció ' + A.textoDias(a.due_date) + '</span></div>';
      });
    }

    html += '<h3 class="subt">Mis calificaciones</h3>';
    if (!calif.length) html += '<div class="vacio">' + A.icon('libro') + 'Todavía no hay notas cargadas.</div>';
    else {
      var porMat = {};
      calif.forEach(function (a) { (porMat[a.subject_id] = porMat[a.subject_id] || []).push(a); });
      Object.keys(porMat).forEach(function (mid) {
        html += '<div class="card" style="margin-bottom:10px"><div class="materia-tag" style="font-size:.85rem">'
          + esc(mname[mid] || '')
          + (function () {
              var tids = Object.keys(terms).map(Number);
              var chips = '';
              tids.forEach(function (tid) {
                var tv = tmap[mid + '_' + tid];
                if (tv != null) chips += ' <span class="chip final">' + esc(terms[tid].name.replace('trimestre','T')) + ' ' + tv + '</span>';
              });
              return chips;
            })()
          + (fmap[mid] != null ? ' <span class="chip final">Final ' + fmap[mid] + '</span>' : '') + '</div>';
        porMat[mid].forEach(function (a) {
          var g = gmap[a.id];
          html += '<div class="fila-act"><div class="info"><div class="titulo">' + esc(a.title) + '</div>'
            + '<div class="meta">' + (a.weight != null ? 'peso ' + a.weight + '% · ' : '')
            + (a.due_date ? A.fmtFecha(a.due_date) : '') + '</div></div>'
            + '<div class="nota-box' + (g.value <= 5 ? ' alerta' : '') + '">' + g.value + '</div></div>';
        });
        html += '</div>';
      });
    }
    view.innerHTML = html;
  }

  sb.channel('estudiante-' + ctx.user.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'grades' }, function () { if (state.me) cargar(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, function () { if (state.me) cargar(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'term_grades' }, function () { if (state.me) cargar(); })
    .subscribe();

  cargar();
};

/* Vista dirección (mínima por ahora): estado de carga */
window.Views.direccion = function (view, ctx) {
  var sb = A.sb, esc = A.esc;
  Promise.all([
    sb.from('subjects').select('id,name,short_name').eq('is_active', true).order('name'),
    sb.from('activities').select('subject_id'),
    sb.from('teacher_assignments').select('subject_id,account_id'),
    sb.from('students').select('id', { count: 'exact' })
  ]).then(function (rs) {
    var counts = {};
    (rs[1].data || []).forEach(function (a) { counts[a.subject_id] = (counts[a.subject_id] || 0) + 1; });
    var docPorMat = {};
    (rs[2].data || []).forEach(function (t) { docPorMat[t.subject_id] = true; });
    var html = '<div class="seccion-titulo"><h2>Estado de carga</h2>'
      + '<span class="nota">' + (rs[3].count || 0) + ' estudiantes · ' + (rs[0].data || []).length + ' materias</span></div>'
      + '<div class="card"><table class="planilla"><thead><tr><th>Materia</th>'
      + '<th class="num">Docente</th><th class="num">Actividades</th></tr></thead><tbody>';
    (rs[0].data || []).forEach(function (m) {
      html += '<tr><td>' + esc(m.name) + '</td><td class="num">'
        + (docPorMat[m.id] ? 'asignado' : '<span class="badge-estado b-nopres">falta</span>')
        + '</td><td class="num">' + (counts[m.id] || 0) + '</td></tr>';
    });
    view.innerHTML = html + '</tbody></table></div>';
  });
};
