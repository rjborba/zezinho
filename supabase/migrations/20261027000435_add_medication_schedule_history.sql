create table public.medication_schedule_history (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  effective_at timestamptz not null default clock_timestamp(),
  medication jsonb,
  unit text not null check (unit in ('unidade','ml','mg','g','gotas','kg')),
  constraint medication_schedule_history_object check (medication is null or jsonb_typeof(medication) = 'object')
);
create index medication_schedule_history_item_time_idx
  on public.medication_schedule_history(item_id, effective_at, id);
alter table public.medication_schedule_history enable row level security;
revoke all on public.medication_schedule_history from anon, authenticated;
grant select on public.medication_schedule_history to anon;
create policy "Shared medication schedules can be read"
  on public.medication_schedule_history for select to anon using (true);

-- No historical regimens are invented: coverage begins at this migration.
insert into public.medication_schedule_history(item_id, medication, unit)
select id, medication, unit from public.items where kind = 'medicamento';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create function private.record_medication_schedule()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.kind = 'medicamento' then
      insert into public.medication_schedule_history(item_id, medication, unit)
      values (new.id, new.medication, new.unit);
    end if;
  elsif (old.kind = 'medicamento' or new.kind = 'medicamento')
    and (old.medication is distinct from new.medication or old.unit is distinct from new.unit or old.kind is distinct from new.kind) then
    insert into public.medication_schedule_history(item_id, medication, unit)
    values (new.id, case when new.kind = 'medicamento' then new.medication else null end, new.unit);
  end if;
  return new;
end;
$$;
revoke all on function private.record_medication_schedule() from public, anon, authenticated;
create trigger record_medication_schedule_after_write
  after insert or update of medication, unit, kind on public.items
  for each row execute function private.record_medication_schedule();
comment on table public.medication_schedule_history is
'Append-only regimen snapshots recorded by a private trigger. Effective timestamps prevent later edits from rewriting past estimated consumption.';
