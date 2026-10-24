import os, openpyxl, psycopg2, unicodedata, re
from psycopg2.extras import execute_values

def norm(s):
    s = unicodedata.normalize('NFD', str(s or ''))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return ' '.join(str(s).upper().split())

def nlower(s): return norm(s).lower()

conn = psycopg2.connect(host='aws-0-us-east-1.pooler.supabase.com', port=5432, dbname='postgres',
    user='postgres.apehzspwbyqwsrdeezrn', password=os.environ['PGPASSWORD'], sslmode='require', connect_timeout=15)
conn.autocommit = True
cur = conn.cursor()
DOCENTE = '038042f8-bdb2-4ad6-b43b-a9a4e0c952bc'
TERMS = [11, 12, 13]

cur.execute("select id, last_name||', '||first_name, course_id from students where course_id in (7,8)")
alum = {}
for sid, name, cid in cur.fetchall():
    alum.setdefault(cid, {})[norm(name)] = sid
extra = {'ARZELAN, ISABELA CELESTE':72,'MENDEZ, BARBARA TIARA':86,'MENDOZA MIRANDA, AGUSTÍN':87,
 'NAGY NARVAEZ, EMMA':90,'VALLEJO, AGUSTÍN':95,'ROMERO ARENA, ROSARIO':123,
 'NAGGY NARVAEZ, EMMA':90,'ROMERIO ARENA, ROSARIO':123}

def buscar_alumno(nombre, cid):
    n = norm(nombre)
    if not n or len(n) < 4: return None
    if n in alum.get(cid, {}): return alum[cid][n]
    if n in extra: return extra[n]
    partes = n.split(',')
    if len(partes) == 2:
        ap = partes[0].split()[0] if partes[0].split() else ''
        no = partes[1].split()[0] if partes[1].split() else ''
        cand = []
        for dbn, sid in alum.get(cid, {}).items():
            dpartes = dbn.split(',')
            if len(dpartes) != 2: continue
            if ap and ap in dpartes[0].split() and no and no in dpartes[1].split():
                cand.append(sid)
        if len(set(cand)) == 1: return cand[0]
    return None

def clasificar(header):
    n = ' ' + nlower(header) + ' '
    n = re.sub(r'[.\-_/()]+', ' ', n)
    if re.search(r'perfil|agustin', n): return 'agust'
    if re.search(r'\bt\s?p\b|\btp\b|trabajo|practico', n): return 'tp'
    if re.search(r'cuestionario|quiz|forms', n): return 'cuest'
    if re.search(r'juego|escape|pasapalabra|trivia|ludico', n): return 'juego'
    if re.search(r'carpeta|folder', n): return 'carp'
    if re.search(r'proyecto|proy|integrador', n): return 'proy'
    if re.search(r'oral|coloquio', n): return 'oral'
    if re.search(r'particip|seguimiento', n): return 'part'
    if re.search(r'intensific', n): return 'saltar'
    if re.search(r'mesa', n): return 'mesa'
    if re.search(r'evaluacion|\bev\b|examen|prueba|test|diagnos|recup|\bfinal\b', n): return 'eval'
    return 'otro'

MINUS = {'y','de','del','la','el','los','las','en','a','e','o','u','con','por','para','un','una'}
def titulo(header, kind, idx):
    h = ' '.join(str(header or '').replace('\n',' ').split())
    t = re.sub(r'^\s*(t\.?\s?p\.?|t\.p\.|tp|trabajo\s+pr[aá]ctico|trabajo|evaluaci[oó]n|ev\.?|examen|prueba|test|quiz|cuestionario|juego|proyecto|proy|carpeta|perfil\s+agustinian[oa]|participaci[oó]n|actividad)\b\s*[:\-–.]?\s*', '', h, flags=re.I)
    t = t.strip(' :-–.')
    if not t: t = h
    if t == t.upper() and len(t) > 3:
        pal = [w if (i>0 and w in MINUS) else (w[0].upper()+w[1:] if w else w) for i,w in enumerate(t.lower().split())]
        t = ' '.join(pal)
    return t or ('Actividad ' + str(idx))

def es_num(v):
    if isinstance(v,(int,float)): return float(v)
    s = str(v or '').strip().replace(',','.')
    try: return float(s)
    except Exception: return None

def valor_celda(v):
    n = es_num(v)
    if n is not None:
        if n == 0: return ('pendiente',0)
        return ('calificada',n)
    s = norm(v)
    if not s or s in ('-','·'): return None
    if 'AUSENTE' in s or s in ('NP','NO PRESENTADO','NO PRESENTO'): return ('no_presentado',1)
    return None

