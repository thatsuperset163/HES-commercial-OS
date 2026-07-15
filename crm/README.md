# HES Commercial Sales OS

Purpose-built sales tool for **Harris Exterior Solutions** to book commercial pressure washing, window cleaning, and junk removal contracts.

## Run

```bash
cd crm
npm install
npm run dev
```

For local CRM-only: Vite serves at [http://localhost:5173/sales/](http://localhost:5173/sales/) (base path `/sales/`).

**Preferred:** sync into the Harris Exteriors HQ site (`hes-blackboard`):

```bash
cd ../hes-blackboard
npm run sync:sales
npm run dev
```

Then open [http://localhost:3000/sales/](http://localhost:3000/sales/) after logging into HQ.

## Screens

- **Today** — tasks due, calls/emails/visits/quotes, pipeline, won/lost
- **Prospects** — full commercial records, filters, timeline, tasks, quotes
- **Emails** — templates, personalization, follow-ups, sent log
- **Analytics** — pipeline and activity from logged events

## Shortcuts

- `⌘/Ctrl+K` search everywhere
- `G` then `D/P/E/A` navigate
- `?` shortcut help

Data persists in browser `localStorage` (`hes-sales-os-v1`). Use **Reset demo data** in the sidebar to restore the seed.
