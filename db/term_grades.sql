-- Nota de trimestre habilitada por el docente (calculada por peso + ajuste manual)
create table if not exists term_grades (
  id         bigint generated always as identity primary key,
  student_id bigint not null references students(id) on delete cascade,
  subject_id bigint not null references subjects(id) on delete cascade,
  term_id    bigint not null references terms(id) on delete cascade,
  computed   numeric(5,2),          -- lo que dio el algoritmo al habilitar
  value      numeric(4,1) not null, -- la nota que quedó (puede estar ajustada a mano)
  updated_by uuid references accounts(id),
  updated_at timestamptz not null default now(),
  unique (student_id, subject_id, term_id)
);
alter table term_grades enable row level security;
create policy termg_read on term_grades for select
  using (fn_is_direccion() or fn_teaches(subject_id)
         or fn_guardian_of(student_id) or fn_is_student(student_id));
create policy termg_write on term_grades for insert
  with check (fn_teaches(subject_id));
create policy termg_update on term_grades for update
  using (fn_teaches(subject_id));
alter publication supabase_realtime add table term_grades;