def procesar(libro, hoja, subject_id, course_id):
    wb = openpyxl.load_workbook(os.path.join(os.environ.get('SYNC_DIR','/tmp'), libro + '.xlsx'), read_only=True, data_only=True)
    if hoja not in wb.sheetnames: wb.close(); return ('SIN HOJA',0,0,[])
    rows = list(wb[hoja].iter_rows(values_only=True)); wb.close()
    if len(rows) < 3: return ('VACIA',0,0,[])
    head0, head1 = rows[0], (rows[1] if len(rows)>1 else ())
    def hd(c):
        for h in (head0, head1):
            v = h[c] if c < len(h) else None
            if v is not None and str(v).strip() and 'APELLIDO' not in norm(v): return str(v).strip()
        return ''
    term_cols, calif_col, act_cols = {}, None, {11:[],12:[],13:[]}
    termino = 0
    NCOL = max(len(head0), len(head1), 40)
    for c in range(2, NCOL):
        h = norm(hd(c))
        if 'OBSERV' in h: continue
        if 'CALIF' in h: calif_col = c; continue
        if 'TERMINO' in h: termino += 1; term_cols[termino] = c; continue
        tid = TERMS[min(termino,2)]
        act_cols.setdefault(tid, []).append((c, hd(c)))
    start = None
    for i, r in enumerate(rows):
        c1 = r[1] if len(r)>1 else None
        c0 = r[0] if len(r)>0 else None
        if c1 and 'APELLIDO' in norm(c1): start = i+1; continue
        if c1 and str(c1).strip() and es_num(c0) is not None and start is None: start = i
        if start is not None and i >= start: break
    if start is None: start = 2
    # actividades existentes en DB por subject+term
    cur.execute("select id, term_id, title, kind from activities where subject_id=%s", (subject_id,))
    dbacts = cur.fetchall()
    porTermTitulo = {}
    for aid, tid, title, kind in dbacts:
        porTermTitulo.setdefault(tid, {})[norm(title)] = aid
    # matchear columnas -> activity_id
    acts, noMatch = {}, []
    for tid, cols in act_cols.items():
        dbT = porTermTitulo.get(tid, {})
        usados = set()
        for idx,(c,htxt) in enumerate(cols,1):
            if not htxt: continue
            kind = clasificar(htxt)
            if kind == 'saltar': continue
            tdb = titulo(htxt, kind, idx)
            aid = dbT.get(norm(tdb)) or dbT.get(norm(htxt)) or dbT.get(norm(kind.upper()+' '+tdb))
            if not aid:
                # probar conteniendo
                cand = [k for k in dbT if norm(tdb) in k or k in norm(tdb)]
                if len(cand)==1 and cand[0] not in usados: aid = dbT[cand[0]]
            if aid and aid in usados: aid = None
            if aid: usados.add(aid); acts[c] = aid
            else: noMatch.append(htxt)
    # comparar celdas vs DB
    cur.execute("""select g.activity_id,g.student_id,g.status,g.value from grades g
      join activities a on a.id=g.activity_id where a.subject_id=%s""", (subject_id,))
    db = {(a,s):(st,float(v) if v is not None else None) for a,s,st,v in cur.fetchall()}
    ups, dels, ncell = [], [], 0
    sin_match = []
    for r in rows[start:]:
        nombre = r[1] if len(r)>1 else None
        if not nombre or not str(nombre).strip(): continue
        if 'APELLIDO' in norm(nombre) or 'COLEGIO' in norm(nombre): continue
        sid = buscar_alumno(nombre, course_id)
        if not sid:
            if len(sin_match)<8: sin_match.append(str(nombre).strip())
            continue
        for c, aid in acts.items():
            cv = valor_celda(r[c] if c < len(r) else None)
            cur_v = db.get((aid, sid))
            if cv:
                ncell += 1
                if cur_v != (cv[0], float(cv[1])):
                    ups.append((aid, sid, cv[1], cv[0], DOCENTE))
            elif cur_v:
                dels.append((aid, sid))
    for aid, sid, v, st, u in ups:
        cur.execute("""insert into grades(activity_id,student_id,value,status,updated_by)
          values(%s,%s,%s,%s,%s)
          on conflict (activity_id,student_id) do update set value=excluded.value,status=excluded.status""",
          (aid,sid,v,st,u))
    for aid, sid in dels:
        cur.execute("delete from grades where activity_id=%s and student_id=%s", (aid,sid))
    # termino y final: solo upsert si cambiaron
    t_up = f_up = 0
    for r in rows[start:]:
        nombre = r[1] if len(r)>1 else None
        if not nombre or not str(nombre).strip() or 'APELLIDO' in norm(nombre): continue
        sid = buscar_alumno(nombre, course_id)
        if not sid: continue
        for tnum, tc in term_cols.items():
            if tnum>3 or tc>=len(r): continue
            v = es_num(r[tc])
            if v is not None and v>=1:
                cur.execute("""insert into term_grades(student_id,subject_id,term_id,computed,value,updated_by)
                  values(%s,%s,%s,%s,%s,%s) on conflict (student_id,subject_id,term_id)
                  do update set value=excluded.value where term_grades.value<>excluded.value""",
                  (sid, subject_id, TERMS[tnum-1], v, v, DOCENTE))
                t_up += cur.rowcount
        if calif_col is not None and calif_col < len(r):
            v = es_num(r[calif_col])
            if v is not None and v>=1:
                cur.execute("""insert into final_grades(student_id,subject_id,value,updated_by)
                  values(%s,%s,%s,%s) on conflict (student_id,subject_id)
                  do update set value=excluded.value where final_grades.value<>excluded.value""",
                  (sid, subject_id, v, DOCENTE))
                f_up += cur.rowcount
    return ('OK', len(ups), len(dels), sin_match, noMatch, t_up, f_up)

