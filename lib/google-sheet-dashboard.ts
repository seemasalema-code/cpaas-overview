import {buildDashboard} from '@/lib/csv-dashboard';

export const SOURCE_SPREADSHEET_ID='1udQZmSHEpLWuQJO2k0t4UvA3zU8fUFkvx_1lIfINId8';
export const SOURCE_SPREADSHEET_URL=`https://docs.google.com/spreadsheets/d/${SOURCE_SPREADSHEET_ID}/edit?gid=888299704#gid=888299704`;

// Google’s /export endpoint expands formatting and can take minutes for this
// workbook. The Visualization feed reads only populated table rows and is much
// more reliable from the hosted worker.
const SHEETS={
  projects:{name:'Chatbot Projects',range:'A1:AS5000'},
  rm:{name:'Chatbot R&M',range:'A1:AM10000'},
  wa:{name:'WA_Consumables',range:'A1:G10000'},
  rcs:{name:'RCS_Consumables',range:'A1:Z5000'},
} as const;

type Dashboard=ReturnType<typeof buildDashboard>;
let cached:{data:Dashboard;loadedAt:number}|null=null;
let pending:Promise<Dashboard>|null=null;
const FIVE_MINUTES=300_000;
const PUBLISHED_MIRROR='https://raw.githubusercontent.com/seemasalema-code/botpulse360/main/data.js';

async function fetchCsv(source:{name:string;range:string}){
  // Do not filter on column A. Some source tabs (notably RCS) begin in
  // column B, so an A-based query silently removes every valid data row.
  const query=new URLSearchParams({tqx:'out:csv',sheet:source.name,range:source.range});
  const response=await fetch(`https://docs.google.com/spreadsheets/d/${SOURCE_SPREADSHEET_ID}/gviz/tq?${query}`,{
    cache:'no-store',
    signal:AbortSignal.timeout(20_000),
  });
  if(!response.ok)throw new Error(`Google Sheet export returned ${response.status}`);
  const text=await response.text();
  if(!text.trim()||/^\s*<!doctype html/i.test(text))throw new Error('Google Sheet export is not publicly readable');
  return text;
}

function rowsToCsv(rows:unknown[][]){
  return rows.map(row=>row.map(value=>{
    const text=String(value??'');
    return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
  }).join(',')).join('\n');
}

async function loadPublishedMirror(){
  const response=await fetch(`${PUBLISHED_MIRROR}?_=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(15_000)});
  if(!response.ok)throw new Error(`Published dashboard mirror returned ${response.status}`);
  const script=await response.text();
  const json=script.replace(/^\s*window\.EMBEDDED_SHEETS_CURRENT\s*=\s*/,'').replace(/;\s*$/,'');
  const workbook=JSON.parse(json) as Record<string,unknown[][]>;
  const required=['Chatbot Projects','Chatbot R&M','WA_Consumables','RCS_Consumables'];
  if(required.some(name=>!Array.isArray(workbook[name])||!workbook[name].length))throw new Error('Published dashboard mirror is incomplete');
  return buildDashboard(rowsToCsv(workbook['Chatbot Projects']),rowsToCsv(workbook['Chatbot R&M']),rowsToCsv(workbook.WA_Consumables),rowsToCsv(workbook.RCS_Consumables),SOURCE_SPREADSHEET_URL);
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
    const data=await loadPublishedMirror();
    cached={data,loadedAt:Date.now()};
    return data;
  }finally{pending=null;}
}
