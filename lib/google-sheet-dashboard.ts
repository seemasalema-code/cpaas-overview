import {buildDashboard} from '@/lib/csv-dashboard';

export const SOURCE_SPREADSHEET_ID='1udQZmSHEpLWuQJO2k0t4UvA3zU8fUFkvx_1lIfINId8';
export const SOURCE_SPREADSHEET_URL=`https://docs.google.com/spreadsheets/d/${SOURCE_SPREADSHEET_ID}/edit?gid=888299704#gid=888299704`;

// Full-tab CSV export bypasses temporary Sheet filters and always reflects every
// populated row. It grows automatically as the workbook grows.
const SHEETS={
  projects:{gid:888299704},
  rm:{gid:559338930},
  wa:{gid:172604510},
  rcs:{gid:269889098},
} as const;

async function fetchCsv(source:{gid:number}){
  const response=await fetch(`https://docs.google.com/spreadsheets/d/${SOURCE_SPREADSHEET_ID}/export?format=csv&gid=${source.gid}`,{
    cache:'no-store',
    signal:AbortSignal.timeout(90_000),
  });
  if(!response.ok)throw new Error(`Google Sheet export returned ${response.status}`);
  const text=await response.text();
  if(!text.trim()||/^\s*<!doctype html/i.test(text))throw new Error('Google Sheet export is not publicly readable');
  return text;
}

export async function loadGoogleSheetDashboard(){
  const [projects,rm,wa,rcs]=await Promise.all([
    fetchCsv(SHEETS.projects),fetchCsv(SHEETS.rm),fetchCsv(SHEETS.wa),fetchCsv(SHEETS.rcs),
  ]);
  return buildDashboard(projects,rm,wa,rcs,SOURCE_SPREADSHEET_URL);
}
