import {buildDashboard} from '@/lib/csv-dashboard';

export const SOURCE_SPREADSHEET_ID='1udQZmSHEpLWuQJO2k0t4UvA3zU8fUFkvx_1lIfINId8';
export const SOURCE_SPREADSHEET_URL=`https://docs.google.com/spreadsheets/d/${SOURCE_SPREADSHEET_ID}/edit?gid=888299704#gid=888299704`;

// Each request reads the whole source tab. This avoids filtered Google
// visualization views and has no fixed upper row limit or stored snapshot.
const SHEETS={projects:888299704,rm:559338930,wa:172604510,rcs:269889098} as const;
// This is deliberately not a data cache: it only lets simultaneous page/API requests share the
// same in-progress live read. Once it resolves or fails, the value is discarded, so the next
// reload always re-reads the Google Sheet.
let activeLiveRead:Promise<ReturnType<typeof buildDashboard>>|null=null;

async function fetchCsv(gid:number){
  const response=await fetch(`https://docs.google.com/spreadsheets/d/${SOURCE_SPREADSHEET_ID}/export?format=csv&gid=${gid}`,{
    cache:'no-store',signal:AbortSignal.timeout(90_000),
  });
  if(!response.ok)throw new Error(`Google Sheet export returned ${response.status}`);
  const text=await response.text();
  if(!text.trim()||/^\s*<!doctype html/i.test(text))throw new Error('Google Sheet export is not publicly readable');
  return text;
}

export async function loadGoogleSheetDashboard(){
  if(activeLiveRead)return activeLiveRead;
  activeLiveRead=(async()=>{
    const [projects,rm,wa,rcs]=await Promise.all([
      fetchCsv(SHEETS.projects),fetchCsv(SHEETS.rm),fetchCsv(SHEETS.wa),fetchCsv(SHEETS.rcs),
    ]);
    return buildDashboard(projects,rm,wa,rcs,SOURCE_SPREADSHEET_URL);
  })();
  try{return await activeLiveRead;}
  finally{activeLiveRead=null;}
}
