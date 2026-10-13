import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/app/racun/[token]/PrintButton';
import { JobSheet } from '@/components/job/JobSheet';
import { BackLink } from '@/components/ui';
import { loadJobSheet } from '@/lib/job-sheet';
import { requireWorkshop } from '@/lib/session';

export const metadata: Metadata = { title: 'Nalog na papiru' };

export default async function JobSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkshop();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sheet = await loadJobSheet(ctx.supabase, id);
  if (!sheet) notFound();

  return (
    <div className="mx-auto w-full min-w-0 max-w-[230mm] space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink href={`/app/jobs/${id}`}>Nalog #{sheet.jobNumber}</BackLink>
        <PrintButton />
      </div>
      <JobSheet data={sheet} />
    </div>
  );
}
