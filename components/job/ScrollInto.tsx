'use client';

import { useEffect } from 'react';

// Deep links (inbox → messages, an old photo tab) land on the open card.
export function ScrollInto({ id }: { id?: string }) {
  useEffect(() => {
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [id]);
  return null;
}
