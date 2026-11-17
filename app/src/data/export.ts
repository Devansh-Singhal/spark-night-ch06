import { PartAttempt } from '../domain/types';

/**
 * Neutralize formula injection prefixes in user-entered cells.
 * If a cell starts with =, +, -, @, \t, or \r, prefix with a single quote '
 * and wrap in quotes if it contains commas, quotes, or newlines according to RFC 4180.
 */
export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);

  // Check formula injection prefixes
  const formulaPrefixes = ['=', '+', '-', '@', '\t', '\r'];
  if (formulaPrefixes.some((p) => str.startsWith(p))) {
    str = `'${str}`;
  }

  // Escape quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Generate CSV export of parts list
 */
export function generatePartsCsv(parts: PartAttempt[]): string {
  const headers = [
    'Internal UUID',
    'Display ID',
    'Station ID',
    'Recipe ID',
    'Recipe Rev',
    'Source Kind',
    'Started At (UTC)',
    'Ended At (UTC)',
    'Rule Finding',
    'Rule Reason',
    'Current Verification',
    'Audio Verification',
    'Audio Drift State',
    'Part Audio Score',
    'Inspection Status',
    'Disposition Decision',
    'Storage State',
  ];

  const rows = parts.map((p) => [
    p.id,
    p.displayId,
    p.stationId,
    p.recipeId,
    p.recipeVersion,
    p.sourceKind,
    p.startedAt,
    p.endedAt || '',
    p.ruleFinding,
    p.ruleReason,
    p.currentVerification,
    p.audioVerification,
    p.driftFinding,
    p.audioScore != null ? p.audioScore.toFixed(2) : '',
    p.inspectionStatus,
    p.dispositionStatus,
    p.savedState,
  ]);

  const csvContent = [
    headers.map(sanitizeCsvCell).join(','),
    ...rows.map((row) => row.map(sanitizeCsvCell).join(',')),
  ].join('\r\n');

  return csvContent;
}

/**
 * Trigger browser file download
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
