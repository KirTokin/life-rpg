-- Миграция БД: новый тип записи 'care' — отметки дел ухода за собой (здоровье).
-- Выполнить один раз в Supabase → SQL Editor ДО публикации кода с этим типом записи.
begin;

alter table public.log_entries add column if not exists care_id text;

alter table public.log_entries drop constraint log_entries_type_check;
alter table public.log_entries add constraint log_entries_type_check
  check (type in ('quest', 'purchase', 'claim', 'care'));

alter table public.log_entries drop constraint entry_shape;
alter table public.log_entries add constraint entry_shape check (
  (type = 'quest'
    and quest_id is not null and stat is not null
    and xp > 0 and (gold is null or gold >= 0))
  or
  (type = 'purchase'
    and reward_id is not null and cost > 0)
  or
  (type = 'claim'
    and achievement_id is not null and gold is not null and gold >= 0)
  or
  (type = 'care'
    and care_id is not null)
);

commit;
