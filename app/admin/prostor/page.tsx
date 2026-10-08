import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { Card, CardHeader, Stat, buttonClass } from '@/components/ui';
import { downloadBackup } from '@/lib/actions/backup';
import { listBackups, storageUse } from '@/lib/backup';
import { formatDateTime } from '@/lib/format';
import { requireTower } from '@/lib/tower';
import { BackupNow } from './BackupNow';

export const metadata: Metadata = { title: 'Prostor i kopije' };

// Supabase limits: Free 500 MB database and 1 GB files, Pro 8 GB and 100 GB.
const LIMITS = {
  free: { database: 500 * 1024 ** 2, files: 1024 ** 3, label: 'Free' },
  pro: { database: 8 * 1024 ** 3, files: 100 * 1024 ** 3, label: 'Pro' },
};

const size = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2).replace('.', ',')} GB` : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1).replace('.', ',')} MB` : `${Math.round(bytes / 1024)} kB`;

const BUCKETS: Record<string, string> = { 'job-files': 'Slike i dokumenti', branding: 'Logotipi', backups: 'Sigurnosne kopije' };

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular text-muted">
          {size(used)} od {size(limit)} · {pct} %
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface2">
        <div className={pct >= 90 ? 'h-full bg-crit' : pct >= 70 ? 'h-full bg-warn' : 'h-full bg-accent'} style={{ width: `${Math.max(1, pct)}%` }} />
      </div>
    </div>
  );
}

// How much room the database and files take, which workshops take most,
// and the weekly copies of the database to download.
export default async function StoragePage() {
  const admin = await requireTower();
  const plan = process.env.SUPABASE_PLAN?.trim() === 'pro' ? LIMITS.pro : LIMITS.free;
  const [use, backups, { data: tenants }] = await Promise.all([storageUse(admin), listBackups(admin), admin.from('tenants').select('id, name')]);
  const names = new Map((tenants ?? []).map((t) => [t.id as string, t.name as string]));

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Baza" value={size(use.database)} hint={`Supabase ${plan.label}`} />
        <Stat label="Datoteke" value={size(use.files)} hint={`${use.byBucket.reduce((s, b) => s + b.files, 0)} datoteka`} />
        <Stat label="Sigurnosne kopije" value={backups.length} hint={backups[0] ? `zadnja ${formatDateTime(backups[0].created)}` : 'još nijedna'} />
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Prostor" subtitle={`Granice paketa Supabase ${plan.label}. Na Pro u Vercelu upišite SUPABASE_PLAN=pro.`} />
          <div className="space-y-4 p-4">
            <Meter label="Baza podataka" used={use.database} limit={plan.database} />
            <Meter label="Datoteke" used={use.files} limit={plan.files} />
            <ul className="divide-y divide-line text-sm">
              {use.byBucket.map((b) => (
                <li key={b.bucket} className="flex justify-between py-2">
                  <span>{BUCKETS[b.bucket] ?? b.bucket}</span>
                  <span className="tabular text-muted">
                    {b.files} · {size(b.bytes)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <Card>
          <CardHeader title="Najviše slika i dokumenata" subtitle="Po radionici" />
          {use.byWorkshop.length ? (
            <ul className="divide-y divide-line">
              {use.byWorkshop.slice(0, 10).map((w) => (
                <li key={w.tenantId} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 break-words">{names.get(w.tenantId) ?? 'Obrisana radionica'}</span>
                  <span className="shrink-0 tabular text-muted">{size(w.bytes)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-sm text-muted">Još nema datoteka.</p>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Sigurnosne kopije baze" subtitle="Sama se radi jednom tjedno, čuva se zadnjih 8. Preuzmite je i spremite i izvan Supabasea." action={<BackupNow />} />
          {backups.length ? (
            <ul className="divide-y divide-line">
              {backups.map((b) => (
                <li key={b.name} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span>
                    {formatDateTime(b.created)} <span className="text-faint">· {size(b.size)}</span>
                  </span>
                  <form action={downloadBackup}>
                    <input type="hidden" name="name" value={b.name} />
                    <button type="submit" className={buttonClass('ghost', 'sm')}>
                      <Download className="size-4" /> Preuzmi
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-sm text-muted">Još nema kopije. Prva se napravi večeras ili dodirom na „Napravi kopiju sada”.</p>
          )}
          <p className="border-t border-line px-4 py-2.5 text-xs text-faint">U kopiji je svaka tablica kao JSON. Slike i dokumenti nisu u kopiji.</p>
        </Card>
      </div>
    </div>
  );
}
