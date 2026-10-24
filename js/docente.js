/* Vista docente: materias del curso → planilla de notas con peso y trimestre calculado */
window.Views.docente = function (view, ctx) {
  var sb = A.sb, esc = A.esc, el = A.el;
  var CURSO = ctx.course ? ctx.course.id : null;
  var state = { subjects: [], subject: null, terms: [], term: null,
                activities: [], students: [], grades: {}, finals: {}, termGrades: {},
                filtro: '', autoTimer: null, calMes: null, verPlanilla: false };

  function cargar() {
    var prom = CURSO
      ? sb.from('subject_courses').select('subject_id,is_primary').eq('course_id', CURSO)
      : Promise.resolve({ data: [] });
    Promise.all([
      sb.from('teacher_assignments').select('subject_id, subjects(id,name,short_name)').eq('account_id', ctx.user.id),
      prom,
      sb.from('terms').select('id,name,ordinal').order('ordinal', { ascending: false })
    ]).then(function (rs) {
      var enCurso = {};
      // solo el curso "principal" de cada materia compartida la muestra en Mis materias
      (rs[1].data || []).forEach(function (x) { if (x.is_primary !== false) enCurso[x.subject_id] = true; });
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
      sb.from('final_grades').select('student_id,value').in('subject_id', sids),
      sb.from('subject_courses').select('subject_id,course_id').in('subject_id', sids)
    ]).then(function (rs) {
      state.activities = rs[0].data || [];
      // materia compartida entre divisiones: la clase mezcla estudiantes de ambos cursos
      var otrosCursos = {};
      (rs[3].data || []).forEach(function (x) { if (x.course_id !== CURSO) otrosCursos[x.subject_id] = true; });
      var compartida = sids.some(function (s) { return otrosCursos[s]; });
      var vistos = {};
      state.students = (rs[1].data || []).map(function (e) { return e.students; })
        .filter(function (s) { return compartida || !CURSO || s.course_id === CURSO; })
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
    return actsDelTerm().reduce(function (s, a) { return a.kind === 'mesa' ? s : s + (Number(a.weight) || 0); }, 0);
  }
  // Nota trimestre calculada: Σ(nota×peso)/Σ(peso de lo ya calificado)
  function notaTrimestre(sid) {
    var acts = actsDelTerm().filter(function (a) { return a.kind !== 'mesa'; }), suma = 0, pesos = 0, conDatos = false;
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
    acts.filter(function (a) { return a.kind !== 'mesa'; }).forEach(function (a) {
      state.students.forEach(function (s) {
        var g = state.grades[a.id + '_' + s.id];
        if (!g || g.status === 'sin_calificar') sinCalificar++;
      });
    });
    var peso = pesoTotal();

    view.innerHTML =
      '<div class="seccion-titulo"><h2>Mis materias</h2>'
      + '<span class="nota">Tocá una actividad para cargar las notas; el peso va al lado de cada una</span></div>'
      + '<div class="pills" id="pills"></div>'
      + '<div class="toolbar"><div class="pills grupo" id="pillsT" style="margin:0"></div><div class="spacer"></div>'
      + '<button class="btn btn-mini" id="nueva">+ Nueva actividad</button>'
      + '<button class="btn btn-ghost btn-mini" id="ver-planilla">' + (state.verPlanilla ? 'Cerrar planilla' : 'Ver planilla completa') + '</button></div>'
      + '<div class="stats">'
      + '<div class="stat"><div class="n">' + state.students.length + '</div><div class="l">estudiantes</div></div>'
      + '<div class="stat"><div class="n">' + acts.filter(function (a) { return a.kind !== 'mesa'; }).length + '</div><div class="l">actividades</div></div>'
      + '<div class="stat' + (sinCalificar ? ' alerta' : '') + '"><div class="n">' + sinCalificar + '</div><div class="l">sin calificar</div></div>'
      + '<div class="stat' + (peso > 100 ? ' alerta' : '') + '"><div class="n">' + peso + '%</div><div class="l">peso del trimestre</div></div></div>'
      + '<div id="cal"></div>'
      + '<div id="lista"></div>'
      + '<div id="zona-planilla"' + (state.verPlanilla ? '' : ' class="oculta"') + '></div>'
      + '<div class="leyenda"><span><b>0</b> = pendiente de entrega</span><span><b>1</b> = no presentado</span>'
      + '<span><b>—</b> = sin calificación</span><span><b>Trim.</b> se calcula por peso; la <b>Final</b> la cargás vos.</span></div>';

    var pills = view.querySelector('#pills');
    state.subjects.forEach(function (s) {
      var clave = s.ids.join(',');
      var b = el('button', 'pill' + (clave === state.subject ? ' activa' : ''), s.nombre);
      b.addEventListener('click', function () { state.subject = clave; state.verPlanilla = false; cargarMateria(); });
      pills.appendChild(b);
    });
    var pillsT = view.querySelector('#pillsT');
    state.terms.forEach(function (t) {
      var b = el('button', 'pill' + (t.id === state.term ? ' activa' : ''), t.name.replace('trimestre', 'T'));
      b.addEventListener('click', function () { state.term = t.id; dibujar(); });
      pillsT.appendChild(b);
    });
    view.querySelector('#nueva').addEventListener('click', function () { modalActividad(null); });
    view.querySelector('#ver-planilla').addEventListener('click', function () {
      state.verPlanilla = !state.verPlanilla;
      dibujar();
    });
    dibujarCal();
    dibujarLista();
    if (state.verPlanilla) dibujarPlanilla();
  }

  /* Calendario mensual: marca las fechas de las actividades (evaluaciones destacadas) */
  function dibujarCal() {
    var z = view.querySelector('#cal');
    var ref = state.calMes || A.hoy().slice(0, 7);
    var parts = ref.split('-');
    var yy = Number(parts[0]), mm = Number(parts[1]);
    var offset = (new Date(yy, mm - 1, 1).getDay() + 6) % 7;
    var dias = new Date(yy, mm, 0).getDate();
    var porDia = {};
    state.activities.forEach(function (a) {
      if (!a.due_date) return;
      (porDia[a.due_date] = porDia[a.due_date] || []).push(a);
    });
    var MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    var hoy = A.hoy();
    var h = '<div class="calendario"><div class="cal-head">'
      + '<button class="cal-nav" id="cal-ant" aria-label="Mes anterior">‹</button>'
      + '<div class="cal-tit">' + MESES[mm] + ' ' + yy + '</div>'
      + '<button class="cal-nav" id="cal-sig" aria-label="Mes siguiente">›</button></div>'
      + '<div class="cal-grid">';
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(function (d) { h += '<div class="cal-dow">' + d + '</div>'; });
    for (var i = 0; i < offset; i++) h += '<div class="cal-dia vacio"></div>';
    for (var d = 1; d <= dias; d++) {
      var f = yy + '-' + (mm < 10 ? '0' : '') + mm + '-' + (d < 10 ? '0' : '') + d;
      var ad = porDia[f] || [];
      var evs = ad.filter(function (a) { return a.kind === 'eval' || a.kind === 'oral'; });
      var dow = new Date(yy, mm - 1, d).getDay();
      var cls = 'cal-dia' + (f === hoy ? ' hoy' : '') + (evs.length ? ' ev' : (ad.length ? ' con-act' : ''))
        + ((dow === 0 || dow === 6) ? ' finde' : '');
      h += '<button class="' + cls + '" data-fecha="' + f + '"><span>' + d + '</span>';
      if (ad.length) {
        h += '<span class="cal-puntos">';
        ad.slice(0, 3).forEach(function (a) {
          h += '<i class="' + (a.kind === 'eval' || a.kind === 'oral' ? 'ev' : '') + '"></i>';
        });
        h += '</span>';
      }
      h += '</button>';
    }
    h += '</div><div class="cal-pie"><span><i class="cal-dot ev"></i> evaluación</span>'
      + '<span><i class="cal-dot"></i> otra actividad</span>'
      + '<span>Tocá un día para ver o agregar actividades</span></div></div>';
    z.innerHTML = h;
    z.querySelector('#cal-ant').addEventListener('click', function () { moverMes(-1); });
    z.querySelector('#cal-sig').addEventListener('click', function () { moverMes(1); });
    z.querySelectorAll('.cal-dia[data-fecha]').forEach(function (b) {
      b.addEventListener('click', function () { modalDia(b.getAttribute('data-fecha')); });
    });
  }
  function moverMes(dir) {
    var ref = (state.calMes || A.hoy().slice(0, 7)).split('-');
    var yy = Number(ref[0]), mm = Number(ref[1]) + dir;
    if (mm < 1) { mm = 12; yy--; }
    if (mm > 12) { mm = 1; yy++; }
    state.calMes = yy + '-' + (mm < 10 ? '0' : '') + mm;
    dibujarCal();
  }
  /* Día del calendario: sus actividades + opción de fijar una nueva fecha */
  function modalDia(fecha) {
    var delDia = state.activities.filter(function (a) { return a.due_date === fecha; });
    if (!delDia.length) { modalActividad(null, fecha); return; }
    var fondo = el('div', 'modal-fondo');
    var filas = delDia.map(function (a) {
      var t = state.terms.filter(function (x) { return x.id === a.term_id; })[0];
      return '<button class="fila-act act-btn-cal" data-act="' + a.id + '"><div class="info">'
        + '<div class="titulo">' + esc(A.nombreActividad(a)) + '</div>'
        + '<div class="meta">' + (t ? esc(t.name) : '') + (a.weight != null ? ' · peso ' + a.weight + '%' : '') + '</div></div></button>';
    }).join('');
    fondo.innerHTML = '<div class="modal"><h3>' + esc(A.fmtFecha(fecha)) + '</h3>' + filas
      + '<div class="acciones"><button class="btn-ghost btn" id="md-cancel">Cerrar</button>'
      + '<button class="btn" id="md-nueva">+ Actividad este día</button></div></div>';
    document.body.appendChild(fondo);
    fondo.querySelector('#md-cancel').addEventListener('click', function () { fondo.remove(); });
    fondo.addEventListener('click', function (e) { if (e.target === fondo) fondo.remove(); });
    fondo.querySelector('#md-nueva').addEventListener('click', function () {
      fondo.remove(); modalActividad(null, fecha);
    });
    fondo.querySelectorAll('.act-btn-cal').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = state.activities.filter(function (x) { return x.id === Number(b.getAttribute('data-act')); })[0];
        fondo.remove();
        if (a) modalNotas(a);
      });
    });
  }

  /* Primera interfaz de la materia: un botón por actividad + su peso al lado */
  function dibujarLista() {
    var z = view.querySelector('#lista');
    var todas = actsDelTerm();
    var acts = todas.filter(function (a) { return a.kind !== 'mesa'; });
    var mesas = todas.filter(function (a) { return a.kind === 'mesa'; });
    var peso = pesoTotal();
    var h = '<h3 class="subt">Actividades del trimestre'
      + ' <span class="nota" id="peso-total"' + (peso > 100 ? ' style="color:var(--rojo)"' : '') + '>'
      + '(peso total ' + peso + '% de 100%)</span></h3>';
    if (!acts.length && !mesas.length) {
      z.innerHTML = h + '<div class="vacio">' + A.icon('calendario')
        + 'Todavía no hay actividades en este trimestre.<br>Creá la primera con "+ Nueva actividad" o tocando un día del calendario.</div>';
      return;
    }
    function filaAct(a, esMesa) {
      var cargadas = 0;
      state.students.forEach(function (s) {
        var g = state.grades[a.id + '_' + s.id];
        if (g && g.status !== 'sin_calificar') cargadas++;
      });
      var deben = 0;
      if (esMesa) {
        state.students.forEach(function (s) {
          var f = state.finals[s.id];
          if (f != null && Number(f) < 6) deben++;
        });
      }
      var metaTxt = (a.due_date ? A.fmtFecha(a.due_date) + ' · ' + A.textoDias(a.due_date) : 'sin fecha')
        + (esMesa ? ' · ' + deben + ' deben rendir' : ' · ' + cargadas + '/' + state.students.length + ' notas');
      var r = '<div class="fila-act"><button class="act-btn' + (esMesa ? ' mesa' : '') + '" data-act="' + a.id + '"><div class="info">'
        + '<div class="titulo">' + esc(cap(A.nombreActividad(a))) + '</div>'
        + '<div class="meta">' + metaTxt + '</div></div>'
        + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex:none"><path d="M9 18l6-6-6-6"/></svg></button>';
      if (!esMesa) {
        r += '<div class="peso-box"><input type="number" min="0" max="100" step="1" inputmode="numeric"'
          + ' data-peso="' + a.id + '" value="' + (a.weight != null ? a.weight : '') + '" placeholder="—"'
          + ' aria-label="Peso de ' + esc(a.title) + '"><span>%</span></div>';
      }
      return r + '</div>';
    }
    if (!acts.length) h += '<div class="vacio" style="padding:18px">Solo hay instancias de mesa en este trimestre.</div>';
    acts.forEach(function (a) { h += filaAct(a, false); });
    if (mesas.length) {
      h += '<h3 class="subt">Instancias de mesa</h3>';
      mesas.forEach(function (a) { h += filaAct(a, true); });
    }
    z.innerHTML = h + '<div class="aviso" id="peso-msg" style="display:none;margin-top:8px"></div>';
    z.querySelectorAll('.act-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = state.activities.filter(function (x) { return x.id === Number(b.getAttribute('data-act')); })[0];
        if (a) modalNotas(a);
      });
    });
    var avisoTimer = null;
    z.querySelectorAll('input[data-peso]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var aid = Number(inp.getAttribute('data-peso'));
        var act = state.activities.filter(function (x) { return x.id === aid; })[0];
        var viejo = act ? act.weight : null;
        var v = inp.value === '' ? null : Number(inp.value);
        if (v != null && (isNaN(v) || v < 0 || v > 100)) { inp.value = viejo != null ? viejo : ''; return; }
        var total = pesoTotal() - (viejo || 0) + (v || 0);
        var msg = z.querySelector('#peso-msg');
        if (total > 100) {
          inp.value = viejo != null ? viejo : '';
          msg.style.display = '';
          msg.className = 'aviso alerta';
          msg.textContent = 'Con ' + (v || 0) + '% la suma sería ' + total + '%: supera el 100%. Bajá otro peso primero.';
          clearTimeout(avisoTimer);
          avisoTimer = setTimeout(function () { msg.style.display = 'none'; }, 3000);
          return;
        }
        inp.disabled = true;
        sb.from('activities').update({ weight: v }).eq('id', aid).then(function (r) {
          inp.disabled = false;
          if (r.error) { inp.value = viejo != null ? viejo : ''; alert('No se pudo guardar el peso: ' + r.error.message); return; }
          if (act) act.weight = v;
          var t = z.querySelector('#peso-total');
          if (t) { t.textContent = '(peso total ' + pesoTotal() + '% de 100%)'; t.style.color = ''; }
        });
      });
    });
  }

  /* Planilla completa: solo se arma cuando el docente la pide */
  function dibujarPlanilla() {
    var tabla = view.querySelector('#zona-planilla');
    var acts = actsDelTerm();
    var barraSup = '<div class="toolbar"><div class="buscar">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
      + '<input id="filtro" placeholder="Buscar alumno…" value="' + esc(state.filtro) + '"></div><div class="spacer"></div>'
      + '<div class="nav-tabla"><button class="btn-nav" id="navIzq" aria-label="Columnas anteriores">‹</button>'
      + '<button class="btn-nav" id="navDer" aria-label="Columnas siguientes">›</button></div></div>';
    if (!state.students.length) { tabla.innerHTML = barraSup + '<div class="vacio">Sin estudiantes en esta materia.</div>'; return; }
    if (!acts.length) {
      tabla.innerHTML = barraSup + '<div class="vacio">Sin actividades en este trimestre.</div>'
        + '<div class="savebar"><div class="spacer"></div>'
        + '<button class="btn btn-ghost btn-mini" id="excel">Excel</button>'
        + '<button class="btn btn-ghost btn-mini" id="imprimir">Imprimir</button></div>';
      view.querySelector('#imprimir').addEventListener('click', imprimir);
      view.querySelector('#excel').addEventListener('click', descargarExcel);
      view.querySelector('#filtro').addEventListener('input', function (e) { state.filtro = e.target.value; });
      return;
    }
    var html = '<div class="planilla-wrap"><table class="planilla"><thead><tr>'
      + '<th class="col-alumno alumno">Estudiante</th>';
    acts.forEach(function (a) {
      html += '<th class="num"><button class="th-act" data-edit="' + a.id + '" title="'
        + esc(a.description || 'Editar actividad') + '"><span class="t1">' + esc(A.nombreActividad(a)) + '</span>'
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
      + '<button class="btn btn-ghost btn-mini" id="excel">Excel</button>'
      + '<button class="btn btn-ghost btn-mini" id="imprimir">Imprimir</button>'
      + '<button class="btn btn-ghost btn-mini" id="habilitar">Habilitar trimestre</button>'
      + '<button class="btn" id="guardar">Guardar</button></div>';
    tabla.innerHTML = barraSup + html;
    aplicarFiltro();
    actualizarPendientes();

    view.querySelector('#imprimir').addEventListener('click', imprimir);
    view.querySelector('#excel').addEventListener('click', descargarExcel);
    var filtro = tabla.querySelector('#filtro');
    filtro.addEventListener('input', function () { state.filtro = filtro.value; aplicarFiltro(); });
    function moverTabla(dir) {
      var w = tabla.querySelector('.planilla-wrap');
      if (w) w.scrollBy({ left: dir * Math.max(240, w.clientWidth * 0.7), behavior: 'smooth' });
    }
    tabla.querySelector('#navIzq').addEventListener('click', function () { moverTabla(-1); });
    tabla.querySelector('#navDer').addEventListener('click', function () { moverTabla(1); });

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
  }

  /* Carga de notas de una actividad: lista de estudiantes, un recuadro 1-10 (solo .5) */
  function modalNotas(act) {
    var fondo = el('div', 'modal-fondo');
    var esMesa = act.kind === 'mesa';
    var lista = state.students;
    if (esMesa) {
      lista = state.students.filter(function (s) {
        var f = state.finals[s.id];
        return f != null && Number(f) < 6;
      });
    }
    var filas = '';
    lista.forEach(function (s) {
      var g = state.grades[act.id + '_' + s.id];
      var st = g ? g.status : 'sin_calificar';
      var v = g && g.status === 'calificada' && g.value != null ? g.value : '';
      filas += '<div class="fila-act" data-sid="' + s.id + '"><div class="info"><div class="titulo">'
        + esc(s.last_name) + ', ' + esc(s.first_name)
        + (esMesa ? ' <span class="chip" style="margin-left:6px">final ' + esc(String(state.finals[s.id])) + '</span>' : '')
        + '</div></div>'
        + '<select class="estado nf-est">'
        + opt('sin_calificar', '—', st) + opt('pendiente', 'Pend.', st)
        + opt('no_presentado', 'No pres.', st) + opt('calificada', 'Nota', st) + '</select>'
        + '<input class="nota nf-nota" type="number" min="1" max="10" step="0.5" inputmode="decimal"'
        + ' placeholder="1-10" value="' + v + '"' + (st === 'calificada' ? '' : ' disabled') + '></div>';
    });
    var avisoIni = esMesa
      ? '<div class="aviso info">' + A.icon('alerta') + '<div>Aparecen solo los estudiantes con <b>nota final menor a 6</b>. Si todos aprobaron, la lista queda vacía.</div></div>'
      : '<div class="aviso info">' + A.icon('lapiz') + '<div>Notas del <b>1 al 10</b> en pasos de medio punto '
        + '(7, 7.5, 8…). Pendiente y No presentado se eligen en la lista de cada estudiante.</div></div>';
    if (esMesa && !lista.length) {
      filas = '<div class="vacio" style="padding:26px">Ningún estudiante debe rendir esta instancia:<br>todos tienen nota final de 6 o más (o aún no cargaste las finales).</div>';
    }
    fondo.innerHTML =
      '<div class="modal"><h3>' + esc(A.nombreActividad(act)) + '</h3>'
      + avisoIni
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
    ['proy', 'Proyecto'], ['mesa', 'Mesa / instancia final'], ['otro', 'Otra actividad']
  ];
  function nombreTipo(k) {
    for (var i = 0; i < TIPOS.length; i++) if (TIPOS[i][0] === k) return TIPOS[i][1];
    return '';
  }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function tipoActividad(a) {
    var t = a && a.kind ? nombreTipo(a.kind) : '';
    if (!t) return '';
    var tit = (a.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var claves = { eval: ['evaluac', 'examen', 'prueba', 'escrita'], oral: ['oral', 'coloquio'],
      tp: ['trabajo', 'practico', 'tp'], cuest: ['cuestionario'], juego: ['juego'],
      agust: ['agust', 'perfil'], part: ['particip'], carp: ['carpeta'],
      proy: ['proyect', 'integrador'], mesa: ['mesa', 'intensificaci', 'periodo'], otro: [] }[a.kind] || [];
    for (var i = 0; i < claves.length; i++) if (tit.indexOf(claves[i]) !== -1) return '';
    return t + ' · ';
  }

  function modalActividad(act, fechaPre) {
    var esEdicion = !!act;
    var fondo = el('div', 'modal-fondo');
    fondo.innerHTML =
      '<div class="modal"><h3>' + (esEdicion ? 'Editar actividad' : 'Nueva actividad') + '</h3>'
      + '<div class="campo"><label>Tipo de actividad</label><select id="m-tipo">'
      + TIPOS.map(function (t) { return '<option value="' + t[0] + '"' + (act && act.kind === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="campo"><label>Tema o nombre</label><input id="m-tit" placeholder="ej. Fracciones, capítulo 3" value="' + esc(act ? act.title : '') + '"></div>'
      + '<div class="campo"><label>Descripción (opcional)</label><input id="m-des" placeholder="Qué hay que entregar" value="' + esc(act ? (act.description || '') : '') + '"></div>'
      + '<div class="campo"><label>Fecha (entrega o evaluación — aparece en el calendario)</label><input id="m-fec" type="date" value="' + (act && act.due_date ? act.due_date : (fechaPre || '')) + '"></div>'
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
      return A.nombreActividad(a) + (a.weight != null ? ' (' + a.weight + '%)' : '');
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
      h += '<th>' + esc(A.nombreActividad(a)) + (a.weight != null ? '<br><span class="ph-peso">' + a.weight + '%</span>' : '') + '</th>';
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
