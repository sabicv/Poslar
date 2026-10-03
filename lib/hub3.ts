import 'server-only';
import bwipjs from 'bwip-js';
import type { Payee } from '@/lib/billing';

// HUB-3: the barcode on Croatian payment slips that every bank's app reads.
// Text without Croatian letters (banks read them as ISO 8859-2 at best).
const plain = (s: string, max: number) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'D'))
    .replace(/[^\x20-\x7E]/g, '')
    .slice(0, max);

export interface PaymentSlip {
  amount: number;
  payerName: string;
  payerStreet: string;
  payerCity: string;
  reference: string;
  description: string;
}

export async function hub3Svg(slip: PaymentSlip, to: Payee): Promise<string> {
  const text = [
    'HRVHUB30',
    'EUR',
    String(Math.round(slip.amount * 100)).padStart(15, '0'),
    plain(slip.payerName, 30),
    plain(slip.payerStreet, 27),
    plain(slip.payerCity, 27),
    plain(to.name, 25),
    plain(to.street, 25),
    plain(to.city, 27),
    to.iban,
    'HR00',
    plain(slip.reference, 22),
    'OTHR',
    plain(slip.description, 35),
    '',
  ].join('\n');
  return bwipjs.toSVG({ bcid: 'pdf417', text, columns: 9, eclevel: 4, scale: 2, padding: 4, backgroundcolor: 'FFFFFF' });
}
