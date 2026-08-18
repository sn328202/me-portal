# Me Portal

A personal portal — recipes and pantry, habits and chores, travel, reading, day planning,
finances and a few games — behind one login, themed however you feel that week.

Live at [me-portal-xi.vercel.app](https://me-portal-xi.vercel.app).

## Stack

React 19 + Vite 7 (plain JS), React Router 7, Supabase for auth and Postgres,
hand-written CSS with a CSS-variable theme system. Deployed on Vercel.

## Getting started

```bash
npm install
cp .env.example .env    # then fill in your keys
npm run dev
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the built output locally |
| `npm run lint` | ESLint over the whole project |

### Environment

See `.env.example`. All three are `VITE_`-prefixed, meaning **they are inlined into the
client bundle and are publicly visible** — that is expected for the Supabase anon key
(Row Level Security is what protects the data), but the Google Maps key must be
restricted by HTTP referrer in Google Cloud Console.

## Layout

```
src/
  App.jsx            routing; every route except Dashboard is lazy-loaded
  layout/AppShell    the icon rail and page frame
  contexts/          AuthContext (Supabase session), ThemeContext (the seven vibes)
  pages/             one per room: Dashboard, Atlas, DayPlanner, Larder, Treasury,
                     Library, Studio, Learning, Play, Systems, Settings, Auth
  widgets/           the dashboard cards, each toggleable from Settings
  components/        shared pieces — recipe forms, menus, kanban, maps, gamification
  hooks/             one use<Domain> hook per feature, wrapping its Supabase queries
  configs/themes     the seven themes; each remaps colours, fonts, labels and icons
  styles/            one stylesheet per widget or page
api/news.js          Vercel serverless proxy for NewsAPI
supabase/migrations  SQL migrations
```

The data pattern is consistent: a hook owns all reads and writes for its tables and
returns `{ items, loading, ...mutators }`; pages and widgets only consume hooks.

## Themes

Seven themes in `src/configs/themes.jsx` — Dark Academia, 8-Bit Arcade, Cottagecore,
The Matrix, Lofi Study, Renaissance, Cybercity. A theme is not just colours: it remaps
CSS variables, font families, section labels and icons. All seven are checked to meet
WCAG AA contrast (4.5:1 body text, 3:1 borders) against their own backgrounds.

## Deploying

Vercel is wired to the CLI rather than to git, so pushing does **not** deploy:

```bash
npx vercel --prod
```

New environment variables must be added in the Vercel dashboard
(Settings → Environment Variables) as well as in your local `.env`, then redeployed.

## Database

Supabase Postgres, ~26 tables, one hook each. Row Level Security with
`auth.uid() = user_id` policies is the only thing protecting the data, since the anon
key is public by design — so RLS must be enabled on every table.

Only some of the schema is captured under `supabase/migrations/`. Run
`supabase db pull` to capture the rest before making further changes.
