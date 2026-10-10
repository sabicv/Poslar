import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/app/racun/[token]/PrintButton';
import { JobDossier } from '@/components/job/JobDossier';
import { BackLink } from '@/components/ui';
import { loadDossier } from '@/lib/dossier';
import { requireOwner } from '@/lib/session';

export const metadata: Metadata = { title: 'Zapisnik' };

// The attachment that prints behind the invoice. Same paper, one or two pages.
export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOwner();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const dossier = await loadDossier(ctx.supabase, id);
  if (!dossier) notFound();

  return (
    <div className="mx-auto w-full min-w-0 max-w-[230mm] space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink href={`/app/jobs/${id}`}>Nalog #{dossier.jobNumber}</BackLink>
        <PrintButton />
      </div>
      <JobDossier data={dossier} />
    </div>
  );
}
