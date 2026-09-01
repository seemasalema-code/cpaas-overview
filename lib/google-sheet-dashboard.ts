import {buildDashboard} from '@/lib/csv-dashboard';

export const SOURCE_SPREADSHEET_ID='1udQZmSHEpLWuQJO2k0t4UvA3zU8fUFkvx_1lIfINId8';
export const SOURCE_SPREADSHEET_URL=`https://docs.google.com/spreadsheets/d/${SOURCE_SPREADSHEET_ID}/edit?gid=888299704#gid=888299704`;

// Google’s /export endpoint expands formatting and can take minutes for this
// workbook. The Visualization feed reads only populated table rows and is much
// more reliable from the hosted worker.
const SHEETS={
  projects:'Chatbot Projects',
  rm:'Chatbot R&M',
  wa:'WA_Consumables',
  rcs:'RCS_Consumables',
} as const;

type Dashboard=ReturnType<typeof buildDashboard>;
let cached:{data:Dashboard;loadedAt:number}|null=null;
let pending:Promise<Dashboard>|null=null;
const FIVE_MINUTES=300_000;

async function fetchCsv(sheet:string){
  const query=new URLSearchParams({tqx:'out:csv',sheet,tq:'select *'});
  const response=await fetch(`https://docs.google.com/spreadsheets/d/${SOURCE_SPREADSHEET_ID}/gviz/tq?${query}`,{
    cache:'no-store',
    signal:AbortSignal.timeout(55_000),
  });
  if(!response.ok)throw new Error(`Google Sheet export returned ${response.status}`);
  const text=await response.text();
  if(!text.trim()||/^\s*<!doctype html/i.test(text))throw new Error('Google Sheet export is not publicly readable');
  return text;
}

export async function loadGoogleSheetDashboard(){
  if(cached&&Date.now()-cached.loadedAt<FIVE_MINUTES)return cached.data;
  if(pending)return pending;
  pending=(async()=>{
    const [projects,rm,wa,rcs]=await Promise.all([
      fetchCsv(SHEETS.projects),fetchCsv(SHEETS.rm),fetchCsv(SHEETS.wa),fetchCsv(SHEETS.rcs),
    ]);
    const data=buildDashboard(projects,rm,wa,rcs,SOURCE_SPREADSHEET_URL);
    cached={data,loadedAt:Date.now()};
    return data;
  })();
  try{return await pending;}catch(error){
    if(cached)return cached.data;
    throw error;
  }finally{pending=null;}
}
