import type { InspectionSection, InspectionTemplate } from '../tenant.config';

export const COMMON_PHOTO_TAGS = [
  { code: 'intake', label: 'Stanje pri prijemu' },
  { code: 'damage', label: 'Oštećenje / kvar' },
  { code: 'part_old', label: 'Stari dio' },
  { code: 'part_new', label: 'Novi dio' },
  { code: 'meter', label: 'Brojilo' },
  { code: 'document', label: 'Dokument' },
];

// A plain checklist: every item is "done / not applicable" with an
// optional note, but it runs on the same inspection engine as the DVI.
export function checklist(code: string, name: string, purpose: InspectionTemplate['purpose'], title: string, labels: string[]): InspectionTemplate {
  const section: InspectionSection = {
    title,
    items: labels.map((label, i) => ({ code: `${code.split('.').pop()}_${String(i + 1).padStart(2, '0')}`, label })),
  };
  return { code, name, purpose, sections: [section] };
}
