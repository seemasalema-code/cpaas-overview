import {NextResponse} from 'next/server';
import {consoleData} from '@/lib/console-data';
import {clientMonthly} from '@/lib/client-monthly';
import {ensureDashboardTable,getDb} from '@/lib/dashboard-store';

export const dynamic='force-dynamic';
export async function GET(){const db=getDb();if(!db)return NextResponse.json({consoleData,clientMonthly,updatedAt:null,updatedBy:'Initial verified snapshot'});await ensureDashboardTable(db);const row=await db.prepare('SELECT payload, updated_at, updated_by FROM dashboard_snapshots WHERE id = 1').first<any>();if(!row)return NextResponse.json({consoleData,clientMonthly,updatedAt:null,updatedBy:'Initial verified snapshot'});return NextResponse.json({...JSON.parse(row.payload),updatedAt:row.updated_at,updatedBy:row.updated_by},{headers:{'Cache-Control':'no-store'}})}
