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
import { consoleData } from '@/lib/console-data';
import { clientMonthly } from '@/lib/client-monthly';
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
type View = 'overview' | 'clients' | 'projects' | 'client360';
type ProjectSort = 'default' | 'revenue' | 'margin';
const monthLabel = (m: string) =>
  new Date(m + '-01').toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
export default function Home() {
  const [data, setData] = useState<any>({
      consoleData,
      clientMonthly,
      updatedAt: null,
      updatedBy: 'Initial verified snapshot',
    }),
    allMonths = useMemo(
      () =>
        Array.from(
          new Set<string>(data.clientMonthly.map((r: any) => r.month)),
        ).sort(),
      [data.clientMonthly],
    );
  const [view, setView] = useState<View>('overview'),
    [riskClients, setRiskClients] = useState(false),
    [query, setQuery] = useState(''),
    [industry, setIndustry] = useState('All industries'),
    [status, setStatus] = useState('All statuses'),
    [botType, setBotType] = useState('All bot types'),
    [selectedMonths, setSelectedMonths] = useState<string[]>(() =>
      Array.from(new Set(clientMonthly.map((r) => r.month))).sort(),
    ),
    [projectSort, setProjectSort] = useState<ProjectSort>('default'),
    [monthOpen, setMonthOpen] = useState(false);
  const liveData = data.consoleData,
    liveMonthly = data.clientMonthly;
  const monthPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMonthOpen(false), [view]);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      fetch('/api/dashboard', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((x) => {
          if (active && x) {
            setData(x);
            const months = Array.from(
              new Set<string>(x.clientMonthly.map((r: any) => r.month)),
            ).sort();
            setSelectedMonths((current: string[]) => {
              const valid = current.filter((m) => months.includes(m));
              return valid.length ? valid : months;
            });
          }
        })
        .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 300000);
    return () => {
      active = false;
      clearInterval(timer);
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
      { waRevenue: number; waCost: number; rcsRevenue: number; rcsCost: number }
    >();
    liveMonthly
      .filter((r: any) => selectedMonths.includes(r.month))
      .forEach((r: any) => {
        const x = period.get(r.client) || {
          waRevenue: 0,
          waCost: 0,
          rcsRevenue: 0,
          rcsCost: 0,
        };
        x.waRevenue += r.waRevenue;
        x.waCost += r.waCost;
        x.rcsRevenue += r.rcsRevenue;
        x.rcsCost += r.rcsCost;
        period.set(r.client, x);
      });
    return clients.map((c: any) => {
      const x = period.get(c.client) || {
        waRevenue: 0,
        waCost: 0,
        rcsRevenue: 0,
        rcsCost: 0,
      };
      const totalRevenue = c.projectRevenue + x.waRevenue + x.rcsRevenue,
        totalCost = c.projectCost + x.waCost + x.rcsCost;
      return {
        ...c,
        ...x,
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
          <a href={liveData.sourceUrl} target="_blank">
            Open Google Sheet <ExternalLink />
          </a>
        </div>
      </aside>
      <section className="workspace">
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
          <div className="month-picker" ref={monthPickerRef}>
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
          </div>
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
          <span>Project commercials + WA + RCS</span>
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
  const [scope, setScope] = useState<'all' | 'wa' | 'rcs' | 'both'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const rows = useMemo(() => {
    const consumables = new Map<string, any>();
    monthly.forEach((r) => {
      const key = clientKey(r.client);
      const item = consumables.get(key) || {
        client: r.client,
        waRevenue: 0,
        waCost: 0,
        rcsRevenue: 0,
        rcsCost: 0,
        months: new Set<string>(),
      };
      item.waRevenue += Number(r.waRevenue || 0);
      item.waCost += Number(r.waCost || 0);
      item.rcsRevenue += Number(r.rcsRevenue || 0);
      item.rcsCost += Number(r.rcsCost || 0);
      if (r.waRevenue || r.waCost || r.rcsRevenue || r.rcsCost)
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
        const usage = consumables.get(key);
        if (!usage) return null;
        const hasWA = usage.waRevenue !== 0 || usage.waCost !== 0;
        const hasRCS = usage.rcsRevenue !== 0 || usage.rcsCost !== 0;
        if (!hasWA && !hasRCS) return null;
        return { ...chatbot, ...usage, key, hasWA, hasRCS };
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
        (scope === 'rcs' && r.hasRCS) ||
        (scope === 'both' && r.hasWA && r.hasRCS)) &&
      r.client.toLowerCase().includes(query.toLowerCase()),
  );
  const current = rows.find((r) => r.key === selected) || null;
  const history = current
    ? monthly
        .filter((r) => clientKey(r.client) === current.key)
        .sort((a, b) => a.month.localeCompare(b.month))
    : [];
  return (
    <div className="client360-wrap">
      <div className="content client360-head">
        <div className="heading">
          <div>
            <h2>Chatbot clients using consumables</h2>
            <p>Clients matched across chatbot projects, WhatsApp and RCS billing.</p>
          </div>
          <span>{visible.length} matched clients</span>
        </div>
        <div className="client360-kpis">
          <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}><b>{rows.length}</b><span>All matched</span></button>
          <button className={scope === 'wa' ? 'active' : ''} onClick={() => setScope('wa')}><b>{rows.filter(r => r.hasWA).length}</b><span>WhatsApp</span></button>
          <button className={scope === 'rcs' ? 'active' : ''} onClick={() => setScope('rcs')}><b>{rows.filter(r => r.hasRCS).length}</b><span>RCS</span></button>
          <button className={scope === 'both' ? 'active' : ''} onClick={() => setScope('both')}><b>{rows.filter(r => r.hasWA && r.hasRCS).length}</b><span>WA + RCS</span></button>
        </div>
      </div>
      <div className="client360-grid">
        <div className="table-card client360-list">
          <table><thead><tr><th>Client</th><th>Chatbots</th><th>Channels</th><th>Months</th><th>Consumables revenue</th></tr></thead>
            <tbody>{visible.map((r) => <tr key={r.key} className={selected === r.key ? 'selected' : ''} onClick={() => setSelected(r.key)}><td><b>{r.client}</b></td><td>{r.projects.length}</td><td><span className="channel-pills">{r.hasWA && <em>WA</em>}{r.hasRCS && <em>RCS</em>}</span></td><td>{r.months.size}</td><td>{compact(r.waRevenue + r.rcsRevenue)}</td></tr>)}</tbody>
          </table>
        </div>
        <aside className="client360-detail">
          {!current ? <div className="client360-empty"><Users /><b>Select a client</b><span>Click a row to see month-wise consumables and its chatbot portfolio.</span></div> : <>
            <div className="client360-detail-head"><span><small>CLIENT 360</small><b>{current.client}</b></span><button onClick={() => setSelected(null)}>×</button></div>
            <div className="client360-projects"><h3>Chatbots</h3>{current.projects.map((p:any) => <div key={p.project}><b>{p.project}</b><span>{p.type} · {p.status}</span></div>)}</div>
            <h3>Month-wise consumables</h3>
            <div className="client360-history">{history.map((r:any) => <div key={r.month}><b>{monthLabel(r.month)}</b><span>WA {compact(r.waRevenue)}<small>cost {compact(r.waCost)}</small></span><span>RCS {compact(r.rcsRevenue)}<small>cost {compact(r.rcsCost)}</small></span></div>)}</div>
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
  const [segment, setSegment] = useState<'all' | 'negative' | 'low' | 'strong'>(
    'all',
  );
  const { rows } = props,
    visible = rows.filter((p) =>
      segment === 'negative'
        ? p.margin < 0
        : segment === 'low'
          ? p.margin >= 0 && p.revenue > 0 && p.margin / p.revenue < 0.08
          : segment === 'strong'
            ? p.revenue > 0 && p.margin / p.revenue >= 0.15
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
                    {compact(c.margin)}
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
