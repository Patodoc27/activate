#!/usr/bin/env python3
"""Carga inicial STV 2026 (1°A + 1°B) desde los libros exportados.
Cada pestaña = un grupo-materia. Los nombres se unifican con matching tolerante
(truncados, tildes, variantes tipo ISABELA/ISABELLA)."""
import openpyxl, psycopg2, unicodedata, re, json, urllib.request, os

DB = dict(host='aws-0-us-east-1.pooler.supabase.com', port=5432, dbname='postgres',
          user='postgres.apehzspwbyqwsrdeezrn', sslmode='require',
          password=os.environ['PGPASSWORD'], connect_timeout=15)
SB_URL = 'https://apehzspwbyqwsrdeezrn.supabase.co'
SECRET = os.environ['SB_SECRET']
DEMO_PASS = 'Activate2026'

LIBROS = [('/tmp/libro1A.xlsx', '1° A'), ('/tmp/libro1B.xlsx', '1° B')]
SHARED_HINTS = ('DEPORTE', 'TEATRO', 'MÚSICA', 'N1', 'N2')

def norm(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s).upper().strip()

def lev1(a, b):
    if a == b: return True
    la, lb = len(a), len(b)
    if abs(la - lb) > 1: return False
    if la == lb:
        return sum(x != y for x, y in zip(a, b)) <= 1
    if la > lb: a, b, la, lb = b, a, lb, la
    i = j = dif = 0
    while i < la and j < lb:
        if a[i] == b[j]: i += 1; j += 1
        else: dif += 1; j += 1
        if dif > 1: return False
    return True

def tokens(s): return [t for t in norm(s).replace(',', ' ').split() if len(t) > 1]

def same_person(n1, n2):
    t1, t2 = tokens(n1), tokens(n2)
    short, long = (t1, t2) if len(t1) <= len(t2) else (t2, t1)
    if not short: return False
    return all(any(s == l or l.startswith(s) or s.startswith(l) or lev1(s, l) for l in long) for s in short)

def materia_clean(title):
    t = title.strip()
    t = re.sub(r'\s*1[º°]\s*[AB]\s*$', '', t).strip()
    return ' '.join(w.capitalize() for w in t.split())

# ---------- 1) Leer ambos libros ----------
groups = []  # (tab_materia, curso_hint, [nombres])
for path, curso in LIBROS:
    wb = openpyxl.load_workbook(path, read_only=True)
    for ws in wb.worksheets:
        t = ws.title.strip()
        if 'PERFIL AGUSTINO' in t.upper() or t.upper().startswith('HOJA'):
            continue
        names = []
        for row in ws.iter_rows(min_row=3, max_col=2, values_only=True):
            name = row[1]
            if name and str(name).strip() and 'APELLIDO' not in str(name).upper():
                names.append(str(name).strip())
        if names:
            groups.append((materia_clean(t), t, curso, names))
            print(f'{curso} | {t} -> {materia_clean(t)}: {len(names)}')

# ---------- 2) Clusterizar estudiantes ----------
clusters = []  # {names:set, tabs:set}
for materia, tab, curso, names in groups:
    for n in names:
        hit = None
        for c in clusters:
            if any(same_person(n, x) for x in c['names']):
                hit = c; break
        if not hit:
            hit = {'names': set(), 'tabs': set()}
            clusters.append(hit)
        hit['names'].add(n); hit['tabs'].add(tab)
print(f'{len(clusters)} estudiantes únicos')

def curso_de(c):
    a = sum(1 for t in c['tabs'] if '1ºA' in t or '1°A' in t)
    b = sum(1 for t in c['tabs'] if '1ºB' in t or '1°B' in t or '1º B' in t)
    return '1° A' if a >= b else '1° B'

def display_name(c):
    best = max(c['names'], key=len)
    if ',' not in best:
        con_coma = [n for n in c['names'] if ',' in n]
        if con_coma: best = max(con_coma, key=len)
    return best

# ---------- 3) Base ----------
conn = psycopg2.connect(**DB); conn.autocommit = True
cur = conn.cursor()
def one(sql, args):
    cur.execute(sql, args); r = cur.fetchone(); return r[0] if r else None
def run(sql, args): cur.execute(sql, args)

school = one("select id from schools where name='Santo Tomás de Villanueva'", ()) or \
         one("insert into schools(name) values('Santo Tomás de Villanueva') returning id", ())
year = one("select id from academic_years where school_id=%s and label='2026'", (school,)) or \
       one("insert into academic_years(school_id,label) values(%s,'2026') returning id", (school,))
for i,(nm,ini,fin) in enumerate([('1er trimestre','2026-03-02','2026-06-05'),
                                 ('2do trimestre','2026-06-08','2026-09-04'),
                                 ('3er trimestre','2026-09-07','2026-12-11')],1):
    run("insert into terms(academic_year_id,name,ordinal,starts_on,ends_on) values(%s,%s,%s,%s,%s)"
        " on conflict (academic_year_id,ordinal) do update set name=excluded.name",(year,nm,i,ini,fin))
course_ids = {}
for nm, s in [('1° A',1),('1° B',2)]:
    course_ids[nm] = one("insert into courses(academic_year_id,name,sort) values(%s,%s,%s)"
                         " on conflict (academic_year_id,name) do update set sort=excluded.sort returning id",(year,nm,s))

