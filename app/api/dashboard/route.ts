import {NextResponse} from 'next/server';
import {consoleData} from '@/lib/console-data';
import {clientMonthly} from '@/lib/client-monthly';
import {loadGoogleSheetDashboard,SOURCE_SPREADSHEET_URL} from '@/lib/google-sheet-dashboard';

export const dynamic='force-dynamic';
const currentSource=(data:typeof consoleData)=>({...data,sourceUrl:SOURCE_SPREADSHEET_URL});
export async function GET(){
 try{
  const live=await loadGoogleSheetDashboard();
  return NextResponse.json({...live,updatedAt:new Date().toISOString(),updatedBy:'Live Google Sheet'},{headers:{'Cache-Control':'no-store'}});
 }catch{
  return NextResponse.json({consoleData:currentSource(consoleData),clientMonthly,updatedAt:null,updatedBy:'Source temporarily unavailable'},{headers:{'Cache-Control':'no-store'}});
 }
}
