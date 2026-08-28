export const dashboardSchema = `CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
)`;
