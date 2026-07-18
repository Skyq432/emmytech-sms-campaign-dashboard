-- EMMYTECH SMS OUTREACH DASHBOARD
-- Run this entire file in the SQL Editor of the AMBASSADOR Supabase project.
-- It reads from public.spin_players and stores SMS campaign data in this same project.

create extension if not exists pgcrypto;

create or replace function public.normalize_ng_phone(raw_phone text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(raw_phone, ''), '[^0-9]', '', 'g');

  if digits = '' then
    return null;
  end if;

  if left(digits, 4) = '2340' and length(digits) >= 14 then
    digits := '234' || substring(digits from 5);
  elsif left(digits, 1) = '0' and length(digits) = 11 then
    digits := '234' || substring(digits from 2);
  elsif length(digits) = 10 and left(digits, 1) in ('7','8','9') then
    digits := '234' || digits;
  end if;

  if left(digits, 3) <> '234' or length(digits) <> 13 then
    return null;
  end if;

  return digits;
end;
$$;

create table if not exists public.sms_leads (
  id uuid primary key default gen_random_uuid(),
  source_player_id text,
  first_name text,
  full_name text,
  phone_normalized text not null unique,
  joined_at timestamptz,
  whatsapp_outreach_status text not null default 'not_messaged'
    check (whatsapp_outreach_status in ('not_messaged','messaged','messaged_us_before','excluded')),
  outreach_status_source text not null default 'default',
  outreach_status_imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sms_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null unique,
  name text not null,
  message_template text not null,
  whatsapp_number text not null,
  whatsapp_message text not null default 'Hello EmmyTech, I want to claim my 2 free spins.',
  public_base_url text not null,
  status text not null default 'draft' check (status in ('draft','active','paused','completed')),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sms_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.sms_campaigns(id) on delete cascade,
  lead_id uuid not null references public.sms_leads(id) on delete cascade,
  tracking_token text not null unique default lower(encode(gen_random_bytes(6), 'hex')),
  sms_status text not null default 'selected'
    check (sms_status in ('selected','exported','sent','delivered','clicked','claimed','failed')),
  exported_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  clicked_at timestamptz,
  click_count integer not null default 0,
  whatsapp_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);

create index if not exists sms_leads_outreach_status_idx
  on public.sms_leads (whatsapp_outreach_status);
create index if not exists sms_recipients_campaign_status_idx
  on public.sms_campaign_recipients (campaign_id, sms_status);
create index if not exists sms_recipients_tracking_token_idx
  on public.sms_campaign_recipients (tracking_token);

create or replace function public.sms_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sms_leads_set_updated_at on public.sms_leads;
create trigger sms_leads_set_updated_at
before update on public.sms_leads
for each row execute function public.sms_set_updated_at();

drop trigger if exists sms_campaigns_set_updated_at on public.sms_campaigns;
create trigger sms_campaigns_set_updated_at
before update on public.sms_campaigns
for each row execute function public.sms_set_updated_at();

drop trigger if exists sms_recipients_set_updated_at on public.sms_campaign_recipients;
create trigger sms_recipients_set_updated_at
before update on public.sms_campaign_recipients
for each row execute function public.sms_set_updated_at();

