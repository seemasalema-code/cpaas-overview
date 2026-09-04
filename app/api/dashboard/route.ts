import {NextResponse} from 'next/server';
import {loadGoogleSheetDashboard} from '@/lib/google-sheet-dashboard';

export const dynamic='force-dynamic';
export async function GET(){
 try{
  const live=await loadGoogleSheetDashboard();
  return NextResponse.json({...live,updatedAt:new Date().toISOString(),updatedBy:'Live Google Sheet'},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const message=error instanceof Error?error.message:'The live Google Sheet could not be read.';
  return NextResponse.json({sourceError:true,message},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
