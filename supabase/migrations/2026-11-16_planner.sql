-- Миграция БД: планировщик (итерация 3).
--   * payload jsonb — данные события: у 'quest' метаданные выполнения (игровой день, сессия,
--     проект/этап), у 'plan' — операция планировщика (проекты, этапы, выбор на день, активация правил);
--   * новый тип записи 'plan'.
-- Повторный запуск безопасен. RLS не меняется: политики «только свои строки» действуют и для новых колонок.
begin;

alter table public.log_entries add column if not exists payload jsonb;

alter table public.log_entries drop constraint if exists log_entries_type_check;
alter table public.log_entries add constraint log_entries_type_check
  check (type in ('quest', 'purchase', 'claim', 'care', 'leisure', 'plan'));

alter table public.log_entries drop constraint if exists entry_shape;
alter table public.log_entries add constraint entry_shape check (
  (payload is null or jsonb_typeof(payload) = 'object')
  and (
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
    or
    (type = 'plan'
      and payload is not null and payload ? 'op'
      and octet_length(payload::text) <= 65536)
  )
);

-- Проверка RLS: должно вернуть true (защита строк включена)
select relrowsecurity as rls_enabled from pg_class where oid = 'public.log_entries'::regclass;

commit;
