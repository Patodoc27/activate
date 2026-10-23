/* Vista docente: materias → planilla de notas por actividad */
window.Views.docente = function (view, ctx) {
  var sb = A.sb, esc = A.esc, el = A.el;
  var state = { subjects: [], subject: null, terms: [], term: null,
                activities: [], students: [], grades: {}, finals: {} };

  function cargar() {
    sb.from('teacher_assignments')
      .select('subject_id, subjects(id,name,short_name)')
      .eq('account_id', ctx.user.id)
      .then(function (r) {
        if (r.error) { view.innerHTML = '<div class="aviso">No se pudieron cargar tus materias.</div>'; return; }
        state.subjects = (r.data || []).map(function (x) { return x.subjects; });
        if (!state.subjects.length) {
          view.innerHTML = '<div class="vacio">Todavía no tenés materias asignadas.<br>Avisá a dirección.</div>';
          return;
        }
        sb.from('terms').select('id,name,ordinal').order('ordinal', { ascending: false })
          .then(function (rt) {
            state.terms = rt.data || [];
            if (!state.term && state.terms.length) state.term = state.terms[0].id;
            if (!state.subject) state.subject = state.subjects[0].id;
            cargarMateria();
          });
      });
  }

  function cargarMateria() {
    var sid = state.subject;
    Promise.all([
      sb.from('activities').select('id,title,description,due_date,term_id')
        .eq('subject_id', sid).order('due_date', { ascending: true }),
      sb.from('enrollments').select('student_id, students(id,last_name,first_name)')
        .eq('subject_id', sid),
      sb.from('final_grades').select('student_id,value').eq('subject_id', sid)
    ]).then(function (rs) {
      state.activities = rs[0].data || [];
      state.students = (rs[1].data || []).map(function (e) { return e.students; })
        .sort(function (a, b) { return (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name); });
      state.finals = {};
      (rs[2].data || []).forEach(function (f) { state.finals[f.student_id] = f.value; });
      var ids = state.activities.map(function (a) { return a.id; });
      if (!ids.length) { state.grades = {}; dibujar(); return; }
      sb.from('grades').select('id,activity_id,student_id,value,status')
        .in('activity_id', ids).then(function (rg) {
          state.grades = {};
          (rg.data || []).forEach(function (g) { state.grades[g.activity_id + '_' + g.student_id] = g; });
          dibujar();
        });
    });
  }

  function dibujar() {
    view.innerHTML =
      '<div class="seccion-titulo"><h2>Mis materias</h2>'
      + '<span class="nota">Tocá una actividad para ver el plazo; escribí la nota en cada celda</span></div>'
      + '<div class="pills" id="pills"></div>'
      + '<div class="toolbar"><div class="pills" id="pillsT" style="margin:0"></div><div class="spacer"></div>'
      + '<button class="btn btn-mini" id="nueva">+ Nueva actividad</button></div>'
      + '<div id="tabla"></div>'
      + '<div class="leyenda"><span><b>0</b> = pendiente de entrega</span><span><b>1</b> = no presentado</span>'
      + '<span><b>—</b> = sin calificación</span><span>La nota <b>Final</b> la cargás vos a mano.</span></div>';

    var pills = view.querySelector('#pills');
    state.subjects.forEach(function (s) {
      var b = el('button', 'pill' + (s.id === state.subject ? ' activa' : ''), s.name);
      b.addEventListener('click', function () { state.subject = s.id; cargarMateria(); });
      pills.appendChild(b);
    });
    var pillsT = view.querySelector('#pillsT');
    state.terms.forEach(function (t) {
      var b = el('button', 'pill' + (t.id === state.term ? ' activa' : ''), t.name.replace('trimestre', 'T'));
      b.addEventListener('click', function () { state.term = t.id; dibujar(); });
      pillsT.appendChild(b);
    });
    view.querySelector('#nueva').addEventListener('click', modalActividad);

    var acts = state.activities.filter(function (a) { return a.term_id === state.term; });
    var tabla = view.querySelector('#tabla');
    if (!state.students.length) { tabla.innerHTML = '<div class="vacio">Sin estudiantes en esta materia.</div>'; return; }
    if (!acts.length) {
      tabla.innerHTML = '<div class="vacio">Todavía no hay actividades en este trimestre.<br>Creá la primera con "+ Nueva actividad".</div>';
      return;
    }
    var html = '<div class="planilla-wrap"><table class="planilla"><thead><tr>'
      + '<th class="alumno">Estudiante</th>';
    acts.forEach(function (a) {
      html += '<th class="num" title="' + esc(a.description || '') + '">'
        + esc(a.title) + '<br><span style="font-weight:400;font-size:.72rem;opacity:.75">'
        + (a.due_date ? A.fmtFecha(a.due_date) : 'sin plazo') + '</span></th>';
    });
    html += '<th class="num">Final</th></tr></thead><tbody>';
    state.students.forEach(function (s) {
      html += '<tr><td class="alumno">' + esc(s.last_name) + ', ' + esc(s.first_name) + '</td>';
      acts.forEach(function (a) {
        var g = state.grades[a.id + '_' + s.id];
        var v = g && g.status === 'calificada' ? g.value : '';
        var st = g ? g.status : 'sin_calificar';
        html += '<td class="num" data-aid="' + a.id + '" data-sid="' + s.id + '">'
          + '<input class="nota" type="number" min="0" max="10" step="1" value="' + (v === null || v === undefined ? '' : v) + '">'
          + '<br><select class="estado">'
          + opt('sin_calificar', '—', st) + opt('pendiente', '0 pend.', st)
          + opt('no_presentado', '1 no pres.', st) + opt('calificada', 'nota', st)
          + '</select></td>';
      });
      var f = state.finals[s.id];
      html += '<td class="num"><input class="nota" type="number" min="2" max="10" step="1" value="'
        + (f == null ? '' : f) + '" data-final="' + s.id + '"></td></tr>';
    });
    html += '</tbody></table></div>'
      + '<div class="toolbar" style="margin-top:14px"><div class="spacer"></div>'
      + '<button class="btn" id="guardar">Guardar cambios</button></div>';
    tabla.innerHTML = html;

    // al escribir 0 o 1 el estado cambia solo (convención STV)
    tabla.querySelectorAll('input.nota:not([data-final])').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var sel = inp.parentElement.querySelector('select.estado');
        if (inp.value === '0') sel.value = 'pendiente';
        else if (inp.value === '1') sel.value = 'no_presentado';
        else if (inp.value !== '') sel.value = 'calificada';
      });
    });
    view.querySelector('#guardar').addEventListener('click', guardar);
  }
  function opt(v, label, cur) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + label + '</option>'; }

  function modalActividad() {
    var fondo = el('div', 'modal-fondo');
    fondo.innerHTML =
      '<div class="modal"><h3>Nueva actividad</h3>'
      + '<div class="campo"><label>Título</label><input id="m-tit" placeholder="Trabajo práctico 5"></div>'
      + '<div class="campo"><label>Descripción (opcional)</label><input id="m-des" placeholder="Qué hay que entregar"></div>'
      + '<div class="fila-form">'
      + '<div class="campo"><label>Plazo máximo de entrega</label><input id="m-fec" type="date"></div>'
      + '<div class="campo"><label>Trimestre</label><select id="m-term">'
      + state.terms.map(function (t) { return '<option value="' + t.id + '"' + (t.id === state.term ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('')
      + '</select></div></div>'
      + '<div class="acciones"><button class="btn-ghost btn" id="m-cancel">Cancelar</button>'
      + '<button class="btn" id="m-ok">Crear actividad</button></div></div>';
    document.body.appendChild(fondo);
    fondo.querySelector('#m-cancel').addEventListener('click', function () { fondo.remove(); });
    fondo.addEventListener('click', function (e) { if (e.target === fondo) fondo.remove(); });
    fondo.querySelector('#m-ok').addEventListener('click', function () {
      var tit = fondo.querySelector('#m-tit').value.trim();
      if (!tit) { fondo.querySelector('#m-tit').focus(); return; }
      var btn = fondo.querySelector('#m-ok'); btn.disabled = true; btn.textContent = 'Creando…';
      sb.from('activities').insert({
        subject_id: state.subject, term_id: Number(fondo.querySelector('#m-term').value),
        title: tit, description: fondo.querySelector('#m-des').value.trim() || null,
        due_date: fondo.querySelector('#m-fec').value || null, created_by: ctx.user.id
      }).then(function (r) {
        fondo.remove();
        if (r.error) alert('No se pudo crear: ' + r.error.message);
        else cargarMateria();
      });
    });
  }

  function guardar() {
    var btn = view.querySelector('#guardar');
    btn.disabled = true; btn.textContent = 'Guardando…';
    var filas = [];
    view.querySelectorAll('td[data-aid]').forEach(function (td) {
      var aid = Number(td.getAttribute('data-aid'));
      var sid = Number(td.getAttribute('data-sid'));
      var v = td.querySelector('input.nota').value;
      var st = td.querySelector('select.estado').value;
      if (st === 'sin_calificar' && v === '') return;      // nada que guardar
      var val = v === '' ? null : Number(v);
      if (st === 'pendiente') val = 0;
      if (st === 'no_presentado') val = 1;
      if (st === 'calificada' && val === null) st = 'sin_calificar';
      filas.push({ activity_id: aid, student_id: sid, value: val, status: st, updated_by: ctx.user.id });
    });
    var finales = [];
    view.querySelectorAll('input[data-final]').forEach(function (inp) {
      if (inp.value === '') return;
      finales.push({ student_id: Number(inp.getAttribute('data-final')),
        subject_id: state.subject, value: Number(inp.value), updated_by: ctx.user.id });
    });
    var trabajo = Promise.resolve({ error: null });
    if (filas.length) trabajo = sb.from('grades').upsert(filas, { onConflict: 'activity_id,student_id' });
    trabajo.then(function (r1) {
      var err = r1 && r1.error;
      if (finales.length && !err) {
        sb.from('final_grades').upsert(finales, { onConflict: 'student_id,subject_id' }).then(function (r2) {
          finGuardar(btn, r2.error);
        });
      } else finGuardar(btn, err);
    });
  }
  function finGuardar(btn, err) {
    btn.disabled = false; btn.textContent = 'Guardar cambios';
    if (err) { alert('Error al guardar: ' + err.message); return; }
    btn.textContent = 'Guardado ✓';
    setTimeout(function () { btn.textContent = 'Guardar cambios'; }, 2000);
    cargarMateria();
  }

  cargar();
};
