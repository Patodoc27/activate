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
DOCENTE='038042f8-bdb2-4ad6-b43b-a9a4e0c952bc'; TERMS=[11,12,13]
cur.execute("select id, last_name||', '||first_name, course_id from students where course_id in (7,8)")
alum={}
for sid,name,cid in cur.fetchall(): alum.setdefault(cid,{})[norm(name)]=sid
extra={norm(k):v for k,v in {'ARZELAN, ISABELA CELESTE':72,'MENDEZ, BARBARA TIARA':86,'MENDOZA MIRANDA, AGUSTÍN':87,
 'NAGY NARVAEZ, EMMA':90,'VALLEJO, AGUSTÍN':95,'ROMERO ARENA, ROSARIO':123,'NAGGY NARVAEZ, EMMA':90,'ROMERIO ARENA, ROSARIO':123}.items()}
def buscar(nombre,cid):
    n=norm(nombre)
    if not n or len(n)<4: return None
    if n in alum.get(cid,{}): return alum[cid][n]
    if n in extra: return extra[n]
    p=n.split(',')
    if len(p)==2:
        ap=p[0].split()[0] if p[0].split() else ''
        no=p[1].split()[0] if p[1].split() else ''
        cand=[]
        for dbn,sid in alum.get(cid,{}).items():
            d=dbn.split(',')
            if len(d)!=2: continue
            if ap and ap in d[0].split() and no and no in d[1].split(): cand.append(sid)
        if len(set(cand))==1: return cand[0]
    return None
def clasificar(header):
    n=' '+nlower(header)+' '; n=re.sub(r'[.\-_/()]+',' ',n)
    if re.search(r'perfil|agustin',n): return 'agust'
    if re.search(r'\bt\s?p\b|\btp\b|trabajo|practico',n): return 'tp'
    if re.search(r'cuestionario|quiz|forms',n): return 'cuest'
    if re.search(r'juego|escape|pasapalabra|trivia|ludico',n): return 'juego'
    if re.search(r'carpeta|folder',n): return 'carp'
    if re.search(r'proyecto|proy|integrador',n): return 'proy'
    if re.search(r'oral|coloquio|recitado|leccion',n): return 'oral'
    if re.search(r'particip|seguimiento',n): return 'part'
    if re.search(r'intensific',n): return 'saltar'
    if re.search(r'mesa',n): return 'mesa'
    if re.search(r'evaluacion|\bev\b|examen|prueba|test|diagnos|recup|\bfinal\b|recovery',n): return 'eval'
    return 'otro'
MINUS={'y','de','del','la','el','los','las','en','a','e','o','u','con','por','para','un','una'}
def titulo(header,kind,idx):
    h=' '.join(str(header or '').replace('\n',' ').split())
    t=re.sub(r'^\s*(t\.?\s?p\.?|t\.p\.|tp|trabajo\s+pr[aá]ctico|trabajo|evaluaci[oó]n|ev\.?|examen|prueba|test|quiz|cuestionario|juego|proyecto|proy|carpeta|perfil\s+agustinian[oa]|participaci[oó]n|actividad|seguimiento|final)\b\s*[:\-–.]?\s*','',h,flags=re.I)
    t=t.strip(' :-–.')
    if not t: t=h
    if t==t.upper() and len(t)>3:
        t=' '.join(w if (i>0 and w in MINUS) else (w[0].upper()+w[1:] if w else w) for i,w in enumerate(t.lower().split()))
    return t or ('Actividad '+str(idx))
def es_num(v):
    if isinstance(v,(int,float)): return float(v)
    s=str(v or '').strip().replace(',','.')
    try: return float(s)
    except: return None
def valor_celda(v):
    n=es_num(v)
    if n is not None: return ('pendiente',0) if n==0 else ('calificada',n)
    s=norm(v)
    if not s or s in ('-','·'): return None
    if 'AUSENTE' in s or s in ('NP','NO PRESENTADO','NO PRESENTO'): return ('no_presentado',1)
    return None

# headers estructurales que NO son actividades cargables
SKIP_H = re.compile(r'RECUPERATORIO\s+TRIMESTRE|PER[IÍ]ODO\s+DE\s+RECUPERACI|PERFIL\s+AGUSTIN|INTENSIF',re.I)

