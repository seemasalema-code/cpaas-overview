import {NextResponse} from 'next/server';
import {consoleData} from '@/lib/console-data';
import {clientMonthly} from '@/lib/client-monthly';
import {loadGoogleSheetDashboard,SOURCE_SPREADSHEET_URL} from '@/lib/google-sheet-dashboard';

export const dynamic='force-dynamic';
const currentSource=(data:typeof consoleData)=>({...data,sourceUrl:SOURCE_SPREADSHEET_URL});
const CACHE_URL='https://cpaas-cache.internal/dashboard-v1';
const cacheStorage=()=>((globalThis as any).caches?.default as Cache|undefined);
export async function GET(request:Request){
 const force=new URL(request.url).searchParams.get('force')==='1';
 const edge=cacheStorage(),cacheKey=new Request(CACHE_URL);
 if(edge&&!force){
  const hit=await edge.match(cacheKey);
  if(hit)return new NextResponse(hit.body,{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Dashboard-Cache':'HIT'}});
 }
 try{
  const live=await loadGoogleSheetDashboard();
  const payload={...live,updatedAt:new Date().toISOString(),updatedBy:'Live Google Sheet'};
  if(edge)await edge.put(cacheKey,new Response(JSON.stringify(payload),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=86400'}}));
  return NextResponse.json(payload,{headers:{'Cache-Control':'no-store','X-Dashboard-Cache':'MISS'}});
 }catch{
  if(edge){const stale=await edge.match(cacheKey);if(stale)return new NextResponse(stale.body,{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Dashboard-Cache':'STALE'}});}
  return NextResponse.json({consoleData:currentSource(consoleData),clientMonthly,updatedAt:null,updatedBy:'Source temporarily unavailable',sourceError:true},{headers:{'Cache-Control':'no-store'}});
 }
}
