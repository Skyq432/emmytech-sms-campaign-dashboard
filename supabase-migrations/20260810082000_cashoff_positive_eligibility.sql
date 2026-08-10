-- CASH-OFF POSITIVE-BALANCE ELIGIBILITY (2026-08-10)
-- Canonical source of truth: public.cash_off_accounts.balance.
-- A customer is eligible when current Cash-Off > 0 and a valid unique phone
-- is available. Previous outreach history does NOT remove eligibility.

DO $$
BEGIN
  IF to_regclass('public.cash_off_accounts') IS NULL THEN
    RAISE EXCEPTION 'public.cash_off_accounts is required for canonical Cash-Off eligibility';
  END IF;
END;
$$;

alter table public.sms_leads
  add column if not exists identity_id uuid;

create index if not exists sms_leads_identity_id_idx
  on public.sms_leads(identity_id);

create or replace function public.refresh_sms_leads_from_spin_players()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected integer := 0;
begin
  with source as (
    select
      p.id::text as source_player_id,
      p.identity_id,
      coalesce(
        nullif(split_part(trim(coalesce(p.full_name, '')), ' ', 1), ''),
        'Hi'
      ) as first_name,
      coalesce(nullif(trim(p.full_name), ''), 'Unnamed lead') as full_name,
      public.normalize_ng_phone(p.phone_number) as phone_normalized,
      p.created_at as joined_at,
      coalesce(account.balance, 0) as canonical_cash_off
    from public.spin_players p
    left join public.cash_off_accounts account
      on account.identity_id = p.identity_id
    where p.identity_id is not null
      and public.normalize_ng_phone(p.phone_number) is not null
  ),
  deduped as (
    select distinct on (phone_normalized)
      source_player_id,
      identity_id,
      first_name,
      full_name,
      phone_normalized,
      joined_at
    from source
    order by
      phone_normalized,
      (canonical_cash_off > 0) desc,
      canonical_cash_off desc,
      joined_at desc nulls last,
      source_player_id
  )
  insert into public.sms_leads (
    source_player_id,
    identity_id,
    first_name,
    full_name,
    phone_normalized,
    joined_at
  )
  select
    source_player_id,
    identity_id,
    first_name,
    full_name,
    phone_normalized,
    joined_at
  from deduped
  on conflict (phone_normalized) do update
  set
    source_player_id = excluded.source_player_id,
    identity_id = excluded.identity_id,
    first_name = excluded.first_name,
    full_name = excluded.full_name,
    joined_at = coalesce(excluded.joined_at, public.sms_leads.joined_at);

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.prepare_sms_campaign_recipients(
  p_campaign_id uuid,
  p_limit integer default 20
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_count integer := 0;
begin
  insert into public.sms_campaign_recipients (campaign_id, lead_id)
  select p_campaign_id, lead.id
  from public.sms_leads lead
  join public.cash_off_accounts account
    on account.identity_id = lead.identity_id
  where coalesce(account.balance, 0) > 0
    and not exists (
      select 1
      from public.sms_campaign_recipients existing
      where existing.campaign_id = p_campaign_id
        and existing.lead_id = lead.id
    )
  order by
    account.balance desc,
    lead.joined_at asc nulls last,
    lead.created_at asc
  limit greatest(1, least(coalesce(p_limit, 20), 5000))
  on conflict (campaign_id, lead_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.sms_dashboard_summary(p_campaign_id uuid default null)
returns table (
  total_leads bigint,
  eligible_leads bigint,
  selected_recipients bigint,
  clicked_recipients bigint,
  claimed_recipients bigint,
  sent_recipients bigint,
  success_rate numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (
      select count(*)
      from public.sms_leads lead
      join public.cash_off_accounts account
        on account.identity_id = lead.identity_id
      where coalesce(account.balance, 0) > 0
    ) as total_leads,
    (
      select count(*)
      from public.sms_leads lead
      join public.cash_off_accounts account
        on account.identity_id = lead.identity_id
      where coalesce(account.balance, 0) > 0
    ) as eligible_leads,
    (
      select count(*)
      from public.sms_campaign_recipients r
      where p_campaign_id is null or r.campaign_id = p_campaign_id
    ) as selected_recipients,
    (
      select count(*)
      from public.sms_campaign_recipients r
      where (p_campaign_id is null or r.campaign_id = p_campaign_id)
        and r.clicked_at is not null
    ) as clicked_recipients,
    (
      select count(*)
      from public.sms_campaign_recipients r
      where (p_campaign_id is null or r.campaign_id = p_campaign_id)
        and r.whatsapp_claimed_at is not null
    ) as claimed_recipients,
    (
      select count(*)
      from public.sms_campaign_recipients r
      where (p_campaign_id is null or r.campaign_id = p_campaign_id)
        and r.sms_status in ('sent','delivered','clicked','claimed')
    ) as sent_recipients,
    case
      when (
        select count(*)
        from public.sms_campaign_recipients r
        where (p_campaign_id is null or r.campaign_id = p_campaign_id)
          and r.sms_status in ('sent','delivered','clicked','claimed')
      ) = 0 then 0
      else round(
        100.0 *
        (
          select count(*)
          from public.sms_campaign_recipients r
          where (p_campaign_id is null or r.campaign_id = p_campaign_id)
            and r.whatsapp_claimed_at is not null
        ) /
        (
          select count(*)
          from public.sms_campaign_recipients r
          where (p_campaign_id is null or r.campaign_id = p_campaign_id)
            and r.sms_status in ('sent','delivered','clicked','claimed')
        ),
        1
      )
    end as success_rate;
$$;

create or replace view public.sms_campaign_recipient_details as
select
  recipient.id,
  recipient.campaign_id,
  recipient.lead_id,
  recipient.tracking_token,
  recipient.sms_status,
  recipient.exported_at,
  recipient.sent_at,
  recipient.delivered_at,
  recipient.failed_at,
  recipient.clicked_at,
  recipient.click_count,
  recipient.whatsapp_claimed_at,
  recipient.created_at,
  lead.first_name,
  lead.full_name,
  lead.phone_normalized,
  lead.joined_at,
  lead.whatsapp_outreach_status,
  lead.identity_id,
  coalesce(account.balance, 0)::numeric(14,2) as cash_off_balance
from public.sms_campaign_recipients recipient
join public.sms_leads lead on lead.id = recipient.lead_id
left join public.cash_off_accounts account on account.identity_id = lead.identity_id;

grant execute on function public.refresh_sms_leads_from_spin_players() to anon;
grant execute on function public.prepare_sms_campaign_recipients(uuid, integer) to anon;
grant execute on function public.sms_dashboard_summary(uuid) to anon;
grant select on public.sms_campaign_recipient_details to anon;

select public.refresh_sms_leads_from_spin_players();
