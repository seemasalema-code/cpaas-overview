import {dashboardSchema} from '@/db/schema';

type D1DatabaseLike={prepare:(sql:string)=>{bind:(...values:unknown[])=>any;first:<T=unknown>()=>Promise<T|null>;run:()=>Promise<unknown>}};

export function getDb():D1DatabaseLike|null {
  return ((globalThis as any).DB ?? (globalThis as any).env?.DB ?? null) as D1DatabaseLike|null;
}

export async function ensureDashboardTable(db:D1DatabaseLike){await db.prepare(dashboardSchema).run()}
