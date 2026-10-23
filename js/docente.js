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
      var lista = (rs[0].data || []).map(function (x) { return x.subjects; })
        .filter(function (s) { return !CURSO || enCurso[s.id]; });
      // Agrupar por nombre normalizado: "Historia (1° A)" y "Historia" son una sola materia
      var grupos = {}, orden = [];
      lista.forEach(function (s) {
        var nom = nombreMateria(s.name);
        if (!grupos[nom]) { grupos[nom] = { nombre: nom, ids: [] }; orden.push(nom); }
        grupos[nom].ids.push(s.id);
      });
      state.subjects = orden.map(function (n) { return grupos[n]; });
      if (!state.subjects.length) {
        view.innerHTML = '<div class="vacio">' + A.icon('libro') + 'No tenés materias en este curso.<br>Tocá el nombre del curso arriba para cambiar, o avisá a dirección.</div>';
        return;
      }
      state.terms = rs[2].data || [];
      if (!state.term && state.terms.length) state.term = state.terms[0].id;
      if (!state.subjects.filter(function (s) { return s.ids.join(',') === state.subject; }).length)
        state.subject = state.subjects[0].ids.join(',');
      cargarMateria();
    });
  }

  function nombreMateria(n) {
    return (n || '').replace(/[\(\[]?\s*1[°º]\s*[AB]\s*[\)\]]?/g, ' ')
      .replace(/\s{2,}/g, ' ').trim();
  }

  function idsMateria() { return state.subject.split(',').map(Number); }

  function cargarMateria() {
    var sids = idsMateria();
    var sid = sids[0];
    Promise.all([
      sb.from('activities').select('id,title,kind,description,due_date,term_id,weight')
        .in('subject_id', sids).order('due_date', { ascending: true }),
      sb.from('enrollments').select('student_id, students(id,last_name,first_name,course_id)').in('subject_id', sids),
      sb.from('final_grades').select('student_id,value').in('subject_id', sids)
    ]).then(function (rs) {
      state.activities = rs[0].data || [];
      var vistos = {};
      state.students = (rs[1].data || []).map(function (e) { return e.students; })
        .filter(function (s) { return !CURSO || s.course_id === CURSO; })
        .filter(function (s) { if (vistos[s.id]) return false; vistos[s.id] = 1; return true; })
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
      .in('subject_id', sids).then(function (rt) {
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
      + '<span class="nota">Tocá una actividad para cargar las notas de sus estudiantes; los pesos se asignan al cerrar el trimestre</span></div>'
      + '<div class="pills" id="pills"></div>'
      + '<div class="toolbar"><div class="pills grupo" id="pillsT" style="margin:0"></div><div class="spacer"></div>'
      + '<div class="nav-tabla"><button class="btn-nav" id="navIzq" aria-label="Columnas anteriores">‹</button>'
      + '<button class="btn-nav" id="navDer" aria-label="Columnas siguientes">›</button></div>'
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
      var clave = s.ids.join(',');
      var b = el('button', 'pill' + (clave === state.subject ? ' activa' : ''), s.nombre);
      b.addEventListener('click', function () { state.subject = clave; cargarMateria(); });
      pills.appendChild(b);
    });
    var pillsT = view.querySelector('#pillsT');
    state.terms.forEach(function (t) {
      var b = el('button', 'pill' + (t.id === state.term ? ' activa' : ''), t.name.replace('trimestre', 'T'));
      b.addEventListener('click', function () { state.term = t.id; dibujar(); });
      pillsT.appendChild(b);
    });
    view.querySelector('#nueva').addEventListener('click', function () { modalActividad(null); });
    function moverTabla(dir) {
      var w = view.querySelector('.planilla-wrap');
      if (w) w.scrollBy({ left: dir * Math.max(240, w.clientWidth * 0.7), behavior: 'smooth' });
    }
    view.querySelector('#navIzq').addEventListener('click', function () { moverTabla(-1); });
    view.querySelector('#navDer').addEventListener('click', function () { moverTabla(1); });
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
      tabla.innerHTML = '<div class="vacio">' + A.icon('calendario') + 'Todavía no hay actividades en este trimestre.<br>Creá la primera con "+ Nueva actividad".</div>'
        + '<div class="savebar"><div class="spacer"></div>'
        + '<button class="btn btn-ghost btn-mini" id="excel">Descargar Excel</button>'
        + '<button class="btn btn-ghost btn-mini" id="imprimir">Imprimir</button></div>';
      view.querySelector('#imprimir').addEventListener('click', imprimir);
      view.querySelector('#excel').addEventListener('click', descargarExcel);
      return;
    }
    var html = '<div class="planilla-wrap"><table class="planilla"><thead><tr>'
      + '<th class="col-alumno alumno">Estudiante</th>';
    acts.forEach(function (a) {
      html += '<th class="num"><button class="th-act" data-edit="' + a.id + '" title="'
        + esc(a.description || 'Editar actividad') + '"><span class="t1">' + esc(tipoActividad(a) + a.title) + '</span>'
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
      + '<button class="btn btn-ghost btn-mini" id="excel">Descargar Excel</button>'
      + '<button class="btn btn-ghost btn-mini" id="imprimir">Imprimir</button>'
      + '<button class="btn btn-ghost btn-mini" id="pesos">Pesos %</button>'
      + '<button class="btn btn-ghost btn-mini" id="habilitar">Habilitar trimestre</button>'
      + '<button class="btn" id="guardar">Guardar</button></div>';
    tabla.innerHTML = html;
    aplicarFiltro();
    actualizarPendientes();

    view.querySelector('#imprimir').addEventListener('click', imprimir);
    view.querySelector('#excel').addEventListener('click', descargarExcel);

    tabla.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = state.activities.filter(function (x) { return x.id === Number(b.getAttribute('data-edit')); })[0];
        if (a) modalNotas(a);
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
    view.querySelector('#pesos').addEventListener('click', modalPesos);
  }

  /* Carga de notas de una actividad: lista de estudiantes, un recuadro 1-10 (solo .5) */
  function modalNotas(act) {
    var fondo = el('div', 'modal-fondo');
    var filas = '';
    state.students.forEach(function (s) {
      var g = state.grades[act.id + '_' + s.id];
      var st = g ? g.status : 'sin_calificar';
      var v = g && g.status === 'calificada' && g.value != null ? g.value : '';
      filas += '<div class="fila-act" data-sid="' + s.id + '"><div class="info"><div class="titulo">'
        + esc(s.last_name) + ', ' + esc(s.first_name) + '</div></div>'
        + '<select class="estado nf-est">'
        + opt('sin_calificar', '—', st) + opt('pendiente', 'Pend.', st)
        + opt('no_presentado', 'No pres.', st) + opt('calificada', 'Nota', st) + '</select>'
        + '<input class="nota nf-nota" type="number" min="1" max="10" step="0.5" inputmode="decimal"'
        + ' placeholder="1-10" value="' + v + '"' + (st === 'calificada' ? '' : ' disabled') + '></div>';
    });
    fondo.innerHTML =
      '<div class="modal"><h3>' + esc(tipoActividad(act) + act.title) + '</h3>'
      + '<div class="aviso info">' + A.icon('lapiz') + '<div>Notas del <b>1 al 10</b> en pasos de medio punto '
      + '(7, 7.5, 8…). Pendiente y No presentado se eligen en la lista de cada estudiante.</div></div>'
      + '<div style="max-height:52vh;overflow-y:auto">' + filas + '</div>'
      + '<div class="aviso" id="mn-msg" style="display:none"></div>'
      + '<div class="acciones"><button class="btn-ghost btn" id="mn-editar">Editar actividad</button>'
      + '<button class="btn" id="mn-listo">Listo</button></div></div>';
    document.body.appendChild(fondo);
    function cerrar() { fondo.remove(); cargarMateria(); }
    fondo.querySelector('#mn-listo').addEventListener('click', cerrar);
    fondo.addEventListener('click', function (e) { if (e.target === fondo) cerrar(); });
    fondo.querySelector('#mn-editar').addEventListener('click', function () {
      fondo.remove(); modalActividad(act);
    });
    var timer = null;
    function aviso(txt, mal) {
      var m = fondo.querySelector('#mn-msg');
      m.style.display = txt ? '' : 'none';
      m.className = 'aviso' + (mal ? ' alerta' : ' info');
      m.textContent = txt;
    }
    function notaOk(v) { var n = Number(v); return v !== '' && n >= 1 && n <= 10 && (n * 2) % 1 === 0; }
    function guardarFila(fila) {
      var sid = Number(fila.getAttribute('data-sid'));
      var sel = fila.querySelector('select'), inp = fila.querySelector('input');
      var st = sel.value, val = null;
      if (st === 'calificada') {
        if (inp.value === '') { st = 'sin_calificar'; }
        else if (!notaOk(inp.value)) { inp.classList.add('invalida'); aviso('La nota va del 1 al 10, en medios puntos (ej. 7.5).', true); return; }
        else val = Number(inp.value);
      } else if (st === 'pendiente') { val = 0; inp.value = ''; }
      else if (st === 'no_presentado') { val = 1; inp.value = ''; }
      else { inp.value = ''; }
      inp.classList.remove('invalida');
      inp.disabled = st !== 'calificada';
      aviso('Guardando…');
      sb.from('grades').upsert({ activity_id: act.id, student_id: sid, value: val, status: st, updated_by: ctx.user.id },
        { onConflict: 'activity_id,student_id' }).then(function (r) {
          if (r.error) { aviso('Error: ' + r.error.message, true); return; }
          state.grades[act.id + '_' + sid] = { activity_id: act.id, student_id: sid, value: val, status: st };
          aviso('Guardado');
          clearTimeout(timer);
          timer = setTimeout(function () { aviso(''); }, 1200);
        });
    }
    fondo.querySelectorAll('.fila-act').forEach(function (fila) {
      var sel = fila.querySelector('select'), inp = fila.querySelector('input');
      sel.addEventListener('change', function () {
        inp.disabled = sel.value !== 'calificada';
        if (sel.value === 'calificada') { inp.focus(); if (!notaOk(inp.value)) return; }
        guardarFila(fila);
      });
      inp.addEventListener('change', function () { guardarFila(fila); });
    });
  }

  /* Panel de pesos: todas las actividades del trimestre con su % al lado */
  function modalPesos() {
    var acts = actsDelTerm();
    var fondo = el('div', 'modal-fondo');
    var filas = acts.map(function (a) {
      return '<div class="fila-act"><div class="info"><div class="titulo">' + esc(tipoActividad(a) + a.title) + '</div>'
        + '<div class="meta">' + (a.due_date ? A.fmtFecha(a.due_date) : 'sin plazo') + '</div></div>'
        + '<input class="nota" style="width:70px;text-align:center;padding:8px;border:1.5px solid var(--linea);border-radius:8px;font-weight:700"'
        + ' type="number" min="0" max="100" step="1" inputmode="numeric" data-peso="' + a.id + '"'
        + ' placeholder="%" value="' + (a.weight != null ? a.weight : '') + '"></div>';
    }).join('');
    fondo.innerHTML =
      '<div class="modal"><h3>Pesos del trimestre</h3>'
      + '<div class="aviso info">' + A.icon('lapiz') + '<div>Asigná el <b>%</b> de cada actividad. '
      + 'La suma no puede pasar de 100%. Llevás <b id="mp-total">' + pesoTotal() + '%</b>.</div></div>'
      + (acts.length ? '<div style="max-height:46vh;overflow-y:auto">' + filas + '</div>'
        : '<div class="vacio">No hay actividades en este trimestre.</div>')
      + '<div class="acciones"><button class="btn-ghost btn" id="mp-cancel">Cancelar</button>'
      + '<button class="btn" id="mp-ok">Guardar pesos</button></div></div>';
    document.body.appendChild(fondo);
    fondo.querySelector('#mp-cancel').addEventListener('click', function () { fondo.remove(); });
    fondo.addEventListener('click', function (e) { if (e.target === fondo) fondo.remove(); });
    var orig = {};
    acts.forEach(function (a) { orig[a.id] = a.weight != null ? Number(a.weight) : null; });
    function totalActual() {
      var t = 0;
      fondo.querySelectorAll('input[data-peso]').forEach(function (i) { t += Number(i.value) || 0; });
      return t;
    }
    fondo.addEventListener('input', function () {
      var t = totalActual();
      var span = fondo.querySelector('#mp-total');
      span.textContent = t + '%';
      span.parentElement.parentElement.classList.toggle('alerta', t > 100);
      span.parentElement.innerHTML = 'La suma no puede pasar de 100%. Llevás <b id="mp-total">' + t + '%</b>' + (t > 100 ? ' — <b>supera el 100%</b>' : '.');
    });
    fondo.querySelector('#mp-ok').addEventListener('click', function () {
      var t = totalActual();
      if (t > 100) { avisoPesos(fondo, 'La suma es ' + t + '%: supera el 100%. Bajá algún peso.'); return; }
      var cambios = [];
      fondo.querySelectorAll('input[data-peso]').forEach(function (i) {
        var id = Number(i.getAttribute('data-peso'));
        var v = i.value === '' ? null : Number(i.value);
        if (v !== orig[id]) cambios.push({ id: id, weight: v });
      });
      if (!cambios.length) { fondo.remove(); return; }
      var btn = fondo.querySelector('#mp-ok'); btn.disabled = true; btn.textContent = 'Guardando…';
      Promise.all(cambios.map(function (c) {
        return sb.from('activities').update({ weight: c.weight }).eq('id', c.id);
      })).then(function (rs) {
        var err = rs.map(function (r) { return r.error; }).filter(Boolean)[0];
        fondo.remove();
        if (err) alert('No se pudieron guardar: ' + err.message);
        else cargarMateria();
      });
    });
    function avisoPesos(f, txt) {
      var m = f.querySelector('.aviso');
      if (m) { m.classList.add('alerta'); m.querySelector('div').innerHTML = esc(txt); }
    }
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
        subject_id: idsMateria()[0], value: Number(inp.value), updated_by: ctx.user.id, inp: inp });
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

  var TIPOS = [
    ['eval', 'Evaluación escrita'], ['oral', 'Evaluación oral'],
    ['tp', 'Trabajo práctico'], ['cuest', 'Cuestionario virtual'],
    ['juego', 'Juego educativo'], ['agust', 'Perfil agustiniano'],
    ['part', 'Participación en clase'], ['carp', 'Carpeta'],
    ['proy', 'Proyecto'], ['otro', 'Otra actividad']
  ];
  function nombreTipo(k) {
    for (var i = 0; i < TIPOS.length; i++) if (TIPOS[i][0] === k) return TIPOS[i][1];
    return '';
  }
  function tipoActividad(a) {
    var t = a && a.kind ? nombreTipo(a.kind) : '';
    if (!t || (a.title || '').toLowerCase().indexOf(t.toLowerCase()) === 0) return '';
    return t + ' · ';
  }

  function modalActividad(act) {
    var esEdicion = !!act;
    var fondo = el('div', 'modal-fondo');
    fondo.innerHTML =
      '<div class="modal"><h3>' + (esEdicion ? 'Editar actividad' : 'Nueva actividad') + '</h3>'
      + '<div class="campo"><label>Tipo de actividad</label><select id="m-tipo">'
      + TIPOS.map(function (t) { return '<option value="' + t[0] + '"' + (act && act.kind === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="campo"><label>Tema o nombre</label><input id="m-tit" placeholder="ej. Fracciones, capítulo 3" value="' + esc(act ? act.title : '') + '"></div>'
      + '<div class="campo"><label>Descripción (opcional)</label><input id="m-des" placeholder="Qué hay que entregar" value="' + esc(act ? (act.description || '') : '') + '"></div>'
      + '<div class="campo"><label>Plazo máximo de entrega</label><input id="m-fec" type="date" value="' + (act && act.due_date ? act.due_date : '') + '"></div>'
      + '<div class="campo"><label>Trimestre</label><select id="m-term">'
      + state.terms.map(function (t) { return '<option value="' + t.id + '"' + (t.id === (act ? act.term_id : state.term) ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="acciones">'
      + (esEdicion ? '<button class="btn btn-peligro" id="m-del" style="margin-right:auto">Eliminar</button>' : '')
      + '<button class="btn-ghost btn" id="m-cancel">Cancelar</button>'
      + '<button class="btn" id="m-ok">' + (esEdicion ? 'Guardar' : 'Crear actividad') + '</button></div></div>';
    document.body.appendChild(fondo);
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
      var btn = fondo.querySelector('#m-ok'); btn.disabled = true; btn.textContent = 'Guardando…';
      var datos = {
        subject_id: idsMateria()[0], term_id: Number(fondo.querySelector('#m-term').value),
        kind: fondo.querySelector('#m-tipo').value,
        title: tit, description: fondo.querySelector('#m-des').value.trim() || null,
        due_date: fondo.querySelector('#m-fec').value || null,
        weight: esEdicion ? act.weight : null
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
        ups.push({ student_id: sid, subject_id: idsMateria()[0], term_id: state.term,
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

  // Exportar: planilla en A4 horizontal (imprimir/PDF) y CSV para Excel
  function nombreMateriaSel() {
    var m = state.subjects.filter(function (s) { return s.ids.join(',') === state.subject; })[0];
    return m ? m.nombre : '';
  }
  function nombreTermSel() {
    var t = state.terms.filter(function (x) { return x.id === state.term; })[0];
    return t ? t.name : '';
  }
  function notaCelda(g) {
    if (!g) return '';
    if (g.status === 'calificada') return g.value != null ? String(g.value) : '';
    if (g.status === 'pendiente') return '0';
    if (g.status === 'no_presentado') return '1';
    return '';
  }
  function notaCeldaTxt(g) {
    if (!g) return '—';
    if (g.status === 'calificada') return g.value != null ? String(g.value) : '—';
    if (g.status === 'pendiente') return 'Pend.';
    if (g.status === 'no_presentado') return 'No pres.';
    return '—';
  }
  function nombreArchivo() {
    return ('planilla-' + nombreMateriaSel() + '-' + (ctx.course ? ctx.course.name : '') + '-' + nombreTermSel())
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function descargarExcel() {
    var acts = actsDelTerm();
    var cab = ['Estudiante'].concat(acts.map(function (a) {
      return tipoActividad(a) + a.title + (a.weight != null ? ' (' + a.weight + '%)' : '');
    }), ['Trimestre', 'Final']);
    var filas = [cab];
    state.students.forEach(function (s) {
      var fila = [s.last_name + ', ' + s.first_name];
      acts.forEach(function (a) {
        var g = state.grades[a.id + '_' + s.id];
        fila.push(!g ? '' : (g.status === 'calificada' ? String(g.value).replace('.', ',')
          : (g.status === 'pendiente' ? 'Pendiente' : (g.status === 'no_presentado' ? 'No presentado' : ''))));
      });
      var tg = state.termGrades[s.id + '_' + state.term];
      var nt = tg ? tg.value : notaTrimestre(s.id);
      fila.push(nt != null ? String(nt).replace('.', ',') : '');
      fila.push(state.finals[s.id] != null ? String(state.finals[s.id]).replace('.', ',') : '');
      filas.push(fila);
    });
    var csv = '﻿' + filas.map(function (f) {
      return f.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = nombreArchivo() + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  function imprimir() {
    var acts = actsDelTerm();
    var hoy = new Date().toLocaleDateString('es-AR');
    var h = '<div class="ph-head"><div class="ph-brand">Activate · Santo Tomás de Villanueva</div>'
      + '<h1>' + esc(nombreMateriaSel()) + ' — ' + esc(ctx.course ? ctx.course.name : '') + '</h1>'
      + '<div class="ph-meta">' + esc(nombreTermSel()) + ' · ' + state.students.length + ' estudiantes · ' + hoy + '</div></div>'
      + '<table class="ph-tabla"><thead><tr><th class="ph-alumno">Estudiante</th>';
    acts.forEach(function (a) {
      h += '<th>' + esc(tipoActividad(a) + a.title) + (a.weight != null ? '<br><span class="ph-peso">' + a.weight + '%</span>' : '') + '</th>';
    });
    h += '<th class="ph-trim">Trim.</th><th class="ph-trim">Final</th></tr></thead><tbody>';
    state.students.forEach(function (s) {
      h += '<tr><td class="ph-alumno">' + esc(s.last_name) + ', ' + esc(s.first_name) + '</td>';
      acts.forEach(function (a) {
        var g = state.grades[a.id + '_' + s.id];
        h += '<td' + (g && g.status === 'calificada' ? ' class="ph-nota"' : '') + '>' + notaCeldaTxt(g) + '</td>';
      });
      var tg = state.termGrades[s.id + '_' + state.term];
      var nt = tg ? tg.value : notaTrimestre(s.id);
      h += '<td class="ph-trim">' + (nt != null ? '<b>' + nt + '</b>' : '—') + '</td>';
      h += '<td class="ph-trim">' + (state.finals[s.id] != null ? '<b>' + state.finals[s.id] + '</b>' : '—') + '</td></tr>';
    });
    h += '</tbody></table><div class="ph-pie">Pend. = pendiente de entrega · No pres. = no presentado · — = sin calificar · '
      + 'Trim. calculada por peso (total ' + pesoTotal() + '%)</div>';
    var z = document.getElementById('print-area');
    if (!z) { z = document.createElement('div'); z.id = 'print-area'; document.body.appendChild(z); }
    z.innerHTML = h;
    window.print();
  }

  cargar();
};
