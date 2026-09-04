const clean=(v:unknown)=>String(v??'').trim();
const num=(v:unknown)=>Number(clean(v).replace(/[₹,$%\s]/g,'').replace(/\((.*)\)/,'-$1'))||0;
const hk=(v:unknown)=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const rk=(v:unknown)=>hk(v).replace(/\s+/g,'');
// The source tabs do not always use the identical legal-name suffix.  Use one
// stable key for joins, but retain the first source label for display.
const clientKey=(v:unknown)=>hk(v).replace(/\b(private|pvt|limited|ltd|company|co)\b/g,'').replace(/\s+/g,'');
// A few numeric/date headers are blanked by Google CSV exports when the source cell has a
// numeric format. Named headers win; verified positional fallbacks keep the live parser aligned
// with the workbook when that export quirk occurs.
const col=(h:string[],names:string[],fallback=-1)=>{const w=names.map(hk),found=h.findIndex(x=>w.includes(hk(x)));return found>=0?found:fallback};

export function parseCsv(text:string){
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(field);field=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field=''}else field+=c}
 row.push(field);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
function monthValue(value:string){
 const v=clean(value);if(/^\d{4}-\d{2}/.test(v))return v.slice(0,7);
 const shortMonth=v.match(/^([A-Za-z]{3})[\s-](\d{2}|\d{4})$/);if(shortMonth){const names=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],m=names.indexOf(shortMonth[1].toLowerCase()),rawYear=Number(shortMonth[2]),y=rawYear<100?2000+rawYear:rawYear;if(m>=0)return `${y}-${String(m+1).padStart(2,'0')}`}
 const indian=v.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(indian){const m=+indian[2],y=+indian[3];if(m>0&&m<13)return `${y}-${String(m).padStart(2,'0')}`}
 const d=new Date(v);if(!Number.isNaN(d.getTime()))return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
 const serial=Number(v);if(serial>30000){const x=new Date(Date.UTC(1899,11,30)+serial*86400000);return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,'0')}`}return '';
}
function plusMonth(month:string,n:number){const [y,m]=month.split('-').map(Number),d=new Date(y,m-1+n,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function financialYear(date=new Date()){
 const startYear=date.getMonth()>=3?date.getFullYear():date.getFullYear()-1;
 return {start:`${startYear}-04`,end:`${startYear+1}-03`,label:`FY ${startYear}-${String(startYear+1).slice(-2)}`};
}
type Monthly={client:string;month:string;chatbotRevenue:number;chatbotCost:number;chatbotRentalRevenue:number;chatbotRentalCost:number;waRevenue:number;waCost:number;rcsRevenue:number;rcsCost:number;periodType:'Actual'|'Forecast'};
const empty=(client:string,month:string,periodType:'Actual'|'Forecast'='Actual'):Monthly=>({client,month,chatbotRevenue:0,chatbotCost:0,chatbotRentalRevenue:0,chatbotRentalCost:0,waRevenue:0,waCost:0,rcsRevenue:0,rcsCost:0,periodType});

export function buildDashboard(projectCsv:string,rmCsv:string,waCsv:string,rcsCsv:string,sourceUrl:string){
 const p=parseCsv(projectCsv),rm=parseCsv(rmCsv),wa=parseCsv(waCsv),rcs=parseCsv(rcsCsv);if(p.length<2)throw new Error('Chatbot Projects CSV has no data rows.');
 const pi=p.findIndex(r=>r.some(v=>hk(v)==='chatbot'));if(pi<0)throw new Error('Chatbot Projects is missing its named header row.');
 const ph=p[pi],pcClient=col(ph,['Client Legal Name','Client','Client Name'],0),pcProject=col(ph,['Chatbot','Project','Project Name'],1),pcIndustry=col(ph,['Industry'],2),pcOwner=col(ph,['Sales Connect','Owner','Project Owner'],4),pcType=col(ph,['Bot Type','Type','Platform','Channel'],5),pcVendor=col(ph,['Vendor'],7),pcStatus=col(ph,['Status','Stage'],8);
 if([pcClient,pcProject,pcStatus].some(i=>i<0))throw new Error('Chatbot Projects is missing a required named column.');
 const projects=p.slice(pi+1).filter(r=>clean(r[pcClient])||clean(r[pcProject])).map(r=>({client:clean(r[pcClient]),project:clean(r[pcProject]),industry:pcIndustry>=0?clean(r[pcIndustry])||'Unclassified':'Unclassified',owner:pcOwner>=0?clean(r[pcOwner])||'Unassigned':'Unassigned',type:pcType>=0?clean(r[pcType])||'Unspecified':'Unspecified',vendor:pcVendor>=0?clean(r[pcVendor])||'Unspecified':'Unspecified',status:clean(r[pcStatus])||'Unspecified',revenue:0,cost:0,margin:0}));
 const clientLabels=new Map<string,string>();
 const resolveClient=(value:unknown,fallback='')=>{const label=clean(value)||fallback,key=clientKey(label);if(!key)return label;const known=clientLabels.get(key);if(known)return known;clientLabels.set(key,label);return label};
 projects.forEach(project=>{project.client=resolveClient(project.client,project.project)});
 const now=new Date(),current=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`,fy=financialYear(now),future:string[]=[];
 for(let month=plusMonth(current,1);month<=fy.end;month=plusMonth(month,1))future.push(month);
 const projectByBot=new Map<string,any[]>();projects.forEach(x=>{const key=rk(x.project),list=projectByBot.get(key)||[];list.push(x);projectByBot.set(key,list)});
 // R&M has many repeated monthly records for the same bot. Memoising the lookup avoids
 // re-running a full fuzzy project scan for every one of those records.
 const resolvedProjectCache=new Map<string,any|null>();
 const resolveProject=(bot:string)=>{const key=rk(bot);if(resolvedProjectCache.has(key))return resolvedProjectCache.get(key)||null;const exact=projectByBot.get(key)||[];let resolved:any|null=exact.length===1?exact[0]:null;if(!resolved){const fuzzy=projects.filter(x=>{const candidate=rk(x.project);return key.length>5&&candidate.length>5&&(candidate.includes(key)||key.includes(candidate))});resolved=fuzzy.length===1?fuzzy[0]:null}resolvedProjectCache.set(key,resolved);return resolved};
 const actual=new Map<string,Monthly>(),forecast=new Map<string,Monthly>(),projectTotals=new Map<string,{revenue:number;cost:number}>(),latest=new Map<string,{client:string;month:string;revenue:number;cost:number}>(),explicit=new Set<string>(),liveKeys=new Set(projects.filter(x=>hk(x.status)==='live').map(x=>rk(x.project)));
 const ri=rm.findIndex(r=>r.some(v=>hk(v)==='chatbot')&&(r.some(v=>hk(v)==='month')||(r.some(v=>hk(v)==='client')&&r.some(v=>hk(v)==='vendor'))));
 if(ri>=0){const h=rm[ri],cc=col(h,['Client','Client Name','Client Legal Name'],0),cb=col(h,['Chatbot','Project','Project Name'],1),cm=col(h,['Month','Billing Month','Revenue Month'],3),cr=col(h,['Total Netcore Revenue','Netcore Total Revenue','Total Revenue Netcore','Total Revenue','Monthly Revenue','Revenue'],34),co=col(h,['Total Vendor Cost','Vendor Total Cost','Total Cost Vendor','Total Cost','Vendor Cost','Cost'],19),crRental=col(h,['Netcore Monthly Rental'],21),coRental=col(h,['Vendor Monthly Rental'],6);if([cb,cm,cr,co].some(i=>i<0))throw new Error('Chatbot R&M is missing a required financial column.');
  rm.slice(ri+1).forEach(r=>{const bot=clean(r[cb]),matched=resolveProject(bot),client=resolveClient((cc>=0?clean(r[cc]):'')||matched?.client||'',matched?.project||bot),month=monthValue(r[cm]);if(!client||!bot||!month||month<fy.start)return;const revenue=num(r[cr]),cost=num(r[co]),rentalRevenue=num(r[crRental]),rentalCost=num(r[coRental]);if(!revenue&&!cost)return;const bk=rk(matched?.project||bot);
   if(month<=current){const key=client+'\u0000'+month,x=actual.get(key)||empty(client,month);x.chatbotRevenue+=revenue;x.chatbotCost+=cost;x.chatbotRentalRevenue+=rentalRevenue;x.chatbotRentalCost+=rentalCost;actual.set(key,x);const t=projectTotals.get(bk)||{revenue:0,cost:0};t.revenue+=revenue;t.cost+=cost;projectTotals.set(bk,t);const old=latest.get(bk);if(!old||month>old.month)latest.set(bk,{client,month,revenue,cost});}
   else if(month<=fy.end&&liveKeys.has(bk)){const key=client+'\u0000'+month,x=forecast.get(key)||empty(client,month,'Forecast');x.chatbotRevenue+=revenue;x.chatbotCost+=cost;x.chatbotRentalRevenue+=rentalRevenue;x.chatbotRentalCost+=rentalCost;forecast.set(key,x);explicit.add(bk+'\u0000'+month);}
  });
 }
 projects.forEach(p=>{const key=rk(p.project);let f=projectTotals.get(key);if(!f){const matches=[...projectTotals.entries()].filter(([candidate])=>key.length>5&&candidate.length>5&&(candidate.includes(key)||key.includes(candidate)));if(matches.length===1)f=matches[0][1]}if(f){p.revenue=f.revenue;p.cost=f.cost;p.margin=f.revenue-f.cost}});
 projects.filter(p=>hk(p.status)==='live').forEach(p=>{const bk=rk(p.project),run=latest.get(bk);if(!run)return;future.forEach(month=>{if(explicit.has(bk+'\u0000'+month))return;const client=p.client||run.client,key=client+'\u0000'+month,x=forecast.get(key)||empty(client,month,'Forecast');x.chatbotRevenue+=run.revenue;x.chatbotCost+=run.cost;forecast.set(key,x)})});

 const addUsage=(rows:string[][],kind:'wa'|'rcs')=>{const i=rows.findIndex(r=>r.some(v=>['client','client name','client legal name'].includes(hk(v)))&&r.some(v=>hk(v)==='month'));if(i<0)return;const h=rows[i],cc=col(h,['Client','Client Name','Client Legal Name']),cm=col(h,['Month','Billing Month','Revenue Month']),cr=col(h,['Revenue','Total Revenue','Monthly Revenue']),co=col(h,['Cost','Total Cost','Monthly Cost']);if([cc,cm,cr,co].some(x=>x<0))return;rows.slice(i+1).forEach(r=>{const client=resolveClient(r[cc]),month=monthValue(r[cm]);if(!client||!month||month<fy.start||month>current)return;const key=client+'\u0000'+month,x=actual.get(key)||empty(client,month);if(kind==='wa'){x.waRevenue+=num(r[cr]);x.waCost+=num(r[co])}else{x.rcsRevenue+=num(r[cr]);x.rcsCost+=num(r[co])}actual.set(key,x)})};
 addUsage(wa,'wa');addUsage(rcs,'rcs');
 const actualRows=[...actual.values()],waMonths=[...new Set(actualRows.filter(x=>x.waRevenue||x.waCost).map(x=>x.month))].sort().reverse().slice(0,3),rcsMonths=[...new Set(actualRows.filter(x=>x.rcsRevenue||x.rcsCost).map(x=>x.month))].sort().reverse().slice(0,3),waDivisor=Math.max(1,waMonths.length),rcsDivisor=Math.max(1,rcsMonths.length);
 const waMonthSet=new Set(waMonths),rcsMonthSet=new Set(rcsMonths),usageRates=new Map<string,{waRevenue:number;waCost:number;rcsRevenue:number;rcsCost:number}>();
 actualRows.forEach(x=>{const rate=usageRates.get(x.client)||{waRevenue:0,waCost:0,rcsRevenue:0,rcsCost:0};if(waMonthSet.has(x.month)){rate.waRevenue+=x.waRevenue;rate.waCost+=x.waCost}if(rcsMonthSet.has(x.month)){rate.rcsRevenue+=x.rcsRevenue;rate.rcsCost+=x.rcsCost}usageRates.set(x.client,rate)});
 usageRates.forEach((rate,client)=>{future.forEach(month=>{const key=client+'\u0000'+month,x=forecast.get(key)||empty(client,month,'Forecast');x.waRevenue+=rate.waRevenue/waDivisor;x.waCost+=rate.waCost/waDivisor;x.rcsRevenue+=rate.rcsRevenue/rcsDivisor;x.rcsCost+=rate.rcsCost/rcsDivisor;forecast.set(key,x)})});
 const clientMonthly=[...actual.values()].sort((a,b)=>a.month.localeCompare(b.month)||a.client.localeCompare(b.client)),forecastClientMonthly=[...forecast.values()].sort((a,b)=>a.month.localeCompare(b.month)||a.client.localeCompare(b.client));
 const clientMap=new Map<string,any>();for(const x of projects){const c=clientMap.get(x.client)||{client:x.client,projectRevenue:0,projectCost:0,waRevenue:0,waCost:0,rcsRevenue:0,rcsCost:0,projects:0,live:0};c.projectRevenue+=x.revenue;c.projectCost+=x.cost;c.projects++;if(hk(x.status)==='live')c.live++;clientMap.set(x.client,c)}for(const x of clientMonthly){const c=clientMap.get(x.client)||{client:x.client,projectRevenue:0,projectCost:0,waRevenue:0,waCost:0,rcsRevenue:0,rcsCost:0,projects:0,live:0};c.waRevenue+=x.waRevenue;c.waCost+=x.waCost;c.rcsRevenue+=x.rcsRevenue;c.rcsCost+=x.rcsCost;clientMap.set(x.client,c)}
 const clients=[...clientMap.values()].map(c=>({...c,totalRevenue:c.projectRevenue+c.waRevenue+c.rcsRevenue,totalCost:c.projectCost+c.waCost+c.rcsCost,margin:c.projectRevenue+c.waRevenue+c.rcsRevenue-c.projectCost-c.waCost-c.rcsCost})).sort((a,b)=>b.totalRevenue-a.totalRevenue);
 const monthlyMap=new Map<string,{month:string;chatbotRevenue:number;chatbotMargin:number;waRevenue:number;waMargin:number;rcsRevenue:number;rcsMargin:number}>();
 clientMonthly.forEach(x=>{const value=monthlyMap.get(x.month)||{month:x.month,chatbotRevenue:0,chatbotMargin:0,waRevenue:0,waMargin:0,rcsRevenue:0,rcsMargin:0};value.chatbotRevenue+=x.chatbotRevenue;value.chatbotMargin+=x.chatbotRevenue-x.chatbotCost;value.waRevenue+=x.waRevenue;value.waMargin+=x.waRevenue-x.waCost;value.rcsRevenue+=x.rcsRevenue;value.rcsMargin+=x.rcsRevenue-x.rcsCost;monthlyMap.set(x.month,value)});
 const months=[...monthlyMap.keys()].sort(),monthly=months.map(month=>monthlyMap.get(month)!);
 const statuses=[...projects.reduce((m,x)=>m.set(x.status,(m.get(x.status)||0)+1),new Map<string,number>())].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
 const forecastMap=new Map<string,{month:string;periodType:'Forecast';chatbotRevenue:number;chatbotCost:number;waRevenue:number;waCost:number;rcsRevenue:number;rcsCost:number;totalRevenue:number;totalCost:number}>();
 forecastClientMonthly.forEach(x=>{const value=forecastMap.get(x.month)||{month:x.month,periodType:'Forecast' as const,chatbotRevenue:0,chatbotCost:0,waRevenue:0,waCost:0,rcsRevenue:0,rcsCost:0,totalRevenue:0,totalCost:0};value.chatbotRevenue+=x.chatbotRevenue;value.chatbotCost+=x.chatbotCost;value.waRevenue+=x.waRevenue;value.waCost+=x.waCost;value.rcsRevenue+=x.rcsRevenue;value.rcsCost+=x.rcsCost;value.totalRevenue+=x.chatbotRevenue+x.waRevenue+x.rcsRevenue;value.totalCost+=x.chatbotCost+x.waCost+x.rcsCost;forecastMap.set(x.month,value)});
 const forecastMonthly=future.map(month=>forecastMap.get(month)||{month,periodType:'Forecast' as const,chatbotRevenue:0,chatbotCost:0,waRevenue:0,waCost:0,rcsRevenue:0,rcsCost:0,totalRevenue:0,totalCost:0});
 return {consoleData:{asOf:new Date().toISOString().slice(0,10),reportingStart:fy.start,reportingEnd:fy.end,financialYear:fy.label,sourceUrl,clients,projects,monthly,statuses,forecastMonthly},clientMonthly,forecastClientMonthly};
}
