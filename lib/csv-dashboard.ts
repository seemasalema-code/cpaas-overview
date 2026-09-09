/*
 * CPaaS Account Intelligence data layer
 *
 * The four live Google Sheet exports remain the single source of truth. Every
 * reload re-normalises current source data; nothing client- or project-specific
 * is stored in the application.
 */
const clean=(value:unknown)=>String(value??'').trim();
const key=(value:unknown)=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const compactKey=(value:unknown)=>key(value).replace(/\s+/g,'');
const clientKey=(value:unknown)=>key(value).replace(/\b(private|pvt|limited|ltd|company|co)\b/g,'').replace(/\s+/g,'');
const number=(value:unknown)=>Number(clean(value).replace(/[₹,$%\s]/g,'').replace(/\((.*)\)/,'-$1').replace(/,/g,''))||0;
const hasValue=(value:unknown)=>clean(value)!==''&&clean(value)!=='-';

const column=(headers:string[],aliases:string[],fallback=-1)=>{
 const wanted=aliases.map(key),exact=headers.findIndex(header=>wanted.includes(key(header)));
 if(exact>=0)return exact;
 const partial=headers.findIndex(header=>wanted.some(name=>key(header).includes(name)));
 return partial>=0?partial:fallback;
};

export function parseCsv(text:string){
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
 for(let index=0;index<text.length;index+=1){const char=text[index];
  if(char==='"'){if(quoted&&text[index+1]==='"'){field+='"';index+=1}else quoted=!quoted}
  else if(char===','&&!quoted){row.push(field);field=''}
  else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[index+1]==='\n')index+=1;row.push(field);if(row.some(cell=>cell.trim()))rows.push(row);row=[];field=''}
  else field+=char;
 }
 row.push(field);if(row.some(cell=>cell.trim()))rows.push(row);return rows;
}

function monthValue(value:unknown){
 const raw=clean(value);if(/^\d{4}-\d{2}/.test(raw))return raw.slice(0,7);
 const short=raw.match(/^([A-Za-z]{3})[\s-](\d{2}|\d{4})$/);
 if(short){const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],index=months.indexOf(short[1].toLowerCase()),year=Number(short[2]);if(index>=0)return `${year<100?2000+year:year}-${String(index+1).padStart(2,'0')}`}
 const indian=raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);if(indian)return `${indian[3]}-${indian[2].padStart(2,'0')}`;
 const serial=Number(raw);if(serial>30000){const date=new Date(Date.UTC(1899,11,30)+serial*86400000);return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`}
 const date=new Date(raw);return Number.isNaN(date.getTime())?'':`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}
function dateValue(value:unknown){
 const raw=clean(value);if(!raw)return '';
 const indian=raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/),date=indian?new Date(Number(indian[3]),Number(indian[2])-1,Number(indian[1])):new Date(raw);
 return Number.isNaN(date.getTime())?'':date.toISOString().slice(0,10);
}
function financialYear(now=new Date()){
 const startYear=now.getMonth()>=3?now.getFullYear():now.getFullYear()-1;
 return {start:`${startYear}-04`,end:`${startYear+1}-03`,label:`FY ${startYear}-${String(startYear+1).slice(-2)}`,remainingMonths:((2-now.getMonth()+12)%12)+1};
}
function canonicalStage(value:unknown){
 const raw=clean(value),valueKey=key(raw);if(!raw)return {stage:'Unmapped',raw:'Missing stage',mapped:false};
 if(/\blive\b|deployed|launched|active/.test(valueKey))return {stage:'Live',raw,mapped:true};
 if(/discovery|requirement|scoping/.test(valueKey))return {stage:'Discovery',raw,mapped:true};
 if(/quote|proposal|commercial discussion|commercial shared/.test(valueKey))return {stage:'Quotes Given',raw,mapped:true};
 if(/development|build|implementation/.test(valueKey))return {stage:'Development',raw,mapped:true};
 if(/\buat\b|testing|user acceptance/.test(valueKey))return {stage:'UAT',raw,mapped:true};
 if(/hold|pause|blocked/.test(valueKey))return {stage:'On Hold',raw,mapped:true};
 if(/lost|closed|cancelled|cancelled/.test(valueKey))return {stage:'Closed',raw,mapped:true};
 return {stage:'Unmapped',raw,mapped:false};
}
const PRE_LIVE=new Set(['Discovery','Quotes Given','Development','UAT']);
const stageLimits:Record<string,number>={Discovery:14,'Quotes Given':21,Development:30,UAT:14};
type Monthly={client:string;month:string;chatbotRevenue:number;chatbotCost:number;waRevenue:number;waCost:number;rcsRevenue:number;rcsCost:number};
const emptyMonth=(client:string,month:string):Monthly=>({client,month,chatbotRevenue:0,chatbotCost:0,waRevenue:0,waCost:0,rcsRevenue:0,rcsCost:0});