def procesar(libro,hoja,subject_id,course_id):
    wb=openpyxl.load_workbook(libro+'.xlsx',read_only=True,data_only=True)
    if hoja not in wb.sheetnames: wb.close(); return ('SIN HOJA',0,0,[])
    rows=list(wb[hoja].iter_rows(values_only=True)); wb.close()
    if len(rows)<3: return ('VACIA',0,0,[])
    head0,head1=rows[0],(rows[1] if len(rows)>1 else ())
    def hd(c):
        for h in (head0,head1):
            v=h[c] if c<len(h) else None
            if v is not None and str(v).strip() and 'APELLIDO' not in norm(v): return str(v).strip()
        return ''
    term_cols,calif_col,act_cols={},None,{11:[],12:[],13:[]}
    termino=0
    NCOL=max(len(head0),len(head1),40)
    for c in range(2,NCOL):
        h=norm(hd(c))
        if 'OBSERV' in h: continue
        if 'CALIF' in h: calif_col=c; continue
        if 'TERMINO' in h: termino+=1; term_cols[termino]=c; continue
        act_cols.setdefault(TERMS[min(termino,2)],[]).append((c,hd(c)))
    start=None
    for i,r in enumerate(rows):
        c1=r[1] if len(r)>1 else None; c0=r[0] if len(r)>0 else None
        if c1 and 'APELLIDO' in norm(c1): start=i+1; continue
        if c1 and str(c1).strip() and es_num(c0) is not None and start is None: start=i
        if start is not None and i>=start: break
    if start is None: start=2
    cur.execute("select id,term_id,title from activities where subject_id=%s",(subject_id,))
    dbacts=cur.fetchall()
    porTerm={}
    for aid,tid,title in dbacts: porTerm.setdefault(tid,{})[norm(title)]=aid
    cur.execute("""select g.activity_id,g.student_id,g.status,g.value from grades g
      join activities a on a.id=g.activity_id where a.subject_id=%s""",(subject_id,))
    db={(a,s):(st,float(v) if v is not None else None) for a,s,st,v in cur.fetchall()}
    nact=0; nnotas=0; creadas=[]
    for tid,cols in act_cols.items():
        dbT=porTerm.get(tid,{})
        usados=set(dbT.values())
        for idx,(c,htxt) in enumerate(cols,1):
            if not htxt: continue
            kind=clasificar(htxt)
            if kind=='saltar' or SKIP_H.search(norm(htxt)): continue
            tdb=titulo(htxt,kind,idx)
            aid=dbT.get(norm(tdb)) or dbT.get(norm(htxt))
            if not aid:
                cand=[k for k in dbT if norm(tdb) in k or k in norm(tdb)]
                if len(cand)==1 and cand[0] not in usados: aid=dbT[cand[0]]
            if aid and aid in usados: continue
            if not aid:
                hay=any(valor_celda((r[c] if c<len(r) else None)) is not None for r in rows[start:start+60])
                if not hay: continue
                cur.execute("insert into activities(subject_id,term_id,kind,title,created_by) values(%s,%s,%s,%s,%s) returning id",
                    (subject_id,tid,kind if kind!='agust' else 'otro',tdb,DOCENTE))
                aid=cur.fetchone()[0]; dbT[norm(tdb)]=aid; nact+=1; creadas.append(tdb)
            usados.add(aid)
            g_rows=[]
            for r in rows[start:]:
                nombre=r[1] if len(r)>1 else None
                if not nombre or not str(nombre).strip() or 'APELLIDO' in norm(nombre) or 'COLEGIO' in norm(nombre): continue
                sid=buscar(nombre,course_id)
                if not sid: continue
                cv=valor_celda(r[c] if c<len(r) else None)
                if not cv: continue
                if db.get((aid,sid))!=(cv[0],float(cv[1])):
                    g_rows.append((aid,sid,cv[1],cv[0],DOCENTE))
            for a2,s2,v2,st2,u2 in g_rows:
                cur.execute("""insert into grades(activity_id,student_id,value,status,updated_by)
                  values(%s,%s,%s,%s,%s) on conflict (activity_id,student_id)
                  do update set value=excluded.value,status=excluded.status""",(a2,s2,v2,st2,u2))
            nnotas+=len(g_rows)
    return ('OK',nact,nnotas,creadas)

JOBS=[('libro1A_new','HISTORIA 1ºA',33,7),('libro1A_new','LENGUA Y LITERATURA 1ºA',34,7),
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
 ('libro1B_new','FORMACIÓN RELIGIOSA 1ºB',63,8),('libro1B_new','AJEDREZ 1ºB',64,8)]
os.chdir(os.environ.get('SYNC_DIR','/tmp'))
t=[0,0]
for libro,hoja,sid,cid in JOBS:
    r=procesar(libro,hoja,sid,cid)
    if r[0]=='OK':
        _,na,nn,creadas=r; t[0]+=na; t[1]+=nn
        if na or nn: print(f'{hoja:32s} -> {na} acts nuevas, {nn} notas  {creadas[:6]}',flush=True)
    else: print(hoja,sid,r[:3],flush=True)
print('TOTAL nuevas acts/notas:',t)
