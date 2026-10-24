/* Vista docente: materias del curso → planilla de notas con peso y trimestre calculado */
window.Views.docente = function (view, ctx) {
  var sb = A.sb, esc = A.esc, el = A.el;
  var CURSO = ctx.course ? ctx.course.id : null;
  var XBTN = '<button class="modal-x" aria-label="Cerrar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  var SOLO_LECTURA = ctx.readonly === true;
  var state = { subjects: [], subject: null, terms: [], term: null,
                activities: [], students: [], grades: {}, finals: {}, termGrades: {},
                filtro: '', autoTimer: null, calMes: null, verPlanilla: false,
                resumen: true, cierres: {} };

  /* Frases motivadoras: se muestran al azar al ingresar, el tiempo de lectura
     se calcula por palabras y entra solo a la materia */
  var FRASES = [
    { t: 'Buen día. Hoy algún estudiante va a entender algo por primera vez gracias a tu manera de explicarlo. Que ese pensamiento te acompañe toda la jornada.', a: '' },
    { t: 'Los pueblos se degradan donde se descuida la educación. Lo que hacés hoy en el aula sostiene mucho más que un programa.', a: 'Domingo Faustino Sarmiento' },
    { t: 'Educar es un acto de amor, por eso es un acto de valor: nadie se anima a hacerlo si teme dejar de ser centro del mundo.', a: 'Paulo Freire' },
    { t: 'Un niño, un docente, un libro y una lapicera pueden cambiar el mundo. Y ese cambio puede empezar hoy.', a: 'Malala Yousafzai' },
    { t: 'La educación no es llenar un balde, sino encender un fuego. Hoy hay fogatas por prender.', a: 'William Butler Yeats' },
    { t: 'Educar la mente sin educar el corazón no es educar en absoluto. Los chicos también aprenden de cómo los miramos.', a: 'Aristóteles' },
    { t: 'Todo el mundo es un genio. Pero si juzgas a un pez por su habilidad de trepar árboles, vivirá creyendo que es inútil.', a: 'atribuida a Albert Einstein' },
    { t: 'Mientras enseñamos, aprendemos. Hoy los estudiantes también tienen algo para enseñarte: dejales la puerta abierta.', a: 'Séneca' },
    { t: 'La mente no es un vaso que hay que llenar, sino una madera que hay que encender. Que hoy salga la chispa.', a: 'Plutarco' },
    { t: 'La educación es el arma más poderosa que puedes usar para cambiar el mundo. La tenés en la mano todas las mañanas.', a: 'Nelson Mandela' },
    { t: 'Dime y lo olvido, enséñame y lo recuerdo, involúcrame y lo aprendo. Hoy es un buen día para involucrarlos.', a: 'Benjamin Franklin' },
    { t: 'Un docente deja huella en la eternidad: nunca sabe dónde termina su influencia. Lo de hoy puede llegar más lejos de lo que imaginás.', a: 'Henry Adams' },
    { t: 'El docente mediocre cuenta. El bueno explica. El excelente inspira. Hoy se puede aspirar a inspirar.', a: 'William Arthur Ward' },
    { t: 'El arte de enseñar es el arte de ayudar a descubrir. Reservales el descubrimiento, no solo la respuesta.', a: 'Mark Van Doren' },
    { t: 'Quien se anima a enseñar no debe dejar de aprender. Entrá al aula también con curiosidad.', a: 'John Cotton Dana' },
    { t: 'La educación es lo que sobrevive cuando lo enseñado se ha olvidado. Hoy construís lo que se queda.', a: 'B. F. Skinner' },
    { t: 'La tarea del educador moderno no es cortar junglas, sino regar desiertos. Hay desiertos esperándote.', a: 'C. S. Lewis' },
    { t: 'Enseñar es tocar una vida para siempre. Hoy puede ser uno de esos días que un estudiante recuerde dentro de veinte años.', a: '' },
    { t: 'Nadie aprende de alguien que no respete. Antes de abrir el cuaderno, abrí el vínculo: eso también se enseña.', a: '' },
    { t: 'Cada chico trae hoy una historia que vos no conocés. La primera clase empieza mucho antes de la primera palabra.', a: '' },
    { t: 'Los estudiantes no recuerdan cada contenido; recuerdan quién creyó en ellos cuando nadie más lo hacía. Hoy podés ser ese quién.', a: '' },
    { t: 'La buena enseñanza no convierte al más débil en el mejor: hace que cada uno dé más de lo que él mismo creía posible.', a: '' },
    { t: 'Hay mañanas en que el aula parece un semillero que no florece. El docente sabe que está creciendo igual, por debajo de la tierra.', a: '' },
    { t: 'Un error hoy es un aprendizaje mañana, tuyo y de ellos. Que el aula sea el lugar seguro para equivocarse.', a: '' },
    { t: 'El mejor momento para creer en un estudiante es cuando dejó de creer en sí mismo. Alguien te está esperando hoy con eso.', a: '' },
    { t: 'No enseñamos contenidos: enseñamos personas a través de contenidos. El orden importa, siempre.', a: '' },
    { t: 'La paciencia docente no es esperar quieto: es volver a intentar de mil maneras hasta que el otro lo vea.', a: '' },
    { t: 'El conocimiento que se comparte con generosidad es el único que se multiplica. Hoy repartís sin gastarte.', a: '' },
    { t: 'Quien enseña con el ejemplo enseña dos veces. Tu forma de llegar ya es una clase antes del primer tema.', a: '' },
    { t: 'El niño no es una botella que hay que llenar sino un fuego que hay que encender. Con eso arrancamos.', a: 'François Rabelais' },
    { t: 'Dentro de cada niño hay un adulto posible. La escuela decide qué tan posible termina siendo.', a: 'María Montessori, en espíritu' },
    { t: 'Enseñar no es transferir conocimiento, es crear las posibilidades para producirlo. Hoy creás posibilidades.', a: 'Paulo Freire' },
    { t: 'Solo la educación libera al hombre de la herencia, del medio y del momento. Nadie te paga lo suficiente por eso; se hace por vocación.', a: '' },
    { t: 'Cada respuesta equivocada en el aula es un intento honesto, no un fracaso. Celebrá el intento y corregí con dignidad.', a: '' },
    { t: 'Los docentes somos arquitectos de futuros que no vamos a habitar. Hoy colocás ladrillos que otros van a pisar.', a: '' },
    { t: 'Lo importante no es llegar a todos con la misma palabra, sino encontrar la palabra que llegue a cada uno.', a: '' },
    { t: 'Un estudiante que pregunta incómodo es un estudiante que piensa. Que hoy pregunten incómodo: es señal de vida.', a: '' },
    { t: 'Enseñar es decirle a alguien que puede, tantas veces, que un día empieza a poder solo. Seguí diciéndolo.', a: '' },
    { t: 'El silencio del aula que piensa vale más que cien respuestas memorizadas. Provocá ese silencio.', a: '' },
    { t: 'Hay días en que enseñás y días en que transformás. No siempre sabés cuál es cuál: tratá cada día como el segundo.', a: '' },
    { t: 'La escuela no prepara para la vida: la escuela ya es la vida, ahora mismo, en tu aula, esta mañana.', a: 'John Dewey' },
    { t: 'El sabio no enseña con las palabras sino con sus obras. Lo que modelás pesa más que lo que decís.', a: 'Lao Tse' },
    { t: 'Buen comienzo de jornada: hoy el mundo puede girar un poquito mejor porque alguien aprendió algo en tu aula.', a: '' },
    { t: 'El mayor elogio del docente es el estudiante que un día ya no lo necesita. Trabajás para quedar prescindible.', a: '' },
    { t: 'Aprender sin reflexionar es malgastar la energía. Enseñar sin reflexionar es gastar la de ellos. Un minuto de silencio antes de entrar ayuda.', a: 'inspirada en Confucio' },
    { t: 'La primera tarea del educador es agitar la vida interior del estudiante, y dejarla agitada. Que hoy se lleven inquietud sana.', a: 'inspirada en Margaret Mead' },
    { t: 'Los chicos aprenden lo que viven: si aprenden respeto, sabrán respetar; si aprenden confianza, sabrán confiar. El clima del aula también es un programa.', a: '' },
    { t: 'Nada es imposible para quien está dispuesto a aprender. Hoy se lo recordás con cada ejemplo.', a: '' },
    { t: 'Educar no es dar respuestas: es sostener buenas preguntas hasta que el otro pueda buscar sus propias respuestas.', a: '' },
    { t: 'El que se atreve a enseñar no debe dejar de aprender. Hoy entrás también como estudiante.', a: '' }
  ];

  function mostrarFrase() {
    var f = FRASES[Math.floor(Math.random() * FRASES.length)];
    var palabras = f.t.split(/\s+/).length;
    var espera = Math.min(Math.max(palabras / 180 * 60000, 3000), 9000);
    view.innerHTML = '<div class="frase-fondo"><div class="frase-card">'
      + '<div class="frase-comillas">”</div>'
      + '<p class="frase-texto">' + esc(f.t) + '</p>'
      + (f.a ? '<div class="frase-autor">— ' + esc(f.a) + '</div>' : '')
      + '<div class="frase-skip">tocá para entrar</div>'
      + '</div></div>';
    var entrar = function () { state.resumen = false; cargarMateria(); };
    var timer = setTimeout(entrar, espera);
    view.querySelector('.frase-fondo').addEventListener('click', function () { clearTimeout(timer); entrar(); });
  }

  function cargar() {
    var prom = CURSO
      ? sb.from('subject_courses').select('subject_id,is_primary').eq('course_id', CURSO)
      : Promise.resolve({ data: [] });
    var promSujetos = SOLO_LECTURA && CURSO
      ? sb.from('subject_courses').select('subject_id,is_primary,subjects(id,name,short_name)').eq('course_id', CURSO)
      : sb.from('teacher_assignments').select('subject_id, subjects(id,name,short_name)').eq('account_id', ctx.user.id);
    Promise.all([
      promSujetos,
      prom,
      sb.from('terms').select('id,name,ordinal').order('ordinal', { ascending: false })
    ]).then(function (rs) {
      var enCurso = {};
      // solo el curso "principal" de cada materia compartida la muestra en Mis materias
      (rs[1].data || []).forEach(function (x) { if (x.is_primary !== false) enCurso[x.subject_id] = true; });
      var lista = (rs[0].data || []).map(function (x) { return x.subjects; })
        .filter(function (s) { return s && (!CURSO || enCurso[s.id] || (SOLO_LECTURA && rs[0].data.filter(function(x){return x.subject_id===s.id&&x.is_primary!==false}).length)); });
      // Agrupar por nombre normalizado: "Historia (1° A)" y "Historia" son una sola materia
      var grupos = {}, orden = [];
      lista.forEach(function (s) {
        var nom = nombreMateria(s.name);
        if (!grupos[nom]) { grupos[nom] = { nombre: nom, ids: [] }; orden.push(nom); }
        grupos[nom].ids.push(s.id);
      });
      state.subjects = orden.map(function (n) { return grupos[n]; });
      if (!state.subjects.length) {
        view.innerHTML = '<div class="vacio">' + A.icon('libro') + (SOLO_LECTURA ? 'No hay materias cargadas en este curso.' : 'No tenés materias en este curso.<br>Tocá el nombre del curso arriba para cambiar, o avisá a dirección.') + '</div>';
        return;
      }
      state.terms = rs[2].data || [];
      if (!state.term && state.terms.length) state.term = state.terms[0].id;
      if (!state.subjects.filter(function (s) { return s.ids.join(',') === state.subject; }).length)
        state.subject = state.subjects[0].ids.join(',');
      if (state.resumen) { if (SOLO_LECTURA) dibujarPanel(); else dibujarResumen(); } else cargarMateria();
    });
  }

  /* Panel de entrada: "Mi materia" con estadísticas del curso */
  function dibujarResumen() {
    view.innerHTML = '<div class="seccion-titulo"><h2>'
      + (state.subjects.length > 1 ? 'Mis materias' : 'Mi materia') + '</h2>'
      + '<span class="nota">' + esc(ctx.course ? ctx.course.name : '') + '</span></div>'
      + '<div id="resumen-cards"><div class="vacio">Cargando estadísticas…</div></div>'
      + '<button class="btn" id="ingresar" style="width:100%;margin-top:16px;padding:15px;font-size:1.02rem">Ingresar</button>';
    view.querySelector('#ingresar').addEventListener('click', mostrarFrase);
    var todos = [];
    state.subjects.forEach(function (s) { todos = todos.concat(s.ids); });
    sb.from('activities').select('id,subject_id,kind,term_id,weight').in('subject_id', todos).then(function (ra) {
      var acts = ra.data || [];
      var porAct = {};
      acts.forEach(function (a) { porAct[a.id] = a.subject_id; });
      function todasLasNotas(desde, acum) {
        return sb.from('grades').select('activity_id,value,status,activities!inner(subject_id)')
          .in('activities.subject_id', todos).order('activity_id').range(desde, desde + 999)
          .then(function (r) {
            var filas = r.data || [];
            acum = acum.concat(filas);
            return filas.length === 1000 ? todasLasNotas(desde + 1000, acum) : acum;
          });
      }
      function todosLosCierres(desde, acum) {
        return sb.from('term_grades').select('student_id,subject_id,term_id,value')
          .in('subject_id', todos).order('student_id').range(desde, desde + 999)
          .then(function (r) {
            var filas = r.data || [];
            acum = acum.concat(filas);
            return filas.length === 1000 ? todosLosCierres(desde + 1000, acum) : acum;
          });
      }
      Promise.all([
        sb.from('enrollments').select('student_id,subject_id').in('subject_id', todos).limit(5000),
        todasLasNotas(0, []),
        todosLosCierres(0, [])
      ]).then(function (rs2) {
        var enr = rs2[0].data || [], grads = rs2[1] || [], cierres = rs2[2] || [];
        var gradeMap = {};
        grads.forEach(function (g) { gradeMap[g.activity_id + '_' + g.student_id] = g; });
        var cierreMap = {};
        cierres.forEach(function (c) { cierreMap[c.student_id + '_' + c.subject_id + '_' + c.term_id] = c.value; });
        function pondResumen(sid, sids, termId) {
          var suma = 0, pesos = 0, conDatos = false;
          acts.forEach(function (a) {
            if (sids.indexOf(a.subject_id) === -1 || a.term_id !== termId || a.kind === 'mesa') return;
            if (a.weight == null || a.weight === 0) return;
            var g = gradeMap[a.id + '_' + sid];
            if (!g) return;
            var v = null;
            if (g.status === 'calificada' && g.value != null) v = g.value;
            else if (g.status === 'pendiente') v = 0;
            else if (g.status === 'no_presentado') v = 1;
            if (v == null) return;
            conDatos = true; suma += v * a.weight; pesos += a.weight;
          });
          if (!conDatos || !pesos) return null;
          return suma / pesos;
        }
        // Solo notas de cierre habilitadas por el docente — sin sugeridas
        function notaTrimResumen(sid, sids, termId) {
          var sidPrim = sids[0];
          var hab = cierreMap[sid + '_' + sidPrim + '_' + termId];
          return hab != null ? { nota: hab } : null;
        }
        function fmt(v) { return v != null ? v.toFixed(1).replace('.', ',') : '—'; }
        var html = '';
        state.subjects.forEach(function (s) {
          var actsS = acts.filter(function (a) { return s.ids.indexOf(a.subject_id) !== -1 && a.kind !== 'mesa'; });
          var alumnos = {};
          enr.forEach(function (e) { if (s.ids.indexOf(e.subject_id) !== -1) alumnos[e.student_id] = 1; });
          var aluIds = Object.keys(alumnos).map(Number);
          var nAlu = aluIds.length;
          var notasPorTrim = {};
          aluIds.forEach(function (sid) {
            state.terms.forEach(function (t) {
              var r = notaTrimResumen(sid, s.ids, t.id);
              if (r) (notasPorTrim[t.id] = notasPorTrim[t.id] || []).push(r.nota);
            });
          });
          var promAlum = [];
          aluIds.forEach(function (sid) {
            var ns = [];
            state.terms.forEach(function (t) {
              var r = notaTrimResumen(sid, s.ids, t.id);
              if (r) ns.push(r.nota);
            });
            if (ns.length) promAlum.push(ns.reduce(function (a, b) { return a + b; }, 0) / ns.length);
          });
          var promGral = promAlum.length ? promAlum.reduce(function (a, b) { return a + b; }, 0) / promAlum.length : null;
          html += '<div class="card card-resumen"><div class="res-titulo">' + esc(s.nombre) + '</div>'
            + '<div class="res-stats">'
            + '<div class="res-stat"><b>' + nAlu + '</b><span>estudiantes</span></div>'
            + '<div class="res-stat"><b>' + actsS.length + '</b><span>actividades</span></div>'
            + '<div class="res-stat"><b>' + fmt(promGral) + '</b><span>promedio general</span></div></div>';
          var termOrden = state.terms.slice().sort(function (a, b) { return a.id - b.id; });
          termOrden.forEach(function (t, i) {
            var actsT = actsS.filter(function (a) { return a.term_id === t.id; });
            var notas = notasPorTrim[t.id] || [];
            var apr = notas.filter(function (n) { return n >= 6; }).length;
            var des = notas.length - apr;
            var promT = notas.length ? notas.reduce(function (a, b) { return a + b; }, 0) / notas.length : null;
            var pApr = notas.length ? Math.round(apr / notas.length * 100) : 0;
            var torta = notas.length
              ? '<div class="torta" style="background:conic-gradient(var(--azul) 0 ' + pApr + '%, var(--rojo) ' + pApr + '% 100%)"><div class="torta-centro">' + pApr + '%</div></div>'
              : '<div class="torta torta-vacia"><div class="torta-centro">—</div></div>';
            html += '<div class="res-trim"><div class="res-trim-t">' + esc(t.name) + '</div>'
              + '<div class="res-trim-body"><div class="res-trim-stats">'
              + '<span><b>' + actsT.length + '</b> actividades</span>'
              + (notas.length
                ? '<span><b>' + apr + '</b> aprobados</span>'
                + '<span><b>' + des + '</b> desaprobados</span>'
                + '<span>promedio <b>' + fmt(promT) + '</b></span>'
                : '<span class="res-sin">aún sin nota de cierre</span>')
              + '</div>' + torta + '</div>'
              + (notas.length ? '<div class="res-pie">' + pApr + '% aprobados · ' + (100 - pApr) + '% desaprobados (sobre ' + notas.length + ' con nota de cierre)</div>'
                : '')
              + '</div>';
          });
          html += '</div>';
        });
        var z = view.querySelector('#resumen-cards');
        if (z) z.innerHTML = html;
      });
    });
  }

  /* Panel de supervisión (preceptor / dirección): elegí el trimestre,
     cada materia con su barra de aprobados vs desaprobados; tocá para entrar */
  function dibujarPanel() {
    var termOrden = state.terms.slice().sort(function (a, b) { return a.id - b.id; });
    if (!state.term && termOrden.length) state.term = termOrden[0].id;
    view.innerHTML = '<div class="seccion-titulo"><h2>Estadísticas por materia</h2>'
      + '<span class="nota">' + esc(ctx.course ? ctx.course.name : '') + ' · elegí el trimestre y tocá una materia</span></div>'
      + '<div class="pills" id="pills-t"></div>'
      + '<button class="btn-alerta" id="btn-alerta">' + A.icon('alertaAlumno') + ' Alerta de estudiantes</button>'
      + '<div id="panel-lista"><div class="vacio">Cargando estadísticas…</div></div>';
    view.querySelector('#btn-alerta').addEventListener('click', dibujarAlerta);
    var pills = view.querySelector('#pills-t');
    termOrden.forEach(function (t) {
      var b = el('button', 'pill' + (t.id === state.term ? ' activa' : ''));
      b.textContent = t.name.replace(/\s*trimestre/i, ' T');
      b.addEventListener('click', function () { state.term = t.id; dibujarPanel(); });
      pills.appendChild(b);
    });
    var todos = [];
    state.subjects.forEach(function (s) { todos = todos.concat(s.ids); });
    Promise.all([
      sb.from('term_grades').select('student_id,subject_id,value')
        .in('subject_id', todos).eq('term_id', state.term).limit(5000),
      sb.from('enrollments').select('student_id,subject_id').in('subject_id', todos).limit(5000),
      sb.from('activities').select('id,subject_id,kind')
        .in('subject_id', todos).eq('term_id', state.term).limit(2000)
    ]).then(function (rs) {
      var cierres = rs[0].data || [], enr = rs[1].data || [], acts = rs[2].data || [];
      var lista = view.querySelector('#panel-lista');
      if (!lista) return;
      lista.innerHTML = '';
      state.subjects.forEach(function (s) {
        var alumnos = {};
        enr.forEach(function (e) { if (s.ids.indexOf(e.subject_id) !== -1) alumnos[e.student_id] = 1; });
        var nAlu = Object.keys(alumnos).length;
        var notas = cierres.filter(function (c) { return s.ids.indexOf(c.subject_id) !== -1; });
        var apr = notas.filter(function (n) { return n.value >= 6; }).length;
        var des = notas.length - apr;
        var nActs = acts.filter(function (a) {
          return s.ids.indexOf(a.subject_id) !== -1 && a.kind !== 'mesa';
        }).length;
        var pApr = notas.length ? Math.round(apr / notas.length * 100) : 0;
        var card = el('button', 'card panel-card' + (notas.length ? '' : ' panel-vacia'));
        card.innerHTML = '<div class="panel-nom">' + esc(s.nombre) + '</div>'
          + '<div class="panel-bar">'
          + (notas.length
            ? '<span class="pb-apr" style="width:' + pApr + '%"></span>'
              + '<span class="pb-des" style="width:' + (100 - pApr) + '%"></span>'
            : '<span class="pb-vacia"></span>')
          + '</div>'
          + '<div class="panel-det">'
          + (notas.length
            ? '<b>' + apr + '</b> aprobados · <b>' + des + '</b> desaprobados · ' + pApr + '% aprobación'
            : 'aún sin nota de cierre en este trimestre')
          + ' · ' + nAlu + ' estudiantes · ' + nActs + ' actividades</div>';
        card.addEventListener('click', function () {
          state.subject = s.ids.join(',');
          state.resumen = false;
          cargarMateria();
        });
        lista.appendChild(card);
      });
      if (!state.subjects.length)
        lista.innerHTML = '<div class="vacio">No hay materias en este curso.</div>';
    });
  }

  /* Alerta de estudiantes (preceptor/dirección): solapas por trimestre,
     por materia los estudiantes con pendiente (0) y desaprobado (1) */
  function dibujarAlerta() {
    var termOrden = state.terms.slice().sort(function (a, b) { return a.id - b.id; });
    if (!state.term && termOrden.length) state.term = termOrden[0].id;
    view.innerHTML = '<div class="seccion-titulo"><h2>Alerta de estudiantes</h2>'
      + '<span class="nota">' + esc(ctx.course ? ctx.course.name : '') + '</span></div>'
      + '<div class="pills" id="pills-al"></div>'
      + '<div class="aviso info">' + A.icon('alertaAlumno') + '<div>Por materia: <b>0</b> = pendiente de entrega (todavía puede entregar) · <b>1</b> = desaprobado, ya no remonta esa nota.</div></div>'
      + '<div id="alerta-lista"><div class="vacio">Cargando…</div></div>'
      + '<button class="btn btn-ghost" id="alerta-volver" style="margin-top:14px">← Volver a materias</button>';
    view.querySelector('#alerta-volver').addEventListener('click', dibujarPanel);
    var pills = view.querySelector('#pills-al');
    termOrden.forEach(function (t) {
      var b = el('button', 'pill' + (t.id === state.term ? ' activa' : ''));
      b.textContent = t.name.replace(/\s*trimestre/i, ' T');
      b.addEventListener('click', function () { state.term = t.id; dibujarAlerta(); });
      pills.appendChild(b);
    });
    var todos = [];
    var sidGrupo = {};
    state.subjects.forEach(function (s) {
      s.ids.forEach(function (id) { sidGrupo[id] = s; });
      todos = todos.concat(s.ids);
    });
    sb.from('activities').select('id,subject_id,title,term_id,kind')
      .in('subject_id', todos).eq('term_id', state.term).limit(2000)
    .then(function (ra) {
      var acts = (ra.data || []).filter(function (a) { return a.kind !== 'mesa'; });
      var actIds = acts.map(function (a) { return a.id; });
      var actMap = {};
      acts.forEach(function (a) { actMap[a.id] = a; });
      if (!actIds.length) {
        view.querySelector('#alerta-lista').innerHTML = '<div class="vacio">Todavía no hay actividades en este trimestre.</div>';
        return;
      }
      function todasLasNotas(desde, acum) {
        return sb.from('grades').select('activity_id,student_id,status')
          .in('activity_id', actIds).order('activity_id').range(desde, desde + 999)
          .then(function (r) {
            var filas = r.data || [];
            acum = acum.concat(filas);
            return filas.length === 1000 ? todasLasNotas(desde + 1000, acum) : acum;
          });
      }
      Promise.all([
        sb.from('enrollments').select('student_id,subject_id,students(id,first_name,last_name,course_id)')
          .in('subject_id', todos).limit(5000),
        todasLasNotas(0, [])
      ]).then(function (rs) {
        var enr = rs[0].data || [], grads = rs[1] || [];
        var alumnos = {};
        enr.forEach(function (e) {
          var st = e.students;
          if (!st || (CURSO && st.course_id !== CURSO)) return;
          if (!alumnos[st.id]) alumnos[st.id] = { id: st.id, nom: st.last_name + ', ' + st.first_name };
        });
        // por materia: pend -> [sid x n], des -> [sid x n]
        var porMateria = {};
        grads.forEach(function (g) {
          if (g.status !== 'pendiente' && g.status !== 'no_presentado') return;
          if (!alumnos[g.student_id]) return;
          var a = actMap[g.activity_id];
          if (!a) return;
          var gpo = sidGrupo[a.subject_id];
          if (!gpo) return;
          var m = porMateria[gpo.nombre] = porMateria[gpo.nombre] || { pend: {}, des: {}, titulos: {} };
          var bucket = g.status === 'pendiente' ? m.pend : m.des;
          if (!bucket[g.student_id]) bucket[g.student_id] = { n: 0, acts: [] };
          bucket[g.student_id].n++;
          bucket[g.student_id].acts.push(a.title);
        });
        var nombres = Object.keys(porMateria).sort();
        var html = '';
        nombres.forEach(function (nom) {
          var m = porMateria[nom];
          var nPend = Object.keys(m.pend).length, nDes = Object.keys(m.des).length;
          html += '<div class="card alerta-card"><div class="panel-nom">' + esc(nom) + '</div>';
          function filas(mapa, cls, etiqueta) {
            var ids = Object.keys(mapa).map(Number)
              .sort(function (a, b) { return mapa[b].n - mapa[a].n || alumnos[a].nom.localeCompare(alumnos[b].nom); });
            if (!ids.length) return '';
            var s = '<div class="alerta-grupo ' + cls + '"><div class="alerta-gtit">' + etiqueta + '</div>';
            ids.forEach(function (sid) {
              var e2 = mapa[sid];
              s += '<div class="alerta-est"><span>' + esc(alumnos[sid].nom) + '</span>'
                + '<span class="alerta-cant">' + e2.n + ' · ' + esc(e2.acts.join(' · ')) + '</span></div>';
            });
            return s + '</div>';
          }
          html += filas(m.pend, 'pend', '0 · pendiente de entrega — todavía puede entregar')
              + filas(m.des, 'des', '1 · desaprobado — ya no remonta');
          html += '</div>';
        });
        var lista = view.querySelector('#alerta-lista');
        if (!lista) return;
        lista.innerHTML = nombres.length
          ? '<div class="alerta-tot">' + nombres.length + ' materia' + (nombres.length > 1 ? 's' : '') + ' con estudiantes en alerta en este trimestre</div>' + html
          : '<div class="vacio">Ningún estudiante con alertas en este trimestre.</div>';
      });
    });
  }

  function nombreMateria(n) {
    return (n || '').replace(/[\(\[]?\s*1[°º]\s*[AB]\s*[\)\]]?/g, ' ')
      .replace(/\s{2,}/g, ' ').trim()
      .replace(/\bY\b/g, 'y');
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
      sb.from('subject_courses').select('subject_id,course_id').in('subject_id', sids),
      sb.from('cierre_grades').select('student_id,value').in('subject_id', sids)
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
      state.cierres = {};
      (rs[4].data || []).forEach(function (f) { state.cierres[f.student_id] = f.value; });
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
  function mesasDelTerm() {
    return actsDelTerm().filter(function (a) { return a.kind === 'mesa'; }).sort(function (x, y) {
      var o = function (a) { var t = (a.title || '').toLowerCase(); return t.indexOf('dic') !== -1 ? 0 : (t.indexOf('feb') !== -1 ? 1 : 2); };
      return o(x) - o(y) || x.id - y.id;
    });
  }
  // Mesa aprobada (>=6), en orden Diciembre luego Febrero
  function mesaAprobada(sid) {
    var mesas = mesasDelTerm(), ap = null;
    mesas.forEach(function (a) {
      var g = state.grades[a.id + '_' + sid];
      if (ap == null && g && g.status === 'calificada' && g.value != null && Number(g.value) >= 6) ap = g.value;
    });
    return ap;
  }
  // Cierre del año: la nota cargada por el docente, la mesa aprobada,
  // o el promedio de trimestres cuando supera 5,5
  function cierreFinal(sid) {
    if (state.cierres[sid] != null) return state.cierres[sid];
    var ap = mesaAprobada(sid);
    if (ap != null) return ap;
    var p = promFinal(sid);
    return p != null && p > 5.5 ? Math.max(1, Math.round(p)) : null;
  }
  function pesoTotal() {
    return actsDelTerm().reduce(function (s, a) { return a.kind === 'mesa' ? s : s + (Number(a.weight) || 0); }, 0);
  }
  // Nota trimestre calculada: Σ(nota×peso)/Σ(peso de lo ya calificado)
  function notaTrimestre(sid, termId) {
    var acts = state.activities.filter(function (a) { return a.term_id === (termId || state.term) && a.kind !== 'mesa'; }),
      suma = 0, pesos = 0, conDatos = false;
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
    return suma / pesos;
  }
  // Ponderación con 2 decimales y nota sugerida (redondea hacia arriba desde ,50)
  function pondTxt(nt) { return nt != null ? nt.toFixed(2).replace('.', ',') : ''; }
  function sug(nt) { return nt != null ? Math.max(1, Math.round(nt)) : null; }
  // Nota de trimestre efectiva: la habilitada por el docente o la sugerida
  function notaTrimEfectiva(sid, termId) {
    var tg = state.termGrades[sid + '_' + termId];
    if (tg && tg.value != null) return Number(tg.value);
    var nt = notaTrimestre(sid, termId);
    return nt != null ? sug(nt) : null;
  }
  // Promedio del año: promedio de las notas de trimestre disponibles
  function promFinal(sid) {
    var ns = [];
    state.terms.forEach(function (t) {
      var n = notaTrimEfectiva(sid, t.id);
      if (n != null) ns.push(n);
    });
    if (!ns.length) return null;
    return ns.reduce(function (a, b) { return a + b; }, 0) / ns.length;
  }
  // Final efectiva: la cargada por el docente o el promedio redondeado
  function finalEfectiva(sid) {
    var f = state.finals[sid];
    if (f != null) return f;
    var p = promFinal(sid);
    return p != null ? Math.max(1, Math.round(p)) : null;
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

    var subjActual = state.subjects.filter(function (s) { return s.ids.join(',') === state.subject; })[0];
    view.innerHTML =
      '<div class="seccion-titulo"><h2>' + esc(subjActual ? subjActual.nombre : 'Mis materias') + '</h2>'
      + '<span class="nota">' + (SOLO_LECTURA ? 'Solo lectura: podés ver lo que cargaron los docentes' : 'Tocá una actividad para cargar las notas; el peso va al lado de cada una') + '</span></div>'
      + '<div class="pills" id="pills"></div>'
      + '<div class="toolbar"><button class="btn btn-ghost btn-mini" id="volver-resumen" title="Volver al resumen">Resumen</button>'
      + '<div class="pills grupo" id="pillsT" style="margin:0"></div><div class="spacer"></div>'
      + (SOLO_LECTURA ? '' : '<button class="btn btn-mini" id="nueva">+ Nueva actividad</button>')
      + '<button class="btn btn-ghost btn-mini" id="ver-planilla">' + (state.verPlanilla ? 'Cerrar planilla' : 'Ver planilla completa') + '</button></div>'
      + '<div class="stats">'
      + '<div class="stat"><div class="n">' + state.students.length + '</div><div class="l">estudiantes</div></div>'
      + '<div class="stat"><div class="n">' + acts.filter(function (a) { return a.kind !== 'mesa'; }).length + '</div><div class="l">actividades</div></div>'
      + '<div class="stat' + (sinCalificar ? ' alerta' : '') + '"><div class="n">' + sinCalificar + '</div><div class="l">notas por cargar</div></div>'
      + '<div class="stat' + (peso > 100 ? ' alerta' : '') + '"><div class="n">' + peso + '%</div><div class="l">peso del trimestre</div></div></div>'
      + '<div id="cal"></div>'
      + '<div id="lista"></div>'
      + '<div id="zona-planilla"' + (state.verPlanilla ? '' : ' class="oculta"') + '></div>'
      + '<div class="leyenda"><span><b>0</b> = pendiente de entrega</span><span><b>1</b> = no presentado</span>'
      + '<span><b>—</b> = sin calificación</span></div>';

    var pills = view.querySelector('#pills');
    state.subjects.forEach(function (s) {
      var clave = s.ids.join(',');
      var b = el('button', 'pill' + (clave === state.subject ? ' activa' : ''), s.nombre);
      b.addEventListener('click', function () { state.subject = clave; state.verPlanilla = false; cargarMateria(); });
      pills.appendChild(b);
    });
    var pillsT = view.querySelector('#pillsT');
    state.terms.slice().sort(function (a, b) { return a.id - b.id; }).forEach(function (t) {
      var b = el('button', 'pill' + (t.id === state.term ? ' activa' : ''), t.name.replace('trimestre', 'T'));
      b.addEventListener('click', function () { state.term = t.id; dibujar(); });
      pillsT.appendChild(b);
    });
    var btnNueva = view.querySelector('#nueva');
    if (btnNueva) btnNueva.addEventListener('click', function () { modalActividad(null); });
    view.querySelector('#volver-resumen').addEventListener('click', function () { state.resumen = true; dibujarResumen(); });
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
    if (!delDia.length) {
      if (SOLO_LECTURA) return;
      modalActividad(null, fecha); return;
    }
    var fondo = el('div', 'modal-fondo');
    var filas = delDia.map(function (a) {
      var t = state.terms.filter(function (x) { return x.id === a.term_id; })[0];
      return '<button class="fila-act act-btn-cal" data-act="' + a.id + '"><div class="info">'
        + '<div class="titulo">' + esc(A.nombreActividad(a)) + '</div>'
        + '<div class="meta">' + (t ? esc(t.name) : '') + (a.weight != null ? ' · peso ' + a.weight + '%' : '') + '</div></div></button>';
    }).join('');
    fondo.innerHTML = '<div class="modal">' + XBTN + '<h3>' + esc(A.fmtFecha(fecha)) + '</h3>' + filas
      + '<div class="acciones"><button class="btn-ghost btn" id="md-cancel">Cerrar</button>'
      + (SOLO_LECTURA ? '' : '<button class="btn" id="md-nueva">+ Actividad este día</button>') + '</div></div>';
    document.body.appendChild(fondo);
    fondo.querySelector('#md-cancel').addEventListener('click', function () { fondo.remove(); });
    fondo.querySelector('.modal-x').addEventListener('click', function () { fondo.remove(); });
    fondo.addEventListener('click', function (e) { if (e.target === fondo) fondo.remove(); });
    var btnMd = fondo.querySelector('#md-nueva');
    if (btnMd) btnMd.addEventListener('click', function () {
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
        + 'Todavía no hay actividades en este trimestre.' + (SOLO_LECTURA ? '' : '<br>Creá la primera con "+ Nueva actividad" o tocando un día del calendario.') + '</div>';
      return;
    }
    function filaAct(a, esMesa) {
      var metaTxt = a.due_date ? 'cierra ' + A.fmtFecha(a.due_date) : 'sin fecha de cierre';
      var r = '<div class="fila-act"><button class="act-btn' + (esMesa ? ' mesa' : '') + '" data-act="' + a.id + '"><div class="info">'
        + '<div class="titulo">' + esc(cap(A.nombreActividad(a))) + '</div>'
        + '<div class="meta" data-meta-fecha>' + metaTxt + '</div></div>'
        + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex:none"><path d="M9 18l6-6-6-6"/></svg></button>';
      var ed = '';
      if (!SOLO_LECTURA) {
        ed += '<input class="fecha-ed" type="date" data-fecha="' + a.id + '" value="' + (a.due_date || '') + '"'
          + ' title="Fecha de cierre — se muestra a estudiantes y familias" aria-label="Fecha de cierre de ' + esc(a.title) + '">';
      }
      if (!esMesa) {
        if (SOLO_LECTURA) {
          ed += '<div class="peso-box" style="justify-content:center"><span>'
            + (a.weight != null ? a.weight + '%' : '—') + '</span></div>';
        } else {
          ed += '<div class="peso-box"><input type="number" min="0" max="100" step="1" inputmode="numeric"'
            + ' data-peso="' + a.id + '" value="' + (a.weight != null ? a.weight : '') + '" placeholder="—"'
            + ' aria-label="Peso de ' + esc(a.title) + '"><span>%</span></div>';
        }
      }
      if (ed) r += '<div class="fila-ed">' + ed + '</div>';
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
    z.querySelectorAll('input[data-fecha]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var aid = Number(inp.getAttribute('data-fecha'));
        var act = state.activities.filter(function (x) { return x.id === aid; })[0];
        var viejo = act ? act.due_date : null;
        var v = inp.value || null;
        inp.disabled = true;
        sb.from('activities').update({ due_date: v }).eq('id', aid).then(function (r) {
          inp.disabled = false;
          if (r.error) { inp.value = viejo || ''; alert('No se pudo guardar la fecha: ' + r.error.message); return; }
          if (act) act.due_date = v;
          var fila = inp.closest('.fila-act');
          var meta = fila ? fila.querySelector('[data-meta-fecha]') : null;
          if (meta) meta.textContent = v ? 'cierra ' + A.fmtFecha(v) : 'sin fecha de cierre';
          dibujarCal();
        });
      });
    });
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
    var todas = actsDelTerm();
    var acts = todas.filter(function (a) { return a.kind !== 'mesa'; });
    var mesas = mesasDelTerm();
    var barraSup = '<div class="toolbar"><div class="buscar">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
      + '<input id="filtro" placeholder="Buscar alumno…" value="' + esc(state.filtro) + '"></div><div class="spacer"></div>'
      + '<div class="nav-tabla"><button class="btn-nav" id="navIzq" aria-label="Columnas anteriores">‹</button>'
      + '<button class="btn-nav" id="navDer" aria-label="Columnas siguientes">›</button></div></div>';
    if (!state.students.length) { tabla.innerHTML = barraSup + '<div class="vacio">Sin estudiantes en esta materia.</div>'; return; }
    if (!todas.length) {
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
        + esc(a.description || 'Editar actividad') + '"><span class="t1">' + esc(A.nombreActividad(a)) + '</span></button></th>';
    });
    var nomTrim = (state.terms.filter(function (t) { return t.id === state.term; })[0] || { name: 'Trimestre' }).name;
    html += '<th class="num">' + esc(nomTrim) + '<br><span style="font-weight:400;font-size:.68rem;opacity:.75">calculada</span></th>'
      + '<th class="num">Final</th>';
    mesas.forEach(function (a) {
      html += '<th class="num"><button class="th-act" data-edit="' + a.id + '" title="Instancia fuera del período lectivo"><span class="t1">'
        + esc(a.title) + '</span></button></th>';
    });
    html += '<th class="num">Nota Final</th></tr></thead><tbody>';
    state.students.forEach(function (s) {
      html += '<tr data-nom="' + esc((s.last_name + ' ' + s.first_name).toLowerCase()) + '"><td class="alumno">'
        + esc(s.last_name) + ', ' + esc(s.first_name) + '</td>';
      acts.forEach(function (a) {
        var g = state.grades[a.id + '_' + s.id];
        var v = g && g.status === 'calificada' ? g.value : '';
        var st = g ? g.status : 'sin_calificar';
        var celda = st === 'pendiente' ? ' celda-pend' : (st === 'no_presentado' ? ' celda-nopres' : (st === 'calificada' ? ' celda-cal' : ''));
        html += '<td class="num' + celda + '" data-aid="' + a.id + '" data-sid="' + s.id + '">'
          + (SOLO_LECTURA
            ? '<span class="nota-ro">' + (st === 'calificada' && v !== '' ? v : (st === 'pendiente' ? '0' : (st === 'no_presentado' ? '1' : '—'))) + '</span>'
            : '<input class="nota" type="number" min="0" max="10" step="1" inputmode="numeric" aria-label="Nota de '
            + esc(s.last_name) + ' en ' + esc(a.title) + '" value="' + (v === null || v === undefined ? '' : v) + '">'
            + '<br><select class="estado" aria-label="Estado">'
            + opt('sin_calificar', '—', st) + opt('pendiente', '0 pend.', st)
            + opt('no_presentado', '1 no pres.', st) + opt('calificada', 'nota', st)
            + '</select>') + '</td>';
      });
      var nt = notaTrimestre(s.id);
      var tg = state.termGrades[s.id + '_' + state.term];
      html += '<td class="num">' + (tg
          ? '<b style="font-size:1.05rem">' + tg.value + '</b>'
          : (nt != null ? '<span style="font-size:1.05rem;color:var(--gris);opacity:.7">' + sug(nt) + '</span>' : '<span style="color:var(--gris-claro)">—</span>'))
        + '</td>';
      var f = state.finals[s.id], fe = finalEfectiva(s.id), p = promFinal(s.id);
      html += '<td class="num">' + (SOLO_LECTURA
        ? '<span class="nota-ro">' + (fe == null ? '—' : fe) + '</span>'
        : '<input class="nota' + (f == null && fe != null ? ' nota-sug' : '') + '" type="number" min="2" max="10" step="1" inputmode="numeric" value="'
        + (fe == null ? '' : fe) + '" data-final="' + s.id + '" aria-label="Nota final de ' + esc(s.last_name) + '"'
        + (p != null ? ' title="Promedio de trimestres: ' + pondTxt(p) + '"' : '') + '>'
        + (f == null && p != null ? '<div class="fin-sug">pond ' + pondTxt(p) + '</div>' : '')) + '</td>';
      mesas.forEach(function (a) {
        var g = state.grades[a.id + '_' + s.id];
        var v = g && g.status === 'calificada' ? g.value : '';
        var st = g ? g.status : 'sin_calificar';
        var celda = st === 'pendiente' ? ' celda-pend' : (st === 'no_presentado' ? ' celda-nopres' : (st === 'calificada' ? ' celda-cal' : ''));
        html += '<td class="num' + celda + '" data-aid="' + a.id + '" data-sid="' + s.id + '">'
          + (SOLO_LECTURA
            ? '<span class="nota-ro">' + (st === 'calificada' && v !== '' ? v : (st === 'pendiente' ? '0' : (st === 'no_presentado' ? '1' : '—'))) + '</span>'
            : '<input class="nota" type="number" min="0" max="10" step="1" inputmode="numeric" aria-label="Nota de '
            + esc(s.last_name) + ' en ' + esc(a.title) + '" value="' + (v === null || v === undefined ? '' : v) + '">'
            + '<br><select class="estado" aria-label="Estado">'
            + opt('sin_calificar', '—', st) + opt('pendiente', '0 pend.', st)
            + opt('no_presentado', '1 no pres.', st) + opt('calificada', 'nota', st)
            + '</select>') + '</td>';
      });
      var cierre = cierreFinal(s.id);
      html += '<td class="num">' + (SOLO_LECTURA
        ? '<span class="nota-ro"><b style="font-size:1.05rem">' + (cierre == null ? '—' : cierre) + '</b></span>'
        : '<input class="nota" type="number" min="0" max="10" step="1" inputmode="numeric" value="'
        + (cierre == null ? '' : cierre) + '" data-cierre="' + s.id + '" aria-label="Nota de cierre de ' + esc(s.last_name) + '">') + '</td></tr>';
    });
    html += '</tbody></table></div>'
      + '<div class="savebar"><span class="pendientes" id="pend"></span><div class="spacer"></div>'
      + '<button class="btn btn-ghost btn-mini" id="excel">Excel</button>'
      + '<button class="btn btn-ghost btn-mini" id="imprimir">Imprimir</button>'
      + (SOLO_LECTURA ? '' : '<button class="btn btn-ghost btn-mini" id="habilitar">Habilitar trimestre</button>'
      + '<button class="btn" id="guardar">Guardar</button>') + '</div>';
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
    tabla.querySelectorAll('input[data-final], input[data-cierre]').forEach(function (inp) {
      inp.addEventListener('input', function () { inp.setAttribute('data-sucia', '1'); programarAutosave(); });
    });
    if (!SOLO_LECTURA) {
      view.querySelector('#guardar').addEventListener('click', guardar);
      view.querySelector('#habilitar').addEventListener('click', modalHabilitar);
    }
  }

  /* Carga de notas de una actividad: lista de estudiantes, un recuadro 1-10 (solo .5) */
  function modalNotas(act) {
    var fondo = el('div', 'modal-fondo');
    var esMesa = act.kind === 'mesa';
    var lista = state.students;
    if (esMesa) {
      lista = state.students.filter(function (s) {
        var f = finalEfectiva(s.id);
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
        + (esMesa ? ' <span class="chip" style="margin-left:6px">final ' + esc(String(finalEfectiva(s.id))) + '</span>' : '')
        + '</div></div>'
        + (SOLO_LECTURA
          ? '<span class="nota-ro nf-ro">' + (st === 'calificada' && v !== '' ? v : (st === 'pendiente' ? '0 pend.' : (st === 'no_presentado' ? '1 no pres.' : '—'))) + '</span>'
          : '<select class="estado nf-est">'
          + opt('sin_calificar', '—', st) + opt('pendiente', 'Pend.', st)
          + opt('no_presentado', 'No pres.', st) + opt('calificada', 'Nota', st) + '</select>'
          + '<input class="nota nf-nota" type="number" min="1" max="10" step="0.5" inputmode="decimal"'
          + ' placeholder="1-10" value="' + v + '"' + (st === 'calificada' ? '' : ' disabled') + '>') + '</div>';
    });
    var avisoIni = esMesa
      ? '<div class="aviso info">' + A.icon('alerta') + '<div>Aparecen solo los estudiantes con <b>nota final menor a 6</b> (la cargada a mano o el promedio de trimestres). Si todos aprobaron, la lista queda vacía.</div></div>'
      : (SOLO_LECTURA ? '' : '<div class="aviso info">' + A.icon('lapiz') + '<div>Notas del <b>1 al 10</b> en pasos de medio punto '
        + '(7, 7.5, 8…). Pendiente y No presentado se eligen en la lista de cada estudiante.</div></div>');
    if (esMesa && !lista.length) {
      filas = '<div class="vacio" style="padding:26px">Ningún estudiante debe rendir esta instancia:<br>todos tienen nota final de 6 o más (o aún no cargaste las finales).</div>';
    }
    fondo.innerHTML =
      '<div class="modal">' + XBTN + '<h3>' + esc(A.nombreActividad(act)) + '</h3>'
      + avisoIni
      + '<div style="max-height:52vh;overflow-y:auto">' + filas + '</div>'
      + '<div class="aviso" id="mn-msg" style="display:none"></div>'
      + '<div class="acciones">' + (SOLO_LECTURA ? '' : '<button class="btn-ghost btn" id="mn-editar">Editar actividad</button>')
      + '<button class="btn" id="mn-listo">' + (SOLO_LECTURA ? 'Cerrar' : 'Listo') + '</button></div></div>';
    document.body.appendChild(fondo);
    function cerrar() { fondo.remove(); cargarMateria(); }
    fondo.querySelector('#mn-listo').addEventListener('click', cerrar);
    fondo.querySelector('.modal-x').addEventListener('click', cerrar);
    fondo.addEventListener('click', function (e) { if (e.target === fondo) cerrar(); });
    var btnEdit = fondo.querySelector('#mn-editar');
    if (btnEdit) btnEdit.addEventListener('click', function () {
      fondo.remove(); modalActividad(act);
    });
    if (SOLO_LECTURA) return;
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
    var cierres = [], borrados = [];
    view.querySelectorAll('input[data-cierre][data-sucia]').forEach(function (inp) {
      var sid = Number(inp.getAttribute('data-cierre'));
      if (inp.value === '') borrados.push({ sid: sid, inp: inp });
      else cierres.push({ student_id: sid, subject_id: idsMateria()[0], value: Number(inp.value), updated_by: ctx.user.id, inp: inp });
    });
    return { filas: filas, finales: finales, cierres: cierres, borrados: borrados };
  }

  function guardar() {
    clearTimeout(state.autoTimer);
    var p = celdasAPayload();
    if (!p.filas.length && !p.finales.length && !p.cierres.length && !p.borrados.length) { actualizarPendientes(); return; }
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
      if (!err && (p.cierres.length || p.borrados.length)) {
        var t = Promise.resolve({ error: null });
        if (p.cierres.length) {
          var cClean = p.cierres.map(function (f) {
            return { student_id: f.student_id, subject_id: f.subject_id, value: f.value, updated_by: f.updated_by };
          });
          t = sb.from('cierre_grades').upsert(cClean, { onConflict: 'student_id,subject_id' }).then(function (r3) {
            if (!r3.error) p.cierres.forEach(function (f) { f.inp.removeAttribute('data-sucia'); state.cierres[f.student_id] = f.value; });
            return r3;
          });
        }
        return t.then(function (r3) {
          if (r3 && r3.error) return r3.error;
          if (!p.borrados.length) return null;
          return sb.from('cierre_grades').delete()
            .in('student_id', p.borrados.map(function (b) { return b.sid; }))
            .eq('subject_id', idsMateria()[0]).then(function (r4) {
              if (!r4.error) p.borrados.forEach(function (b) { b.inp.removeAttribute('data-sucia'); delete state.cierres[b.sid]; });
              return r4.error;
            });
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
          var nActs = actsDelTerm().filter(function (a) { return a.kind !== 'mesa'; }).length;
          var cell = td[nActs];
          if (cell) cell.innerHTML = tg
            ? '<b style="font-size:1.05rem">' + tg.value + '</b>' + (tg.computed != null && Math.abs(Number(tg.computed) - Number(tg.value)) > 0.001 ? '<br><span style="font-size:.66rem;color:var(--gris)">pond ' + pondTxt(Number(tg.computed)) + '</span>' : '')
            : (nt != null ? '<span style="font-size:1.05rem;color:var(--gris)">' + pondTxt(nt) + '</span><br><span style="font-size:.66rem;color:var(--gris-claro)">sugiere <b>' + sug(nt) + '</b></span>' : '<span style="color:var(--gris-claro)">—</span>');
          var cellCierre = td[td.length - 1];
          var cierre = cierreFinal(s.id);
          if (cellCierre) {
            var inpC = cellCierre.querySelector('input[data-cierre]');
            if (inpC) { if (inpC.value === '' && cierre != null) inpC.value = cierre; }
            else cellCierre.innerHTML = '<span class="nota-ro"><b style="font-size:1.05rem">' + (cierre == null ? '—' : cierre) + '</b></span>';
          }
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
    if (SOLO_LECTURA) return;
    var esEdicion = !!act;
    var fondo = el('div', 'modal-fondo');
    fondo.innerHTML =
      '<div class="modal">' + XBTN + '<h3>' + (esEdicion ? 'Editar actividad' : 'Nueva actividad') + '</h3>'
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
    fondo.querySelector('.modal-x').addEventListener('click', function () { fondo.remove(); });
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

  // Aceptar la sugerida para todos los estudiantes de una vez (no pisa las ya habilitadas)
  function aceptarSugeridas() {
    var ups = [];
    state.students.forEach(function (s) {
      var nt = notaTrimestre(s.id);
      if (nt == null || state.termGrades[s.id + '_' + state.term]) return;
      ups.push({ student_id: s.id, subject_id: idsMateria()[0], term_id: state.term,
        computed: Math.round(nt * 100) / 100, value: sug(nt), updated_by: ctx.user.id });
    });
    if (!ups.length) return;
    if (!confirm('¿Aceptar la nota sugerida para ' + ups.length + ' estudiantes? Después podés ajustar cualquiera a mano.')) return;
    sb.from('term_grades').upsert(ups, { onConflict: 'student_id,subject_id,term_id' }).then(function (r) {
      if (r.error) alert('No se pudo habilitar: ' + r.error.message);
      else cargarMateria();
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
      var valor = tg ? tg.value : (sug(nt) != null ? sug(nt) : '');
      if (nt != null) conCalif++;
      filas += '<div class="fila-act"><div class="info"><div class="titulo">' + esc(s.last_name) + ', ' + esc(s.first_name) + '</div>'
        + '<div class="meta">' + (nt != null ? 'ponderación ' + pondTxt(nt) + ' · sugerida <b>' + sug(nt) + '</b>' : 'sin datos') + '</div></div>'
        + '<input class="nota" style="width:70px;text-align:center;padding:8px;border:1.5px solid var(--linea);border-radius:8px;font-weight:700" type="number" min="0" max="10" step="1" inputmode="numeric" data-hab="' + s.id + '"'
        + (sug(nt) != null ? ' placeholder="' + sug(nt) + '"' : '') + ' value="' + valor + '"></div>';
    });
    fondo.innerHTML =
      '<div class="modal">' + XBTN + '<h3>Habilitar nota de trimestre</h3>'
      + '<div class="aviso info">' + A.icon('libro') + '<div>Peso asignado: <b>' + peso + '%</b>' + (peso < 100 ? ' — la ponderación proyecta con lo cargado' : '') + '. La sugerida redondea hacia arriba desde ,50 (6,50 → 7). Revisá cada nota, ajustá si hace falta y confirmá.</div></div>'
      + '<div style="max-height:46vh;overflow-y:auto">' + filas + '</div>'
      + '<div class="acciones"><button class="btn-ghost btn" id="h-sug">Aceptar sugeridas</button>'
      + '<button class="btn-ghost btn" id="h-cancel">Cancelar</button>'
      + '<button class="btn" id="h-ok">Habilitar ' + conCalif + ' notas</button></div></div>';
    document.body.appendChild(fondo);
    fondo.querySelector('#h-cancel').addEventListener('click', function () { fondo.remove(); });
    fondo.querySelector('.modal-x').addEventListener('click', function () { fondo.remove(); });
    fondo.addEventListener('click', function (e) { if (e.target === fondo) fondo.remove(); });
    fondo.querySelector('#h-sug').addEventListener('click', function () {
      fondo.querySelectorAll('input[data-hab]').forEach(function (inp) {
        if (inp.value !== '') return;
        var nt = notaTrimestre(Number(inp.getAttribute('data-hab')));
        if (sug(nt) != null) inp.value = sug(nt);
      });
    });
    fondo.querySelector('#h-ok').addEventListener('click', function () {
      var ups = [];
      fondo.querySelectorAll('input[data-hab]').forEach(function (inp) {
        if (inp.value === '') return;
        var sid = Number(inp.getAttribute('data-hab'));
        var nt = notaTrimestre(sid);
        ups.push({ student_id: sid, subject_id: idsMateria()[0], term_id: state.term,
          computed: nt != null ? Math.round(nt * 100) / 100 : null, value: Number(inp.value), updated_by: ctx.user.id });
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
    var acts = actsDelTerm().filter(function (a) { return a.kind !== 'mesa'; });
    var mesas = mesasDelTerm();
    var cab = ['Estudiante'].concat(acts.map(function (a) {
      return A.nombreActividad(a) + (a.weight != null ? ' (' + a.weight + '%)' : '');
    }), ['Trimestre', 'Final'], mesas.map(function (a) { return a.title; }), ['Nota Final']);
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
      fila.push(nt != null ? Number(nt).toFixed(2).replace('.', ',') : '');
      fila.push(finalEfectiva(s.id) != null ? String(finalEfectiva(s.id)).replace('.', ',') : '');
      mesas.forEach(function (a) {
        var g = state.grades[a.id + '_' + s.id];
        fila.push(g && g.status === 'calificada' && g.value != null ? String(g.value).replace('.', ',') : '');
      });
      var cierre = cierreFinal(s.id);
      fila.push(cierre != null ? String(cierre).replace('.', ',') : '');
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

  // Mesa aprobada en cualquier trimestre (para la planilla anual impresa)
  function mesaAprobadaAnual(sid) {
    var mesas = state.activities.filter(function (a) { return a.kind === 'mesa'; }).sort(function (x, y) {
      var o = function (a) { var t = (a.title || '').toLowerCase(); return t.indexOf('dic') !== -1 ? 0 : (t.indexOf('feb') !== -1 ? 1 : 2); };
      return o(x) - o(y) || x.id - y.id;
    }), ap = null;
    mesas.forEach(function (a) {
      var g = state.grades[a.id + '_' + sid];
      if (ap == null && g && g.status === 'calificada' && g.value != null && Number(g.value) >= 6) ap = g.value;
    });
    return ap;
  }

  /* Imprimir: planilla completa del año (los 3 trimestres) en A4 horizontal con escudo */
  function imprimir() {
    var hoy = new Date().toLocaleDateString('es-AR');
    var grupos = state.terms.slice().sort(function (a, b) { return a.id - b.id; }).map(function (t) {
      var todas = state.activities.filter(function (a) { return a.term_id === t.id; });
      return { t: t, acts: todas.filter(function (a) { return a.kind !== 'mesa'; }) };
    });
    var mesas = state.activities.filter(function (a) { return a.kind === 'mesa'; }).sort(function (x, y) {
      var o = function (a) { var t = (a.title || '').toLowerCase(); return t.indexOf('dic') !== -1 ? 0 : (t.indexOf('feb') !== -1 ? 1 : 2); };
      return o(x) - o(y) || x.id - y.id;
    });
    var h = '<div class="ph-head">'
      + '<img class="ph-escudo" src="escudo.png" alt="Escudo Santo Tomás de Villanueva">'
      + '<div><div class="ph-brand">Activate · Colegio Santo Tomás de Villanueva</div>'
      + '<h1>' + esc(nombreMateriaSel()) + ' — ' + esc(ctx.course ? ctx.course.name : '') + ' · Planilla anual</h1>'
      + '<div class="ph-meta">' + state.students.length + ' estudiantes · ' + hoy + '</div></div></div>'
      + '<table class="ph-tabla"><thead><tr><th class="ph-alumno" rowspan="2">Estudiante</th>';
    grupos.forEach(function (g) {
      h += '<th class="ph-grupo" colspan="' + (g.acts.length + 1) + '">' + esc(g.t.name) + '</th>';
    });
    h += '<th class="ph-grupo" colspan="' + (mesas.length + 2) + '">Cierre</th></tr><tr>';
    grupos.forEach(function (g) {
      g.acts.forEach(function (a) {
        h += '<th>' + esc(A.nombreActividad(a)) + (a.weight != null ? '<br><span class="ph-peso">' + a.weight + '%</span>' : '') + '</th>';
      });
      h += '<th class="ph-trim">Nota ' + esc(g.t.name.replace('trimestre', 'T')) + '</th>';
    });
    h += '<th class="ph-trim">Final</th>';
    mesas.forEach(function (a) { h += '<th>' + esc(a.title) + '</th>'; });
    h += '<th class="ph-trim">Nota Final</th></tr></thead><tbody>';
    state.students.forEach(function (s) {
      h += '<tr><td class="ph-alumno">' + esc(s.last_name) + ', ' + esc(s.first_name) + '</td>';
      grupos.forEach(function (g) {
        g.acts.forEach(function (a) {
          var gr = state.grades[a.id + '_' + s.id];
          h += '<td' + (gr && gr.status === 'calificada' ? ' class="ph-nota"' : '') + '>' + notaCeldaTxt(gr) + '</td>';
        });
        var tg = state.termGrades[s.id + '_' + g.t.id];
        var nt = tg ? tg.value : notaTrimestre(s.id, g.t.id);
        h += '<td class="ph-trim">' + (nt != null ? '<b>' + Number(nt).toFixed(2).replace('.', ',') + '</b>' : '—') + '</td>';
      });
      h += '<td class="ph-trim">' + (finalEfectiva(s.id) != null ? '<b>' + finalEfectiva(s.id) + '</b>' : '—') + '</td>';
      mesas.forEach(function (a) {
        var gr = state.grades[a.id + '_' + s.id];
        h += '<td' + (gr && gr.status === 'calificada' ? ' class="ph-nota"' : '') + '>' + notaCeldaTxt(gr) + '</td>';
      });
      var cierre = state.cierres[s.id] != null ? state.cierres[s.id] : mesaAprobadaAnual(s.id);
      if (cierre == null) { var pa = promFinal(s.id); cierre = pa != null && pa > 5.5 ? Math.max(1, Math.round(pa)) : null; }
      h += '<td class="ph-trim">' + (cierre != null ? '<b>' + cierre + '</b>' : '—') + '</td></tr>';
    });
    h += '</tbody></table><div class="ph-pie">Pend. = pendiente de entrega · No pres. = no presentado · — = sin calificar · '
      + 'La nota de cada trimestre se calcula por peso; la Nota Final es el cierre del año (mesa aprobada o carga del docente).</div>';
    var z = document.getElementById('print-area');
    if (!z) { z = document.createElement('div'); z.id = 'print-area'; document.body.appendChild(z); }
    z.innerHTML = h;
    window.print();
  }

  cargar();
};
