-- ============================================================
-- App de calificaciones — esquema base (fase 0)
-- Supabase / Postgres 15+
-- Regla de oro: la nota final es un dato manual del docente,
-- la base nunca calcula promedios.
-- ============================================================

-- ---------- Estructura escolar ----------

create table if not exists schools (
  id         bigint generated always as identity primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists academic_years (
  id         bigint generated always as identity primary key,
  school_id  bigint not null references schools(id) on delete cascade,
  label      text not null,                 -- '2026'
  is_active  boolean not null default true,
  unique (school_id, label)
);

create table if not exists terms (
  id              bigint generated always as identity primary key,
  academic_year_id bigint not null references academic_years(id) on delete cascade,
  name            text not null,            -- '1er trimestre'
  ordinal         int  not null,            -- 1, 2, 3
  starts_on       date,
  ends_on         date,
  unique (academic_year_id, ordinal)
);

create table if not exists courses (
  id              bigint generated always as identity primary key,
  academic_year_id bigint not null references academic_years(id) on delete cascade,
  name            text not null,            -- '1° A'
  sort            int not null default 0,
  unique (academic_year_id, name)
);

-- Una materia puede dictarse en varios cursos (optativas que mezclan divisiones)
create table if not exists subjects (
  id              bigint generated always as identity primary key,
  academic_year_id bigint not null references academic_years(id) on delete cascade,
  name            text not null,
  short_name      text,                     -- etiqueta corta para pantallas chicas
  is_active       boolean not null default true,
  unique (academic_year_id, name)
);

create table if not exists subject_courses (
  subject_id bigint not null references subjects(id) on delete cascade,
  course_id  bigint not null references courses(id)  on delete cascade,
  primary key (subject_id, course_id)
);

-- ---------- Personas ----------

-- Una fila por usuario autenticado. El rol decide la interfaz.
create table if not exists accounts (
  id         uuid primary key references auth.users(id) on delete cascade,
  school_id  bigint not null references schools(id) on delete cascade,
  role       text not null check (role in ('direccion','docente','familia','estudiante')),
  full_name  text not null,
  created_at timestamptz not null default now()
);

-- El estudiante existe como persona aunque todavía no tenga cuenta (fase 2)
create table if not exists students (
  id         bigint generated always as identity primary key,
  school_id  bigint not null references schools(id) on delete cascade,
  course_id  bigint not null references courses(id) on delete restrict,
  last_name  text not null,
  first_name text not null,
  account_id uuid references accounts(id) on delete set null,  -- null hasta que tenga login
  is_active  boolean not null default true
);

-- Qué materias cursa cada estudiante (permite optativas entre divisiones)
create table if not exists enrollments (
  student_id bigint not null references students(id) on delete cascade,
  subject_id bigint not null references subjects(id) on delete cascade,
  primary key (student_id, subject_id)
);

-- Vínculo familia ↔ estudiante (el corazón de la privacidad)
create table if not exists guardian_links (
  id                 bigint generated always as identity primary key,
  guardian_account_id uuid   not null references accounts(id) on delete cascade,
  student_id         bigint not null references students(id) on delete cascade,
  relation           text,              -- 'madre', 'padre', 'tutor'…
  unique (guardian_account_id, student_id)
);

create table if not exists teacher_assignments (
  id         bigint generated always as identity primary key,
  subject_id bigint not null references subjects(id)   on delete cascade,
  account_id uuid   not null references accounts(id)   on delete cascade,
  unique (subject_id, account_id)
);

-- ---------- Evaluación ----------

create table if not exists activities (
  id          bigint generated always as identity primary key,
  subject_id  bigint not null references subjects(id) on delete cascade,
  term_id     bigint not null references terms(id)    on delete cascade,
  title       text not null,
  description text,
  due_date    date,                         -- plazo máximo de entrega
  created_by  uuid not null references accounts(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists grades (
  id          bigint generated always as identity primary key,
  activity_id bigint not null references activities(id) on delete cascade,
  student_id  bigint not null references students(id)   on delete cascade,
  value       numeric(4,1),                 -- 0..10; null si aplica estado
  status      text not null default 'sin_calificar'
              check (status in ('pendiente','no_presentado','sin_calificar','calificada')),
  updated_by  uuid references accounts(id),
  updated_at  timestamptz not null default now(),
  unique (activity_id, student_id)
);

-- Nota final por materia: SOLO la carga el docente, nunca calculada
create table if not exists final_grades (
  id         bigint generated always as identity primary key,
  student_id bigint not null references students(id) on delete cascade,
  subject_id bigint not null references subjects(id) on delete cascade,
  value      numeric(4,1) not null,
  updated_by uuid references accounts(id),
  updated_at timestamptz not null default now(),
  unique (student_id, subject_id)
);

-- ---------- Invitaciones (alta de familias por código) ----------

create table if not exists invites (
  id         bigint generated always as identity primary key,
  code       text not null unique,          -- ej. 'FAM-7KQ2-9XPL'
  student_id bigint not null references students(id) on delete cascade,
  role       text not null default 'familia' check (role in ('familia','estudiante')),
  expires_at timestamptz,
  used_at    timestamptz,
  used_by    uuid references accounts(id),
  created_by uuid references accounts(id),
  created_at timestamptz not null default now()
);

-- ---------- Auditoría de notas (confianza) ----------

create table if not exists grade_events (
  id          bigint generated always as identity primary key,
  grade_id    bigint not null,
  activity_id bigint not null,
  student_id  bigint not null,
  old_value   numeric(4,1),
  new_value   numeric(4,1),
  old_status  text,
  new_status  text,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);

create or replace function trg_grade_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into grade_events(grade_id, activity_id, student_id, old_value, new_value, old_status, new_status, changed_by)
  values (coalesce(new.id, old.id), coalesce(new.activity_id, old.activity_id), coalesce(new.student_id, old.student_id),
          old.value, new.value, old.status, new.status, auth.uid());
  return coalesce(new, old);
end $$;

drop trigger if exists grade_audit on grades;
create trigger grade_audit
  after insert or update or delete on grades
  for each row execute function trg_grade_audit();

-- ---------- Índices ----------

create index if not exists idx_activities_subject on activities(subject_id);
create index if not exists idx_activities_due     on activities(due_date);
create index if not exists idx_grades_student     on grades(student_id);
create index if not exists idx_grades_activity    on grades(activity_id);
create index if not exists idx_enroll_subject     on enrollments(subject_id);
create index if not exists idx_guardian_student   on guardian_links(student_id);
create index if not exists idx_students_course    on students(course_id);
