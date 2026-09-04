'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  Building2,
  CircleAlert,
  ExternalLink,
  Filter,
  Layers3,
  Search,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react';
const compact = (v: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(v);
const full = (v: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(v);
const percent = (v: number, b: number) =>
  b ? `${((v / b) * 100).toFixed(1)}%` : '—';
type View = 'overview' | 'clients' | 'projects' | 'forecast' | 'client360';
type ProjectSort = 'default' | 'revenue' | 'margin';
const monthLabel = (m: string) =>
  new Date(m + '-01').toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
export default function Home() {
  const [data, setData] = useState<any | null>(null),
    allMonths = useMemo(
      () =>
        Array.from(
          new Set<string>((data?.clientMonthly ?? []).map((r: any) => r.month)),
        ).sort(),
      [data],
    );
  const [view, setView] = useState<View>('overview'),
    [isLive, setIsLive] = useState(false),
    [syncDelayed, setSyncDelayed] = useState(false),
    [retryNow, setRetryNow] = useState<null | (() => void)>(null),
    [riskClients, setRiskClients] = useState(false),
    [query, setQuery] = useState(''),
    [industry, setIndustry] = useState('All industries'),
    [status, setStatus] = useState('All statuses'),
    [botType, setBotType] = useState('All bot types'),
    [selectedMonths, setSelectedMonths] = useState<string[]>([]),
    [projectSort, setProjectSort] = useState<ProjectSort>('default'),
    [monthOpen, setMonthOpen] = useState(false);
  const liveData = data?.consoleData,
    liveMonthly = data?.clientMonthly ?? [];
  const monthPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMonthOpen(false), [view]);
  useEffect(() => {
    let active = true;
    let refreshing = false;
    let retryTimer:ReturnType<typeof setTimeout>|undefined;
    const apply = (x:any) => {
      if (!active || !x) return;
      if(x.sourceError){setSyncDelayed(true);setRetryNow(()=>refresh);clearTimeout(retryTimer);retryTimer=setTimeout(refresh,60_000);return;}
      setData(x);setIsLive(true);setSyncDelayed(false);
      setRetryNow(()=>refresh);
      const months=Array.from(new Set<string>(x.clientMonthly.map((r:any)=>r.month))).sort();
      setSelectedMonths((current:string[])=>{const valid=current.filter((m)=>months.includes(m));return valid.length?valid:months;});
    };
    const refresh = () => {
      if(refreshing)return Promise.resolve();
      refreshing=true;
      return fetch('/api/dashboard', { cache: 'no-store' })
        .then((r) => r.json().catch(() => null))
        .then(apply)
        .catch(() => {if(active){setSyncDelayed(true);setRetryNow(()=>refresh);}})
        .finally(()=>{refreshing=false;});
    };
    refresh();
    const timer = setInterval(refresh, 300000);
    const refreshWhenVisible=()=>{if(document.visibilityState==='visible')refresh();};
    document.addEventListener('visibilitychange',refreshWhenVisible);
    window.addEventListener('focus',refreshWhenVisible);
    window.addEventListener('online',refreshWhenVisible);
    return () => {
      active = false;
      clearInterval(timer);
      clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange',refreshWhenVisible);
      window.removeEventListener('focus',refreshWhenVisible);
      window.removeEventListener('online',refreshWhenVisible);
    };
  }, []);
  useEffect(() => {
    if (!monthOpen) return;
    const outside = (e: MouseEvent) => {
        if (!monthPickerRef.current?.contains(e.target as Node))
          setMonthOpen(false);
      },
      escape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setMonthOpen(false);
      };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [monthOpen]);
  if (!liveData) {
    return <main className="initial-live-state"><div className="live-sync-state"><span></span><div><b>{syncDelayed?'Live Google Sheet is taking longer than usual':'Loading live Google Sheet data'}</b><small>{syncDelayed?'The console will retry automatically. No saved dashboard snapshot is being shown.':'Reading the current Projects, R&M, WhatsApp and RCS data…'}</small>{syncDelayed&&<button type="button" className="live-retry" onClick={()=>retryNow?.()}>Retry now</button>}</div></div></main>;
  }
  const projects = liveData.projects,
    clients = liveData.clients;
  const industries = [
      'All industries',
      ...Array.from(new Set(projects.map((p) => p.industry))).sort(),
    ],
    statuses = [
      'All statuses',
      ...Array.from(new Set(projects.map((p) => p.status))).sort(),
    ],
    botTypes = [
      'All bot types',
      ...Array.from(new Set(projects.map((p) => p.type))).sort(),
    ];
  const projectRows = useMemo(() => {
    const activeClients = new Set(
        liveMonthly
          .filter((r: any) => selectedMonths.includes(r.month))
          .map((r: any) => r.client),
      ),
      monthScoped = selectedMonths.length < allMonths.length;
    const rows = projects.filter(
      (p: any) =>
        (!monthScoped || activeClients.has(p.client)) &&
        (industry === 'All industries' || p.industry === industry) &&
        (status === 'All statuses' || p.status === status) &&
        (botType === 'All bot types' || p.type === botType) &&
        `${p.client} ${p.project} ${p.owner} ${p.type}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    return projectSort === 'revenue'
      ? [...rows].sort((a: any, b: any) => b.revenue - a.revenue)
      : projectSort === 'margin'
        ? [...rows].sort((a: any, b: any) => a.margin - b.margin)
        : rows;
  }, [
    query,
    industry,
    status,
    botType,
    selectedMonths,
    projectSort,
    projects,
    liveMonthly,
    allMonths.length,
  ]);
  const periodClients = useMemo(() => {
    const period = new Map<
      string,
      { chatbotRevenue: number; chatbotCost: number; waRevenue: number; waCost: number; rcsRevenue: number; rcsCost: number }
    >();
    liveMonthly
      .filter((r: any) => selectedMonths.includes(r.month))
      .forEach((r: any) => {
        const x = period.get(r.client) || {
          chatbotRevenue: 0,
          chatbotCost: 0,
          waRevenue: 0,
          waCost: 0,
          rcsRevenue: 0,
          rcsCost: 0,
        };
        x.chatbotRevenue += Number(r.chatbotRevenue || 0);
        x.chatbotCost += Number(r.chatbotCost || 0);
        x.waRevenue += r.waRevenue;
        x.waCost += r.waCost;
        x.rcsRevenue += r.rcsRevenue;
        x.rcsCost += r.rcsCost;
        period.set(r.client, x);
      });
    return clients.map((c: any) => {
      const x = period.get(c.client) || {
        chatbotRevenue: 0,
        chatbotCost: 0,
        waRevenue: 0,
        waCost: 0,
        rcsRevenue: 0,
        rcsCost: 0,
      };
      const totalRevenue = x.chatbotRevenue + x.waRevenue + x.rcsRevenue,
        totalCost = x.chatbotCost + x.waCost + x.rcsCost;
      return {
        ...c,
        ...x,
        projectRevenue: x.chatbotRevenue,
        projectCost: x.chatbotCost,
        totalRevenue,
        totalCost,
        margin: totalRevenue - totalCost,
      };
    });
  }, [selectedMonths, clients, liveMonthly]);
  const clientRows = useMemo(
    () =>
      periodClients.filter((c) =>
        c.client.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, periodClients],
  );
  const selectedMonthly = liveData.monthly.filter((m: any) =>
    selectedMonths.includes(m.month),
  );
  const latest = selectedMonthly.at(-1),
    previous = selectedMonthly.at(-2),
    latestRevenue = latest ? latest.waRevenue + latest.rcsRevenue : 0,
    previousRevenue = previous ? previous.waRevenue + previous.rcsRevenue : 0,
    latestMargin = latest ? latest.waMargin + latest.rcsMargin : 0,
    previousMargin = previous ? previous.waMargin + previous.rcsMargin : 0;
  const revenueMove = previousRevenue
      ? ((latestRevenue - previousRevenue) / previousRevenue) * 100
      : 0,
    marginMove = previousMargin
      ? ((latestMargin - previousMargin) / Math.abs(previousMargin)) * 100
      : 0;
  const totalRevenue = periodClients.reduce((s, c) => s + c.totalRevenue, 0),
    totalCost = periodClients.reduce((s, c) => s + c.totalCost, 0),
    margin = totalRevenue - totalCost;
  const streams = [
      {
        name: 'Project',
        value: periodClients.reduce((s, c) => s + c.projectRevenue, 0),
      },
      {
        name: 'WhatsApp',
        value: periodClients.reduce((s, c) => s + c.waRevenue, 0),
      },
      {
        name: 'RCS',
        value: periodClients.reduce((s, c) => s + c.rcsRevenue, 0),
      },
    ],
    colors = ['#8db9a6', '#9ca9d9', '#e8b98b'];
  return (
    <main className="app">
      <aside>
        <div className="brand">
          <i>
            <BarChart3 />
          </i>
          <div>
            <b>CPaaS Overview</b>
            <small>Management console</small>
          </div>
        </div>
        <nav>
          <button
            onClick={() => setView('overview')}
            className={view === 'overview' ? 'on' : ''}
          >
            <Layers3 />
            Overview
          </button>
          <button
            onClick={() => setView('clients')}
            className={view === 'clients' ? 'on' : ''}
          >
            <Building2 />
            Clients
          </button>
          <button
            onClick={() => setView('projects')}
            className={view === 'projects' ? 'on' : ''}
          >
            <WalletCards />
            Projects
          </button>
          <button
            onClick={() => setView('forecast')}
            className={view === 'forecast' ? 'on' : ''}
          >
            <TrendingUp />
            Forecast
          </button>
          <button
            onClick={() => setView('client360')}
            className={view === 'client360' ? 'on' : ''}
          >
            <Users />
            Client 360
          </button>
        </nav>
        <div className="source">
          <span>Shared dataset</span>
          <b>Live Google Sheet</b>
          <small>
            {data.updatedAt
              ? `Updated ${new Date(data.updatedAt).toLocaleString('en-IN')}`
              : `Snapshot · ${liveData.asOf}`}
          </small>
          <small>{data.updatedBy}</small>
          <small>Automatically refreshes every 5 minutes</small>
          <a href="https://docs.google.com/spreadsheets/d/1udQZmSHEpLWuQJO2k0t4UvA3zU8fUFkvx_1lIfINId8/edit?gid=888299704#gid=888299704" target="_blank">
            Open Google Sheet <ExternalLink />
          </a>
        </div>
      </aside>
      <section className="workspace">
        {!isLive && <div className="live-sync-state"><span></span><div><b>{syncDelayed?'Live Sheet refresh is taking longer than expected':'Refreshing live Google Sheet'}</b><small>{syncDelayed?'The console will retry automatically; no browser or server snapshot is used.':'Reading the current source data; published figures will replace this message automatically.'}</small></div></div>}
        <header>
          <div>
            <p>Commercial intelligence</p>
            <h1>
              {view === 'overview'
                ? 'Executive overview'
                : view === 'clients'
                  ? 'Client profitability'
                  : view === 'projects'
                    ? 'Project portfolio'
                    : view === 'forecast'
                      ? 'Chatbot revenue forecast'
                      : 'Chatbot + consumables overlap'}
            </h1>
          </div>
        </header>
        <div className="filters">
          <label>
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                view === 'clients'
                  ? 'Search client…'
                  : view === 'client360'
                    ? 'Search overlapping clients…'
                  : 'Search client, project, owner or bot type…'
              }
            />
          </label>
          {view === 'projects' && (
            <>
              <label>
                <Filter />
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                >
                  {industries.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {statuses.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                <select
                  value={botType}
                  onChange={(e) => setBotType(e.target.value)}
                >
                  {botTypes.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          {view !== 'forecast' && <div className="month-picker" ref={monthPickerRef}>
            <button
              aria-expanded={monthOpen}
              onClick={() => setMonthOpen(!monthOpen)}
            >
              <Filter />
              {selectedMonths.length === allMonths.length
                ? 'All months'
                : selectedMonths.length + ' months'}
            </button>
            {monthOpen && (
              <div className="month-menu">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedMonths.length === allMonths.length}
                    onChange={(e) =>
                      setSelectedMonths(e.target.checked ? allMonths : [])
                    }
                  />
                  <b>All months</b>
                </label>
                {allMonths.map((m) => (
                  <label key={m}>
                    <input
                      type="checkbox"
                      checked={selectedMonths.includes(m)}
                      onChange={(e) =>
                        setSelectedMonths(
                          e.target.checked
                            ? [...selectedMonths, m].sort()
                            : selectedMonths.filter((x) => x !== m),
                        )
                      }
                    />
                    {monthLabel(m)}
                  </label>
                ))}
                <button
                  className="month-done"
                  onClick={() => setMonthOpen(false)}
                >
                  Done
                </button>
              </div>
            )}
          </div>}
          {view === 'overview' && (
            <div className={'mom-chip ' + (revenueMove >= 0 ? 'up' : 'down')}>
              <TrendingUp />
              <b>
                {previous
                  ? (revenueMove >= 0 ? '+' : '') +
                    revenueMove.toFixed(1) +
                    '% revenue'
                  : 'Select 2+ months'}
              </b>
              {previous && (
                <small>
                  {marginMove >= 0 ? 'Margin improved' : 'Margin softened'}{' '}
                  {Math.abs(marginMove).toFixed(1)}%
                </small>
              )}
            </div>
          )}
          <span>{view === 'forecast' ? 'Forecast · live chatbot run-rate + WA + RCS consumption' : 'Chatbot R&M + WA + RCS · from Apr 2026'}</span>
        </div>
        {view === 'overview' ? (
          <div className="content">
            <div className="kpis">
              <Kpi
                label="Total revenue"
                value={compact(totalRevenue)}
                note="Selected months + project commercials"
                icon={<TrendingUp />}
              />
              <Kpi
                label="Gross margin"
                value={compact(margin)}
                note={percent(margin, totalRevenue) + ' blended'}
                icon={<WalletCards />}
              />
              <Kpi
                label="Live projects"
                value={String(
                  projects.filter((p) => p.status === 'Live').length,
                )}
                note={projects.length + ' total projects'}
                icon={<Layers3 />}
              />
              <Kpi
                label="Clients at risk"
                value={String(periodClients.filter((c) => c.margin < 0).length)}
                note="Negative margin · click to view"
                icon={<CircleAlert />}
                onClick={() => {
                  setRiskClients(true);
                  setView('clients');
                }}
              />
            </div>
            <div className="grid">
              <Card
                title="Revenue & margin trajectory"
                sub="Monthly consumables performance"
              >
                <div className="chart">
                  <ResponsiveContainer>
                    <AreaChart data={selectedMonthly}>
                      <defs>
                        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="0"
                            stopColor="#9ca9d9"
                            stopOpacity=".38"
                          />
                          <stop
                            offset="1"
                            stopColor="#9ca9d9"
                            stopOpacity="0"
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#e9e2d8" />
                      <XAxis
                        dataKey="month"
                        tickFormatter={(x) =>
                          new Date(x + '-01').toLocaleDateString('en-IN', {
                            month: 'short',
                          })
                        }
                      />
                      <YAxis tickFormatter={compact} />
                      <Tooltip formatter={(v) => full(Number(v))} />
                      <Area
                        dataKey="waRevenue"
                        name="WA revenue"
                        stroke="#7d8fc8"
                        fill="url(#fill)"
                        strokeWidth={3}
                      />
                      <Area
                        dataKey="waMargin"
                        name="WA margin"
                        stroke="#74a18e"
                        fill="transparent"
                        strokeWidth={3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card title="Commercial mix" sub="Revenue by stream">
                <div className="donut">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={streams}
                        dataKey="value"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                      >
                        {streams.map((_, i) => (
                          <Cell key={i} fill={colors[i]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => full(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <strong>
                    {percent(streams[1].value, totalRevenue)}
                    <small>WA share</small>
                  </strong>
                </div>
                <div className="legend">
                  {streams.map((x, i) => (
                    <div key={x.name}>
                      <i style={{ background: colors[i] }} />
                      <b>{x.name}</b>
                      <span>{compact(x.value)}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Portfolio movement" sub="Projects by current status">
                <div className="chart">
                  <ResponsiveContainer>
                    <BarChart
                      data={liveData.statuses.slice(0, 7)}
                      layout="vertical"
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={90}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 7, 7, 0]}>
                        {liveData.statuses
                          .slice(0, 7)
                          .map((_: any, i: number) => (
                            <Cell
                              key={i}
                              fill={i === 0 ? '#8db9a6' : '#c1bdd1'}
                            />
                          ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card
                title="Top client contribution"
                sub="Ranked by selected-period revenue"
              >
                <div className="ranks">
                  {[...periodClients]
                    .sort((a, b) => b.totalRevenue - a.totalRevenue)
                    .slice(0, 8)
                    .map((c, i) => (
                      <div key={c.client}>
                        <em>{String(i + 1).padStart(2, '0')}</em>
                        <p>
                          <b>{c.client}</b>
                          <small>
                            {c.projects} projects ·{' '}
                            {percent(c.margin, c.totalRevenue)} margin
                          </small>
                        </p>
                        <strong>{compact(c.totalRevenue)}</strong>
                      </div>
                    ))}
                </div>
              </Card>
            </div>
          </div>
        ) : view === 'clients' ? (
          riskClients ? (
            <ClientRiskTable
              rows={clientRows}
              months={selectedMonths}
              monthly={liveMonthly}
              onClear={() => setRiskClients(false)}
            />
          ) : (
            <ClientTable
              rows={clientRows}
              months={selectedMonths}
              monthly={liveMonthly}
            />
          )
        ) : view === 'projects' ? (
          <ProjectSegmentTable
            rows={projectRows}
            months={selectedMonths}
            monthly={liveMonthly}
            sort={projectSort}
            onSort={setProjectSort}
            onReset={() => {
              setQuery('');
              setIndustry('All industries');
              setStatus('All statuses');
              setBotType('All bot types');
              setProjectSort('default');
            }}
            onOpenMonths={() => setMonthOpen(true)}
          />
        ) : view === 'forecast' ? (
          <ForecastView
            rows={data.forecastClientMonthly || []}
            monthly={liveData.forecastMonthly || []}
            actualRows={liveMonthly || []}
            query={query}
          />
        ) : (
          <Client360
            projects={projects}
            monthly={liveMonthly}
            query={query}
          />
        )}
      </section>
    </main>
  );
}

function ForecastView({ rows, monthly, actualRows, query }: { rows: any[]; monthly: any[]; actualRows: any[]; query: string }) {
  const visible = rows.filter((r) => r.client.toLowerCase().includes(query.toLowerCase()));
  const actual = actualRows.filter((r) => r.client.toLowerCase().includes(query.toLowerCase()));
  const totalRevenue = (r:any) => Number(r.chatbotRevenue||0)+Number(r.waRevenue||0)+Number(r.rcsRevenue||0);
  const totalCost = (r:any) => Number(r.chatbotCost||0)+Number(r.waCost||0)+Number(r.rcsCost||0);
  const future = visible.reduce((s, r) => s + totalRevenue(r), 0);
  const achieved = actual.reduce((s, r) => s + totalRevenue(r), 0);
  const projected = achieved + future;
  const achievement = projected ? achieved / projected * 100 : 0;
  const streams = [
    { label: 'Chatbot', className: 'chatbot', achieved: actual.reduce((s,r)=>s+Number(r.chatbotRevenue||0),0), future: visible.reduce((s,r)=>s+Number(r.chatbotRevenue||0),0) },
    { label: 'WA consumables', className: 'wa', achieved: actual.reduce((s,r)=>s+Number(r.waRevenue||0),0), future: visible.reduce((s,r)=>s+Number(r.waRevenue||0),0) },
    { label: 'RCS consumables', className: 'rcs', achieved: actual.reduce((s,r)=>s+Number(r.rcsRevenue||0),0), future: visible.reduce((s,r)=>s+Number(r.rcsRevenue||0),0) },
  ];
  const forecastMonths = query ? Array.from(new Set(visible.map(r=>r.month))).sort().map(month=>visible.filter(r=>r.month===month).reduce((a,r)=>({month,chatbotRevenue:a.chatbotRevenue+Number(r.chatbotRevenue||0),waRevenue:a.waRevenue+Number(r.waRevenue||0),rcsRevenue:a.rcsRevenue+Number(r.rcsRevenue||0),totalRevenue:a.totalRevenue+totalRevenue(r)}),{month,chatbotRevenue:0,waRevenue:0,rcsRevenue:0,totalRevenue:0})) : monthly;
  return <div className="content forecast-view">
    <div className="kpis forecast-kpis">
      <Kpi label="Projected revenue" value={compact(projected)} note="Achieved + future forecast" icon={<TrendingUp />} />
      <Kpi label="Achieved" value={compact(achieved)} note={achievement.toFixed(1) + '% of projected'} icon={<WalletCards />} />
      <Kpi label="Remaining to achieve" value={compact(future)} note="Future months" icon={<BarChart3 />} />
      <Kpi label="Achievement" value={achievement.toFixed(1) + '%'} note={`${compact(achieved)} of ${compact(projected)}`} icon={<Users />} />
    </div>
    <div className="dashboard-grid forecast-stream-grid">
      <Card title="Monthly forecast by revenue stream" sub="Live chatbot run-rate plus the trailing 3-month WA and RCS consumption average.">
        <div className="forecast-months">{forecastMonths.map((m:any) => <div className="forecast-month-card" key={m.month}><div className="forecast-month-head"><span>{monthLabel(m.month)}</span><b>{compact(m.totalRevenue)}</b></div><div className="forecast-stream-pills"><em className="chatbot">Chatbot {compact(m.chatbotRevenue)}</em><em className="wa">WA {compact(m.waRevenue)}</em><em className="rcs">RCS {compact(m.rcsRevenue)}</em></div><small>Projected revenue</small></div>)}</div>
      </Card>
      <div className="forecast-side-stack"><Card title="Projected by revenue stream" sub="Achieved plus future forecast."><div className="forecast-stream-summary">{streams.map(s=><div className={s.className} key={s.label}><b>{s.label}</b><span>{compact(s.achieved+s.future)} projected</span><small>{compact(s.achieved)} achieved</small></div>)}</div></Card><Card title="Projected vs achieved" sub="Progress against the combined forecast."><div className="forecast-progress"><div><b>{achievement.toFixed(1)}% achieved</b><span>{compact(achieved)} of {compact(projected)}</span></div><div><b>{compact(future)} remaining</b><span>Future forecast</span></div></div></Card></div>
    </div>
    <div className="table-card forecast-table"><table><thead><tr><th>Month</th><th>Chatbot</th><th>WA consumables</th><th>RCS consumables</th><th>Projected</th><th>Achieved</th><th>Remaining</th></tr></thead><tbody>{forecastMonths.map((m:any)=><tr key={m.month}><td><b>{monthLabel(m.month)}</b></td><td>{compact(m.chatbotRevenue)}</td><td>{compact(m.waRevenue)}</td><td>{compact(m.rcsRevenue)}</td><td><b>{compact(m.totalRevenue)}</b></td><td>{compact(0)}</td><td><b>{compact(m.totalRevenue)}</b></td></tr>)}</tbody></table>{!forecastMonths.length&&<div className="empty">No run-rate forecast is available. Add a live chatbot R&M month or WA/RCS consumption history.</div>}</div>
  </div>;
}
const clientKey = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/\b(private|pvt|limited|ltd|company|co)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

function Client360({
  projects,
  monthly,
  query,
}: {
  projects: any[];
  monthly: any[];
  query: string;
}) {
  const [scope, setScope] = useState<'all' | 'wa' | 'rcs'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const rows = useMemo(() => {
    const consumables = new Map<string, any>();
    monthly.forEach((r) => {
      const key = clientKey(r.client);
      const item = consumables.get(key) || {
        client: r.client,
        chatbotRevenue: 0,
        chatbotCost: 0,
        waRevenue: 0,
        waCost: 0,
        rcsRevenue: 0,
        rcsCost: 0,
        months: new Set<string>(),
      };
      item.chatbotRevenue += Number(r.chatbotRevenue || 0);
      item.chatbotCost += Number(r.chatbotCost || 0);
      item.waRevenue += Number(r.waRevenue || 0);
      item.waCost += Number(r.waCost || 0);
      item.rcsRevenue += Number(r.rcsRevenue || 0);
      item.rcsCost += Number(r.rcsCost || 0);
      if (r.chatbotRevenue || r.chatbotCost || r.waRevenue || r.waCost || r.rcsRevenue || r.rcsCost)
        item.months.add(r.month);
      consumables.set(key, item);
    });
    const chatbotClients = new Map<string, any>();
    projects.forEach((p) => {
      const key = clientKey(p.client);
      const item = chatbotClients.get(key) || {
        client: p.client,
        projects: [],
      };
      item.projects.push(p);
      chatbotClients.set(key, item);
    });
    return [...chatbotClients.entries()]
      .map(([key, chatbot]) => {
        const usage = consumables.get(key) || {client:chatbot.client,chatbotRevenue:0,chatbotCost:0,waRevenue:0,waCost:0,rcsRevenue:0,rcsCost:0,months:new Set<string>()};
        const hasWA = usage.waRevenue !== 0 || usage.waCost !== 0;
        const hasRCS = usage.rcsRevenue !== 0 || usage.rcsCost !== 0;
        const chatbotMargin=usage.chatbotRevenue-usage.chatbotCost;
        return { ...chatbot, ...usage, key, hasWA, hasRCS, chatbotMargin };
      })
      .filter(Boolean)
      .sort((a: any, b: any) =>
        String(a.client).localeCompare(String(b.client)),
      ) as any[];
  }, [projects, monthly]);
  const visible = rows.filter(
    (r) =>
      (scope === 'all' ||
        (scope === 'wa' && r.hasWA) ||
        (scope === 'rcs' && r.hasRCS)) &&
      r.client.toLowerCase().includes(query.toLowerCase()),
  );
  const current = rows.find((r) => r.key === selected) || null;
  const history = current
    ? Array.from(
        monthly
          .filter((r) => clientKey(r.client) === current.key)
          .reduce((months: Map<string, any>, r: any) => {
            const row = months.get(r.month) || {month:r.month,chatbotRevenue:0,chatbotCost:0,waRevenue:0,waCost:0,rcsRevenue:0,rcsCost:0};
            for (const field of ['chatbotRevenue','chatbotCost','waRevenue','waCost','rcsRevenue','rcsCost']) row[field] += Number(r[field] || 0);
            months.set(r.month, row);
            return months;
          }, new Map<string, any>())
          .values(),
      ).sort((a: any, b: any) => a.month.localeCompare(b.month))
    : [];
  return (
    <div className="client360-wrap">
      <div className="content client360-head">
        <div className="heading">
          <div>
            <h2>Chatbot clients using consumables</h2>
            <p>Clients matched across chatbot projects, WhatsApp and RCS billing.</p>
          </div>
          <span>{visible.length} chatbot clients</span>
        </div>
        <div className="client360-kpis">
          <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}><b>{rows.length}</b><span>Chatbot</span></button>
          <button className={scope === 'wa' ? 'active' : ''} onClick={() => setScope('wa')}><b>{rows.filter(r => r.hasWA).length}</b><span>WA</span></button>
          <button className={scope === 'rcs' ? 'active' : ''} onClick={() => setScope('rcs')}><b>{rows.filter(r => r.hasRCS).length}</b><span>RCS</span></button>
        </div>
      </div>
      <div className="client360-grid">
        <div className="table-card client360-list">
          <table><thead><tr><th>Client</th><th>Chatbots</th><th>Channels</th><th>Chatbot</th><th>WA</th><th>RCS</th><th>Chatbot margin</th></tr></thead>
            <tbody>{visible.map((r) => <tr key={r.key} className={selected === r.key ? 'selected' : ''} onClick={() => setSelected(r.key)}><td><b>{r.client}</b>{r.chatbotMargin < 0 && <em className="negative-chip">Negative margin</em>}</td><td>{r.projects.length}</td><td><span className="channel-pills">{r.hasWA && <em>WA</em>}{r.hasRCS && <em>RCS</em>}</span></td><td>{compact(r.chatbotRevenue)}</td><td>{compact(r.waRevenue)}</td><td>{compact(r.rcsRevenue)}</td><td className={r.chatbotMargin < 0 ? 'bad' : 'good'}>{compact(r.chatbotMargin)}</td></tr>)}</tbody>
          </table>
        </div>
        <aside className="client360-detail">
          {!current ? <div className="client360-empty"><Users /><b>Select a client</b><span>Click a row to see total month-wise revenue and its chatbot portfolio.</span></div> : <>
            <div className="client360-detail-head"><span><small>CLIENT 360</small><b>{current.client}{current.chatbotMargin < 0 && <em className="negative-chip">Negative margin</em>}</b></span><button onClick={() => setSelected(null)}>×</button></div>
            <div className="client360-finance"><div><small>Chatbot</small><b>{compact(current.chatbotRevenue)}</b></div><div><small>WA</small><b>{compact(current.waRevenue)}</b></div><div><small>RCS</small><b>{compact(current.rcsRevenue)}</b></div><div><small>Chatbot margin</small><b className={current.chatbotMargin < 0 ? 'bad' : 'good'}>{compact(current.chatbotMargin)}</b></div></div>
            <div className="client360-projects"><h3>Chatbots</h3>{current.projects.map((p:any) => <div key={p.project}><b>{p.project}</b><span>{p.type} · {p.status}</span></div>)}</div>
            <h3>Monthly commercial trend</h3>
            <div className="client360-history">{history.map((r:any,index:number) => {
              const total=Number(r.chatbotRevenue||0)+Number(r.waRevenue||0)+Number(r.rcsRevenue||0), cost=Number(r.chatbotCost||0)+Number(r.waCost||0)+Number(r.rcsCost||0);
              const previous=index?history[index-1]:null, previousTotal=previous?Number(previous.chatbotRevenue||0)+Number(previous.waRevenue||0)+Number(previous.rcsRevenue||0):0;
              const movement=previousTotal?((total-previousTotal)/previousTotal)*100:null;
              return <div key={r.month}>
                <span className="history-month"><b>{monthLabel(r.month)}</b><em>{movement===null?'Starting month':`${movement>=0?'▲':'▼'} ${Math.abs(movement).toFixed(1)}% MoM`}</em></span>
                <span className="history-total"><small>Total revenue</small><strong>{compact(total)}</strong><em>{percent(total-cost,total)} margin · {compact(total-cost)}</em></span>
                <span className="history-mix"><small>Channel mix</small><em>Chatbot <b>{compact(r.chatbotRevenue||0)}</b></em><em>WA <b>{compact(r.waRevenue||0)}</b></em><em>RCS <b>{compact(r.rcsRevenue||0)}</b></em></span>
              </div>;
            })}</div>
          </>}
        </aside>
      </div>
    </div>
  );
}
function Kpi({
  label,
  value,
  note,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      <i>{icon}</i>
      <span>{label}</span>
      <b>{value}</b>
      <small>{note}</small>
    </>
  );
  return onClick ? (
    <button className="kpi kpi-action" onClick={onClick}>
      {content}
    </button>
  ) : (
    <article className="kpi">{content}</article>
  );
}
function Card({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <article className="card">
      <div className="title">
        <h2>
          {title}
          <small>{sub}</small>
        </h2>
        <button>•••</button>
      </div>
      {children}
    </article>
  );
}
function ClientRiskTable({
  rows,
  months,
  monthly,
  onClear,
}: {
  rows: any[];
  months: string[];
  monthly: any[];
  onClear: () => void;
}) {
  const negative = rows.filter((c) => c.margin < 0);
  return (
    <div className="risk-client-view">
      <div className="risk-focus">
        <CircleAlert />
        <span>
          <b>Negative-margin clients highlighted</b>
          <small>
            {negative.length} clients need commercial attention in the selected
            period.
          </small>
        </span>
        <button onClick={onClear}>Show all clients</button>
      </div>
      <ClientTable rows={negative} months={months} monthly={monthly} />
    </div>
  );
}
function ProjectSegmentTable(props: {
  rows: any[];
  months: string[];
  monthly: any[];
  sort: ProjectSort;
  onSort: (s: ProjectSort) => void;
  onReset: () => void;
  onOpenMonths: () => void;
}) {
  const [segment, setSegment] = useState<'all' | 'negative' | 'low' | 'mid' | 'strong' | 'unpriced'>(
    'all',
  );
  const { rows } = props,
    visible = rows.filter((p) =>
      segment === 'negative'
        ? p.margin < 0
        : segment === 'low'
          ? p.margin >= 0 && p.revenue > 0 && p.margin / p.revenue < 0.08
          : segment === 'mid'
            ? p.revenue > 0 && p.margin / p.revenue >= 0.08 && p.margin / p.revenue < 0.15
          : segment === 'strong'
            ? p.revenue > 0 && p.margin / p.revenue >= 0.15
            : segment === 'unpriced'
              ? p.revenue <= 0 && p.margin >= 0
            : true,
    );
  const choose = (next: typeof segment) => {
    setSegment(next);
    props.onSort(next === 'negative' || next === 'low' ? 'margin' : 'default');
    if (next === 'all') props.onReset();
  };
  return (
    <div className="project-segment-wrap">
      <div className="content project-segment-head">
        <div className="heading">
          <div>
            <h2>Project commercial portfolio</h2>
            <p>
              Click a commercial segment to filter the table and every portfolio
              insight.
            </p>
          </div>
          <span>{visible.length} projects</span>
        </div>
        <div className="client-segments">
          <button
            className={segment === 'all' ? 'active' : ''}
            onClick={() => choose('all')}
          >
            <span>All projects</span>
            <b>{rows.length}</b>
            <small>Complete filtered portfolio</small>
          </button>
          <button
            className={segment === 'negative' ? 'active' : ''}
            onClick={() => choose('negative')}
          >
            <span>Negative margin</span>
            <b>{rows.filter((p) => p.margin < 0).length}</b>
            <small>Immediate commercial attention</small>
          </button>
          <button
            className={segment === 'low' ? 'active' : ''}
            onClick={() => choose('low')}
          >
            <span>Below 8% margin</span>
            <b>
              {
                rows.filter(
                  (p) =>
                    p.margin >= 0 &&
                    p.revenue > 0 &&
                    p.margin / p.revenue < 0.08,
                ).length
              }
            </b>
            <small>Margin improvement opportunity</small>
          </button>
          <button
            className={segment === 'mid' ? 'active' : ''}
            onClick={() => choose('mid')}
          >
            <span>8–15% margin</span>
            <b>{rows.filter((p) => p.revenue > 0 && p.margin / p.revenue >= 0.08 && p.margin / p.revenue < 0.15).length}</b>
            <small>Stable, with room to improve</small>
          </button>
          <button
            className={segment === 'strong' ? 'active' : ''}
            onClick={() => choose('strong')}
          >
            <span>Strong margin</span>
            <b>
              {
                rows.filter(
                  (p) => p.revenue > 0 && p.margin / p.revenue >= 0.15,
                ).length
              }
            </b>
            <small>15% and above</small>
          </button>
          <button
            className={segment === 'unpriced' ? 'active' : ''}
            onClick={() => choose('unpriced')}
          >
            <span>No revenue recorded</span>
            <b>{rows.filter((p) => p.revenue <= 0 && p.margin >= 0).length}</b>
            <small>Commercial data missing</small>
          </button>
        </div>
      </div>
      <ProjectTable {...props} rows={visible} />
    </div>
  );
}
function ClientTable({
  rows,
  months,
  monthly,
}: {
  rows: any[];
  months: string[];
  monthly: any[];
}) {
  const [segment, setSegment] = useState<'all' | 'negative' | 'low' | 'strong'>(
      'all',
    ),
    visible = rows.filter((c) =>
      segment === 'negative'
        ? c.margin < 0
        : segment === 'low'
          ? c.margin >= 0 &&
            c.totalRevenue > 0 &&
            c.margin / c.totalRevenue < 0.08
          : segment === 'strong'
            ? c.totalRevenue > 0 && c.margin / c.totalRevenue >= 0.15
            : true,
    );
  const names = new Set(visible.map((r) => r.client));
  const trend = months.map((month) =>
    monthly
      .filter((r) => r.month === month && names.has(r.client))
      .reduce(
        (a, r) => ({
          month,
          revenue: a.revenue + r.waRevenue + r.rcsRevenue,
          margin:
            a.margin + (r.waRevenue - r.waCost) + (r.rcsRevenue - r.rcsCost),
        }),
        { month, revenue: 0, margin: 0 },
      ),
  );
  return (
    <div className="content tableview">
      <div className="heading">
        <div>
          <h2>Client 360 profitability</h2>
          <p>
            Project commercials with consumables filtered across {months.length}{' '}
            selected month{months.length === 1 ? '' : 's'}.
          </p>
        </div>
        <span>{visible.length} clients</span>
      </div>
      <div className="client-segments">
        <button
          className={segment === 'all' ? 'active' : ''}
          onClick={() => setSegment('all')}
        >
          <span>All clients</span>
          <b>{rows.length}</b>
          <small>Complete selected-period view</small>
        </button>
        <button
          className={segment === 'negative' ? 'active' : ''}
          onClick={() => setSegment('negative')}
        >
          <span>Negative margin</span>
          <b>{rows.filter((c) => c.margin < 0).length}</b>
          <small>Immediate commercial attention</small>
        </button>
        <button
          className={segment === 'low' ? 'active' : ''}
          onClick={() => setSegment('low')}
        >
          <span>Below 8% margin</span>
          <b>
            {
              rows.filter(
                (c) =>
                  c.margin >= 0 &&
                  c.totalRevenue > 0 &&
                  c.margin / c.totalRevenue < 0.08,
              ).length
            }
          </b>
          <small>Margin improvement opportunity</small>
        </button>
        <button
          className={segment === 'strong' ? 'active' : ''}
          onClick={() => setSegment('strong')}
        >
          <span>Strong margin</span>
          <b>
            {
              rows.filter(
                (c) => c.totalRevenue > 0 && c.margin / c.totalRevenue >= 0.15,
              ).length
            }
          </b>
          <small>15% and above</small>
        </button>
      </div>
      <div className="client-layout">
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Projects</th>
                <th>Project</th>
                <th>WhatsApp</th>
                <th>RCS</th>
                <th>Total revenue</th>
                <th>Total margin</th>
                <th>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, 120).map((c) => (
                <tr key={c.client}>
                  <td>
                    <b>{c.client}</b>
                    <small>{c.live} live</small>
                  </td>
                  <td>{c.projects}</td>
                  <td>{compact(c.projectRevenue)}</td>
                  <td>{compact(c.waRevenue)}</td>
                  <td>{compact(c.rcsRevenue)}</td>
                  <td>
                    <b>{compact(c.totalRevenue)}</b>
                  </td>
                  <td className={c.margin < 0 ? 'bad' : 'good'}>
                    <b>{compact(c.margin)}</b>
                  </td>
                  <td>
                    <span
                      className={
                        c.margin < 0
                          ? 'pill bad'
                          : c.margin / c.totalRevenue < 0.08
                            ? 'pill warn'
                            : 'pill good'
                      }
                    >
                      {percent(c.margin, c.totalRevenue)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Card
          title="Month-on-month trend"
          sub="Consumables for visible clients"
        >
          <div className="client-trend">
            <ResponsiveContainer>
              <BarChart data={trend}>
                <CartesianGrid vertical={false} stroke="#e9e2d8" />
                <XAxis dataKey="month" tickFormatter={monthLabel} />
                <YAxis tickFormatter={compact} />
                <Tooltip
                  labelFormatter={monthLabel}
                  formatter={(v) => full(Number(v))}
                />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  fill="#9ca9d9"
                  radius={[7, 7, 0, 0]}
                />
                <Bar
                  dataKey="margin"
                  name="Margin"
                  fill="#8db9a6"
                  radius={[7, 7, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="trend-note">
            Search a client to isolate their monthly trend.
          </div>
        </Card>
      </div>
    </div>
  );
}
function ProjectTable({
  rows,
  months,
  monthly,
  sort,
  onSort,
  onReset,
  onOpenMonths,
}: {
  rows: any[];
  months: string[];
  monthly: any[];
  sort: ProjectSort;
  onSort: (s: ProjectSort) => void;
  onReset: () => void;
  onOpenMonths: () => void;
}) {
  const revenue = rows.reduce((s, p) => s + p.revenue, 0),
    cost = rows.reduce((s, p) => s + p.cost, 0),
    margin = revenue - cost,
    live = rows.filter((p) => p.status === 'Live').length,
    clientNames = new Set(rows.map((p) => p.client)),
    consumables = monthly
      .filter((r) => months.includes(r.month) && clientNames.has(r.client))
      .reduce((s, r) => s + r.waRevenue + r.rcsRevenue, 0);
  const statusData = Array.from(
    rows.reduce(
      (m, p) => m.set(p.status, (m.get(p.status) || 0) + 1),
      new Map<string, number>(),
    ),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  const botData = Array.from(
    rows.reduce(
      (m, p) => m.set(p.type, (m.get(p.type) || 0) + 1),
      new Map<string, number>(),
    ),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const watch = [...rows]
    .filter(
      (p) => p.margin < 0 || (p.revenue > 0 && p.margin / p.revenue < 0.08),
    )
    .sort((a, b) => a.margin - a.margin)
    .slice(0, 5);
  return (
    <div className="content tableview">
      <div className="heading">
        <div>
          <h2>Project commercial portfolio</h2>
          <p>
            Project commercials are lifetime values; WA + RCS reflects{' '}
            {months.length} selected month{months.length === 1 ? '' : 's'}.
          </p>
        </div>
        <span>{rows.length} projects</span>
      </div>
      <div className="portfolio-kpis">
        <button
          className={sort === 'default' ? 'active' : ''}
          onClick={onReset}
        >
          <span>Filtered projects</span>
          <b>{rows.length}</b>
          <small>{live} live · click to reset</small>
        </button>
        <button
          className={sort === 'revenue' ? 'active' : ''}
          onClick={() => onSort('revenue')}
        >
          <span>Contracted revenue</span>
          <b>{compact(revenue)}</b>
          <small>Click to rank highest first</small>
        </button>
        <button
          className={sort === 'margin' ? 'active' : ''}
          onClick={() => onSort('margin')}
        >
          <span>Gross margin</span>
          <b>{compact(margin)}</b>
          <small>Click to surface margin risk</small>
        </button>
        <button onClick={onOpenMonths}>
          <span>WA + RCS revenue</span>
          <b>{compact(consumables)}</b>
          <small>
            {months.length} selected month{months.length === 1 ? '' : 's'} ·
            change period
          </small>
        </button>
      </div>
      <div className="project-layout">
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>Project & client</th>
                <th>Industry</th>
                <th>Bot type</th>
                <th>Owner</th>
                <th>Vendor</th>
                <th>Status</th>
                <th>Revenue</th>
                <th>Cost</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={p.client + p.project + i}>
                  <td>
                    <b>{p.project}</b>
                    <small>{p.client}</small>
                  </td>
                  <td>{p.industry}</td>
                  <td>{p.type}</td>
                  <td>{p.owner}</td>
                  <td>{p.vendor}</td>
                  <td>
                    <span
                      className={
                        'status ' + p.status.toLowerCase().replaceAll(' ', '-')
                      }
                    >
                      {p.status}
                    </span>
                  </td>
                  <td>{compact(p.revenue)}</td>
                  <td>{compact(p.cost)}</td>
                  <td className={p.margin < 0 ? 'bad' : 'good'}>
                    {compact(p.margin)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="project-side">
          <article className="insight-card">
            <div className="insight-title">
              <div>
                <b>Portfolio status</b>
                <small>Filtered project movement</small>
              </div>
              <span>{percent(live, rows.length)} live</span>
            </div>
            <div className="project-status-chart">
              <ResponsiveContainer>
                <BarChart
                  data={statusData}
                  layout="vertical"
                  margin={{ left: 5, right: 12 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={82}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey="value" fill="#93bba9" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
          <article className="insight-card">
            <div className="insight-title">
              <div>
                <b>Bot type mix</b>
                <small>Top formats in view</small>
              </div>
            </div>
            <div className="mix-list">
              {botData.map((x, i) => (
                <div key={x.name}>
                  <i
                    style={{
                      background: [
                        '#9ca9d9',
                        '#8db9a6',
                        '#e8b98b',
                        '#c1bdd1',
                        '#d9a5a5',
                      ][i],
                    }}
                  />
                  <span>{x.name}</span>
                  <b>{x.value}</b>
                </div>
              ))}
            </div>
          </article>
          <article className="insight-card watch-card">
            <div className="insight-title">
              <div>
                <b>Commercial watchlist</b>
                <small>Negative or low-margin projects</small>
              </div>
            </div>
            {watch.length ? (
              <div className="watch-list">
                {watch.map((p) => (
                  <div key={p.client + p.project}>
                    <span>
                      <b>{p.project}</b>
                      <small>{p.client}</small>
                    </span>
                    <strong className={p.margin < 0 ? 'bad' : 'warn-text'}>
                      {percent(p.margin, p.revenue)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-watch">
                No low-margin projects in this filtered view.
              </p>
            )}
          </article>
        </aside>
      </div>
    </div>
  );
}
