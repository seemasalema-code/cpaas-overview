import {NextResponse} from 'next/server';
import {consoleData} from '@/lib/console-data';
import {clientMonthly} from '@/lib/client-monthly';
import {ensureDashboardTable,getDb} from '@/lib/dashboard-store';
import {loadGoogleSheetDashboard,SOURCE_SPREADSHEET_URL} from '@/lib/google-sheet-dashboard';

export const dynamic='force-dynamic';
const currentSource=(data:typeof consoleData)=>({...data,sourceUrl:SOURCE_SPREADSHEET_URL});
export async function GET(){
 try{
  const live=await loadGoogleSheetDashboard();
  return NextResponse.json({...live,updatedAt:new Date().toISOString(),updatedBy:'Live Google Sheet'},{headers:{'Cache-Control':'no-store'}});
 }catch{
  const db=getDb();
  if(!db)return NextResponse.json({consoleData:currentSource(consoleData),clientMonthly,updatedAt:null,updatedBy:'Verified fallback snapshot'},{headers:{'Cache-Control':'no-store'}});
  await ensureDashboardTable(db);
  const row=await db.prepare('SELECT payload, updated_at, updated_by FROM dashboard_snapshots WHERE id = 1').first<any>();
  if(!row)return NextResponse.json({consoleData:currentSource(consoleData),clientMonthly,updatedAt:null,updatedBy:'Verified fallback snapshot'},{headers:{'Cache-Control':'no-store'}});
  const saved=JSON.parse(row.payload);
  return NextResponse.json({...saved,consoleData:{...saved.consoleData,sourceUrl:SOURCE_SPREADSHEET_URL},updatedAt:row.updated_at,updatedBy:row.updated_by},{headers:{'Cache-Control':'no-store'}});
 }
}
