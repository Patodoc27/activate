-- ============================================================
-- Reglas de privacidad (Row Level Security)
-- La base misma garantiza: una familia solo ve a sus hijos,
-- un docente solo escribe en sus materias.
-- ============================================================

-- ---------- Funciones auxiliares ----------
-- (security definer: se ejecutan como el dueño para evitar recursión)

create or replace function fn_role() returns text
language sql stable security definer set search_path = public as $$
  select role from accounts where id = auth.uid()
$$;

create or replace function fn_school() returns bigint
language sql stable security definer set search_path = public as $$
  select school_id from accounts where id = auth.uid()
$$;

create or replace function fn_is_direccion() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from accounts where id = auth.uid() and role = 'direccion')
$$;

create or replace function fn_teaches(p_subject bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teacher_assignments
    where subject_id = p_subject and account_id = auth.uid()
  )
$$;

create or replace function fn_guardian_of(p_student bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from guardian_links
    where student_id = p_student and guardian_account_id = auth.uid()
  )
$$;

create or replace function fn_is_student(p_student bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students
    where id = p_student and account_id = auth.uid()
  )
$$;

-- ¿Este usuario puede ver a este estudiante? (dirección, su docente, su familia o él mismo)
create or replace function fn_can_see_student(p_student bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select fn_is_direccion()
      or fn_guardian_of(p_student)
      or fn_is_student(p_student)
      or exists (
           select 1 from enrollments e
           join teacher_assignments t on t.subject_id = e.subject_id
           where e.student_id = p_student and t.account_id = auth.uid()
         )
$$;

-- ---------- Habilitar RLS en todo ----------

alter table schools              enable row level security;
alter table academic_years       enable row level security;
alter table terms                enable row level security;
alter table courses              enable row level security;
alter table subjects             enable row level security;
alter table subject_courses      enable row level security;
alter table accounts             enable row level security;
alter table students             enable row level security;
alter table enrollments          enable row level security;
alter table guardian_links       enable row level security;
alter table teacher_assignments  enable row level security;
alter table activities           enable row level security;
alter table grades               enable row level security;
alter table final_grades         enable row level security;
alter table invites              enable row level security;
alter table grade_events         enable row level security;

-- ---------- Estructura: lectura para todo usuario autenticado ----------
-- (no son datos personales; sin esto la app no puede dibujar la navegación)

create policy schools_read       on schools         for select using (auth.role() = 'authenticated');
create policy years_read         on academic_years  for select using (auth.role() = 'authenticated');
create policy terms_read         on terms           for select using (auth.role() = 'authenticated');
create policy courses_read       on courses         for select using (auth.role() = 'authenticated');
create policy subjects_read      on subjects        for select using (auth.role() = 'authenticated');
create policy subject_courses_r  on subject_courses for select using (auth.role() = 'authenticated');
create policy teacher_assign_r   on teacher_assignments for select using (auth.role() = 'authenticated');

create policy structure_direccion_w on academic_years for all using (fn_is_direccion());
create policy terms_direccion_w     on terms          for all using (fn_is_direccion());
create policy courses_direccion_w   on courses        for all using (fn_is_direccion());
create policy subjects_direccion_w  on subjects       for all using (fn_is_direccion());
create policy sc_direccion_w        on subject_courses for all using (fn_is_direccion());
create policy ta_direccion_w        on teacher_assignments for all using (fn_is_direccion());

-- ---------- accounts ----------
-- Cada uno ve su propia cuenta; dirección ve todas las de su escuela.

create policy accounts_self  on accounts for select
  using (id = auth.uid() or (fn_is_direccion() and school_id = fn_school()));
create policy accounts_self_update on accounts for update
  using (id = auth.uid()) with check (id = auth.uid() and role = fn_role());
create policy accounts_direccion on accounts for all
  using (fn_is_direccion() and school_id = fn_school());

-- ---------- students ----------

create policy students_read on students for select
  using (school_id = fn_school() and fn_can_see_student(id));
create policy students_direccion on students for all
  using (fn_is_direccion() and school_id = fn_school());

-- ---------- enrollments ----------

create policy enrollments_read on enrollments for select
  using (fn_is_direccion() or fn_teaches(subject_id)
         or fn_guardian_of(student_id) or fn_is_student(student_id));
create policy enrollments_direccion on enrollments for all
  using (fn_is_direccion());

-- ---------- guardian_links ----------
-- La familia ve sus propios vínculos; dirección los administra.

create policy guardian_links_read on guardian_links for select
  using (guardian_account_id = auth.uid() or fn_is_direccion());
create policy guardian_links_direccion on guardian_links for all
  using (fn_is_direccion());

-- ---------- activities ----------
-- Lee quien corresponde a la materia; escribe solo su docente.

create policy activities_read on activities for select
  using (fn_is_direccion() or fn_teaches(subject_id)
         or exists (
           select 1 from enrollments e
           join students s on s.id = e.student_id
           where e.subject_id = activities.subject_id
             and (fn_guardian_of(e.student_id) or s.account_id = auth.uid())
         ));

create policy activities_write on activities for insert
  with check (fn_teaches(subject_id) and created_by = auth.uid());
create policy activities_update on activities for update
  using (fn_teaches(subject_id)) with check (fn_teaches(subject_id));
create policy activities_delete on activities for delete
  using (fn_teaches(subject_id));

-- ---------- grades ----------

create policy grades_read on grades for select
  using (fn_is_direccion() or fn_guardian_of(student_id) or fn_is_student(student_id)
         or exists (
           select 1 from activities a
           where a.id = grades.activity_id and fn_teaches(a.subject_id)
         ));

create policy grades_write on grades for insert
  with check (exists (
    select 1 from activities a
    where a.id = grades.activity_id and fn_teaches(a.subject_id)
  ));
create policy grades_update on grades for update
  using (exists (
    select 1 from activities a
    where a.id = grades.activity_id and fn_teaches(a.subject_id)
  ));
create policy grades_delete on grades for delete
  using (exists (
    select 1 from activities a
    where a.id = grades.activity_id and fn_teaches(a.subject_id)
  ));

-- ---------- final_grades (manual del docente) ----------

create policy final_read on final_grades for select
  using (fn_is_direccion() or fn_teaches(subject_id)
         or fn_guardian_of(student_id) or fn_is_student(student_id));
create policy final_write on final_grades for insert
  with check (fn_teaches(subject_id));
create policy final_update on final_grades for update
  using (fn_teaches(subject_id));

-- ---------- invites (solo dirección; el canje va por función) ----------

create policy invites_direccion on invites for all using (fn_is_direccion());

-- ---------- grade_events (auditoría: dirección y docente de la materia) ----------

create policy grade_events_read on grade_events for select
  using (fn_is_direccion() or exists (
    select 1 from activities a
    where a.id = grade_events.activity_id and fn_teaches(a.subject_id)
  ));

-- ---------- Tiempo real ----------
-- La familia ve notas y actividades al instante.

alter publication supabase_realtime add table grades;
alter publication supabase_realtime add table activities;
alter publication supabase_realtime add table final_grades;
