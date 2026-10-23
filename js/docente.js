/* Vista docente: materias del curso → planilla de notas con peso y trimestre calculado */
window.Views.docente = function (view, ctx) {
  var sb = A.sb, esc = A.esc, el = A.el;
  var CURSO = ctx.course ? ctx.course.id : null;
  var state = { subjects: [], subject: null, terms: [], term: null,
                activities: [], students: [], grades: {}, finals: {}, termGrades: {},
                filtro: '', autoTimer: null };

  function cargar() {
    var prom = CURSO
      ? sb.from('subject_courses').select('subject_id').eq('course_id', CURSO)
      : Promise.resolve({ data: [] });
    Promise.all([
      sb.from('teacher_assignments').select('subject_id, subjects(id,name,short_name)').eq('account_id', ctx.user.id),
      prom,
      sb.from('terms').select('id,name,ordinal').order('ordinal', { ascending: false })
    ]).then(function (rs) {
      var enCurso = {};
      (rs[1].data || []).forEach(function (x) { enCurso[x.subject_id] = true; });
      state.subjects = (rs[0].data || []).map(function (x) { return x.subjects; })
        .filter(function (s) { return !CURSO || enCurso[s.id]; });
      if (!state.subjects.length) {
        view.innerHTML = '<div class="vacio">' + A.icon('libro') + 'No tenés materias en este curso.<br>Tocá el nombre del curso arriba para cambiar, o avisá a dirección.</div>';
        return;
      }
      state.terms = rs[2].data || [];
      if (!state.term && state.terms.length) state.term = state.terms[0].id;
      if (!state.subjects.filter(function (s) { return s.id === state.subject; }).length)
        state.subject = state.subjects[0].id;
      cargarMateria();
    });
  }

  function cargarMateria() {
    var sid = state.subject;
    Promise.all([
      sb.from('activities').select('id,title,description,due_date,term_id,weight')
        .eq('subject_id', sid).order('due_date', { ascending: true }),
      sb.from('enrollments').select('student_id, students(id,last_name,first_name)').eq('subject_id', sid),
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
    // term_grades por separado para traer term_id
    sb.from('term_grades').select('student_id,term_id,value,computed')
      .eq('subject_id', sid).then(function (rt) {
        state.termGrades = {};
        (rt.data || []).forEach(function (t) { state.termGrades[t.student_id + '_' + t.term_id] = t; });
      });
  }

  function actsDelTerm() {
    return state.activities.filter(function (a) { return a.term_id === state.term; });
  }
  function pesoTotal() {
    return actsDelTerm().reduce(function (s, a) { return s + (Number(a.weight) || 0); }, 0);
  }
  // Nota trimestre calculada: Σ(nota×peso)/Σ(peso de lo ya calificado)
  function notaTrimestre(sid) {
    var acts = actsDelTerm(), suma = 0, pesos = 0, conDatos = false;
    acts.forEach(function (a) {
      var g = state.grades[a.id + '_' + sid];
      if (!g || a.weight == null || a.weight === 0) return;
      var v = null;
      if (g.status === 'calificada' && g.value != null) v = g.value;
      else if (g.status === 'pendiente') v = 0;
      else if (g.status === 'no_presentado') v = 1;
      if (v == null) return;
      conDatos = true; suma += v * a.weight; pesos += a.weight;
    });
    if (!conDatos || !pesos) return null;
    return Math.round(suma / pesos * 10) / 10;
  }

  function dibujar() {
    var acts = actsDelTerm();
    var sinCalificar = 0;
    acts.forEach(function (a) {
      state.students.forEach(function (s) {
        var g = state.grades[a.id + '_' + s.id];
        if (!g || g.status === 'sin_calificar') sinCalificar++;
      });
    });
    var peso = pesoTotal();

    view.innerHTML =
      '<div class="seccion-titulo"><h2>Mis materias</h2>'
      + '<span class="nota">Tocá el título de una actividad para editarla; la nota se guarda sola al escribirla</span></div>'
      + '<div class="pills" id="pills"></div>'
      + '<div class="toolbar"><div class="pills grupo" id="pillsT" style="margin:0"></div><div class="spacer"></div>'
      + '<div class="buscar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="filtro" placeholder="Buscar alumno…"></div>'
      + '<button class="btn btn-mini" id="nueva">+ Nueva actividad</button></div>'
      + '<div class="stats">'
      + '<div class="stat"><div class="n">' + state.students.length + '</div><div class="l">estudiantes</div></div>'
      + '<div class="stat"><div class="n">' + acts.length + '</div><div class="l">actividades</div></div>'
      + '<div class="stat' + (sinCalificar ? ' alerta' : '') + '"><div class="n">' + sinCalificar + '</div><div class="l">sin calificar</div></div>'
      + '<div class="stat' + (peso > 100 ? ' alerta' : '') + '"><div class="n">' + peso + '%</div><div class="l">peso del trimestre</div></div></div>'
      + '<div id="tabla"></div>'
      + '<div class="leyenda"><span><b>0</b> = pendiente de entrega</span><span><b>1</b> = no presentado</span>'
      + '<span><b>—</b> = sin calificación</span><span><b>Trim.</b> se calcula por peso; la <b>Final</b> la cargás vos.</span></div>';

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
    view.querySelector('#nueva').addEventListener('click', function () { modalActividad(null); });
    var filtro = view.querySelector('#filtro');
    filtro.value = state.filtro;
    filtro.addEventListener('input', function () {
      state.filtro = filtro.value;
      aplicarFiltro();
    });
    view.querySelector('#guardar') && view.querySelector('#guardar').addEventListener('click', guardar);

    var tabla = view.querySelector('#tabla');
    if (!state.students.length) { tabla.innerHTML = '<div class="vacio">Sin estudiantes en esta materia.</div>'; return; }
    if (!acts.length) {
      tabla.innerHTML = '<div class="vacio">' + A.icon('calendario') + 'Todavía no hay actividades en este trimestre.<br>Creá la primera con "+ Nueva actividad".</div>';
      return;
    }
    var html = '<div class="planilla-wrap"><table class="planilla"><thead><tr>'
      + '<th class="col-alumno alumno">Estudiante</th>';
    acts.forEach(function (a) {
      html += '<th class="num"><button class="th-act" data-edit="' + a.id + '" title="'
        + esc(a.description || 'Editar actividad') + '"><span class="t1">' + esc(a.title) + '</span>'
        + '<span class="t2">' + (a.weight != null ? a.weight + '%' : 'sin peso')
        + (a.due_date ? ' · ' + A.textoDias(a.due_date) : '') + '</span></button></th>';
    });
    html += '<th class="num">Trim.<br><span style="font-weight:400;font-size:.68rem;opacity:.75">calculada</span></th>'
      + '<th class="num">Final</th></tr></thead><tbody>';
    state.students.forEach(function (s) {
      html += '<tr data-nom="' + esc((s.last_name + ' ' + s.first_name).toLowerCase()) + '"><td class="alumno">'
        + esc(s.last_name) + ', ' + esc(s.first_name) + '</td>';
      acts.forEach(function (a) {
        var g = state.grades[a.id + '_' + s.id];
        var v = g && g.status === 'calificada' ? g.value : '';
        var st = g ? g.status : 'sin_calificar';
        var celda = st === 'pendiente' ? ' celda-pend' : (st === 'no_presentado' ? ' celda-nopres' : (st === 'calificada' ? ' celda-cal' : ''));
        html += '<td class="num' + celda + '" data-aid="' + a.id + '" data-sid="' + s.id + '">'
          + '<input class="nota" type="number" min="0" max="10" step="1" inputmode="numeric" aria-label="Nota de '
          + esc(s.last_name) + ' en ' + esc(a.title) + '" value="' + (v === null || v === undefined ? '' : v) + '">'
          + '<br><select class="estado" aria-label="Estado">'
          + opt('sin_calificar', '—', st) + opt('pendiente', '0 pend.', st)
          + opt('no_presentado', '1 no pres.', st) + opt('calificada', 'nota', st)
          + '</select></td>';
      });
      var nt = notaTrimestre(s.id);
      var tg = state.termGrades[s.id + '_' + state.term];
      html += '<td class="num">' + (tg
          ? '<b style="font-size:1.05rem">' + tg.value + '</b>' + (tg.computed != null && Number(tg.computed).toFixed(1) !== String(tg.value) ? '<br><span style="font-size:.66rem;color:var(--gris)">calc ' + Number(tg.computed).toFixed(1) + '</span>' : '')
          : (nt != null ? '<span style="font-size:1.05rem;color:var(--gris)">' + nt + '</span><br><span style="font-size:.66rem;color:var(--gris-claro)">borrador</span>' : '<span style="color:var(--gris-claro)">—</span>'))
        + '</td>';
      var f = state.finals[s.id];
      html += '<td class="num"><input class="nota" type="number" min="2" max="10" step="1" inputmode="numeric" value="'
        + (f == null ? '' : f) + '" data-final="' + s.id + '" aria-label="Nota final de ' + esc(s.last_name) + '"></td></tr>';
    });
    html += '</tbody></table></div>'
      + '<div class="savebar"><span class="pendientes" id="pend"></span><div class="spacer"></div>'
      + '<button class="btn btn-ghost btn-mini" id="habilitar">Habilitar trimestre</button>'
      + '<button class="btn" id="guardar">Guardar</button></div>';
    tabla.innerHTML = html;
    aplicarFiltro();
    actualizarPendientes();

    tabla.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = state.activities.filter(function (x) { return x.id === Number(b.getAttribute('data-edit')); })[0];
        if (a) modalActividad(a);
      });
    });

    // estado automático + autoguardado (convención STV: 0=pendiente, 1=no presentado)
    tabla.querySelectorAll('td[data-aid]').forEach(function (td) {
      var inp = td.querySelector('input.nota'), sel = td.querySelector('select.estado');
      function marcar() {
        var st = sel.value;
        td.className = 'num' + (st === 'pendiente' ? ' celda-pend' : (st === 'no_presentado' ? ' celda-nopres' : (st === 'calificada' ? ' celda-cal' : '')));
        td.setAttribute('data-sucia', '1');
        programarAutosave();
      }
      inp.addEventListener('input', function () {
        if (inp.value === '0') sel.value = 'pendiente';
        else if (inp.value === '1') sel.value = 'no_presentado';
        else if (inp.value !== '') sel.value = 'calificada';
        marcar();
      });
      sel.addEventListener('change', marcar);
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); var sig = siguienteCelda(td); if (sig) sig.querySelector('input.nota').focus(); }
      });
    });
    tabla.querySelectorAll('input[data-final]').forEach(function (inp) {
      inp.addEventListener('input', function () { inp.setAttribute('data-sucia', '1'); programarAutosave(); });
    });
    view.querySelector('#guardar').addEventListener('click', guardar);
    view.querySelector('#habilitar').addEventListener('click', modalHabilitar);
  }

  function siguienteCelda(td) {
    var tr = td.parentElement, celdas = Array.prototype.slice.call(tr.querySelectorAll('td[data-aid]'));
    var i = celdas.indexOf(td);
    if (i < celdas.length - 1) return celdas[i + 1];
    var sigFila = tr.nextElementSibling;
    while (sigFila && !sigFila.querySelector('td[data-aid]')) sigFila = sigFila.nextElementSibling;
    return sigFila ? sigFila.querySelector('td[data-aid]') : null;
  }

  function aplicarFiltro() {
    var q = state.filtro.trim().toLowerCase();
    view.querySelectorAll('tr[data-nom]').forEach(function (tr) {
      tr.classList.toggle('oculta', q && tr.getAttribute('data-nom').indexOf(q) === -1);
    });
  }
  function opt(v, label, cur) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + label + '</option>'; }

  function actualizarPendientes(txt) {
    var n = view.querySelectorAll('[data-sucia]').length;
    var p = view.querySelector('#pend');
    if (p) p.innerHTML = txt || (n ? '<b>' + n + '</b> cambio' + (n > 1 ? 's' : '') + ' sin guardar' : 'Todo guardado');
  }

  function programarAutosave() {
    actualizarPendientes();
    clearTimeout(state.autoTimer);
    state.autoTimer = setTimeout(guardar, 1200);
  }

  function celdasAPayload() {
    var filas = [], finales = [];
    view.querySelectorAll('td[data-aid][data-sucia]').forEach(function (td) {
      var aid = Number(td.getAttribute('data-aid'));
      var sid = Number(td.getAttribute('data-sid'));
      var v = td.querySelector('input.nota').value;
      var st = td.querySelector('select.estado').value;
      if (st === 'sin_calificar' && v === '') { td.removeAttribute('data-sucia'); return; }
      var val = v === '' ? null : Number(v);
      if (st === 'pendiente') val = 0;
      if (st === 'no_presentado') val = 1;
      if (st === 'calificada' && val === null) st = 'sin_calificar';
      filas.push({ activity_id: aid, student_id: sid, value: val, status: st, updated_by: ctx.user.id, td: td });
    });
    view.querySelectorAll('input[data-final][data-sucia]').forEach(function (inp) {
      if (inp.value === '') { inp.removeAttribute('data-sucia'); return; }
      finales.push({ student_id: Number(inp.getAttribute('data-final')),
        subject_id: state.subject, value: Number(inp.value), updated_by: ctx.user.id, inp: inp });
    });
    return { filas: filas, finales: finales };
  }

  function guardar() {
    clearTimeout(state.autoTimer);
    var p = celdasAPayload();
    if (!p.filas.length && !p.finales.length) { actualizarPendientes(); return; }
    var btn = view.querySelector('#guardar');
    if (btn) btn.disabled = true;
    actualizarPendientes('Guardando…');
    var trabajo = Promise.resolve({ error: null });
    if (p.filas.length) {
      var filasClean = p.filas.map(function (f) {
        return { activity_id: f.activity_id, student_id: f.student_id, value: f.value, status: f.status, updated_by: f.updated_by };
      });
      trabajo = sb.from('grades').upsert(filasClean, { onConflict: 'activity_id,student_id' });
    }
    trabajo.then(function (r1) {
      var err = r1 && r1.error;
      if (!err) p.filas.forEach(function (f) { f.td.removeAttribute('data-sucia'); });
      if (p.finales.length && !err) {
        var finClean = p.finales.map(function (f) {
          return { student_id: f.student_id, subject_id: f.subject_id, value: f.value, updated_by: f.updated_by };
        });
        return sb.from('final_grades').upsert(finClean, { onConflict: 'student_id,subject_id' }).then(function (r2) {
          if (!r2.error) p.finales.forEach(function (f) { f.inp.removeAttribute('data-sucia'); });
          return r2.error;
        });
      }
      return err;
    }).then(function (err) {
      if (btn) btn.disabled = false;
      if (err) { actualizarPendientes('Error al guardar: ' + esc(err.message)); return; }
      actualizarPendientes('Guardado ✓');
      cargarMateriaSilencioso();
    });
  }

  // recalcular Trim. sin redibujar toda la planilla
  function cargarMateriaSilencioso() {
    var ids = state.activities.map(function (a) { return a.id; });
    if (!ids.length) return;
    sb.from('grades').select('id,activity_id,student_id,value,status').in('activity_id', ids)
      .then(function (rg) {
        state.grades = {};
        (rg.data || []).forEach(function (g) { state.grades[g.activity_id + '_' + g.student_id] = g; });
        // actualizar columna Trim. en cada fila
        view.querySelectorAll('tr[data-nom]').forEach(function (tr, i) {
          var s = state.students.filter(function (x) {
            return (x.last_name + ' ' + x.first_name).toLowerCase() === tr.getAttribute('data-nom');
          })[0];
          if (!s) return;
          var nt = notaTrimestre(s.id);
          var tg = state.termGrades[s.id + '_' + state.term];
          var td = tr.querySelectorAll('td.num');
          var cell = td[td.length - 2];
          if (cell) cell.innerHTML = tg
            ? '<b style="font-size:1.05rem">' + tg.value + '</b>'
            : (nt != null ? '<span style="font-size:1.05rem;color:var(--gris)">' + nt + '</span><br><span style="font-size:.66rem;color:var(--gris-claro)">borrador</span>' : '<span style="color:var(--gris-claro)">—</span>');
        });
      });
  }

  function modalActividad(act) {
    var esEdicion = !!act;
    var fondo = el('div', 'modal-fondo');
    fondo.innerHTML =
      '<div class="modal"><h3>' + (esEdicion ? 'Editar actividad' : 'Nueva actividad') + '</h3>'
      + '<div class="campo"><label>Título</label><input id="m-tit" placeholder="Trabajo práctico 5" value="' + esc(act ? act.title : '') + '"></div>'
      + '<div class="campo"><label>Descripción (opcional)</label><input id="m-des" placeholder="Qué hay que entregar" value="' + esc(act ? (act.description || '') : '') + '"></div>'
      + '<div class="fila-form">'
      + '<div class="campo"><label>Peso % del trimestre</label><input id="m-peso" type="number" min="0" max="100" step="5" inputmode="numeric" placeholder="ej. 30" value="' + (act && act.weight != null ? act.weight : '') + '">'
      + '<div style="font-size:.76rem;color:var(--gris);margin-top:4px">Llevás <b id="m-peso-total">' + pesoTotal() + '%</b> asignado; no puede superar 100%.</div></div>'
      + '<div class="campo"><label>Plazo máximo de entrega</label><input id="m-fec" type="date" value="' + (act && act.due_date ? act.due_date : '') + '"></div></div>'
      + '<div class="campo"><label>Trimestre</label><select id="m-term">'
      + state.terms.map(function (t) { return '<option value="' + t.id + '"' + (t.id === (act ? act.term_id : state.term) ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="acciones">'
      + (esEdicion ? '<button class="btn btn-peligro" id="m-del" style="margin-right:auto">Eliminar</button>' : '')
      + '<button class="btn-ghost btn" id="m-cancel">Cancelar</button>'
      + '<button class="btn" id="m-ok">' + (esEdicion ? 'Guardar' : 'Crear actividad') + '</button></div></div>';
    document.body.appendChild(fondo);
    var pesoInp = fondo.querySelector('#m-peso');
    var pesoAnt = act && act.weight != null ? Number(act.weight) : 0;
    pesoInp.addEventListener('input', function () {
      fondo.querySelector('#m-peso-total').textContent = (pesoTotal() - pesoAnt + (Number(pesoInp.value) || 0)) + '%';
    });
    fondo.querySelector('#m-cancel').addEventListener('click', function () { fondo.remove(); });
    fondo.addEventListener('click', function (e) { if (e.target === fondo) fondo.remove(); });
    if (esEdicion) fondo.querySelector('#m-del').addEventListener('click', function () {
      if (!confirm('¿Eliminar "' + act.title + '"? También se borran sus calificaciones.')) return;
      sb.from('grades').delete().eq('activity_id', act.id).then(function () {
        return sb.from('activities').delete().eq('id', act.id);
      }).then(function (r) {
        fondo.remove();
        if (r.error) alert('No se pudo eliminar: ' + r.error.message);
        else cargarMateria();
      });
    });
    fondo.querySelector('#m-ok').addEventListener('click', function () {
      var tit = fondo.querySelector('#m-tit').value.trim();
      if (!tit) { fondo.querySelector('#m-tit').focus(); return; }
      var peso = pesoInp.value === '' ? null : Number(pesoInp.value);
      var nuevoTotal = pesoTotal() - pesoAnt + (peso || 0);
      if (nuevoTotal > 100) {
        fondo.querySelector('#m-peso-total').textContent = nuevoTotal + '% — supera el 100%';
        pesoInp.focus();
        return;
      }
      var btn = fondo.querySelector('#m-ok'); btn.disabled = true; btn.textContent = 'Guardando…';
      var datos = {
        subject_id: state.subject, term_id: Number(fondo.querySelector('#m-term').value),
        title: tit, description: fondo.querySelector('#m-des').value.trim() || null,
        due_date: fondo.querySelector('#m-fec').value || null, weight: peso
      };
      var pedido = esEdicion
        ? sb.from('activities').update(datos).eq('id', act.id)
        : sb.from('activities').insert(Object.assign(datos, { created_by: ctx.user.id }));
      pedido.then(function (r) {
        fondo.remove();
        if (r.error) alert('No se pudo guardar: ' + r.error.message);
        else cargarMateria();
      });
    });
  }

  // Habilitar trimestre: revisar la calculada, ajustar a mano y publicar
  function modalHabilitar() {
    var acts = actsDelTerm();
    var peso = pesoTotal();
    var fondo = el('div', 'modal-fondo');
    var filas = '';
    var conCalif = 0;
    state.students.forEach(function (s) {
      var nt = notaTrimestre(s.id);
      var tg = state.termGrades[s.id + '_' + state.term];
      var valor = tg ? tg.value : (nt != null ? nt : '');
      if (nt != null) conCalif++;
      filas += '<div class="fila-act"><div class="info"><div class="titulo">' + esc(s.last_name) + ', ' + esc(s.first_name) + '</div>'
        + '<div class="meta">calculada: ' + (nt != null ? nt : 'sin datos') + '</div></div>'
        + '<input class="nota" style="width:70px;text-align:center;padding:8px;border:1.5px solid var(--linea);border-radius:8px;font-weight:700" type="number" min="0" max="10" step="1" inputmode="numeric" data-hab="' + s.id + '" value="' + valor + '"></div>';
    });
    fondo.innerHTML =
      '<div class="modal"><h3>Habilitar nota de trimestre</h3>'
      + '<div class="aviso info">' + A.icon('libro') + '<div>Peso asignado: <b>' + peso + '%</b>' + (peso < 100 ? ' — la calculada proyecta con lo cargado' : '') + '. Revisá cada nota, ajustá si hace falta y confirmá.</div></div>'
      + '<div style="max-height:46vh;overflow-y:auto">' + filas + '</div>'
      + '<div class="acciones"><button class="btn-ghost btn" id="h-cancel">Cancelar</button>'
      + '<button class="btn" id="h-ok">Habilitar ' + conCalif + ' notas</button></div></div>';
    document.body.appendChild(fondo);
    fondo.querySelector('#h-cancel').addEventListener('click', function () { fondo.remove(); });
    fondo.addEventListener('click', function (e) { if (e.target === fondo) fondo.remove(); });
    fondo.querySelector('#h-ok').addEventListener('click', function () {
      var ups = [];
      fondo.querySelectorAll('input[data-hab]').forEach(function (inp) {
        if (inp.value === '') return;
        var sid = Number(inp.getAttribute('data-hab'));
        var nt = notaTrimestre(sid);
        ups.push({ student_id: sid, subject_id: state.subject, term_id: state.term,
          computed: nt, value: Number(inp.value), updated_by: ctx.user.id });
      });
      if (!ups.length) { fondo.remove(); return; }
      var btn = fondo.querySelector('#h-ok'); btn.disabled = true; btn.textContent = 'Habilitando…';
      sb.from('term_grades').upsert(ups, { onConflict: 'student_id,subject_id,term_id' }).then(function (r) {
        fondo.remove();
        if (r.error) alert('No se pudo habilitar: ' + r.error.message);
        else cargarMateria();
      });
    });
  }

  cargar();
};
