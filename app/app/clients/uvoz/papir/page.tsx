import type { Metadata } from 'next';
import { BackLink, PageHeader } from '@/components/ui';
import { requireOwner } from '@/lib/session';
import { PaperImport } from './PaperImport';

export const metadata: Metadata = { title: 'Uvoz s papira' };

// Old paper job cards and invoices into the history, one photo each.
export default async function PaperImportPage() {
  const ctx = await requireOwner();
  return (
    <>
      <BackLink href="/app/clients/uvoz">Uvoz</BackLink>
      <PageHeader title="Uvoz s papira" subtitle="Stari nalozi i računi u povijest, slikom" />
      <PaperImport identifierLabel={ctx.pkg.vocabulary.identifier} field={ctx.pkg.sector === 'field'} />
    </>
  );
}
