import 'server-only';

import { invoiceTotals, lineAmount } from '@/components/invoice/InvoiceDocument';
import { clientName } from '@/lib/format';
import { zagrebDate, type LoadedInvoice } from '@/lib/invoice';

// What the accountant gets: the month's invoice book as a table Excel opens
// directly (semicolons, decimal commas, UTF-8 with BOM), and each invoice as
// an e-Račun in UBL 2.1 following EN 16931. The XML is a draft of the legal
// format: the accountant should check it before it goes to a tax system.

const invoiceId = (inv: LoadedInvoice) => `${inv.number}/${inv.year}`;
const money = (n: number) => n.toFixed(2);
const csvMoney = (n: number) => n.toFixed(2).replace('.', ',');

function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function invoiceBookCsv(invoices: LoadedInvoice[]): string {
  const header = ['Broj računa', 'Datum', 'Kupac', 'OIB kupca', 'Mjesto kupca', 'Osnovica', 'PDV', 'Ukupno', 'Plaćeno', 'Fiskalni račun', 'Radni nalog'];
  const rows = [header.map(csvCell).join(';')];
  const sum = { net: 0, vat: 0, gross: 0 };
  for (const inv of invoices) {
    const t = invoiceTotals(inv.lines, inv.billing.vatRegistered);
    sum.net += t.net;
    sum.vat += t.vat;
    sum.gross += t.gross;
    const [y, m, d] = zagrebDate(inv.issuedAt!).split('-');
    rows.push(
      [
        invoiceId(inv),
        `${d}.${m}.${y}.`,
        clientName(inv.client as never),
        inv.client.oib,
        inv.client.city,
        csvMoney(t.net),
        csvMoney(t.vat),
        csvMoney(t.gross),
        inv.paid ? 'da' : 'ne',
        inv.fiscalRef,
        inv.jobNumber,
      ]
        .map(csvCell)
        .join(';')
    );
  }
  rows.push(['', '', '', '', 'Ukupno', csvMoney(sum.net), csvMoney(sum.vat), csvMoney(sum.gross), '', '', ''].map(csvCell).join(';'));
  return `﻿${rows.join('\r\n')}\r\n`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tag = (name: string, value: string | number | null | undefined, attrs = '') => (value === null || value === undefined || value === '' ? '' : `<cbc:${name}${attrs}>${esc(String(value))}</cbc:${name}>`);
const eur = (name: string, n: number) => tag(name, money(n), ' currencyID="EUR"');

// UN/ECE Rec 20 unit codes for the units the app offers.
const UNIT_CODES: Record<string, string> = { h: 'HUR', kom: 'H87', l: 'LTR', kg: 'KGM', g: 'GRM', m: 'MTR', set: 'SET', 'paušal': 'C62' };

function taxCategory(rate: number, vatRegistered: boolean, wrapper: 'TaxCategory' | 'ClassifiedTaxCategory') {
  const id = !vatRegistered ? 'E' : rate > 0 ? 'S' : 'Z';
  const reason = !vatRegistered ? tag('TaxExemptionReason', 'PDV nije obračunat temeljem čl. 90. st. 1. Zakona o PDV-u') : '';
  return `<cac:${wrapper}>${tag('ID', id)}${tag('Percent', vatRegistered ? rate : 0)}${wrapper === 'TaxCategory' ? reason : ''}<cac:TaxScheme>${tag('ID', 'VAT')}</cac:TaxScheme></cac:${wrapper}>`;
}

function party(p: { name: string; oib: string | null; address: string | null; city: string | null; vatId?: string | null; phone?: string | null; email?: string | null }) {
  return [
    '<cac:Party>',
    p.oib ? tag('EndpointID', p.oib, ' schemeID="9934"') : '',
    `<cac:PartyName>${tag('Name', p.name)}</cac:PartyName>`,
    `<cac:PostalAddress>${tag('StreetName', p.address)}${tag('CityName', p.city)}<cac:Country>${tag('IdentificationCode', 'HR')}</cac:Country></cac:PostalAddress>`,
    p.vatId ? `<cac:PartyTaxScheme>${tag('CompanyID', p.vatId)}<cac:TaxScheme>${tag('ID', 'VAT')}</cac:TaxScheme></cac:PartyTaxScheme>` : '',
    `<cac:PartyLegalEntity>${tag('RegistrationName', p.name)}${tag('CompanyID', p.oib)}</cac:PartyLegalEntity>`,
    p.phone || p.email ? `<cac:Contact>${tag('Telephone', p.phone)}${tag('ElectronicMail', p.email)}</cac:Contact>` : '',
    '</cac:Party>',
  ].join('');
}

export function invoiceUbl(inv: LoadedInvoice): string {
  const vat = inv.billing.vatRegistered;
  const t = invoiceTotals(inv.lines, vat);
  const w = inv.workshop;
  const notes = [inv.fiscalRef ? `Fiskalizirani račun iz blagajne br. ${inv.fiscalRef}` : null, `Radni nalog #${inv.jobNumber}`, inv.billing.note].filter(Boolean) as string[];

  const lines = inv.lines.map((l, i) => {
    const amount = lineAmount(l);
    const netPrice = l.unit_price * (1 - l.discount_pct / 100);
    return [
      '<cac:InvoiceLine>',
      tag('ID', i + 1),
      tag('InvoicedQuantity', l.qty, ` unitCode="${UNIT_CODES[l.unit] ?? 'C62'}"`),
      eur('LineExtensionAmount', amount),
      `<cac:Item>${tag('Name', l.description)}${taxCategory(l.vat_rate, vat, 'ClassifiedTaxCategory')}</cac:Item>`,
      `<cac:Price>${tag('PriceAmount', netPrice.toFixed(4).replace(/0{1,2}$/, ''), ' currencyID="EUR"')}</cac:Price>`,
      '</cac:InvoiceLine>',
    ].join('');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">',
    tag('CustomizationID', 'urn:cen.eu:en16931:2017'),
    tag('ID', invoiceId(inv)),
    tag('IssueDate', zagrebDate(inv.issuedAt!)),
    tag('InvoiceTypeCode', '380'),
    ...notes.map((n) => tag('Note', n)),
    tag('DocumentCurrencyCode', 'EUR'),
    tag('BuyerReference', `Nalog ${inv.jobNumber}`),
    `<cac:AccountingSupplierParty>${party({ name: w.name, oib: w.oib, address: w.address, city: w.city, vatId: vat && w.oib ? `HR${w.oib}` : null, phone: w.phone, email: w.email })}</cac:AccountingSupplierParty>`,
    `<cac:AccountingCustomerParty>${party({ name: clientName(inv.client as never), oib: inv.client.oib, address: inv.client.address, city: inv.client.city })}</cac:AccountingCustomerParty>`,
    inv.billing.iban
      ? `<cac:PaymentMeans>${tag('PaymentMeansCode', '30')}${tag('PaymentID', `HR00 ${inv.number}-${inv.year}`)}<cac:PayeeFinancialAccount>${tag('ID', inv.billing.iban.replace(/\s/g, ''))}</cac:PayeeFinancialAccount></cac:PaymentMeans>`
      : '',
    `<cac:TaxTotal>${eur('TaxAmount', t.vat)}${t.allRates
      .map(([rate, r]) => `<cac:TaxSubtotal>${eur('TaxableAmount', r.base)}${eur('TaxAmount', r.vat)}${taxCategory(rate, vat, 'TaxCategory')}</cac:TaxSubtotal>`)
      .join('')}</cac:TaxTotal>`,
    `<cac:LegalMonetaryTotal>${eur('LineExtensionAmount', t.net)}${eur('TaxExclusiveAmount', t.net)}${eur('TaxInclusiveAmount', t.gross)}${eur('PayableAmount', t.gross)}</cac:LegalMonetaryTotal>`,
    ...lines,
    '</Invoice>',
    '',
  ].join('\n');
}

export const invoiceFileName = (inv: LoadedInvoice) => `racun-${inv.number}-${inv.year}.xml`;
