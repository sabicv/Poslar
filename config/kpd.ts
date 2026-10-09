import type { PackageId } from './tenant.config';

// Croatian KPD (NKD) six-digit codes for the fiscal invoice line.
// The owner can override per line. These are the usual class for the trade,
// not a legal opinion: the workshop's accountant confirms them.
export const KPD_BY_PACKAGE: Record<PackageId, string> = {
  volt: '452011',
  gear: '452011',
  body: '452011',
  wheel: '452011',
  fleet: '452021',
  machine: '331211',
  moto: '454011',
  marine: '331501',
  air: '432210',
  aqua: '432210',
  tow: '522100',
  deal: '451101',
  detail: '452011',
  electric: '432110',
  appliance: '952200',
  locksmith: '257200',
};

export const KPD_LABELS: Record<string, string> = {
  '452011': 'Održavanje i popravak motornih vozila',
  '452021': 'Održavanje i popravak teretnih vozila',
  '454011': 'Održavanje i popravak motocikala',
  '331211': 'Popravak strojeva',
  '331501': 'Popravak brodova i plovila',
  '432110': 'Električne instalacije',
  '432210': 'Vodovodne i klimatizacijske instalacije',
  '522100': 'Usluge kopnenog prijevoza (vuča)',
  '451101': 'Prodaja motornih vozila',
  '952200': 'Popravak kućanskih aparata',
  '257200': 'Brave i okovi',
};

export function defaultKpd(pkg: PackageId): string {
  return KPD_BY_PACKAGE[pkg];
}
