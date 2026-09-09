# CPaaS Account Intelligence V1

This dashboard reads its working data directly from the shared Google Sheet on load, every five minutes, and when the browser regains focus. No source snapshots are embedded in the application.

## Views

- Executive Overview
- Client Intelligence with Client 360
- Growth & Potential
- Chatbot Pipeline & FY Potential
- Sales Action Centre
- Risks & Alerts

## Core rules

- WhatsApp and RCS are active only where current revenue or consumption is present.
- Chatbot is active when a Live project is recorded, with a revenue fallback only when no project data exists.
- Chatbot pre-live potential includes Discovery, Quotes Given, Development, and UAT. Development is counted once; monthly R&M is included from the current month through March, inclusive.
- A project is priced only when the source contains both revenue and cost commercials. Incomplete packages are shown as `Pending` and are never translated into an invented zero value.
- White space identifies missing products but does not assign a made-up monetary value.

## Build

```sh
pnpm install --frozen-lockfile
pnpm run build:github
```

The production static output is created in `github-pages/`.