-- Reads spin_players defensively through JSON so it tolerates common column names.
create or replace function public.refresh_sms_leads_from_spin_players()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  insert into public.sms_leads (
    source_player_id,
    first_name,
    full_name,
    phone_normalized,
    joined_at
  )
  select
    coalesce(j->>'id', j->>'identity_id', j->>'player_id', md5(coalesce(j->>'phone_number', j->>'phone', j->>'whatsapp_number', j->>'identity_value', ''))) as source_player_id,
    coalesce(
      nullif(j->>'first_name', ''),
      nullif(split_part(coalesce(j->>'full_name', j->>'name', ''), ' ', 1), ''),
      'Hi'
    ) as first_name,
    coalesce(nullif(j->>'full_name', ''), nullif(j->>'name', ''), nullif(j->>'first_name', ''), 'Unnamed lead') as full_name,
    public.normalize_ng_phone(coalesce(j->>'phone_number', j->>'phone', j->>'whatsapp_number', j->>'identity_value', j->>'mobile')) as phone_normalized,
    case
      when coalesce(j->>'created_at', j->>'joined_at', '') ~ '^\d{4}-\d{2}-\d{2}'
        then coalesce(j->>'created_at', j->>'joined_at')::timestamptz
      else null
    end as joined_at
  from (
    select to_jsonb(p) as j
    from public.spin_players p
  ) source
  where public.normalize_ng_phone(coalesce(j->>'phone_number', j->>'phone', j->>'whatsapp_number', j->>'identity_value', j->>'mobile')) is not null
  on conflict (phone_normalized) do update
  set
    source_player_id = excluded.source_player_id,
    first_name = excluded.first_name,
    full_name = excluded.full_name,
    joined_at = coalesce(excluded.joined_at, public.sms_leads.joined_at);

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.import_sms_outreach_labels(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  with incoming as (
    select
      public.normalize_ng_phone(item->>'phone_number') as phone_normalized,
      case
        when item->>'outreach_status' in ('not_messaged','messaged','messaged_us_before','excluded')
          then item->>'outreach_status'
        else 'not_messaged'
      end as outreach_status
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) item
  )
  update public.sms_leads lead
  set
    whatsapp_outreach_status = incoming.outreach_status,
    outreach_status_source = 'old_spin_outreach_csv',
    outreach_status_imported_at = now()
  from incoming
  where incoming.phone_normalized is not null
    and lead.phone_normalized = incoming.phone_normalized;

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
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  insert into public.sms_campaign_recipients (campaign_id, lead_id)
  select p_campaign_id, lead.id
  from public.sms_leads lead
  where lead.whatsapp_outreach_status = 'not_messaged'
    and not exists (
      select 1
      from public.sms_campaign_recipients existing
      where existing.campaign_id = p_campaign_id
        and existing.lead_id = lead.id
    )
  order by lead.joined_at asc nulls last, lead.created_at asc
  limit greatest(1, least(coalesce(p_limit, 20), 5000))
  on conflict (campaign_id, lead_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.record_sms_campaign_click(p_tracking_token text)
returns table (
  whatsapp_number text,
  whatsapp_message text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sms_campaign_recipients recipient
  set
    clicked_at = coalesce(recipient.clicked_at, now()),
    click_count = recipient.click_count + 1,
    sms_status = case
      when recipient.sms_status = 'claimed' then 'claimed'
      else 'clicked'
    end
  where recipient.tracking_token = p_tracking_token;

  return query
  select campaign.whatsapp_number, campaign.whatsapp_message
  from public.sms_campaign_recipients recipient
  join public.sms_campaigns campaign on campaign.id = recipient.campaign_id
  where recipient.tracking_token = p_tracking_token
  limit 1;
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
set search_path = public
as $$
  select
    (select count(*) from public.sms_leads) as total_leads,
    (select count(*) from public.sms_leads where whatsapp_outreach_status = 'not_messaged') as eligible_leads,
    (select count(*) from public.sms_campaign_recipients r where p_campaign_id is null or r.campaign_id = p_campaign_id) as selected_recipients,
    (select count(*) from public.sms_campaign_recipients r where (p_campaign_id is null or r.campaign_id = p_campaign_id) and r.clicked_at is not null) as clicked_recipients,
    (select count(*) from public.sms_campaign_recipients r where (p_campaign_id is null or r.campaign_id = p_campaign_id) and r.whatsapp_claimed_at is not null) as claimed_recipients,
    (select count(*) from public.sms_campaign_recipients r where (p_campaign_id is null or r.campaign_id = p_campaign_id) and r.sms_status in ('sent','delivered','clicked','claimed')) as sent_recipients,
    case
      when (select count(*) from public.sms_campaign_recipients r where (p_campaign_id is null or r.campaign_id = p_campaign_id) and r.sms_status in ('sent','delivered','clicked','claimed')) = 0 then 0
      else round(
        100.0 *
        (select count(*) from public.sms_campaign_recipients r where (p_campaign_id is null or r.campaign_id = p_campaign_id) and r.whatsapp_claimed_at is not null)
        /
        (select count(*) from public.sms_campaign_recipients r where (p_campaign_id is null or r.campaign_id = p_campaign_id) and r.sms_status in ('sent','delivered','clicked','claimed')),
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
  lead.whatsapp_outreach_status
from public.sms_campaign_recipients recipient
join public.sms_leads lead on lead.id = recipient.lead_id;

-- Public GitHub Pages dashboard access.
-- This mirrors the user's existing shared/no-login outreach workflow.
alter table public.sms_leads enable row level security;
alter table public.sms_campaigns enable row level security;
alter table public.sms_campaign_recipients enable row level security;

drop policy if exists "sms dashboard read leads" on public.sms_leads;
create policy "sms dashboard read leads"
on public.sms_leads for select to anon using (true);

drop policy if exists "sms dashboard update leads" on public.sms_leads;
create policy "sms dashboard update leads"
on public.sms_leads for update to anon using (true) with check (true);

drop policy if exists "sms dashboard read campaigns" on public.sms_campaigns;
create policy "sms dashboard read campaigns"
on public.sms_campaigns for select to anon using (true);

drop policy if exists "sms dashboard insert campaigns" on public.sms_campaigns;
create policy "sms dashboard insert campaigns"
on public.sms_campaigns for insert to anon with check (true);

drop policy if exists "sms dashboard update campaigns" on public.sms_campaigns;
create policy "sms dashboard update campaigns"
on public.sms_campaigns for update to anon using (true) with check (true);

drop policy if exists "sms dashboard read recipients" on public.sms_campaign_recipients;
create policy "sms dashboard read recipients"
on public.sms_campaign_recipients for select to anon using (true);

drop policy if exists "sms dashboard insert recipients" on public.sms_campaign_recipients;
create policy "sms dashboard insert recipients"
on public.sms_campaign_recipients for insert to anon with check (true);

drop policy if exists "sms dashboard update recipients" on public.sms_campaign_recipients;
create policy "sms dashboard update recipients"
on public.sms_campaign_recipients for update to anon using (true) with check (true);

-- Allow the public dashboard to call only the intended functions.
grant usage on schema public to anon;
grant select, insert, update on public.sms_leads to anon;
grant select, insert, update on public.sms_campaigns to anon;
grant select, insert, update on public.sms_campaign_recipients to anon;
grant select on public.sms_campaign_recipient_details to anon;
grant execute on function public.refresh_sms_leads_from_spin_players() to anon;
grant execute on function public.import_sms_outreach_labels(jsonb) to anon;
grant execute on function public.prepare_sms_campaign_recipients(uuid, integer) to anon;
grant execute on function public.record_sms_campaign_click(text) to anon;
grant execute on function public.sms_dashboard_summary(uuid) to anon;

-- Initial sync. This can also be repeated from the dashboard.
select public.refresh_sms_leads_from_spin_players();
