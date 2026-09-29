import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { tireSize } from '@/components/modules/wheel/WheelModule';
import { SEASON_LABELS } from '@/config/packages/wheel';
import { clientName } from '@/lib/format';
import { requireWorkshop } from '@/lib/session';
import { PrintButton } from './PrintButton';

// Printable label for a stored tyre set: QR + location + owner.
export default async function TireLabel({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkshop();
  const { id } = await params;
  const { data: set } = await ctx.supabase
    .from('wheel_tire_sets')
    .select('*, client:clients(kind, first_name, last_name, company_name), asset:assets(identifier), stays:wheel_storage_stays(location_id, checked_out_at)')
    .eq('id', id)
    .maybeSingle();
  if (!set) notFound();

  const stay = ((set.stays as { location_id: string; checked_out_at: string | null }[]) ?? []).find((s) => !s.checked_out_at);
  let location = '';
  if (stay) {
    const { data } = await ctx.supabase.from('wheel_storage_locations').select('sector, rack, shelf, slot').eq('id', stay.location_id).single();
    if (data) location = `${data.sector}-${data.rack}-${data.shelf}-${data.slot}`;
  }
  const svg = await QRCode.toString(set.qr_code as string, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });

  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-2xl border border-line bg-white p-5 text-black print:border-0">
        <div className="flex items-center gap-4">
          <div className="size-28 shrink-0" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="min-w-0">
            <p className="font-mono text-2xl font-bold">{location || 'bez mjesta'}</p>
            <p className="font-mono text-sm">{(set.asset as { identifier: string | null } | null)?.identifier ?? ''}</p>
            <p className="truncate text-sm">{clientName(set.client as never)}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-black/20 pt-2 text-xs">
          <span>
            {SEASON_LABELS[set.season as string]} · {tireSize(set)}
          </span>
          <span className="font-mono">{set.qr_code as string}</span>
        </div>
      </div>
      <PrintButton />
    </div>
  );
}
