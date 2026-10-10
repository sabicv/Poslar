-- A sent quote keeps the lines the customer was shown. A later edit
-- is a new number, not a silent change of the old paper.

alter table public.approvals add column if not exists quote_number int;
alter table public.approvals add column if not exists quote_year int;
alter table public.approvals add column if not exists snapshot jsonb;

comment on column public.approvals.quote_number is 'Ponuda number for this workshop and year. Null on links sent before numbering.';
comment on column public.approvals.snapshot is 'Lines, prices and the request as they were when the quote was sent.';

create unique index if not exists uq_approvals_quote_number
  on public.approvals (tenant_id, quote_year, quote_number)
  where quote_number is not null;
