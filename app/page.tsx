'use client';

import { FormEvent, PointerEvent as ReactPointerEvent, WheelEvent, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

type RawStar = [string, number, number, number | null, number | null, number | null, number | null, number | null, number | null, number | null, string, string, string, string, string, string, string, number | null, string, string, ...(number | null)[]];
type Catalog = { stars: RawStar[]; columns?: string[]; simbadAliases?: string[]; simbadIds?: string[]; parallaxDistanceCount: number; maxParallaxSnr: number };
type ExtraCatalog = { count: number; columns: { name: string; numeric: boolean }[]; rows: unknown[][] };
type Population = 'L' | 'S' | 'B';
type SpectralGroup = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M' | 'WR' | 'OTHER' | 'UNKNOWN';
type SpectralFilter = 'ALL' | 'WR' | 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M' | 'HOT' | 'COOL';
type SearchSuggestion = { kind: 'cluster'; label: string; detail: string; ra: number; dec: number; zoom: number; radius: number } | { kind: 'star'; label: string; detail: string; index: number };
type SelectedRegion = { name: string; ra: number; dec: number; radius: number };
type ExportFormat = 'csv' | 'fits' | 'votable' | 'json';
type ColumnMode = 'main' | 'custom' | 'all';
type ExportColumn = { name: string; index?: number; extraIndex?: number; aliases?: true; numeric?: boolean };
type ExportEntry = { star: RawStar; simbadIds: string; rowIndex: number };
type IdentifierIndexEntry = { index: number; identifiers: { label: string; normalized: string }[] };
type QueryScope = 'selected' | 'object' | 'objects' | 'cluster' | 'cone' | 'manual' | 'view' | 'filtered' | 'L' | 'S' | 'B' | 'all';
type ManualTool = 'stars' | 'rectangle' | 'circle' | 'polygon';
type ScreenPoint = { x: number; y: number };

const DEG = Math.PI / 180;
const RA0 = 66 * DEG;
const DEC0 = -72 * DEG;
const COLOR_MIN = -1;
const COLOR_MAX = 6;
const MAG_MIN = 8;
const MAG_MAX = 20.5;
const CLOUD_VIEWS = {
  LMC: { ra: 81.5811, dec: -69.0643, zoom: 4 },
  SMC: { ra: 20.5, dec: -72.9, zoom: 4 },
} as const;
const ALL_VIEW = { ra: 52, dec: -71.5, zoom: 1.5, offsetY: -52 } as const;
const CLUSTER_MARKER_PADDING = 1.45;
const NATURAL_COLLATOR = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const ORIGINAL_EXPORT_COLUMNS: ExportColumn[] = [
  { name: 'id_als', index: 0 }, { name: 'ra', index: 1, numeric: true }, { name: 'dec', index: 2, numeric: true }, { name: 'g_syn', index: 3, numeric: true }, { name: 'bp_rp_syn', index: 4, numeric: true },
  { name: 'parallax_corr_gaia', index: 5, numeric: true }, { name: 'parallax_error_corr_gaia', index: 6, numeric: true }, { name: 'pmra_corr_gaia', index: 7, numeric: true }, { name: 'pmdec_corr_gaia', index: 8, numeric: true }, { name: 'ruwe_gaia', index: 9, numeric: true },
  { name: 'Sample', index: 10 }, { name: 'id_dr3_gaia', index: 11 }, { name: 'main_id_simbad', index: 12 }, { name: 'id_simbad', aliases: true }, { name: 'otype_simbad', index: 13 }, { name: 'sp_type_simbad', index: 14 }, { name: 'g_source', index: 15 }, { name: 'bp_rp_source', index: 16 }, { name: 'Notes', index: 19 },
  { name: 'pmra_error_corr_gaia', index: 20, numeric: true }, { name: 'pmdec_error_corr_gaia', index: 21, numeric: true }, { name: 'SG_var', index: 22, numeric: true }, { name: 'SSG_var', index: 23, numeric: true }, { name: 'SBP_var', index: 24, numeric: true }, { name: 'SSBP_var', index: 25, numeric: true }, { name: 'SRP_var', index: 26, numeric: true }, { name: 'SSRP_var', index: 27, numeric: true },
  { name: 'g_mag_corr_gaia', index: 28, numeric: true }, { name: 'g_mag_error_gaia', index: 29, numeric: true }, { name: 'bp_mag_gaia', index: 30, numeric: true }, { name: 'bp_mag_error_gaia', index: 31, numeric: true }, { name: 'rp_mag_gaia', index: 32, numeric: true }, { name: 'rp_mag_error_gaia', index: 33, numeric: true },
  { name: 'U_zh', index: 34, numeric: true }, { name: 'e_U_zh', index: 35, numeric: true }, { name: 'B_zh', index: 36, numeric: true }, { name: 'e_B_zh', index: 37, numeric: true }, { name: 'u_psf_smss', index: 38, numeric: true }, { name: 'e_u_psf_smss', index: 39, numeric: true }, { name: 'v_psf_smss', index: 40, numeric: true }, { name: 'e_v_psf_smss', index: 41, numeric: true },
  { name: 'j_2mass', index: 42, numeric: true }, { name: 'j_err_2mass', index: 43, numeric: true }, { name: 'k_2mass', index: 44, numeric: true }, { name: 'k_err_2mass', index: 45, numeric: true }, { name: 'Jpmag_vista', index: 46, numeric: true }, { name: 'e_Jpmag_vista', index: 47, numeric: true }, { name: 'Kspmag_vista', index: 48, numeric: true }, { name: 'e_Kspmag_vista', index: 49, numeric: true },
  { name: 'F336W_hubble', index: 50, numeric: true }, { name: 'e_F336W_hubble', index: 51, numeric: true }, { name: 'F555W_hubble', index: 52, numeric: true }, { name: 'e_F555W_hubble', index: 53, numeric: true }, { name: 'F775W_hubble', index: 54, numeric: true }, { name: 'e_F775W_hubble', index: 55, numeric: true },
];
const MAIN_EXPORT_NAMES = new Set(['id_als', 'ra', 'dec', 'g_syn', 'bp_rp_syn', 'parallax_corr_gaia', 'parallax_error_corr_gaia', 'pmra_corr_gaia', 'pmra_error_corr_gaia', 'pmdec_corr_gaia', 'pmdec_error_corr_gaia', 'ruwe_gaia', 'Sample', 'id_dr3_gaia', 'main_id_simbad', 'id_simbad', 'otype_simbad', 'sp_type_simbad']);
const FULL_COLUMN_ORDER = [
  'id_als', 'ra', 'dec', 'id_dr3_gaia', 'g_mag_gaia', 'g_mag_corr_gaia', 'g_mag_error_gaia', 'bp_mag_gaia', 'bp_mag_error_gaia', 'rp_mag_gaia', 'rp_mag_error_gaia', 'parallax_gaia', 'parallax_corr_gaia', 'parallax_error_gaia', 'parallax_error_corr_gaia', 'pmra_gaia', 'pmra_corr_gaia', 'pmra_error_gaia', 'pmra_error_corr_gaia', 'pmdec_gaia', 'pmdec_corr_gaia', 'pmdec_error_gaia', 'pmdec_error_corr_gaia', 'ruwe_gaia', 'astrometric_params_solved_gaia', 'SG_var', 'SSG_var', 'SBP_var', 'SSBP_var', 'SRP_var', 'SSRP_var', 'main_id_simbad', 'otype_simbad', 'sp_type_simbad', 'sp_qual_simbad', 'sp_bibcode_simbad', 'id_simbad', 'id_hubble', 'F336W_hubble', 'e_F336W_hubble', 'f_F336W_hubble', 'F555W_hubble', 'e_F555W_hubble', 'f_F555W_hubble', 'F775W_hubble', 'e_F775W_hubble', 'f_F775W_hubble', 'id_2mass', 'j_2mass', 'j_err_2mass', 'h_2mass', 'h_err_2mass', 'k_2mass', 'k_err_2mass', 'Qflag_2mass', 'id_vista', 'Kspmag_vista', 'e_Kspmag_vista', 'Kserrb_vista', 'Jpmag_vista', 'e_Jpmag_vista', 'Jerrb_vista', 'Ypmag_vista', 'e_Ypmag_vista', 'Yerrb_vista', 'U_zh', 'e_U_zh', 'B_zh', 'e_B_zh', 'V_zh', 'e_V_zh', 'I_zh', 'e_I_zh', 'Flag_zh', 'id_smss', 'u_psf_smss', 'e_u_psf_smss', 'u_flags_smss', 'v_psf_smss', 'e_v_psf_smss', 'v_flags_smss', 'g_psf_smss', 'e_g_psf_smss', 'g_flags_smss', 'r_psf_smss', 'e_r_psf_smss', 'r_flags_smss', 'i_psf_smss', 'e_i_psf_smss', 'i_flags_smss', 'z_psf_smss', 'e_z_psf_smss', 'z_flags_smss', 'g_syn', 'bp_rp_syn', 'g_source', 'bp_rp_source', 'Sample', 'Notes',
] as const;
let extraCatalogPromise: Promise<ExtraCatalog> | null = null;
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
function publicUrl(path: string) { return `${BASE_PATH}/${path.replace(/^\//, '')}`; }
function loadExtraCatalog() { if (!extraCatalogPromise) extraCatalogPromise = fetch(publicUrl('catalog-extra.json')).then(response => { if (!response.ok) throw new Error(`Could not load extra catalogue columns (${response.status})`); return response.json() as Promise<ExtraCatalog>; }); return extraCatalogPromise; }
function useDeferredColumns(mode: ColumnMode) {
  const [data, setData] = useState<ExtraCatalog | null>(null), [error, setError] = useState('');
  useEffect(() => { if (mode === 'main' || data) return; let active = true; loadExtraCatalog().then(result => { if (!active) return; if (result.columns.length + ORIGINAL_EXPORT_COLUMNS.length !== FULL_COLUMN_ORDER.length) throw new Error('The deferred catalogue schema is incomplete'); setData(result); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load all columns'); }); return () => { active = false; }; }, [data, mode]);
  return { data, error, loading: mode !== 'main' && !data && !error };
}
// Angular radii in degrees: half the published major diameter where available,
// otherwise a conservative core/central-region extent.
const CLUSTERS: Record<string, { name: string; ra: number; dec: number; zoom: number; radius: number }> = {
  r136: { name: 'R136', ra: 84.676408, dec: -69.1007, zoom: 32, radius: .00556 },
  '30dor': { name: '30 Doradus', ra: 84.549904, dec: -69.127847, zoom: 15, radius: .08333 },
  '30doradus': { name: '30 Doradus', ra: 84.549904, dec: -69.127847, zoom: 15, radius: .08333 },
  tarantula: { name: '30 Doradus', ra: 84.549904, dec: -69.127847, zoom: 15, radius: .08333 },
  ngc2070: { name: 'NGC 2070', ra: 84.676375, dec: -69.099434, zoom: 24, radius: .025 },
  ngc2004: { name: 'NGC 2004', ra: 82.67225, dec: -67.289397, zoom: 24, radius: .025 },
  ngc2100: { name: 'NGC 2100', ra: 85.53, dec: -69.207497, zoom: 24, radius: .02083 },
  ngc1948: { name: 'NGC 1948', ra: 81.083333, dec: -66.403333, zoom: 24, radius: .0325 },
  ngc1818: { name: 'NGC 1818', ra: 76.055417, dec: -66.434853, zoom: 24, radius: .02583 },
  ngc2027: { name: 'NGC 2027', ra: 83.751375, dec: -66.918267, zoom: 24, radius: .00917 },
  ngc1984: { name: 'NGC 1984', ra: 81.916667, dec: -69.135, zoom: 24, radius: .0125 },
  ngc1850: { name: 'NGC 1850', ra: 77.201054, dec: -68.761483, zoom: 24, radius: .025 },
  ngc1858: { name: 'NGC 1858', ra: 77.520154, dec: -68.908727, zoom: 24, radius: .03667 },
  ngc1966: { name: 'NGC 1966', ra: 81.644583, dec: -68.828148, zoom: 24, radius: .00917 },
  ngc1983: { name: 'NGC 1983', ra: 81.963477, dec: -68.979949, zoom: 24, radius: .00833 },
  ngc2002: { name: 'NGC 2002', ra: 82.618085, dec: -66.880712, zoom: 24, radius: .01583 },
  ngc299: { name: 'NGC 299', ra: 13.403234, dec: -72.204851, zoom: 24, radius: .0075 },
  ngc330: { name: 'NGC 330', ra: 14.077292, dec: -72.462528, zoom: 24, radius: .02333 },
  ngc371: { name: 'NGC 371', ra: 15.854167, dec: -72.073333, zoom: 24, radius: .035 },
  ngc456: { name: 'NGC 456', ra: 18.435, dec: -73.290556, zoom: 24, radius: .0275 },
  ngc460: { name: 'NGC 460', ra: 18.673333, dec: -73.2975, zoom: 24, radius: .02167 },
  ngc465: { name: 'NGC 465', ra: 18.925, dec: -73.328333, zoom: 24, radius: .04167 },
  ngc346: { name: 'NGC 346', ra: 14.777311, dec: -72.172429, zoom: 24, radius: .04 },
  ngc376: { name: 'NGC 376', ra: 16.020903, dec: -72.832299, zoom: 24, radius: .015 },
  ngc602: { name: 'NGC 602', ra: 22.377847, dec: -73.555518, zoom: 24, radius: .01833 },
};

function population(star: RawStar): Population { return (star[10][0] || 'L') as Population; }
function skyPosition(raDegrees: number, decDegrees: number) {
  const ra = raDegrees * DEG, dec = decDegrees * DEG, dra = ra - RA0, distance = 54;
  return {
    x: distance * Math.cos(dec) * Math.sin(dra),
    y: distance * (Math.sin(dec) * Math.cos(DEC0) - Math.cos(dec) * Math.sin(DEC0) * Math.cos(dra)),
  };
}
function clusterKey(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }
function normalizedIdentifier(value: string) {
  return value.normalize('NFKD').toLowerCase().replace(/[−–—]/g, '-').replace(/[^a-z0-9]/g, '');
}
function parseCoordinates(value: string): { ra: number; dec: number } | null {
  const labelled = value.replace(/ra\s*=/gi, '').replace(/dec\s*=/gi, '');
  const decimal = labelled.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)$/);
  if (decimal) {
    const ra = Number(decimal[1]), dec = Number(decimal[2]);
    return ra >= 0 && ra < 360 && dec >= -90 && dec <= 90 ? { ra, dec } : null;
  }
  const parts = labelled.toLowerCase().replace(/[:hmsd°º'"]/g, ' ').replace(/[,;]/g, ' ').trim().split(/\s+/).map(Number);
  if (parts.length !== 6 || parts.some(part => !Number.isFinite(part))) return null;
  const [hours, raMinutes, raSeconds, decDegrees, decMinutes, decSeconds] = parts;
  if (hours < 0 || hours >= 24 || raMinutes < 0 || raMinutes >= 60 || raSeconds < 0 || raSeconds >= 60 || Math.abs(decDegrees) > 90 || decMinutes < 0 || decMinutes >= 60 || decSeconds < 0 || decSeconds >= 60) return null;
  const sign = decDegrees < 0 || /(^|\s)-0(?:\D|$)/.test(labelled) ? -1 : 1;
  return { ra: 15 * (hours + raMinutes / 60 + raSeconds / 3600), dec: sign * (Math.abs(decDegrees) + decMinutes / 60 + decSeconds / 3600) };
}
function spectralGroup(star: RawStar): SpectralGroup {
  const type = star[14].trim().toUpperCase();
  if (!type || type === '-99') return 'UNKNOWN';
  if (/^\[W[CNOR]/.test(type)) return 'OTHER';
  if (type.startsWith('W') || /\bW[CNOR]/.test(type)) return 'WR';
  const match = type.match(/^[([]*([OBAFGKM])/);
  return match ? match[1] as SpectralGroup : 'OTHER';
}
function matchesSpectral(star: RawStar, filter: SpectralFilter) {
  if (filter === 'ALL') return true;
  const group = spectralGroup(star);
  if (filter === 'HOT') return group === 'WR' || group === 'O' || group === 'B' || group === 'A';
  if (filter === 'COOL') return group === 'F' || group === 'G' || group === 'K' || group === 'M';
  return group === filter;
}
function objectTypeSignature(type: string) { return type.replace(/[?*]/g, ''); }
function objectTypeGroup(type: string) {
  const signature = objectTypeSignature(type);
  if (signature === 'HX' || signature === 'HXB') return 'HXB';
  if (signature === 'Y' || signature === 'YO') return 'YO';
  return signature || type;
}
function matchesObjectType(star: RawStar, filter: string) { return filter === 'ALL' || objectTypeGroup(star[13].trim()) === filter; }
const OBJECT_TYPE_NAMES: Record<string, string> = {
  '*': 'Star', '**': 'Double Or Multiple Star', EB: 'Eclipsing Binary', Em: 'Emission-Line Star', Pu: 'Pulsating Variable Star', Be: 'Be Star', sr: 'Red Supergiant', LP: 'Long-Period Variable Star', V: 'Variable Star', sb: 'Blue Supergiant', SB: 'Spectroscopic Binary', El: 'Ellipsoidal Variable Star', pA: 'Post-AGB Star', cC: 'Classical Cepheid', WR: 'Wolf–Rayet Star', sy: 'Yellow Supergiant', sg: 'Supergiant Star', HXB: 'High-Mass X-Ray Binary', Pe: 'Chemically Peculiar Star', YO: 'Young Stellar Object', Y: 'Young Stellar Object', AB: 'Asymptotic Giant Branch Star', C: 'Carbon Star', Mi: 'Mira Variable', RR: 'RR Lyrae Variable', HX: 'High-Mass X-Ray Binary', HS: 'Hot Subdwarf', Ce: 'Cepheid Variable', RB: 'Red Giant Branch Star', HV: 'High-Velocity Star', PN: 'Planetary Nebula', EmO: 'Emission-Line Object', As: 'Stellar Association', XB: 'X-Ray Binary', RV: 'RV Tauri Variable', Or: 'Orion Variable', CV: 'Cataclysmic Variable', Sy: 'Symbiotic Star', bC: 'Beta Cephei Variable', RC: 'R Coronae Borealis Variable', WD: 'White Dwarf', No: 'Nova', RG: 'Red Giant Branch Star', Psr: 'Pulsar', Ro: 'Rotating Variable Star', Ae: 'Herbig Ae/Be Star',
};
const MASSIVE_STAR_OBJECT_TYPES = new Set(['*', '**', 'EB', 'Em', 'Pu', 'Be', 'sr', 'V', 'sb', 'SB', 'El', 'cC', 'WR', 'sy', 'sg', 'HXB', 'Pe', 'YO', 'Ce', 'HV']);
function objectTypeLabel(type: string) {
  const clean = type.trim();
  if (!clean || clean === '-99') return '—';
  const label = OBJECT_TYPE_NAMES[clean] ?? OBJECT_TYPE_NAMES[objectTypeSignature(clean)];
  return label ?? clean.replace(/\?$/, '');
}
function safe(value: number | null, digits = 3) { return value == null ? '—' : value.toFixed(digits); }
function formatCount(value: number) { return value.toLocaleString('en-US').replaceAll(',', ' '); }
function csvCell(value: unknown) { const text = value == null ? '' : String(value); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function xmlEscape(value: unknown) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;'); }
function exportColumns(mode: ColumnMode, extraCatalog?: ExtraCatalog | null, customColumns?: Set<string>) {
  if (mode === 'main') return ORIGINAL_EXPORT_COLUMNS.filter(column => MAIN_EXPORT_NAMES.has(column.name));
  const existing = new Map(ORIGINAL_EXPORT_COLUMNS.map(column => [column.name, column])), extras = new Map((extraCatalog?.columns ?? []).map((column, extraIndex) => [column.name, { ...column, extraIndex }]));
  const columns = FULL_COLUMN_ORDER.map(name => existing.get(name) ?? extras.get(name)).filter((column): column is ExportColumn => column != null);
  return mode === 'custom' ? columns.filter(column => customColumns?.has(column.name)) : columns;
}
function exportValue(entry: ExportEntry, column: ExportColumn, extraCatalog?: ExtraCatalog | null) { if (column.aliases) return entry.simbadIds; if (column.extraIndex != null) return extraCatalog?.rows[entry.rowIndex]?.[column.extraIndex] ?? null; return column.index == null ? null : entry.star[column.index]; }
type ExportProgress = { percent: number; label: string };
type ProgressReporter = (progress: ExportProgress) => void;
function yieldToBrowser() { return new Promise<void>(resolve => setTimeout(resolve, 0)); }
async function buildTextRows(entries: ExportEntry[], row: (entry: ExportEntry) => string, report: ProgressReporter, start: number, end: number) {
  const rows: string[] = [], batchSize = 500;
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    const limit = Math.min(entries.length, offset + batchSize);
    for (let index = offset; index < limit; index++) rows.push(row(entries[index]));
    report({ percent: Math.round(start + (end - start) * limit / Math.max(1, entries.length)), label: `Writing rows · ${formatCount(limit)} / ${formatCount(entries.length)}` });
    await yieldToBrowser();
  }
  return rows;
}
async function tableCsv(entries: ExportEntry[], mode: ColumnMode, extraCatalog: ExtraCatalog | null | undefined, report: ProgressReporter, customColumns?: Set<string>) {
  const columns = exportColumns(mode, extraCatalog, customColumns), rows = await buildTextRows(entries, entry => columns.map(column => csvCell(exportValue(entry, column, extraCatalog))).join(','), report, 5, 94);
  return `\uFEFF${columns.map(column => csvCell(column.name)).join(',')}\r\n${rows.join('\r\n')}\r\n`;
}
async function tableVotable(entries: ExportEntry[], mode: ColumnMode, extraCatalog: ExtraCatalog | null | undefined, report: ProgressReporter, customColumns?: Set<string>) {
  const columns = exportColumns(mode, extraCatalog, customColumns), fields = columns.map(column => column.numeric ? `<FIELD name="${xmlEscape(column.name)}" datatype="double"/>` : `<FIELD name="${xmlEscape(column.name)}" datatype="unicodeChar" arraysize="*"/>`).join('');
  const rows = await buildTextRows(entries, entry => `<TR>${columns.map(column => `<TD>${xmlEscape(exportValue(entry, column, extraCatalog))}</TD>`).join('')}</TR>`, report, 5, 94);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<VOTABLE version="1.4" xmlns="http://www.ivoa.net/xml/VOTable/v1.3"><RESOURCE><TABLE name="ALS_IV_query">${fields}<DATA><TABLEDATA>${rows.join('')}</TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>\n`;
}
async function tableJson(entries: ExportEntry[], mode: ColumnMode, extraCatalog: ExtraCatalog | null | undefined, report: ProgressReporter, customColumns?: Set<string>) {
  const columns = exportColumns(mode, extraCatalog, customColumns), rows = await buildTextRows(entries, entry => JSON.stringify(Object.fromEntries(columns.map(column => [column.name, exportValue(entry, column, extraCatalog)]))), report, 5, 94);
  return `[\n${rows.map(row => `  ${row}`).join(',\n')}\n]\n`;
}
function fitsCard(keyword: string, value?: string | number | boolean) {
  if (keyword === 'END') return 'END'.padEnd(80);
  const formatted = typeof value === 'string' ? `'${value.replaceAll("'", "''")}'` : typeof value === 'boolean' ? value ? 'T' : 'F' : String(value);
  return `${keyword.padEnd(8)}= ${formatted.padStart(20)}`.padEnd(80).slice(0, 80);
}
function fitsHeader(cards: Array<[string, string | number | boolean]>) { const text = [...cards.map(([key, value]) => fitsCard(key, value)), fitsCard('END')].join(''); return text.padEnd(Math.ceil(text.length / 2880) * 2880, ' '); }
async function tableFits(entries: ExportEntry[], mode: ColumnMode, extraCatalog: ExtraCatalog | null | undefined, report: ProgressReporter, customColumns?: Set<string>) {
  const encoder = new TextEncoder(), columns = exportColumns(mode, extraCatalog, customColumns), definitions = columns.map(column => ({ ...column, width: column.numeric ? 8 : 1 })), batchSize = 1000;
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    const limit = Math.min(entries.length, offset + batchSize);
    for (let rowIndex = offset; rowIndex < limit; rowIndex++) for (const field of definitions) if (!field.numeric) field.width = Math.max(field.width, String(exportValue(entries[rowIndex], field, extraCatalog) ?? '').replace(/[^\x20-\x7e]/g, '?').length);
    report({ percent: Math.round(4 + 31 * limit / Math.max(1, entries.length)), label: `Measuring FITS columns · ${formatCount(limit)} / ${formatCount(entries.length)}` });
    await yieldToBrowser();
  }
  const rowLength = definitions.reduce((sum, field) => sum + field.width, 0), primary = fitsHeader([['SIMPLE', true], ['BITPIX', 8], ['NAXIS', 0], ['EXTEND', true]]);
  const extensionCards: Array<[string, string | number | boolean]> = [['XTENSION', 'BINTABLE'], ['BITPIX', 8], ['NAXIS', 2], ['NAXIS1', rowLength], ['NAXIS2', 1], ['PCOUNT', 0], ['GCOUNT', 1], ['TFIELDS', definitions.length]];
  extensionCards[4][1] = entries.length;
  definitions.forEach((field, index) => { extensionCards.push([`TTYPE${index + 1}`, field.name], [`TFORM${index + 1}`, field.numeric ? 'D' : `${field.width}A`]); });
  const extension = fitsHeader(extensionCards), dataBytes = rowLength * entries.length, data = new Uint8Array(Math.ceil(Math.max(1, dataBytes) / 2880) * 2880); data.fill(32);
  const view = new DataView(data.buffer);
  for (let start = 0; start < entries.length; start += batchSize) {
    const limit = Math.min(entries.length, start + batchSize);
    for (let rowIndex = start; rowIndex < limit; rowIndex++) { let offset = rowIndex * rowLength; for (const field of definitions) { const value = exportValue(entries[rowIndex], field, extraCatalog); if (field.numeric) view.setFloat64(offset, typeof value === 'number' ? value : Number.NaN, false); else data.set(encoder.encode(String(value ?? '').replace(/[^\x20-\x7e]/g, '?')).slice(0, field.width), offset); offset += field.width; } }
    report({ percent: Math.round(35 + 59 * limit / Math.max(1, entries.length)), label: `Writing FITS rows · ${formatCount(limit)} / ${formatCount(entries.length)}` });
    await yieldToBrowser();
  }
  return new Blob([encoder.encode(primary), encoder.encode(extension), data], { type: 'application/fits' });
}
function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 0); }
async function downloadEntries(entries: ExportEntry[], mode: ColumnMode, format: ExportFormat, filename: string, extraCatalog?: ExtraCatalog | null, report: ProgressReporter = () => undefined, customColumns?: Set<string>) {
  report({ percent: 1, label: 'Preparing export…' }); await yieldToBrowser();
  if (format === 'fits') downloadBlob(await tableFits(entries, mode, extraCatalog, report, customColumns), `${filename}.fits`);
  if (format === 'csv') downloadBlob(new Blob([await tableCsv(entries, mode, extraCatalog, report, customColumns)], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
  if (format === 'votable') downloadBlob(new Blob([await tableVotable(entries, mode, extraCatalog, report, customColumns)], { type: 'application/x-votable+xml;charset=utf-8' }), `${filename}.vot`);
  if (format === 'json') downloadBlob(new Blob([await tableJson(entries, mode, extraCatalog, report, customColumns)], { type: 'application/json;charset=utf-8' }), `${filename}.json`);
  report({ percent: 100, label: 'Download started' });
}
function angularSeparation(ra1: number, dec1: number, ra2: number, dec2: number) { const d1 = dec1 * DEG, d2 = dec2 * DEG, dra = (ra1 - ra2) * DEG; return Math.acos(Math.max(-1, Math.min(1, Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(dra)))) / DEG; }
function bestIdentifierMatch(value: string, index: IdentifierIndexEntry[]) { const query = normalizedIdentifier(value); if (!query) return null; let best: { index: number; rank: number; distance: number } | null = null; for (const entry of index) for (const identifier of entry.identifiers) { const rank = identifier.normalized === query ? 0 : identifier.normalized.startsWith(query) ? 1 : identifier.normalized.includes(query) ? 2 : 3; if (rank === 3) continue; const distance = Math.abs(identifier.normalized.length - query.length); if (!best || rank < best.rank || rank === best.rank && distance < best.distance) best = { index: entry.index, rank, distance }; } return best ? best.index : null; }
function magnitude(value: number | null, error: number | null) { return value == null ? '—' : `${value.toFixed(3)}${error == null ? '' : ` ± ${error.toFixed(3)}`} mag`; }
function compactMagnitude(value: number | null, error: number | null) { return value == null ? '—' : `${value.toFixed(3)}${error == null ? '' : ` ± ${error.toFixed(3)}`}`; }
function variability(value: number | null, error: number | null) { return value == null ? '—' : `${value.toFixed(3)}${error == null ? '' : ` ± ${error.toFixed(3)}`}`; }
function sexagesimalRa(degrees: number) {
  const hours = degrees / 15; const h = Math.floor(hours); const m = Math.floor((hours - h) * 60); const s = ((hours - h) * 60 - m) * 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${s.toFixed(2)}s`;
}
function sexagesimalDec(degrees: number) {
  const sign = degrees < 0 ? '−' : '+'; const abs = Math.abs(degrees); const d = Math.floor(abs); const m = Math.floor((abs - d) * 60); const s = ((abs - d) * 60 - m) * 60;
  return `${sign}${String(d).padStart(2, '0')}° ${String(m).padStart(2, '0')}′ ${s.toFixed(1)}″`;
}
function starColor(bpRp: number | null) {
  const c = Math.max(-0.5, Math.min(2.5, bpRp ?? 0));
  if (c < 0.3) { const t = (c + 0.5) / 0.8; return `rgb(${Math.round(126 + 80 * t)},${Math.round(166 + 52 * t)},255)`; }
  if (c < 1.1) { const t = (c - 0.3) / 0.8; return `rgb(${Math.round(206 + 49 * t)},${Math.round(218 + 14 * t)},${Math.round(255 - 74 * t)})`; }
  const t = (c - 1.1) / 1.4; return `rgb(255,${Math.round(232 - 107 * t)},${Math.round(181 - 90 * t)})`;
}
function brightnessRadius(g: number) {
  if (g < 13.1) return 3.35;
  if (g < 14.4) return 2.85;
  if (g < 15.5) return 2.35;
  if (g < 16.1) return 1.9;
  return 1.4;
}
function markerZoomScale(zoom: number) {
  return Math.max(.82, Math.min(1.38, .92 + .16 * Math.log2(zoom + .5)));
}
function pointInPolygon(x: number, y: number, vertices: ScreenPoint[]) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i], b = vertices[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const catalogRef = useRef<Catalog | null>(null);
  const screenRef = useRef<Float32Array | null>(null);
  const projectionRef = useRef<Float32Array | null>(null);
  const camera = useRef({ zoom: 1.05, panX: 0, panY: 0 });
  const targetZoom = useRef(1.05);
  const targetPan = useRef({ x: 0, y: 0 });
  const coordinateFocus = useRef<{ ra: number; dec: number } | null>(null);
  const drag = useRef({ active: false, moved: false, x: 0, y: 0 });
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; midX: number; midY: number; zoom: number; panX: number; panY: number } | null>(null);
  const manualDrag = useRef({ active: false, moved: false, x: 0, y: 0 });
  const manualSelectionRef = useRef<Set<number>>(new Set());
  const frame = useRef(0);
  const zoomFrame = useRef(0);
  const selectedRef = useRef<number | null>(null);
  const selectedRegion = useRef<SelectedRegion | null>(null);
  const initialViewApplied = useRef(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState('Loading catalogue…');
  const [enabled, setEnabled] = useState<Record<Population, boolean>>({ L: true, S: true, B: true });
  const [magMin, setMagMin] = useState(MAG_MIN);
  const [magMax, setMagMax] = useState(MAG_MAX);
  const [colorMin, setColorMin] = useState(COLOR_MIN);
  const [colorMax, setColorMax] = useState(COLOR_MAX);
  const [spectralFilter, setSpectralFilter] = useState<SpectralFilter>('ALL');
  const [objectTypeFilter, setObjectTypeFilter] = useState('ALL');
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [notice, setNotice] = useState('');
  const [globalQueryOpen, setGlobalQueryOpen] = useState(false);
  const [queryInitialScope, setQueryInitialScope] = useState<QueryScope>('view');
  const [tableOpen, setTableOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualTool, setManualTool] = useState<ManualTool>('stars');
  const [manualSelection, setManualSelection] = useState<number[]>([]);
  const [manualBox, setManualBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [manualCircle, setManualCircle] = useState<{ x: number; y: number; radius: number } | null>(null);
  const [manualPolygon, setManualPolygon] = useState<ScreenPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(publicUrl('catalog.json')).then(async r => { if (!r.ok) throw new Error(`${r.status}`); return await r.json() as Catalog; }).then(data => {
      if (cancelled) return;
      const projection = new Float32Array(data.stars.length * 2);
      data.stars.forEach((star, index) => { const position = skyPosition(star[1], star[2]); projection[index * 2] = position.x; projection[index * 2 + 1] = position.y; });
      catalogRef.current = data; projectionRef.current = projection; screenRef.current = new Float32Array(data.stars.length * 3); setCatalog(data); setLoading('Catalogue ready');
    }).catch(() => setLoading('Could not load catalog.json'));
    return () => { cancelled = true; };
  }, []);

  const totalCounts = useMemo(() => { const result = { L: 0, S: 0, B: 0 }; catalog?.stars.forEach(star => result[population(star)]++); return result; }, [catalog]);
  const counts = useMemo(() => { const result = { L: 0, S: 0, B: 0 }; catalog?.stars.forEach(star => { const pop = population(star), g = star[3] ?? 18.5, color = star[4] ?? 0; if (enabled[pop] && g >= magMin && g <= magMax && color >= colorMin && color <= colorMax && matchesSpectral(star, spectralFilter) && matchesObjectType(star, objectTypeFilter)) result[pop]++; }); return result; }, [catalog, colorMax, colorMin, enabled, magMax, magMin, objectTypeFilter, spectralFilter]);
  const visibleCount = counts.L + counts.S + counts.B;
  const filteredIndices = useMemo(() => catalog?.stars.flatMap((star, index) => { const pop = population(star), g = star[3] ?? 18.5, color = star[4] ?? 0; return enabled[pop] && g >= magMin && g <= magMax && color >= colorMin && color <= colorMax && matchesSpectral(star, spectralFilter) && matchesObjectType(star, objectTypeFilter) ? [index] : []; }) ?? [], [catalog, colorMax, colorMin, enabled, magMax, magMin, objectTypeFilter, spectralFilter]);
  const tableIndices = useMemo(() => { if (!manualSelection.length) return filteredIndices; const selectedIndices = new Set(manualSelection); return filteredIndices.filter(index => selectedIndices.has(index)); }, [filteredIndices, manualSelection]);
  const objectTypeOptions = useMemo(() => {
    const typeCounts = new Map<string, number>();
    catalog?.stars.forEach(star => { const rawType = star[13].trim(), type = objectTypeGroup(rawType); if (type && type !== '-99') typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1); });
    return [...typeCounts].filter(([type, count]) => count >= 10 && MASSIVE_STAR_OBJECT_TYPES.has(type)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [catalog]);
  const identifierIndex = useMemo(() => catalog?.stars.map((star, index) => {
    const identifiers = [star[0], star[11] ? `Gaia DR3 ${star[11]}` : '', star[12], ...(catalog.simbadAliases?.[index]?.split('|') ?? [])];
    return { index, identifiers: identifiers.filter(identifier => identifier && identifier !== '-99').map(identifier => ({ label: identifier, normalized: normalizedIdentifier(identifier) })) };
  }) ?? [], [catalog]);
  const searchSuggestions = useMemo<SearchSuggestion[]>(() => {
    if (!catalog) return [];
    const normalizedQuery = normalizedIdentifier(query);
    if (normalizedQuery.length < 2) return [];
    const ranked: Array<{ rank: number; distance: number; order: number; suggestion: SearchSuggestion }> = [];
    const seenClusters = new Set<string>();
    Object.entries(CLUSTERS).forEach(([key, cluster]) => {
      const identity = `${cluster.name}|${cluster.ra}|${cluster.dec}`;
      if (seenClusters.has(identity)) return;
      seenClusters.add(identity);
      const names = [cluster.name, key];
      const matches = names.map(name => normalizedIdentifier(name)).filter(name => name.includes(normalizedQuery));
      if (!matches.length) return;
      const rank = matches.some(name => name === normalizedQuery) ? 0 : matches.some(name => name.startsWith(normalizedQuery)) ? 1 : 2;
      const distance = Math.min(...matches.map(name => Math.abs(name.length - normalizedQuery.length)));
      ranked.push({ rank, distance, order: 0, suggestion: { kind: 'cluster', label: cluster.name, detail: 'Cluster', ra: cluster.ra, dec: cluster.dec, zoom: cluster.zoom, radius: cluster.radius } });
    });
    identifierIndex.forEach(({ index, identifiers }) => {
      const star = catalog.stars[index];
      let best: { identifier: string; rank: number; distance: number } | null = null;
      for (const { label, normalized: candidate } of identifiers) {
        const rank = candidate === normalizedQuery ? 0 : candidate.startsWith(normalizedQuery) ? 1 : candidate.includes(normalizedQuery) ? 2 : 3;
        if (rank === 3) continue;
        const distance = Math.abs(candidate.length - normalizedQuery.length);
        if (!best || rank < best.rank || rank === best.rank && distance < best.distance) best = { identifier: label, rank, distance };
      }
      if (best) ranked.push({ rank: best.rank, distance: best.distance, order: 1, suggestion: { kind: 'star', label: best.identifier, detail: `${star[0]} · ${star[12] || 'SIMBAD source'}`, index } });
    });
    return ranked.sort((a, b) => a.rank - b.rank || a.order - b.order || a.distance - b.distance || a.suggestion.label.localeCompare(b.suggestion.label)).slice(0, 12).map(item => item.suggestion);
  }, [catalog, identifierIndex, query]);

  const draw = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current, stage = stageRef.current, data = catalogRef.current, screen = screenRef.current, projection = projectionRef.current;
      if (!canvas || !stage || !data || !screen || !projection) return;
      const rect = stage.getBoundingClientRect(); const dpr = Math.min(devicePixelRatio || 1, 2); const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; }
      const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
      const { zoom, panX, panY } = camera.current; const scale = Math.min(width, height) * 0.0205 * zoom;
      screen.fill(0);
      for (const i of filteredIndices) {
        const star = data.stars[i], g = star[3] ?? 18.5;
        const x = projection[i * 2], y = projection[i * 2 + 1];
        const sx = width / 2 + panX - x * scale, sy2 = height / 2 + panY - y * scale; const radius = brightnessRadius(g) * markerZoomScale(zoom);
        screen[i * 3] = sx; screen[i * 3 + 1] = sy2; screen[i * 3 + 2] = radius; if (sx < -8 || sy2 < -8 || sx > width + 8 || sy2 > height + 8) continue;
        ctx.globalAlpha = Math.max(.28, Math.min(.94, .32 + (20.5 - g) * .08)); ctx.fillStyle = starColor(star[4]);
        if (radius < 1.8) ctx.fillRect(sx, sy2, Math.max(1, radius), Math.max(1, radius)); else { ctx.beginPath(); ctx.arc(sx, sy2, radius, 0, Math.PI * 2); ctx.fill(); if (radius > 2.8) { ctx.globalAlpha = .09; ctx.beginPath(); ctx.arc(sx, sy2, radius * 2.7, 0, Math.PI * 2); ctx.fill(); } }
      }
      const region = selectedRegion.current;
      if (region) {
        const position = skyPosition(region.ra, region.dec), x = width / 2 + panX - position.x * scale, y = height / 2 + panY - position.y * scale, regionRadius = region.radius * DEG * 54 * scale * CLUSTER_MARKER_PADDING;
        if (x + regionRadius > 0 && x - regionRadius < width && y + regionRadius > 0 && y - regionRadius < height) {
          ctx.save();
          ctx.setLineDash([8, 6]); ctx.globalAlpha = .82; ctx.strokeStyle = '#02070b'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(x, y, regionRadius, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1; ctx.strokeStyle = '#78eaf5'; ctx.lineWidth = 1.6; ctx.shadowColor = '#5defff'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(x, y, regionRadius, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.font = '600 10px Arial'; ctx.lineWidth = 4; ctx.strokeStyle = '#05090e'; ctx.strokeText(region.name, x, y - regionRadius - 7); ctx.fillStyle = '#bdf8ff'; ctx.fillText(region.name, x, y - regionRadius - 7);
          ctx.restore();
        }
      }
      if (manualMode) manualSelectionRef.current.forEach(index => {
        if (screen[index * 3 + 2] <= 0) return;
        const x = screen[index * 3], y = screen[index * 3 + 1], radius = Math.max(6, screen[index * 3 + 2] + 3);
        if (x < -radius || y < -radius || x > width + radius || y > height + radius) return;
        ctx.save(); ctx.globalAlpha = .95; ctx.strokeStyle = '#ff9eea'; ctx.lineWidth = 1.4; ctx.shadowColor = '#ff79df'; ctx.shadowBlur = 7; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      });
      const selectedIndex = selectedRef.current;
      if (selectedIndex != null && screen[selectedIndex * 3 + 2] > 0) {
        const x = screen[selectedIndex * 3], y = screen[selectedIndex * 3 + 1], r = screen[selectedIndex * 3 + 2], targetRadius = Math.max(10, r + 6), tickStart = targetRadius + 4, tickEnd = targetRadius + 10;
        ctx.save();
        ctx.globalAlpha = .88; ctx.strokeStyle = '#02070b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, targetRadius, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1; ctx.strokeStyle = '#89f3ff'; ctx.lineWidth = 1.5; ctx.shadowColor = '#5defff'; ctx.shadowBlur = 9; ctx.beginPath(); ctx.arc(x, y, targetRadius, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#f4feff'; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(x - tickEnd, y); ctx.lineTo(x - tickStart, y); ctx.moveTo(x + tickStart, y); ctx.lineTo(x + tickEnd, y); ctx.moveTo(x, y - tickEnd); ctx.lineTo(x, y - tickStart); ctx.moveTo(x, y + tickStart); ctx.lineTo(x, y + tickEnd); ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    });
  }, [filteredIndices, manualMode]);

  useEffect(() => { draw(); }, [catalog, draw]);
  useEffect(() => {
    if (!catalog || initialViewApplied.current) return;
    initialViewApplied.current = true;
    const animationFrame = requestAnimationFrame(() => {
      const stage = stageRef.current; if (!stage) return;
      const rect = stage.getBoundingClientRect(), position = skyPosition(ALL_VIEW.ra, ALL_VIEW.dec), scale = Math.min(rect.width, rect.height) * .0205 * ALL_VIEW.zoom;
      const pan = { x: position.x * scale, y: position.y * scale + ALL_VIEW.offsetY };
      camera.current = { zoom: ALL_VIEW.zoom, panX: pan.x, panY: pan.y }; targetZoom.current = ALL_VIEW.zoom; targetPan.current = pan; coordinateFocus.current = null; draw();
    });
    return () => cancelAnimationFrame(animationFrame);
  }, [catalog, draw]);
  useEffect(() => { const observer = new ResizeObserver(draw); if (stageRef.current) observer.observe(stageRef.current); return () => observer.disconnect(); }, [draw]);
  useEffect(() => () => cancelAnimationFrame(zoomFrame.current), []);
  function commitManualSelection(next: Set<number>) { manualSelectionRef.current = next; setManualSelection([...next]); draw(); }
  function resetManualShape() { setManualBox(null); setManualCircle(null); setManualPolygon([]); }
  function chooseManualTool(tool: ManualTool) { setManualTool(tool); resetManualShape(); }
  function selectNearestManualStar(x: number, y: number) {
    const screen = screenRef.current; if (!screen) return;
    let best = -1, bestDistance = 121;
    for (const index of filteredIndices) { if (screen[index * 3 + 2] <= 0) continue; const dx = screen[index * 3] - x, dy = screen[index * 3 + 1] - y, distance = dx * dx + dy * dy; if (distance < bestDistance) { best = index; bestDistance = distance; } }
    if (best < 0) return; const next = new Set(manualSelectionRef.current); if (next.has(best)) next.delete(best); else next.add(best); commitManualSelection(next);
  }
  function applyManualPolygon() {
    const screen = screenRef.current; if (!screen || manualPolygon.length < 3) return;
    const next = new Set(manualSelectionRef.current);
    for (const index of filteredIndices) if (screen[index * 3 + 2] > 0 && pointInPolygon(screen[index * 3], screen[index * 3 + 1], manualPolygon)) next.add(index);
    setManualPolygon([]); commitManualSelection(next);
  }
  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.current.size >= 2) {
      const [a, b] = [...activePointers.current.values()], rect = event.currentTarget.getBoundingClientRect();
      pinch.current = { distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), midX: (a.x + b.x) / 2 - rect.left - rect.width / 2, midY: (a.y + b.y) / 2 - rect.top - rect.height / 2, zoom: camera.current.zoom, panX: camera.current.panX, panY: camera.current.panY };
      drag.current.active = false; manualDrag.current.active = false; setManualBox(null); setManualCircle(null); return;
    }
    if (manualMode) {
      const rect = event.currentTarget.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
      manualDrag.current = { active: true, moved: false, x, y };
      if (manualTool === 'rectangle') setManualBox({ x1: x, y1: y, x2: x, y2: y });
      if (manualTool === 'circle') setManualCircle({ x, y, radius: 0 });
      return;
    }
    drag.current = { active: true, moved: false, x: event.clientX, y: event.clientY };
  }
  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (activePointers.current.has(event.pointerId)) activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current && activePointers.current.size >= 2) {
      const [a, b] = [...activePointers.current.values()], rect = event.currentTarget.getBoundingClientRect(), currentDistance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), ratio = currentDistance / pinch.current.distance;
      const nextZoom = Math.max(.3, Math.min(14_000, pinch.current.zoom * ratio)), appliedRatio = nextZoom / pinch.current.zoom;
      const midX = (a.x + b.x) / 2 - rect.left - rect.width / 2, midY = (a.y + b.y) / 2 - rect.top - rect.height / 2;
      cancelAnimationFrame(zoomFrame.current); coordinateFocus.current = null;
      camera.current = { zoom: nextZoom, panX: pinch.current.panX * appliedRatio + pinch.current.midX * (1 - appliedRatio) + midX - pinch.current.midX, panY: pinch.current.panY * appliedRatio + pinch.current.midY * (1 - appliedRatio) + midY - pinch.current.midY };
      targetZoom.current = nextZoom; targetPan.current = { x: camera.current.panX, y: camera.current.panY }; draw(); return;
    }
    if (manualMode) {
      if (!manualDrag.current.active) return;
      const rect = event.currentTarget.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
      if (Math.abs(x - manualDrag.current.x) + Math.abs(y - manualDrag.current.y) > 4) manualDrag.current.moved = true;
      if (manualTool === 'rectangle') setManualBox({ x1: manualDrag.current.x, y1: manualDrag.current.y, x2: x, y2: y });
      if (manualTool === 'circle') setManualCircle({ x: manualDrag.current.x, y: manualDrag.current.y, radius: Math.hypot(x - manualDrag.current.x, y - manualDrag.current.y) });
      return;
    }
    if (!drag.current.active) return; const dx = event.clientX - drag.current.x, dy = event.clientY - drag.current.y; if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true; camera.current.panX += dx; camera.current.panY += dy; targetPan.current = { x: camera.current.panX, y: camera.current.panY }; coordinateFocus.current = null; drag.current.x = event.clientX; drag.current.y = event.clientY; draw();
  }
  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    const wasPinching = pinch.current != null;
    activePointers.current.delete(event.pointerId);
    if (wasPinching) {
      pinch.current = null; drag.current.active = false; manualDrag.current.active = false;
      const remaining = [...activePointers.current.values()][0];
      if (remaining && !manualMode) drag.current = { active: true, moved: true, x: remaining.x, y: remaining.y };
      return;
    }
    if (manualMode) {
      if (!manualDrag.current.active) return; manualDrag.current.active = false;
      const screen = screenRef.current, rect = event.currentTarget.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
      if (manualTool === 'stars' && !manualDrag.current.moved) { selectNearestManualStar(x, y); return; }
      if (manualTool === 'polygon' && !manualDrag.current.moved) { setManualPolygon(points => [...points, { x, y }]); return; }
      if (!screen || !manualDrag.current.moved) { setManualBox(null); setManualCircle(null); return; }
      const next = new Set(manualSelectionRef.current);
      if (manualTool === 'rectangle') { const left = Math.min(manualDrag.current.x, x), right = Math.max(manualDrag.current.x, x), top = Math.min(manualDrag.current.y, y), bottom = Math.max(manualDrag.current.y, y); for (const index of filteredIndices) if (screen[index * 3 + 2] > 0 && screen[index * 3] >= left && screen[index * 3] <= right && screen[index * 3 + 1] >= top && screen[index * 3 + 1] <= bottom) next.add(index); }
      if (manualTool === 'circle') { const radius = Math.hypot(x - manualDrag.current.x, y - manualDrag.current.y), radiusSquared = radius * radius; for (const index of filteredIndices) { if (screen[index * 3 + 2] <= 0) continue; const dx = screen[index * 3] - manualDrag.current.x, dy = screen[index * 3 + 1] - manualDrag.current.y; if (dx * dx + dy * dy <= radiusSquared) next.add(index); } }
      setManualBox(null); setManualCircle(null); commitManualSelection(next); return;
    }
    if (!drag.current.active) return; drag.current.active = false; if (!drag.current.moved) pickStar(event.clientX, event.clientY);
  }
  function panForCoordinates(ra: number, dec: number, zoom: number) {
    const stage = stageRef.current; if (!stage) return targetPan.current;
    const rect = stage.getBoundingClientRect(), { x, y } = skyPosition(ra, dec), scale = Math.min(rect.width, rect.height) * .0205 * zoom;
    return { x: x * scale, y: y * scale };
  }
  function setSmoothZoom(nextZoom: number, focusOverride?: { ra: number; dec: number } | null, panOverride?: { x: number; y: number }) {
    const previousTargetZoom = targetZoom.current;
    targetZoom.current = Math.max(.3, Math.min(14_000, nextZoom));
    const selectedStar = selected == null ? null : catalogRef.current?.stars[selected] ?? null;
    const focus = focusOverride === null ? null : focusOverride ?? coordinateFocus.current ?? (selectedStar ? { ra: selectedStar[1], dec: selectedStar[2] } : null);
    if (panOverride) targetPan.current = panOverride;
    else if (focus) { coordinateFocus.current = focus; targetPan.current = panForCoordinates(focus.ra, focus.dec, targetZoom.current); }
    else { const ratio = targetZoom.current / Math.max(previousTargetZoom, .0001); targetPan.current = { x: targetPan.current.x * ratio, y: targetPan.current.y * ratio }; }
    cancelAnimationFrame(zoomFrame.current);
    const step = () => {
      const zoomDifference = targetZoom.current - camera.current.zoom, panXDifference = targetPan.current.x - camera.current.panX, panYDifference = targetPan.current.y - camera.current.panY;
      if (Math.abs(zoomDifference) <= Math.max(.0005, targetZoom.current * .0005) && Math.abs(panXDifference) < .1 && Math.abs(panYDifference) < .1) { camera.current.zoom = targetZoom.current; camera.current.panX = targetPan.current.x; camera.current.panY = targetPan.current.y; draw(); return; }
      camera.current.zoom += zoomDifference * .24; camera.current.panX += panXDifference * .24; camera.current.panY += panYDifference * .24;
      draw();
      zoomFrame.current = requestAnimationFrame(step);
    };
    zoomFrame.current = requestAnimationFrame(step);
  }
  function onWheel(event: WheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect(), modeScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1, sensitivity = event.ctrlKey ? .003 : .00065;
    const previousZoom = targetZoom.current, nextZoom = Math.max(.3, Math.min(14_000, previousZoom * Math.exp(-event.deltaY * modeScale * sensitivity))), ratio = nextZoom / previousZoom;
    const selectedStar = selectedRef.current == null ? null : catalogRef.current?.stars[selectedRef.current];
    if (selectedStar) { const focus = { ra: selectedStar[1], dec: selectedStar[2] }; coordinateFocus.current = focus; setSmoothZoom(nextZoom, focus); return; }
    const cursorX = event.clientX - rect.left - rect.width / 2, cursorY = event.clientY - rect.top - rect.height / 2;
    const pan = { x: targetPan.current.x * ratio + cursorX * (1 - ratio), y: targetPan.current.y * ratio + cursorY * (1 - ratio) };
    coordinateFocus.current = null;
    setSmoothZoom(nextZoom, null, pan);
  }
  function zoomBy(factor: number) { setSmoothZoom(targetZoom.current * factor); }
  function focusRegion(ra: number, dec: number, zoom: number) { coordinateFocus.current = { ra, dec }; targetPan.current = panForCoordinates(ra, dec, zoom); setSmoothZoom(zoom, { ra, dec }); }
  function frameCloud(cloud: keyof typeof CLOUD_VIEWS) { const view = CLOUD_VIEWS[cloud]; selectedRegion.current = null; setNotice(`Focused on the ${cloud}`); focusRegion(view.ra, view.dec, view.zoom); }
  function frameAll() { const systemCenter = { ra: ALL_VIEW.ra, dec: ALL_VIEW.dec }, basePan = panForCoordinates(systemCenter.ra, systemCenter.dec, ALL_VIEW.zoom), pan = { x: basePan.x, y: basePan.y + ALL_VIEW.offsetY }; selectedRegion.current = null; setNotice(''); setSmoothZoom(ALL_VIEW.zoom, systemCenter, pan); coordinateFocus.current = null; }
  function updateSelection(index: number | null) { if (index != null) selectedRegion.current = null; selectedRef.current = index; setSelected(index); }
  function pickStar(clientX: number, clientY: number) { const rect = canvasRef.current?.getBoundingClientRect(), screen = screenRef.current; if (!rect || !screen || !catalog) return; const x = clientX - rect.left, y = clientY - rect.top; let best = -1, bestD = 121; for (let i = 0; i < catalog.stars.length; i++) { if (!screen[i * 3 + 2]) continue; const dx = screen[i * 3] - x, dy = screen[i * 3 + 1] - y, d = dx * dx + dy * dy; if (d < bestD) { bestD = d; best = i; } } selectedRegion.current = null; if (best >= 0) { coordinateFocus.current = { ra: catalog.stars[best][1], dec: catalog.stars[best][2] }; updateSelection(best); } else { coordinateFocus.current = null; updateSelection(null); } draw(); }
  function toggle(pop: Population) { setEnabled(current => ({ ...current, [pop]: !current[pop] })); }
  function clearSelection() { selectedRegion.current = null; updateSelection(null); coordinateFocus.current = null; targetPan.current = { x: camera.current.panX, y: camera.current.panY }; draw(); }
  function resetView() { setMagMin(MAG_MIN); setMagMax(MAG_MAX); setColorMin(COLOR_MIN); setColorMax(COLOR_MAX); setSpectralFilter('ALL'); setObjectTypeFilter('ALL'); setEnabled({ L: true, S: true, B: true }); updateSelection(null); setNotice(''); frameAll(); }
  function focusStar(index: number) {
    const match = catalog?.stars[index]; if (!match) return;
    const pop = population(match), color = match[4] ?? 0, g = match[3] ?? 18.5;
    setEnabled(v => ({ ...v, [pop]: true })); setMagMin(Math.min(magMin, g)); setMagMax(Math.max(magMax, g)); setColorMin(Math.min(colorMin, color)); setColorMax(Math.max(colorMax, color)); setSpectralFilter('ALL'); setObjectTypeFilter('ALL'); updateSelection(index); coordinateFocus.current = { ra: match[1], dec: match[2] }; setNotice(''); setShowSuggestions(false); focusRegion(match[1], match[2], 28);
  }
  function selectTableStar(index: number) { const match = catalog?.stars[index]; if (!match) return; updateSelection(index); coordinateFocus.current = { ra: match[1], dec: match[2] }; setNotice(''); setTableOpen(false); requestAnimationFrame(() => focusRegion(match[1], match[2], 28)); }
  function focusCluster(suggestion: Extract<SearchSuggestion, { kind: 'cluster' }>) {
    updateSelection(null); selectedRegion.current = { name: suggestion.label, ra: suggestion.ra, dec: suggestion.dec, radius: suggestion.radius }; setNotice(`Focused on ${suggestion.label}`); setShowSuggestions(false); focusRegion(suggestion.ra, suggestion.dec, suggestion.zoom);
  }
  function chooseSuggestion(suggestion: SearchSuggestion) {
    setQuery(suggestion.label);
    if (suggestion.kind === 'cluster') focusCluster(suggestion); else focusStar(suggestion.index);
  }
  function search(event: FormEvent) {
    event.preventDefault(); const rawValue = query.trim(), value = rawValue.toLowerCase(); if (!catalog || !value) return;
    const cluster = CLUSTERS[clusterKey(rawValue)];
    if (cluster) { focusCluster({ kind: 'cluster', label: cluster.name, detail: 'Cluster', ra: cluster.ra, dec: cluster.dec, zoom: cluster.zoom, radius: cluster.radius }); return; }
    const coordinates = parseCoordinates(rawValue);
    if (coordinates) { selectedRegion.current = null; updateSelection(null); setNotice(`Focused on RA ${coordinates.ra.toFixed(4)}°, Dec ${coordinates.dec.toFixed(4)}°`); focusRegion(coordinates.ra, coordinates.dec, 24); return; }
    if (searchSuggestions.length) { chooseSuggestion(searchSuggestions[0]); return; }
    setNotice('No matching source, cluster or coordinates found');
  }
  function openQuery(scope: QueryScope = selected == null ? 'view' : 'selected') { setQueryInitialScope(scope); setGlobalQueryOpen(true); }
  function startManualSelection() { setGlobalQueryOpen(false); setTableOpen(false); setManualMode(true); resetManualShape(); draw(); }
  function cancelManualSelection() { setManualMode(false); resetManualShape(); commitManualSelection(new Set()); }
  function queryManualSelection() { setManualMode(false); resetManualShape(); openQuery('manual'); }
  function toggleTableView() { if (tableOpen) { setTableOpen(false); return; } setManualMode(false); resetManualShape(); setTableOpen(true); }
  function currentViewIndices() { const screen = screenRef.current, stage = stageRef.current; if (!screen || !stage || !catalog) return []; const rect = stage.getBoundingClientRect(); return catalog.stars.flatMap((_, index) => screen[index * 3 + 2] > 0 && screen[index * 3] >= 0 && screen[index * 3] <= rect.width && screen[index * 3 + 1] >= 0 && screen[index * 3 + 1] <= rect.height ? [index] : []); }
  const star = selected == null ? null : catalog?.stars[selected] ?? null;

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark" aria-hidden="true"><i /><i /><i /></div><div className="catalog-heading"><h1>ALS IV: <span>Census of massive stars in the Magellanic Clouds</span></h1><p className="byline"><a href="https://arxiv.org/abs/2611.32808" target="_blank" rel="noreferrer">By J. A. Molina-Calzada ↗</a></p></div><div className="header-actions"><div className="catalog-view-buttons"><button type="button" className={`catalog-query-button ${tableOpen ? 'active' : ''}`} onClick={toggleTableView}>Table</button><button type="button" className="catalog-query-button" onClick={() => openQuery()}>Query</button><button type="button" className={`catalog-query-button ${manualMode ? 'active manual' : ''}`} onClick={() => manualMode ? cancelManualSelection() : startManualSelection()} title="Select stars or draw a region on the map" aria-pressed={manualMode}>Select</button></div><div className="catalog-status"><b>{catalog ? formatCount(visibleCount) : '—'} <em>/ {catalog ? formatCount(catalog.stars.length) : '—'}</em></b><span>visible / full catalogue</span></div></div></header>
    <section className="workspace">
      <aside className="control-panel"><div className="panel-heading"><span>Explore</span><button onClick={resetView}>Reset</button></div><div className="search-wrap"><form className="search-box" onSubmit={search}><span>⌕</span><input value={query} onFocus={() => setShowSuggestions(true)} onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }} onBlur={() => setShowSuggestions(false)} aria-label="Search sources, clusters or coordinates" placeholder="ID, cluster, RA Dec" autoComplete="off" /></form>{showSuggestions && query.trim().length >= 2 && <div className="search-suggestions" role="listbox">{searchSuggestions.length ? searchSuggestions.map((suggestion, index) => <button key={`${suggestion.kind}-${suggestion.label}-${index}`} type="button" role="option" aria-selected="false" onMouseDown={event => event.preventDefault()} onClick={() => chooseSuggestion(suggestion)}><span>{suggestion.label}</span><small>{suggestion.detail}</small></button>) : <p>No matching names</p>}</div>}</div>{notice && <p className="notice">{notice}</p>}
        <div className="control-group"><p>Population</p><button className={`filter-row ${enabled.L ? 'active' : ''}`} onClick={() => toggle('L')}>LMC <b>{formatCount(counts.L)} <em>/ {formatCount(totalCounts.L)}</em></b></button><button className={`filter-row ${enabled.S ? 'active' : ''}`} onClick={() => toggle('S')}>SMC <b>{formatCount(counts.S)} <em>/ {formatCount(totalCounts.S)}</em></b></button><button className={`filter-row ${enabled.B ? 'active' : ''}`} onClick={() => toggle('B')}>Bridge <b>{formatCount(counts.B)} <em>/ {formatCount(totalCounts.B)}</em></b></button></div>
        <div className="control-group classification-filters"><p>Spectral type</p><select className="spectral-select" value={spectralFilter} onChange={e => setSpectralFilter(e.target.value as SpectralFilter)} aria-label="Filter by spectral type"><option value="ALL">All types</option><optgroup label="Individual types"><option value="WR">WR</option><option value="O">O</option><option value="B">B</option><option value="A">A</option><option value="F">F</option><option value="G">G</option><option value="K">K</option><option value="M">M</option></optgroup><optgroup label="Ranges"><option value="HOT">Hot stars · WR + OBA</option><option value="COOL">Cool stars · FGKM</option></optgroup></select><p className="classification-subheading">Object type · SIMBAD</p><select className="spectral-select" value={objectTypeFilter} onChange={e => setObjectTypeFilter(e.target.value)} aria-label="Filter by SIMBAD object type"><option value="ALL">All Object Types</option>{objectTypeOptions.map(([type]) => <option key={type} value={type}>{objectTypeLabel(type)}</option>)}</select></div>
        <div className="control-group"><p>G magnitude range</p><div className="color-values"><b>{magMin.toFixed(1)}</b><span>minimum — maximum</span><b>{magMax.toFixed(1)}</b></div><div className="dual-range"><div className="dual-mag-track" /><input type="range" min={MAG_MIN} max={MAG_MAX} step="0.1" value={magMin} onChange={e => setMagMin(Math.min(Number(e.target.value), magMax - 0.1))} aria-label="Minimum G magnitude" /><input type="range" min={MAG_MIN} max={MAG_MAX} step="0.1" value={magMax} onChange={e => setMagMax(Math.max(Number(e.target.value), magMin + 0.1))} aria-label="Maximum G magnitude" /></div><div className="range-labels"><span>brighter</span><span>fainter</span></div></div>
        <div className="control-group"><p>BP−RP colour range</p><div className="color-values"><b>{colorMin.toFixed(2)}</b><span>minimum — maximum</span><b>{colorMax.toFixed(2)}</b></div><div className="dual-range"><div className="dual-color-track" /><input type="range" min={COLOR_MIN} max={COLOR_MAX} step="0.05" value={colorMin} onChange={e => setColorMin(Math.min(Number(e.target.value), colorMax - 0.05))} aria-label="Minimum BP-RP colour" /><input type="range" min={COLOR_MIN} max={COLOR_MAX} step="0.05" value={colorMax} onChange={e => setColorMax(Math.max(Number(e.target.value), colorMin + 0.05))} aria-label="Maximum BP-RP colour" /></div><div className="range-labels"><span>blue</span><span>red</span></div></div>
        <div className="control-group legend"><p>Synthetic photometry</p><div className="gradient" /><div className="legend-labels"><span>blue · BP−RP</span><span>red</span></div><div className="size-key"><i /><i /><i /><i /><i /><span>5 levels · G brightness</span></div></div></aside>
      <section className={`sky-stage ${manualMode ? 'manual-selecting' : ''}`} ref={stageRef}>
        <canvas ref={canvasRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={event => { activePointers.current.delete(event.pointerId); pinch.current = null; drag.current.active = false; manualDrag.current.active = false; setManualBox(null); setManualCircle(null); }} onWheel={onWheel} aria-label="Interactive 2D stellar map" />
        {manualBox && <div className="manual-selection-box" style={{ left: Math.min(manualBox.x1, manualBox.x2), top: Math.min(manualBox.y1, manualBox.y2), width: Math.abs(manualBox.x2 - manualBox.x1), height: Math.abs(manualBox.y2 - manualBox.y1) }} />}
        {manualCircle && <div className="manual-selection-circle" style={{ left: manualCircle.x - manualCircle.radius, top: manualCircle.y - manualCircle.radius, width: manualCircle.radius * 2, height: manualCircle.radius * 2 }} />}
        {manualPolygon.length > 0 && <svg className="manual-polygon-overlay" aria-hidden="true">{manualPolygon.length >= 3 ? <polygon points={manualPolygon.map(point => `${point.x},${point.y}`).join(' ')} /> : <polyline points={manualPolygon.map(point => `${point.x},${point.y}`).join(' ')} />}{manualPolygon.map((point, index) => <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="3" />)}</svg>}
        <div className="stage-label"><span className={`pulse ${catalog ? '' : 'loading'}`} />{catalog ? manualMode ? `Manual selection · ${manualTool}` : 'Sky projection · full catalogue' : loading}</div>
        {manualMode && <div className="manual-toolbar">
          <div className="manual-count"><b>{formatCount(manualSelection.length)}</b><span>selected</span></div>
          <div className="manual-tools" aria-label="Manual selection tool"><button type="button" className={manualTool === 'stars' ? 'active' : ''} onClick={() => chooseManualTool('stars')}>Stars</button><button type="button" className={manualTool === 'rectangle' ? 'active' : ''} onClick={() => chooseManualTool('rectangle')}>Rectangle</button><button type="button" className={manualTool === 'circle' ? 'active' : ''} onClick={() => chooseManualTool('circle')}>Circle</button><button type="button" className={manualTool === 'polygon' ? 'active' : ''} onClick={() => chooseManualTool('polygon')}>Polygon</button></div>
          {manualTool === 'polygon' && <div className="polygon-actions"><button type="button" disabled={!manualPolygon.length} onClick={() => setManualPolygon(points => points.slice(0, -1))}>Undo vertex</button><button type="button" disabled={manualPolygon.length < 3} onClick={applyManualPolygon}>Apply polygon</button></div>}
          <div className="manual-actions"><button type="button" onClick={() => commitManualSelection(new Set())}>Clear</button><button type="button" onClick={cancelManualSelection}>Cancel</button><button type="button" className="primary" disabled={!manualSelection.length} onClick={queryManualSelection}>Open Query</button></div>
        </div>}
        <div className="orientation"><span>N</span><i /><span>E</span></div><div className="map-controls"><div className="region-controls" aria-label="Map framing presets"><button type="button" onClick={() => frameCloud('LMC')}>LMC</button><button type="button" onClick={() => frameCloud('SMC')}>SMC</button><button type="button" onClick={frameAll}>All</button></div><div className="zoom-controls" aria-label="Map zoom controls"><button type="button" onClick={() => zoomBy(1.16)} aria-label="Zoom in">+</button><button type="button" onClick={() => zoomBy(1 / 1.16)} aria-label="Zoom out">−</button></div></div>
        <div className="view-chip">{manualMode ? manualTool === 'stars' ? 'Click stars to add or remove them' : manualTool === 'rectangle' ? 'Drag to draw a rectangular selection' : manualTool === 'circle' ? 'Drag from the centre to draw a circular selection' : 'Click to add vertices, then apply the polygon' : 'Drag to pan · scroll or pinch to zoom · click a star'}</div>
      </section>
      <aside className="detail-panel"><div className="detail-title"><p className="eyebrow">Source inspector</p>{star && <button onClick={clearSelection} aria-label="Close">×</button>}</div>{!star ? <div className="empty-selection"><div className="target-icon">⌖</div><h2>Select a star</h2><p>Click a source to inspect its astrometry, photometry and cross-identifiers.</p></div> : <StarDetails star={star} rowIndex={selected ?? 0} simbadIds={selected == null ? '' : catalog?.simbadIds?.[selected] ?? catalog?.simbadAliases?.[selected] ?? ''} />}</aside>
    </section>
    {tableOpen && catalog && <CatalogTable catalog={catalog} indices={tableIndices} manualSelection={manualSelection.length > 0} onClearManual={() => commitManualSelection(new Set())} onClose={() => setTableOpen(false)} onSelect={selectTableStar} />}
    {globalQueryOpen && catalog && <CatalogQueryDialog catalog={catalog} selected={selected} identifierIndex={identifierIndex} filteredIndices={filteredIndices} currentViewIndices={currentViewIndices} initialScope={queryInitialScope} manualIndices={manualSelection} onStartManual={startManualSelection} onClose={() => setGlobalQueryOpen(false)} />}
  </main>;
}

type TableColumn = 'id' | 'simbad' | 'ra' | 'dec' | 'g' | 'color' | 'sample' | 'spectral' | 'otype';

function CatalogTable({ catalog, indices, manualSelection, onClearManual, onSelect, onClose }: { catalog: Catalog; indices: number[]; manualSelection: boolean; onClearManual: () => void; onSelect: (index: number) => void; onClose: () => void }) {
  const [search, setSearch] = useState(''), deferredSearch = useDeferredValue(search), [sortColumn, setSortColumn] = useState<TableColumn | null>(null), [ascending, setAscending] = useState(true), [page, setPage] = useState(0);
  const pageSize = 100;
  const rows = useMemo(() => {
    const needle = normalizedIdentifier(deferredSearch), values = indices.filter(index => { if (!needle) return true; const star = catalog.stars[index], text = [star[0], star[11], star[12], star[13], objectTypeLabel(star[13]), star[14], catalog.simbadAliases?.[index]].join(' '); return normalizedIdentifier(text).includes(needle); });
    if (sortColumn == null) return values;
    const value = (index: number): string | number => { const star = catalog.stars[index]; if (sortColumn === 'id') return star[0]; if (sortColumn === 'simbad') return star[12]; if (sortColumn === 'ra') return star[1]; if (sortColumn === 'dec') return star[2]; if (sortColumn === 'g') return star[3] ?? Number.POSITIVE_INFINITY; if (sortColumn === 'color') return star[4] ?? Number.POSITIVE_INFINITY; if (sortColumn === 'sample') return star[10]; if (sortColumn === 'spectral') return star[14]; return objectTypeLabel(star[13]); };
    return values.sort((a, b) => { const av = value(a), bv = value(b), comparison = typeof av === 'number' && typeof bv === 'number' ? av - bv : NATURAL_COLLATOR.compare(String(av), String(bv)); return ascending ? comparison : -comparison; });
  }, [ascending, catalog, deferredSearch, indices, sortColumn]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize)), safePage = Math.min(page, pages - 1), visibleRows = rows.slice(safePage * pageSize, (safePage + 1) * pageSize);
  function sort(column: TableColumn) { setPage(0); if (sortColumn === column) setAscending(value => !value); else { setSortColumn(column); setAscending(true); } }
  const heading = (column: TableColumn, label: string) => <button type="button" onClick={() => sort(column)}>{label}{sortColumn === column ? ascending ? ' ↑' : ' ↓' : ''}</button>;
  return <section className="catalog-table-view" aria-label="Interactive catalogue table"><header><div><p className="eyebrow">{manualSelection ? 'Manual selection' : 'Filtered catalogue'}</p><h2>ALS IV Table</h2></div><div className="table-header-actions"><label><span>⌕</span><input value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="Search IDs or classifications" /></label><button type="button" className="table-close" onClick={onClose} aria-label="Close catalogue table">×</button></div></header><div className="table-summary"><b>{formatCount(rows.length)}</b><span>{manualSelection ? 'manually selected sources matching the active filters' : 'matching the active filters'}</span>{manualSelection && <button type="button" className="table-scope-reset" onClick={onClearManual}>Show filtered sample</button>}<em>Click a row to inspect and centre its source</em></div><div className="catalog-table-scroll"><table><thead><tr><th>{heading('id', 'ALS IV ID')}</th><th>{heading('simbad', 'SIMBAD')}</th><th>{heading('ra', 'RA · deg')}</th><th>{heading('dec', 'Dec · deg')}</th><th>{heading('g', 'G')}</th><th>{heading('color', 'BP−RP')}</th><th>{heading('sample', 'Sample')}</th><th>{heading('spectral', 'Sp. type')}</th><th>{heading('otype', 'Object type')}</th></tr></thead><tbody>{visibleRows.map(index => { const star = catalog.stars[index]; return <tr key={index} onClick={() => onSelect(index)} tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') onSelect(index); }}><td>{star[0]}</td><td>{star[12] || '—'}</td><td>{star[1].toFixed(6)}</td><td>{star[2].toFixed(6)}</td><td>{star[3]?.toFixed(3) ?? '—'}</td><td>{star[4]?.toFixed(3) ?? '—'}</td><td>{star[10]}</td><td>{star[14] || '—'}</td><td>{objectTypeLabel(star[13])}</td></tr>; })}</tbody></table></div><footer><span>Page {safePage + 1} / {pages}</span><div><button type="button" disabled={safePage === 0} onClick={() => setPage(Math.max(0, safePage - 1))}>Previous</button><button type="button" disabled={safePage >= pages - 1} onClick={() => setPage(Math.min(pages - 1, safePage + 1))}>Next</button></div></footer></section>;
}

function ColumnSelector({ mode, setMode, selected, setSelected }: { mode: ColumnMode; setMode: (mode: ColumnMode) => void; selected: Set<string>; setSelected: (columns: Set<string>) => void }) {
  const [search, setSearch] = useState('');
  const visibleColumns = FULL_COLUMN_ORDER.filter(name => name.toLowerCase().includes(search.trim().toLowerCase()));
  function toggle(name: string) { const next = new Set(selected); if (next.has(name)) next.delete(name); else next.add(name); setSelected(next); }
  return <div className="query-columns"><span>Columns</span><div className="query-column-modes"><button type="button" className={mode === 'main' ? 'active' : ''} onClick={() => setMode('main')}><b>Main</b><small>{MAIN_EXPORT_NAMES.size} essential fields</small></button><button type="button" className={mode === 'custom' ? 'active' : ''} onClick={() => setMode('custom')}><b>Custom</b><small>{selected.size} selected fields</small></button><button type="button" className={mode === 'all' ? 'active' : ''} onClick={() => setMode('all')}><b>All</b><small>{FULL_COLUMN_ORDER.length} catalogue fields</small></button></div>{mode === 'custom' && <div className="custom-columns"><div className="custom-column-actions"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a column…" aria-label="Find a catalogue column" /><button type="button" onClick={() => setSelected(new Set(MAIN_EXPORT_NAMES))}>Main</button><button type="button" onClick={() => setSelected(new Set(FULL_COLUMN_ORDER))}>All</button><button type="button" onClick={() => setSelected(new Set())}>Clear</button></div><div className="custom-column-list">{visibleColumns.map(name => <label key={name}><input type="checkbox" checked={selected.has(name)} onChange={() => toggle(name)} /><span>{name}</span></label>)}</div><p>{selected.size} of {FULL_COLUMN_ORDER.length} columns selected</p></div>}</div>;
}

function CatalogQueryDialog({ catalog, selected, identifierIndex, filteredIndices, currentViewIndices, initialScope, manualIndices, onStartManual, onClose }: { catalog: Catalog; selected: number | null; identifierIndex: IdentifierIndexEntry[]; filteredIndices: number[]; currentViewIndices: () => number[]; initialScope: QueryScope; manualIndices: number[]; onStartManual: () => void; onClose: () => void }) {
  const [scope, setScope] = useState<QueryScope>(initialScope);
  const [objects, setObjects] = useState(selected == null ? '' : catalog.stars[selected][0]);
  const [clusterName, setClusterName] = useState('NGC 346');
  const [coneRa, setConeRa] = useState('14.7773');
  const [coneDec, setConeDec] = useState('-72.1724');
  const [coneRadius, setConeRadius] = useState('0.1');
  const [columnMode, setColumnMode] = useState<ColumnMode>('main');
  const [customColumns, setCustomColumns] = useState<Set<string>>(() => new Set(MAIN_EXPORT_NAMES));
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const deferred = useDeferredColumns(columnMode);
  const clusters = useMemo(() => [...new Map(Object.values(CLUSTERS).map(cluster => [cluster.name, cluster])).values()].sort((a, b) => a.name.localeCompare(b.name)), []);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  const result = useMemo(() => {
    let indices: number[] = [], unresolved = 0, label: string = scope;
    if (scope === 'selected') { indices = selected == null ? [] : [selected]; label = selected == null ? 'selected_source' : catalog.stars[selected][0]; }
    if (scope === 'object' || scope === 'objects') {
      const requested = objects.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean).slice(0, scope === 'object' ? 1 : undefined), matches = requested.map(value => bestIdentifierMatch(value, identifierIndex));
      unresolved = matches.filter(index => index == null).length; indices = [...new Set(matches.filter((index): index is number => index != null))]; label = scope === 'object' ? 'object' : 'objects';
    }
    if (scope === 'cluster') { const cluster = clusters.find(item => item.name === clusterName); if (cluster) { indices = catalog.stars.flatMap((star, index) => angularSeparation(star[1], star[2], cluster.ra, cluster.dec) <= cluster.radius * CLUSTER_MARKER_PADDING ? [index] : []); label = cluster.name; } }
    if (scope === 'cone') { const ra = Number(coneRa), dec = Number(coneDec), radius = Number(coneRadius); if (Number.isFinite(ra) && Number.isFinite(dec) && Number.isFinite(radius) && ra >= 0 && ra < 360 && dec >= -90 && dec <= 90 && radius > 0) indices = catalog.stars.flatMap((star, index) => angularSeparation(star[1], star[2], ra, dec) <= radius ? [index] : []); label = `cone_${coneRa}_${coneDec}_${coneRadius}deg`; }
    if (scope === 'manual') { indices = manualIndices; label = 'manual_selection'; }
    if (scope === 'view') { indices = currentViewIndices(); label = 'current_view'; }
    if (scope === 'filtered') { indices = filteredIndices; label = 'filtered_sample'; }
    if (scope === 'L' || scope === 'S' || scope === 'B') { indices = catalog.stars.flatMap((star, index) => population(star) === scope ? [index] : []); label = scope === 'L' ? 'LMC' : scope === 'S' ? 'SMC' : 'Bridge'; }
    if (scope === 'all') { indices = catalog.stars.map((_, index) => index); label = 'full_catalogue'; }
    return { indices, unresolved, label };
  }, [catalog, clusterName, clusters, coneDec, coneRa, coneRadius, currentViewIndices, filteredIndices, identifierIndex, manualIndices, objects, scope, selected]);
  const entries = useMemo(() => result.indices.map(index => ({ star: catalog.stars[index], simbadIds: catalog.simbadIds?.[index] ?? catalog.simbadAliases?.[index] ?? '', rowIndex: index })), [catalog, result.indices]);
  async function download(format: ExportFormat) {
    if (!entries.length || exportProgress || columnMode !== 'main' && !deferred.data || columnMode === 'custom' && !customColumns.size) return;
    const cleanName = `ALS_IV_${result.label}`.replace(/[^a-z0-9_-]+/gi, '_');
    try { await downloadEntries(entries, columnMode, format, cleanName, deferred.data, setExportProgress, customColumns); setTimeout(() => setExportProgress(null), 900); }
    catch { setExportProgress({ percent: 100, label: 'Export failed — please try again' }); setTimeout(() => setExportProgress(null), 2400); }
  }
  return <div className="query-backdrop" role="presentation" onMouseDown={onClose}><section className="query-dialog catalog-query-dialog" role="dialog" aria-modal="true" aria-labelledby="catalog-query-title" onMouseDown={event => event.stopPropagation()}><header><div><p className="eyebrow">Catalogue export</p><h2 id="catalog-query-title">ALS IV Query</h2></div><button type="button" onClick={onClose} aria-label="Close query dialog">×</button></header><div className="query-body"><label className="query-field"><span>Query selection</span><select value={scope} onChange={event => setScope(event.target.value as QueryScope)}><option value="selected" disabled={selected == null}>Selected source</option><option value="object">One object</option><option value="objects">Several objects</option><option value="cluster">Cluster</option><option value="cone">Cone search</option><option value="manual">Manual map selection</option><option value="view">Current map region</option><option value="filtered">Current filtered sample</option><option value="L">LMC</option><option value="S">SMC</option><option value="B">Bridge</option><option value="all">Full catalogue</option></select></label>
    {scope === 'object' && <label className="query-field"><span>Object identifier</span><input value={objects.split(/[\n,;]+/)[0]} onChange={event => setObjects(event.target.value)} placeholder="SIMBAD, ALS IV or Gaia DR3 identifier" /></label>}
    {scope === 'objects' && <label className="query-field"><span>Identifiers · one per line</span><textarea value={objects} onChange={event => setObjects(event.target.value)} placeholder={'Sk −69 202\nVFTS 682\nGaia DR3 …'} /></label>}
    {scope === 'cluster' && <label className="query-field"><span>Cluster</span><select value={clusterName} onChange={event => setClusterName(event.target.value)}>{clusters.map(cluster => <option key={cluster.name} value={cluster.name}>{cluster.name}</option>)}</select></label>}
    {scope === 'cone' && <div className="cone-fields"><label className="query-field"><span>RA · deg</span><input value={coneRa} onChange={event => setConeRa(event.target.value)} inputMode="decimal" /></label><label className="query-field"><span>Dec · deg</span><input value={coneDec} onChange={event => setConeDec(event.target.value)} inputMode="decimal" /></label><label className="query-field"><span>Radius · deg</span><input value={coneRadius} onChange={event => setConeRadius(event.target.value)} inputMode="decimal" /></label></div>}
    {scope === 'manual' && <div className="manual-query-entry"><p>Select individual stars with a click, or drag a box over a sky region. Active catalogue filters remain applied.</p><button type="button" onClick={onStartManual}>{manualIndices.length ? 'Edit selection on map' : 'Select on map'}</button></div>}
    <div className="query-summary"><b>{formatCount(entries.length)}</b><span>sources selected</span>{result.unresolved > 0 && <em>{result.unresolved} identifier{result.unresolved === 1 ? '' : 's'} not found</em>}</div>
    <ColumnSelector mode={columnMode} setMode={setColumnMode} selected={customColumns} setSelected={setCustomColumns} />
    <p className={`query-note ${deferred.error ? 'query-error' : ''}`}>{deferred.loading ? 'Loading the 44 deferred catalogue columns…' : deferred.error || 'Column names and order are preserved from the original ALS IV catalogue.'}</p>
    {exportProgress && <div className="query-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={exportProgress.percent}><div><span>{exportProgress.label}</span><b>{exportProgress.percent}%</b></div><i><em style={{ width: `${exportProgress.percent}%` }} /></i></div>}
    <div className="query-formats"><button type="button" disabled={!entries.length || deferred.loading || Boolean(deferred.error) || Boolean(exportProgress) || columnMode === 'custom' && !customColumns.size} onClick={() => download('csv')}><b>CSV</b><span>Universal tabular text</span></button><button type="button" disabled={!entries.length || deferred.loading || Boolean(deferred.error) || Boolean(exportProgress) || columnMode === 'custom' && !customColumns.size} onClick={() => download('fits')}><b>FITS</b><span>Binary table for astronomy</span></button><button type="button" disabled={!entries.length || deferred.loading || Boolean(deferred.error) || Boolean(exportProgress) || columnMode === 'custom' && !customColumns.size} onClick={() => download('votable')}><b>VOTable</b><span>IVOA interoperable table</span></button><button type="button" disabled={!entries.length || deferred.loading || Boolean(deferred.error) || Boolean(exportProgress) || columnMode === 'custom' && !customColumns.size} onClick={() => download('json')}><b>JSON</b><span>Structured data for code</span></button></div></div></section></div>;
}

function StarDetails({ star, simbadIds, rowIndex }: { star: RawStar; simbadIds: string; rowIndex: number }) {
  const [queryOpen, setQueryOpen] = useState(false);
  const [columnMode, setColumnMode] = useState<ColumnMode>('main');
  const [customColumns, setCustomColumns] = useState<Set<string>>(() => new Set(MAIN_EXPORT_NAMES));
  const deferred = useDeferredColumns(columnMode);
  const pop = population(star); const popName = pop === 'L' ? 'Large Magellanic Cloud' : pop === 'S' ? 'Small Magellanic Cloud' : 'Magellanic Bridge';
  const simbadId = star[12] && star[12] !== '-99' ? star[12] : '';
  const simbadUrl = simbadId ? `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(simbadId)}` : null;
  const baseName = star[0].replace(/[^a-z0-9_-]+/gi, '_') || 'ALS_IV_source';
  const gaiaBpRp = star[30] == null || star[32] == null ? null : star[30] - star[32];
  const gaiaBpRpError = star[31] == null || star[33] == null ? null : Math.hypot(star[31], star[33]);
  useEffect(() => { if (!queryOpen) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setQueryOpen(false); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [queryOpen]);
  function download(format: ExportFormat) { if (columnMode !== 'main' && !deferred.data || columnMode === 'custom' && !customColumns.size) return; downloadEntries([{ star, simbadIds, rowIndex }], columnMode, format, baseName, deferred.data, undefined, customColumns); setQueryOpen(false); }
  return <div className="star-details"><div className="star-hero"><div className="star-swatch" style={{ background: starColor(star[4]), boxShadow: `0 0 24px ${starColor(star[4])}` }} /><div><span>{star[10]} · {popName}</span><h2>{star[0]}</h2><p>{simbadId || 'No primary SIMBAD identifier'}</p><p className="gaia-id">Gaia DR3 {star[11] || '—'}</p><div className="external-links">{simbadUrl && <a className="simbad-link" href={simbadUrl} target="_blank" rel="noreferrer">SIMBAD ↗</a>}<button type="button" className="simbad-link link-button" onClick={() => setQueryOpen(true)}>Query ↓</button></div></div></div>
    <div className="detail-section"><h3>Classification</h3><dl><div><dt>Spectral type</dt><dd>{star[14] || '—'}</dd></div><div><dt>Object type</dt><dd>{objectTypeLabel(star[13])}</dd></div></dl></div>
    <div className="detail-section"><h3>Position · ICRS</h3><dl><div><dt>Right ascension</dt><dd>{sexagesimalRa(star[1])}</dd></div><div><dt>Declination</dt><dd>{sexagesimalDec(star[2])}</dd></div></dl></div>
    <div className="detail-section"><h3>Corrected astrometry</h3><dl><div><dt>Parallax</dt><dd>{safe(star[5])} ± {safe(star[6])} mas</dd></div><div><dt>μ<sub>α</sub></dt><dd>{safe(star[7])} ± {safe(star[20])} mas a⁻¹</dd></div><div><dt>μ<sub>δ</sub></dt><dd>{safe(star[8])} ± {safe(star[21])} mas a⁻¹</dd></div><div><dt>RUWE</dt><dd>{safe(star[9], 2)}</dd></div></dl></div>
    <div className="detail-section"><h3>Synthetic photometry</h3><dl className="synthetic-list"><div><dt>G · {star[15]}</dt><dd>{safe(star[3])} mag</dd></div><div><dt>BP−RP · {star[16]}</dt><dd>{safe(star[4])} mag</dd></div></dl></div>
    <div className="detail-section"><h3>Photometry · mag</h3><div className="photometry-table"><PhotometryRow survey="Gaia" items={[["G", star[28], star[29]], ["BP−RP", gaiaBpRp, gaiaBpRpError]]} /><PhotometryRow survey="ZH" items={[["U", star[34], star[35]], ["B", star[36], star[37]]]} /><PhotometryRow survey="SMSS" items={[["u", star[38], star[39]], ["v", star[40], star[41]]]} /><PhotometryRow survey="2MASS" items={[["J", star[42], star[43]], ["Kₛ", star[44], star[45]]]} /><PhotometryRow survey="VISTA" items={[["J", star[46], star[47]], ["Kₛ", star[48], star[49]]]} /><PhotometryRow survey="HST" items={[["F336W", star[50], star[51]], ["F555W", star[52], star[53]], ["F775W", star[54], star[55]]]} /></div></div>
    {(star[22] != null || star[24] != null || star[26] != null) && <div className="detail-section"><h3>Variability</h3><dl className="variability-list"><div><dt>G · mmag</dt><dd>{variability(star[22], star[23])}</dd></div><div><dt>BP · mmag</dt><dd>{variability(star[24], star[25])}</dd></div><div><dt>RP · mmag</dt><dd>{variability(star[26], star[27])}</dd></div></dl></div>}
    {queryOpen && <div className="query-backdrop" role="presentation" onMouseDown={() => setQueryOpen(false)}><section className="query-dialog source-query-dialog" role="dialog" aria-modal="true" aria-labelledby="query-title" onMouseDown={event => event.stopPropagation()}><header><div><p className="eyebrow">Source export</p><h2 id="query-title">Query {star[0]}</h2></div><button type="button" onClick={() => setQueryOpen(false)} aria-label="Close export dialog">×</button></header><p>Download this ALS IV source.</p><ColumnSelector mode={columnMode} setMode={setColumnMode} selected={customColumns} setSelected={setCustomColumns} /><p className={`query-note ${deferred.error ? 'query-error' : ''}`}>{deferred.loading ? 'Loading the 44 deferred catalogue columns…' : deferred.error || 'Original catalogue column names and order are preserved.'}</p><div className="query-formats"><button type="button" disabled={deferred.loading || Boolean(deferred.error) || columnMode === 'custom' && !customColumns.size} onClick={() => download('csv')}><b>CSV</b><span>Universal tabular text</span></button><button type="button" disabled={deferred.loading || Boolean(deferred.error) || columnMode === 'custom' && !customColumns.size} onClick={() => download('fits')}><b>FITS</b><span>Binary table for astronomy</span></button><button type="button" disabled={deferred.loading || Boolean(deferred.error) || columnMode === 'custom' && !customColumns.size} onClick={() => download('votable')}><b>VOTable</b><span>IVOA interoperable table</span></button><button type="button" disabled={deferred.loading || Boolean(deferred.error) || columnMode === 'custom' && !customColumns.size} onClick={() => download('json')}><b>JSON</b><span>Structured data for code</span></button></div></section></div>}
    </div>;
}

function PhotometryRow({ survey, items }: { survey: string; items: [string, number | null, number | null][] }) {
  return <div className="survey-row"><b>{survey}</b><dl style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>{items.map(([band, value, error]) => <div key={band}><dt>{band}</dt><dd title={magnitude(value, error)}>{compactMagnitude(value, error)}</dd></div>)}</dl></div>;
}