# sujeto por grupo (pestaña). name incluye el grupo para evitar colisión.
subj_ids = {}
seen_names = {}
for materia, tab, curso_hint, names in groups:
    courses_in_tab = {curso_de(c) for c in clusters if tab in c['tabs']} or {curso_hint}
    key = (materia, tuple(sorted(courses_in_tab)))
    base = materia
    name = base if len(courses_in_tab) > 1 else f'{base} ({courses_in_tab.pop()})'
    # si ya existe un sujeto con ese name exacto, reusar
    sid = one("select id from subjects where academic_year_id=%s and name=%s", (year, name))
    if not sid:
        sid = one("insert into subjects(academic_year_id,name,short_name) values(%s,%s,%s) returning id",
                  (year, name, base))
    subj_ids[tab] = sid
    for cn in ([key[1][0]] if len(key[1])==1 else list(key[1])):
        run("insert into subject_courses(subject_id,course_id) values(%s,%s) on conflict do nothing",
            (sid, course_ids[cn]))

stud_ids = {}
for c in clusters:
    disp = display_name(c)
    ap, _, nom = disp.partition(',')
    sid = one("insert into students(school_id,course_id,last_name,first_name) values(%s,%s,%s,%s) returning id",
              (school, course_ids[curso_de(c)], ap.strip().title(), nom.strip().title()))
    stud_ids[display_name(c)] = sid
    for tab in c['tabs']:
        run("insert into enrollments(student_id,subject_id) values(%s,%s) on conflict do nothing",
            (sid, subj_ids[tab]))

# estudiante de prueba en 1° A
demo_student = one("insert into students(school_id,course_id,last_name,first_name) values(%s,%s,'De Prueba','Alumna') returning id",
                   (school, course_ids['1° A']))
for materia, tab, curso, names in groups:
    if curso_de({'tabs': {tab}}) == '1° A' or 'A' not in tab.upper():
        pass
for tab, sid in subj_ids.items():
    run("insert into enrollments(student_id,subject_id) values(%s,%s) on conflict do nothing",(demo_student, sid))

# ---------- 4) Cuentas demo ----------
def mkuser(email, role, name):
    req = urllib.request.Request(SB_URL + '/auth/v1/admin/users',
        data=json.dumps({'email': email, 'password': DEMO_PASS, 'email_confirm': True}).encode(),
        headers={'apikey': SECRET, 'Authorization': 'Bearer ' + SECRET, 'Content-Type': 'application/json'})
    try:
        uid = json.load(urllib.request.urlopen(req))['id']
    except urllib.error.HTTPError:
        req2 = urllib.request.Request(SB_URL + '/auth/v1/admin/users?per_page=200',
            headers={'apikey': SECRET, 'Authorization': 'Bearer ' + SECRET})
        uid = next(u['id'] for u in json.load(urllib.request.urlopen(req2))['users'] if u['email'] == email)
    run("insert into accounts(id,school_id,role,full_name) values(%s,%s,%s,%s)"
        " on conflict (id) do update set role=excluded.role, full_name=excluded.full_name",
        (uid, school, role, name))
    return uid

doc = mkuser('docente.demo@activate.stv', 'docente', 'Docente de Prueba')
fam = mkuser('familia.demo@activate.stv', 'familia', 'Familia de Prueba')
est = mkuser('estudiante.demo@activate.stv', 'estudiante', 'Alumna De Prueba')

for sid in set(subj_ids.values()):
    run("insert into teacher_assignments(subject_id,account_id) values(%s,%s) on conflict do nothing",(sid, doc))
run("insert into guardian_links(guardian_account_id,student_id,relation) values(%s,%s,'madre') on conflict do nothing",(fam, demo_student))
cur.execute("update students set account_id=%s where id=%s", (est, demo_student))

# ---------- 5) Actividades y notas demo ----------
term3 = one("select id from terms where academic_year_id=%s and ordinal=3",(year,))
for tab, materia in [('HISTORIA 1ºA','Historia'),('MATEMÁTICA 1ºA','Matemática'),('BIOLOGÍA 1ºA','Biología')]:
    sid = subj_ids.get(tab)
    if not sid: continue
    a1 = one("insert into activities(subject_id,term_id,title,description,due_date,created_by)"
             " values(%s,%s,%s,%s,%s,%s) returning id",(sid,term3,'Trabajo práctico 4','Entrega en clase','2026-10-30',doc))
    a2 = one("insert into activities(subject_id,term_id,title,description,due_date,created_by)"
             " values(%s,%s,%s,%s,%s,%s) returning id",(sid,term3,'Evaluación escrita','','2026-11-13',doc))
    for c in clusters:
        if tab in c['tabs']:
            v = (id(c) % 10) + 1
            run("insert into grades(activity_id,student_id,value,status,updated_by) values(%s,%s,%s,'calificada',%s)"
                " on conflict (activity_id,student_id) do nothing",(a1, stud_ids[display_name(c)], float(v), doc))
    run("insert into grades(activity_id,student_id,value,status,updated_by) values(%s,%s,9,'calificada',%s)"
        " on conflict (activity_id,student_id) do nothing",(a1, demo_student, doc))
    run("insert into grades(activity_id,student_id,value,status,updated_by) values(%s,%s,0,'pendiente',%s)"
        " on conflict (activity_id,student_id) do nothing",(a2, demo_student, doc))
run("insert into final_grades(student_id,subject_id,value,updated_by) values(%s,%s,8,%s)"
    " on conflict (student_id,subject_id) do nothing",(demo_student, subj_ids['MATEMÁTICA 1ºA'], doc))

conn.close()
print(f'SEED OK — {len(subj_ids)} grupos-materia, {len(stud_ids)} estudiantes')
print('Demo pass:', DEMO_PASS)
