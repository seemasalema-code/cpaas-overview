const numberValue=(value:unknown)=>Number(String(value??'').replace(/[₹,$%\s]/g,'').replace(/\((.*)\)/,'-$1'))||0;
const clean=(value:unknown)=>String(value??'').trim();

export function parseCsv(text:string){
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(field);field=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field=''}else field+=c}
 row.push(field);if(row.some(x=>x.trim()))rows.push(row);return rows;
}

function monthValue(value:string){
 const v=clean(value);if(/^\d{4}-\d{2}/.test(v))return v.slice(0,7);
 const indian=v.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
 if(indian){const month=Number(indian[2]),year=Number(indian[3]);if(month>=1&&month<=12)return `${year}-${String(month).padStart(2,'0')}`}
 const d=new Date(v);if(!Number.isNaN(d.getTime()))return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
 const serial=Number(v);if(serial>30000){const x=new Date(Date.UTC(1899,11,30)+serial*86400000);return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,'0')}`}
 return '';
}

type Monthly={client:string;month:string;chatbotRevenue:number;chatbotCost:number;waRevenue:number;waCost:number;rcsRevenue:number;rcsCost:number;periodType:'Actual'|'Forecast'};
const emptyMonthly=(client:string,month:string,periodType:'Actual'|'Forecast'='Actual'):Monthly=>({client,month,chatbotRevenue:0,chatbotCost:0,waRevenue:0,waCost:0,rcsRevenue:0,rcsCost:0,periodType});
const headerKey=(value:unknown)=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const headerColumn=(headers:string[],names:string[])=>{const wanted=names.map(headerKey);return headers.findIndex(h=>wanted.includes(headerKey(h)))};

export function buildDashboard(projectCsv:string,rmCsv:string,waCsv:string,rcsCsv:string,sourceUrl:string){
 const p=parseCsv(projectCsv),rm=parseCsv(rmCsv),wa=parseCsv(waCsv),rcs=parseCsv(rcsCsv);
 if(p.length<2)throw new Error('Chatbot Projects CSV has no data rows.');
 const projects=p.slice(1).filter(r=>clean(r[0])||clean(r[1])).map(r=>({client:clean(r[0]),project:clean(r[1]),industry:clean(r[2])||'Unclassified',owner:clean(r[4])||'Unassigned',type:clean(r[5])||'Unspecified',vendor:clean(r[7])||'Unspecified',status:clean(r[8])||'Unspecified',revenue:0,cost:0,margin:0}));
 const monthlyMap=new Map<string,Monthly>(),forecastMap=new Map<string,Monthly>(),rmProject=new Map<string,{revenue:number;cost:number}>(),currentMonth=new Date().toISOString().slice(0,7);
 const rmHeaderIdx=rm.findIndex(r=>r.some(v=>headerKey(v)==='chatbot')&&r.some(v=>headerKey(v)==='month'));
 if(rmHeaderIdx>=0){
  const h=rm[rmHeaderIdx],cClient=headerColumn(h,['Client']),cBot=headerColumn(h,['Chatbot','Project','Project Name']),cMonth=headerColumn(h,['Month','Billing Month','Revenue Month']),cRevenue=headerColumn(h,['Total Netcore Revenue','Total Revenue Netcore','Total Revenue','Monthly Revenue','Revenue']),cCost=headerColumn(h,['Total Vendor Cost','Total Cost Vendor','Total Cost','Vendor Cost','Cost']);
  if([cClient,cBot,cMonth,cRevenue,cCost].some(i=>i<0))throw new Error('Chatbot R&M is missing a required named financial column.');
  rm.slice(rmHeaderIdx+1).forEach(r=>{const client=clean(r[cClient]),bot=clean(r[cBot]),month=monthValue(r[cMonth]);if(!client||!bot||!month)return;const revenue=numberValue(r[cRevenue]),cost=numberValue(r[cCost]);if(!revenue&&!cost)return;const isForecast=month>currentMonth,target=isForecast?forecastMap:monthlyMap,key=client+'\u0000'+month,x=target.get(key)||emptyMonthly(client,month,isForecast?'Forecast':'Actual');x.chatbotRevenue+=revenue;x.chatbotCost+=cost;target.set(key,x);if(!isForecast){const pk=bot.toLowerCase(),pt=rmProject.get(pk)||{revenue:0,cost:0};pt.revenue+=revenue;pt.cost+=cost;rmProject.set(pk,pt)}});
 }
 projects.forEach(p=>{const finance=rmProject.get(p.project.toLowerCase());if(finance){p.revenue=finance.revenue;p.cost=finance.cost;p.margin=finance.revenue-finance.cost;}});
 const add=(rows:string[][],kind:'wa'|'rcs')=>rows.slice(1).forEach(r=>{const client=clean(r[0]),month=monthValue(r[1]);if(!client||!month||month>currentMonth)return;const key=client+'\u0000'+month,x=monthlyMap.get(key)||emptyMonthly(client,month);if(kind==='wa'){x.waRevenue+=numberValue(r[2]);x.waCost+=numberValue(r[3])}else{x.rcsRevenue+=numberValue(r[2]);x.rcsCost+=numberValue(r[3])}monthlyMap.set(key,x)});
 add(wa,'wa');add(rcs,'rcs');
 const clientMonthly=[...monthlyMap.values()].sort((a,b)=>a.month.localeCompare(b.month)||a.client.localeCompare(b.client));
 const forecastClientMonthly=[...forecastMap.values()].sort((a,b)=>a.month.localeCompare(b.month)||a.client.localeCompare(b.client));
 const clientMap=new Map<string,any>();
 for(const x of projects){const c=clientMap.get(x.client)||{client:x.client,projectRevenue:0,projectCost:0,waRevenue:0,waCost:0,rcsRevenue:0,rcsCost:0,projects:0,live:0};c.projectRevenue+=x.revenue;c.projectCost+=x.cost;c.projects++;if(x.status==='Live')c.live++;clientMap.set(x.client,c)}
 for(const x of clientMonthly){const c=clientMap.get(x.client)||{client:x.client,projectRevenue:0,projectCost:0,waRevenue:0,waCost:0,rcsRevenue:0,rcsCost:0,projects:0,live:0};c.waRevenue+=x.waRevenue;c.waCost+=x.waCost;c.rcsRevenue+=x.rcsRevenue;c.rcsCost+=x.rcsCost;clientMap.set(x.client,c)}
 const clients=[...clientMap.values()].map(c=>({...c,totalRevenue:c.projectRevenue+c.waRevenue+c.rcsRevenue,totalCost:c.projectCost+c.waCost+c.rcsCost,margin:c.projectRevenue+c.waRevenue+c.rcsRevenue-c.projectCost-c.waCost-c.rcsCost})).sort((a,b)=>b.totalRevenue-a.totalRevenue);
 const months=[...new Set(clientMonthly.map(x=>x.month))].sort();
 const monthly=months.map(month=>clientMonthly.filter(x=>x.month===month).reduce((a,x)=>({...a,chatbotRevenue:a.chatbotRevenue+x.chatbotRevenue,chatbotMargin:a.chatbotMargin+x.chatbotRevenue-x.chatbotCost,waRevenue:a.waRevenue+x.waRevenue,waMargin:a.waMargin+x.waRevenue-x.waCost,rcsRevenue:a.rcsRevenue+x.rcsRevenue,rcsMargin:a.rcsMargin+x.rcsRevenue-x.rcsCost}),{month,chatbotRevenue:0,chatbotMargin:0,waRevenue:0,waMargin:0,rcsRevenue:0,rcsMargin:0}));
 const statuses=[...projects.reduce((m,x)=>m.set(x.status,(m.get(x.status)||0)+1),new Map<string,number>())].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
 const forecastMonths=[...new Set(forecastClientMonthly.map(x=>x.month))].sort();
 const forecastMonthly=forecastMonths.map(month=>forecastClientMonthly.filter(x=>x.month===month).reduce((a,x)=>({...a,chatbotRevenue:a.chatbotRevenue+x.chatbotRevenue,chatbotCost:a.chatbotCost+x.chatbotCost,chatbotMargin:a.chatbotMargin+x.chatbotRevenue-x.chatbotCost}),{month,periodType:'Forecast' as const,chatbotRevenue:0,chatbotCost:0,chatbotMargin:0}));
 return {consoleData:{asOf:new Date().toISOString().slice(0,10),sourceUrl,clients,projects,monthly,statuses,forecastMonthly},clientMonthly,forecastClientMonthly};
}