JOBS = [
 ('libro1A_new','HISTORIA 1ºA',33,7),('libro1A_new','LENGUA Y LITERATURA 1ºA',34,7),
 ('libro1A_new','FEyC 1ºA',35,7),('libro1A_new','MATEMÁTICA 1ºA',36,7),
 ('libro1A_new','GEOGRAFÍA 1ºA',37,7),('libro1A_new','BIOLOGÍA 1ºA',38,7),
 ('libro1A_new','FÍSICA 1ºA',39,7),('libro1A_new','ED. TECNOLÓGICA 1ºA',40,7),
 ('libro1A_new','ED. FÍSICA 1ºA',41,7),('libro1A_new','ED. ARTÍSTICA TEATRO ',42,7),
 ('libro1A_new','LENGUA EXTRANJERA N1',43,7),('libro1A_new','FORMACIÓN RELIGIOSA 1ºA',44,7),
 ('libro1A_new','ROBÓTICA 1ºA',45,7),('libro1A_new','DEPORTE AGUSTINA',46,7),
 ('libro1A_new','INFORMÁTICA 1ºA',47,7),('libro1A_new','AJEDREZ 1ºA',48,7),
 ('libro1B_new','LENGUA Y LITERATURA 1ºB',49,8),('libro1B_new','FEyC 1ºB',50,8),
 ('libro1B_new','MATEMÁTICA 1ºB',51,8),('libro1B_new','HISTORIA 1ºB',52,8),
 ('libro1B_new','GEOGRAFÍA 1ºB',53,8),('libro1B_new','BIOLOGÍA 1ºB',54,8),
 ('libro1B_new','FÍSICA 1ºB',55,8),('libro1B_new','ED. TECNOLÓGICA 1ºB',56,8),
 ('libro1B_new','ED. FÍSICA 1ºB',57,8),('libro1B_new','LENGUA EXTRANJERA N2',58,8),
 ('libro1B_new',' ED. ARTÍSTICA MÚSICA ',59,8),('libro1B_new','INFORMÁTICA 1ºB',60,8),
 ('libro1B_new','DEPORTE 1º B FACUNDO',61,8),('libro1B_new','ROBÓTICA 1ºB',62,8),
 ('libro1B_new','FORMACIÓN RELIGIOSA 1ºB',63,8),('libro1B_new','AJEDREZ 1ºB',64,8),
]
os.chdir(os.environ.get('SYNC_DIR','/tmp'))
tot = [0,0,0,0]
for libro, hoja, sid, cid in JOBS:
    r = procesar(libro, hoja, sid, cid)
    if r[0]=='OK':
        est,nu,nd,sm,nm,tu,fu = r
        tot[0]+=nu; tot[1]+=nd; tot[2]+=tu; tot[3]+=fu
        print(f'{hoja:32s} sub={sid} -> {nu} notas act, {nd} borradas, {tu} term, {fu} finales' + (f'  SINMATCH_ALU:{sm}' if sm else '') + (f'  SINMATCH_COL:{nm}' if nm else ''), flush=True)
    else:
        print(hoja, sid, r[:4], flush=True)
print('TOTAL:', tot)