/** Builds dashboard records from the current live source exports. */
export function buildDashboard(projectCsv:string,rmCsv:string,waCsv:string,rcsCsv:string,sourceUrl:string){
 const projectRows=parseCsv(projectCsv),rmRows=parseCsv(rmCsv),waRows=parseCsv(waCsv),rcsRows=parseCsv(rcsCsv);
 if(projectRows.length<2)throw new Error('Chatbot Projects CSV has no data rows.');
 const now=new Date(),fy=financialYear(now),currentMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`,issues:any[]=[];
 const projectHeaderIndex=projectRows.findIndex(row=>row.some(cell=>/chatbot|project/.test(key(cell))));
 if(projectHeaderIndex<0)throw new Error('Chatbot Projects is missing its header row.');
 const projectHeader=projectRows[projectHeaderIndex],projectClient=column(projectHeader,['Client Legal Name','Client','Client Name'],0),projectName=column(projectHeader,['Chatbot','Chatbot Name','Project','Project Name'],1),projectIndustry=column(projectHeader,['Industry'],2),projectOwner=column(projectHeader,['Sales Connect','Sales Owner','Owner','Project Owner'],4),projectType=column(projectHeader,['Bot Type','Chatbot Type','Type','Platform','Channel'],5),projectVendor=column(projectHeader,['Vendor'],7),projectStage=column(projectHeader,['Status','Stage','Project Stage'],8),projectStageDate=column(projectHeader,['Stage Date','Status Date','Stage Updated','Last Updated','Updated At','Modified Date']);
 if([projectClient,projectName,projectStage].some(index=>index<0))throw new Error('Chatbot Projects is missing a required client, project, or stage column.');

 const clientLabels=new Map<string,string>();
 const resolveClient=(value:unknown,fallback='')=>{const label=clean(value)||fallback,normalized=clientKey(label);if(!normalized)return label;const known=clientLabels.get(normalized);if(known)return known;clientLabels.set(normalized,label);return label;};
 const projects=projectRows.slice(projectHeaderIndex+1).filter(row=>clean(row[projectClient])||clean(row[projectName])).map((row,index)=>{
  const client=resolveClient(row[projectClient]),project=clean(row[projectName]),stageInfo=canonicalStage(row[projectStage]),stageDate=projectStageDate>=0?dateValue(row[projectStageDate]):'',daysInStage=stageDate?Math.max(0,Math.floor((now.getTime()-new Date(`${stageDate}T00:00:00`).getTime())/86400000)):null;
  const item:any={id:`${clientKey(client)}-${compactKey(project)}-${index}`,client,project,industry:clean(row[projectIndustry])||'Unclassified',owner:clean(row[projectOwner])||'Unassigned',type:clean(row[projectType])||'Unspecified',vendor:clean(row[projectVendor])||'Unspecified',status:stageInfo.raw,stage:stageInfo.stage,stageMapped:stageInfo.mapped,stageDate,daysInStage,revenue:0,cost:0,margin:0,devRevenue:0,devCost:0,monthlyRevenue:0,monthlyCost:0,commercialPresent:{devRevenue:false,devCost:false,monthlyRevenue:false,monthlyCost:false},dataIssues:[] as string[]};
  if(!client)item.dataIssues.push('Missing client');if(!project)item.dataIssues.push('Missing project name');if(!stageInfo.mapped)item.dataIssues.push(stageInfo.raw==='Missing stage'?'Missing stage':`Unmapped stage: ${stageInfo.raw}`);if(item.vendor==='Unspecified')item.dataIssues.push('Missing vendor');return item;
 });
 const byProject=new Map<string,any[]>();projects.forEach(project=>{const projectKey=compactKey(project.project),existing=byProject.get(projectKey)||[];existing.push(project);byProject.set(projectKey,existing)});
 const resolveProject=(value:unknown)=>{const target=compactKey(value),exact=byProject.get(target)||[];if(exact.length===1)return exact[0];const fuzzy=projects.filter(project=>target.length>5&&compactKey(project.project).length>5&&(compactKey(project.project).includes(target)||target.includes(compactKey(project.project))));return fuzzy.length===1?fuzzy[0]:null;};
 const duplicateProjects=new Map<string,any[]>();projects.forEach(project=>{const normalized=`${clientKey(project.client)}\u0000${compactKey(project.project)}`,matches=duplicateProjects.get(normalized)||[];matches.push(project);duplicateProjects.set(normalized,matches)});duplicateProjects.forEach(matches=>{if(matches.length>1)matches.forEach(project=>project.dataIssues.push('Duplicate client/project record'))});

 const actual=new Map<string,Monthly>();
 const addMonthly=(client:string,month:string,fields:Partial<Monthly>)=>{const normalizedClient=resolveClient(client);if(!normalizedClient||!month||month<fy.start||month>currentMonth)return;const mapKey=`${normalizedClient}\u0000${month}`,target=actual.get(mapKey)||emptyMonth(normalizedClient,month);Object.entries(fields).forEach(([field,value])=>{(target as any)[field]+=Number(value||0)});actual.set(mapKey,target);};
 const rmHeaderIndex=rmRows.findIndex(row=>row.some(cell=>/chatbot|project/.test(key(cell)))&&(row.some(cell=>key(cell)==='month')||row.some(cell=>/revenue|rental/.test(key(cell)))));
 const latestCommercial=new Map<string,{project:any;month:string;values:any}>();
 if(rmHeaderIndex>=0){
  const header=rmRows[rmHeaderIndex],rmClient=column(header,['Client','Client Name','Client Legal Name'],0),rmProject=column(header,['Chatbot','Chatbot Name','Project','Project Name'],1),rmMonth=column(header,['Month','Billing Month','Revenue Month'],3),totalRevenue=column(header,['Total Netcore Revenue','Netcore Total Revenue','Total Revenue Netcore','Total Revenue','Revenue'],34),totalCost=column(header,['Total Vendor Cost','Vendor Total Cost','Total Cost Vendor','Total Cost','Vendor Cost','Cost'],19),monthlyRevenue=column(header,['Netcore Monthly Rental','Monthly R&M Revenue','Monthly RM Revenue','Monthly Rental Revenue','R&M Revenue'],21),monthlyCost=column(header,['Vendor Monthly Rental','Monthly R&M Cost','Monthly RM Cost','Monthly Rental Cost','R&M Cost'],6),devRevenue=column(header,['Development Revenue','Dev Revenue','One Time Revenue','Implementation Revenue']),devCost=column(header,['Development Cost','Dev Cost','One Time Cost','Implementation Cost']);
  rmRows.slice(rmHeaderIndex+1).forEach((row,index)=>{
   const rawProject=clean(row[rmProject]),matched=resolveProject(rawProject),client=resolveClient(clean(row[rmClient])||matched?.client||'',matched?.client||rawProject),month=monthValue(row[rmMonth]);if(!rawProject&&!client)return;
   const legacyRevenue=totalRevenue>=0?number(row[totalRevenue]):0,legacyCost=totalCost>=0?number(row[totalCost]):0,rentalRevenue=monthlyRevenue>=0?number(row[monthlyRevenue]):0,rentalCost=monthlyCost>=0?number(row[monthlyCost]):0;
   if(month)addMonthly(client,month,{chatbotRevenue:legacyRevenue,chatbotCost:legacyCost});
   if(!matched){issues.push({id:`rm-${index}`,kind:'data',client:client||'Unmatched source row',project:rawProject||'—',issue:'R&M row could not be matched to a Chatbot project'});return;}
   if(month&&month>=fy.start&&month<=currentMonth){matched.revenue+=legacyRevenue;matched.cost+=legacyCost;matched.margin=matched.revenue-matched.cost;}
   const values={devRevenue:devRevenue>=0?number(row[devRevenue]):legacyRevenue,devCost:devCost>=0?number(row[devCost]):legacyCost,monthlyRevenue:rentalRevenue,monthlyCost:rentalCost,commercialPresent:{devRevenue:devRevenue>=0?hasValue(row[devRevenue]):totalRevenue>=0&&hasValue(row[totalRevenue]),devCost:devCost>=0?hasValue(row[devCost]):totalCost>=0&&hasValue(row[totalCost]),monthlyRevenue:monthlyRevenue>=0&&hasValue(row[monthlyRevenue]),monthlyCost:monthlyCost>=0&&hasValue(row[monthlyCost])}};
   const old=latestCommercial.get(matched.id);if(!old||month>=old.month)latestCommercial.set(matched.id,{project:matched,month:month||'0000-00',values});
  });
 }
 latestCommercial.forEach(({project,values})=>Object.assign(project,values));
 projects.forEach(project=>{const hasRevenue=project.commercialPresent.devRevenue||project.commercialPresent.monthlyRevenue,hasCost=project.commercialPresent.devCost||project.commercialPresent.monthlyCost;const hasMonthlyRevenue=project.commercialPresent.monthlyRevenue,hasMonthlyCost=project.commercialPresent.monthlyCost;project.commercialComplete=hasRevenue&&hasCost;project.isPreLive=PRE_LIVE.has(project.stage);project.isLive=project.stage==='Live';project.potentialRevenue=project.isPreLive&&project.commercialComplete?project.devRevenue+project.monthlyRevenue*fy.remainingMonths:null;project.potentialCost=project.isPreLive&&project.commercialComplete?project.devCost+project.monthlyCost*fy.remainingMonths:null;project.potentialMargin=project.potentialRevenue===null?null:project.potentialRevenue-project.potentialCost;project.potentialMarginPct=project.potentialRevenue?project.potentialMargin/project.potentialRevenue*100:null;project.forecastEligible=project.isPreLive||project.isLive;project.forecastCommercialComplete=project.isPreLive?project.commercialComplete:project.isLive&&hasMonthlyRevenue&&hasMonthlyCost;project.forecastRevenue=project.forecastCommercialComplete?(project.isLive?project.revenue+project.monthlyRevenue*fy.remainingMonths:project.potentialRevenue):null;project.forecastCost=project.forecastCommercialComplete?(project.isLive?project.cost+project.monthlyCost*fy.remainingMonths:project.potentialCost):null;project.forecastMargin=project.forecastRevenue===null?null:project.forecastRevenue-project.forecastCost;project.forecastMarginPct=project.forecastRevenue?project.forecastMargin/project.forecastRevenue*100:null;project.commercialPending=project.isPreLive&&!project.commercialComplete;project.forecastCommercialPending=project.forecastEligible&&!project.forecastCommercialComplete;project.delayed=project.isPreLive&&project.daysInStage!==null&&project.daysInStage>stageLimits[project.stage];if(project.commercialPending)project.dataIssues.push('Commercials pending');if(project.isLive&&!project.forecastCommercialComplete)project.dataIssues.push('Missing monthly R&M for live forecast');if(project.isPreLive&&project.daysInStage===null)project.dataIssues.push('Missing stage date');project.dataIssues.forEach((issue:string)=>issues.push({id:`${project.id}-${issue}`,kind:'project',client:project.client||'Unassigned',project:project.project||'—',stage:project.stage,issue}));});

 const addUsage=(rows:string[][],product:'wa'|'rcs')=>{const headerIndex=rows.findIndex(row=>row.some(cell=>['client','client name','client legal name'].includes(key(cell)))&&row.some(cell=>key(cell)==='month'));if(headerIndex<0)return;const header=rows[headerIndex],client=column(header,['Client','Client Name','Client Legal Name']),month=column(header,['Month','Billing Month','Revenue Month']),revenue=column(header,['Revenue','Total Revenue','Monthly Revenue']),cost=column(header,['Cost','Total Cost','Monthly Cost']);if([client,month,revenue,cost].some(index=>index<0))return;rows.slice(headerIndex+1).forEach(row=>{const sourceMonth=monthValue(row[month]);addMonthly(clean(row[client]),sourceMonth,product==='wa'?{waRevenue:number(row[revenue]),waCost:number(row[cost])}:{rcsRevenue:number(row[revenue]),rcsCost:number(row[cost])});});};
 addUsage(waRows,'wa');addUsage(rcsRows,'rcs');

 const clientMonthly=[...actual.values()].sort((a,b)=>a.month.localeCompare(b.month)||a.client.localeCompare(b.client));
 const clientMap=new Map<string,any>();const clientEntry=(name:string)=>{const found=clientMap.get(name);if(found)return found;const created={client:name,industry:'Unclassified',owner:'Unassigned',projects:0,live:0,projectRevenue:0,projectCost:0,waRevenue:0,waCost:0,rcsRevenue:0,rcsCost:0};clientMap.set(name,created);return created;};
 projects.forEach(project=>{const client=clientEntry(project.client);client.projects+=1;if(project.stage==='Live')client.live+=1;if(client.industry==='Unclassified'&&project.industry!=='Unclassified')client.industry=project.industry;if(client.owner==='Unassigned'&&project.owner!=='Unassigned')client.owner=project.owner;client.projectRevenue+=project.revenue;client.projectCost+=project.cost;});
 clientMonthly.forEach(row=>{const client=clientEntry(row.client);client.waRevenue+=row.waRevenue;client.waCost+=row.waCost;client.rcsRevenue+=row.rcsRevenue;client.rcsCost+=row.rcsCost;});
 const clients=[...clientMap.values()].map(client=>{const totalRevenue=client.projectRevenue+client.waRevenue+client.rcsRevenue,totalCost=client.projectCost+client.waCost+client.rcsCost;return {...client,chatbotRevenue:client.projectRevenue,chatbotCost:client.projectCost,totalRevenue,totalCost,margin:totalRevenue-totalCost};}).sort((a,b)=>b.totalRevenue-a.totalRevenue);
 const monthlyMap=new Map<string,any>();clientMonthly.forEach(row=>{const line=monthlyMap.get(row.month)||{month:row.month,chatbotRevenue:0,chatbotCost:0,waRevenue:0,waCost:0,rcsRevenue:0,rcsCost:0};['chatbotRevenue','chatbotCost','waRevenue','waCost','rcsRevenue','rcsCost'].forEach(field=>{line[field]+=(row as any)[field]});monthlyMap.set(row.month,line)});const monthly=[...monthlyMap.values()].sort((a,b)=>a.month.localeCompare(b.month));
 const statuses=[...projects.reduce((map,project)=>map.set(project.stage,(map.get(project.stage)||0)+1),new Map<string,number>())].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
 return {consoleData:{asOf:now.toISOString().slice(0,10),reportingStart:fy.start,reportingEnd:fy.end,financialYear:fy.label,remainingFYMonths:fy.remainingMonths,sourceUrl,clients,projects,monthly,statuses,sourceIssues:issues,stageThresholds:stageLimits,filterOptions:{industries:[...new Set(clients.map(client=>client.industry).filter(Boolean))].sort(),owners:[...new Set(projects.map(project=>project.owner).filter(Boolean))].sort(),vendors:[...new Set(projects.map(project=>project.vendor).filter(Boolean))].sort(),botTypes:[...new Set(projects.map(project=>project.type).filter(Boolean))].sort(),stages:[...new Set(projects.map(project=>project.stage).filter(Boolean))].sort()}},clientMonthly,forecastClientMonthly:[]};
}
