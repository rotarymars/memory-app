# Memory

A personal flashcard app built on the Ebbinghaus forgetting-curve schedule.
Stack: Next.js (App Router) · Drizzle ORM · Neon Postgres · Tailwind CSS.

## How it works

Cards live on a ladder of review intervals:

| Level | Next review in |
| ----- | -------------- |
| 0     | 10 minutes     |
| 1     | 30 minutes     |
| 2     | 1 hour         |
| 3     | 2 hours        |
| 4     | 3 hours        |
| 5     | 6 hours        |
| 6     | 12 hours       |
| 7     | 1 day          |
| 8     | 2 days         |
| 9     | 3 days         |
| 10    | 5 days         |
| 11    | 10 days        |
| 12    | 15 days        |
| 13    | 1 month        |
| 14    | 2 months       |
| 15    | 3 months       |

When you recall a card correctly (**Good**), it moves up one level and the
next review is scheduled further out. If you miss it (**Again**), the card
resets to level 0 and reappears in 10 minutes.

## Setup

### 1. Create a Neon database

1. Sign up at [console.neon.tech](https://console.neon.tech).
2. Create a new project — any region is fine.
3. Copy the **pooled** connection string from the dashboard.

### 2. Configure the local env

```bash
cp .env.example .env.local
# then paste the Neon connection string into DATABASE_URL
```

### 3. Install and migrate

```bash
npm install
npm run db:push          # apply the schema to your Neon database
```

`db:push` is the fastest path for solo development — it syncs the schema
directly without generating a migration file. For team workflows use
`npm run db:generate` followed by `npm run db:migrate`.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

- **Dashboard** (`/`) — see what's due and how many cards are learning vs. mature.
- **New card** (`/cards/new`) — front, back, optional tag.
- **Review** (`/review`) — go through every card that's due. Click the card or
  press <kbd>Space</kbd> to flip. Press <kbd>1</kbd> for *Again* or <kbd>2</kbd>
  for *Good*.
- **Cards** (`/cards`) — full list with edit and delete.

## Scripts

| Command               | What it does                                     |
| --------------------- | ------------------------------------------------ |
| `npm run dev`         | Start the dev server                             |
| `npm run build`       | Production build                                 |
| `npm run start`       | Start the production server                      |
| `npm run lint`        | ESLint                                           |
| `npm run db:push`     | Sync the schema to the database (dev shortcut)   |
| `npm run db:generate` | Generate a SQL migration from the schema         |
| `npm run db:migrate`  | Apply pending migrations                         |
| `npm run db:studio`   | Open Drizzle Studio to browse the database       |

## Project layout

```
app/
  page.tsx                 # dashboard
  layout.tsx               # global shell + nav
  actions.ts               # server actions (create/update/delete/review)
  cards/
    page.tsx               # list cards
    CardForm.tsx           # shared form
    new/page.tsx           # create
    [id]/edit/page.tsx     # edit
  review/
    page.tsx               # session entry — fetches due cards
    ReviewSession.tsx      # interactive flip-and-grade UI
lib/
  db/
    client.ts              # Neon + Drizzle client
    schema.ts              # cards table
  cards.ts                 # queries
  spaced-repetition.ts     # interval ladder + applyReview()
drizzle.config.ts          # Drizzle Kit config
```
