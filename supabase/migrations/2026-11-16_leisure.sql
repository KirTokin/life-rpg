-- Миграция БД: учёт времени развлечений.
--   * у покупок появляется minutes (сколько минут куплено);
--   * новый тип записи 'leisure' — фактический сеанс: начало, конец (мс), категория.
-- Выполнить один раз в Supabase → SQL Editor. Повторный запуск безопасен.
-- Включает и миграцию 2026-11-15_care.sql — на случай, если она ещё не выполнялась.
begin;

alter table public.log_entries add column if not exists care_id text;
alter table public.log_entries add column if not exists minutes integer;
alter table public.log_entries add column if not exists leisure_start bigint;
alter table public.log_entries add column if not exists leisure_end bigint;
alter table public.log_entries add column if not exists category text;

alter table public.log_entries drop constraint if exists log_entries_type_check;
alter table public.log_entries add constraint log_entries_type_check
  check (type in ('quest', 'purchase', 'claim', 'care', 'leisure'));

alter table public.log_entries drop constraint if exists entry_shape;
alter table public.log_entries add constraint entry_shape check (
  (type = 'quest'
    and quest_id is not null and stat is not null
    and xp > 0 and (gold is null or gold >= 0))
  or
  (type = 'purchase'
    and reward_id is not null and cost > 0
    and (minutes is null or minutes > 0))
  or
  (type = 'claim'
    and achievement_id is not null and gold is not null and gold >= 0)
  or
  (type = 'care'
    and care_id is not null)
  or
  (type = 'leisure'
    and leisure_start is not null and leisure_end is not null
    and leisure_end > leisure_start
    and leisure_end - leisure_start <= 86400000
    and category is not null)
);

commit;
