-- 0010 · Neutral wording in the job log
--
-- The approval entry read "<name> odobrio/la 2 od 3 stavki". Same function
-- as in 0007, only the log line changes: "Odluka stranke: odobreno 2 od 3 ·
-- <name>", no gendered slash, no count agreement to get wrong.

create or replace function public.decide_approval(
  p_token      uuid,
  p_signer     text,
  p_decisions  jsonb,
  p_ip         text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_approval  public.approvals%rowtype;
  v_locked    timestamptz;
  v_expected  uuid[];
  v_given     uuid[];
  v_approved  int;
  v_total     int;
  v_signer    text := btrim(coalesce(p_signer, ''));
begin
  select * into v_approval from public.approvals where token = p_token for update;
  if not found then
    raise exception 'approval_not_found';
  end if;
  if v_approval.status = 'decided' then
    raise exception 'approval_already_decided';
  end if;
  if v_approval.status = 'expired' or v_approval.expires_at < now() then
    raise exception 'approval_expired';
  end if;
  select locked_at into v_locked from public.jobs where id = v_approval.job_id for update;
  if v_locked is not null then
    raise exception 'approval_job_locked';
  end if;
  if length(v_signer) < 2 or length(v_signer) > 120 then
    raise exception 'approval_signer';
  end if;
  if jsonb_typeof(p_decisions) is distinct from 'array'
     or exists (
       select 1 from jsonb_array_elements(p_decisions) d
       where jsonb_typeof(d) <> 'object'
          or coalesce(d ->> 'decision', '') not in ('approved', 'declined')
          or coalesce(d ->> 'lineId', '') !~* '^[0-9a-f-]{36}$'
     ) then
    raise exception 'approval_invalid';
  end if;

  select coalesce(array_agg(id order by id), '{}') into v_expected
  from public.job_lines where job_id = v_approval.job_id and approval = 'proposed';
  if cardinality(v_expected) = 0 then
    raise exception 'approval_nothing_proposed';
  end if;
  select coalesce(array_agg((d ->> 'lineId')::uuid order by (d ->> 'lineId')::uuid), '{}') into v_given
  from jsonb_array_elements(p_decisions) d;
  if v_given <> v_expected then
    raise exception 'approval_incomplete';
  end if;

  update public.job_lines l
     set approval = (d ->> 'decision')::public.line_approval
    from jsonb_array_elements(p_decisions) d
   where l.id = (d ->> 'lineId')::uuid and l.job_id = v_approval.job_id;

  select count(*) filter (where d ->> 'decision' = 'approved'), count(*)
    into v_approved, v_total
    from jsonb_array_elements(p_decisions) d;

  update public.approvals
     set status = 'decided', decided_at = now(), decisions = p_decisions, signer_name = v_signer,
         ip = left(p_ip, 64), user_agent = left(p_user_agent, 300)
   where id = v_approval.id;

  insert into public.job_events (tenant_id, job_id, event_type, message, metadata)
  values (v_approval.tenant_id, v_approval.job_id, 'approval',
          format('Odluka stranke: odobreno %s od %s · %s', v_approved, v_total, v_signer),
          jsonb_build_object('decisions', p_decisions));

  if v_approved > 0 then
    update public.jobs set phase = 'in_progress' where id = v_approval.job_id and phase = 'awaiting_approval';
  end if;

  return jsonb_build_object('approved', v_approved, 'total', v_total);
end
$$;
