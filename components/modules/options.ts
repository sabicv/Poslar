// Label map → select options. A plain module (not 'use client'), so server
// components can call it while building field definitions for RecordSheet.
export const opts = (map: Record<string, string>) => Object.entries(map).map(([value, label]) => ({ value, label }));
