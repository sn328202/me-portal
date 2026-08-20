# Voice capture

Press a button on your phone, say what you are thinking, and it lands in the
right room of the portal. Nothing to type, nothing to file.

```
iPhone Shortcut  ──POST──▶  /api/capture  ──▶  Claude routes it  ──▶  Supabase
   (dictation)                                                          │
   notification  ◀────────  "Added Kiln to a new itinerary."  ◀──────────┘
```

The Dictations widget on the dashboard shows the last twelve, each with an
undo button that removes exactly the rows that capture created.

---

## 1. Environment variables

All server-side. **None are `VITE_` prefixed**, so none of them reach the
browser — unlike the Supabase anon key, these must never be public.

In Vercel → your project → Settings → Environment Variables, add:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | From [console.anthropic.com](https://console.anthropic.com) → API keys. Add ~$5 of credit; this costs well under a cent per capture. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` (optional — this is the default) |
| `SUPABASE_URL` | Same URL as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role**. This bypasses RLS, which is why it is server-only. |
| `PORTAL_USER_ID` | Your `auth.users` id — Supabase → Authentication → Users → click yourself → User UID |
| `CAPTURE_TOKEN` | A long random string. Generate one with:<br>`openssl rand -base64 32` |

Then redeploy: `npx vercel --prod`.

> Keep `CAPTURE_TOKEN` out of chat, email and screenshots. It is the only thing
> standing between the internet and write access to your dashboard. To rotate
> it, change it in both places below — nothing else depends on it.

## 2. The Shortcut

On your iPhone, Shortcuts app → **+** → add these actions in order:

1. **Dictate Text**
   - Language: English
   - Stop Listening: *After Pause*
2. **Get Contents of URL**
   - URL: `https://me-portal-xi.vercel.app/api/capture`
   - Method: **POST**
   - Headers:
     - `x-capture-token` → your `CAPTURE_TOKEN`
     - `Content-Type` → `application/json`
   - Request Body: **JSON**
     - `text` → *Dictated Text* (the magic variable from step 1)
3. **Get Dictionary Value**
   - Get: *Value* for key `summary` in *Contents of URL*
4. **Show Notification**
   - Title: `Me Portal`
   - Body: *Dictionary Value*

Name it **Portal** so "Hey Siri, Portal" works.

**Put it somewhere you can reach in one press:**
- *Action Button* (iPhone 15 Pro and later): Settings → Action Button → Shortcut → Portal
- *Back Tap*: Settings → Accessibility → Touch → Back Tap → Double Tap → Portal
- *Home Screen*: long-press the shortcut → Add to Home Screen
- *Lock Screen widget*, or just "Hey Siri, Portal"

## 3. Try it

Say each of these and check where it lands:

| Say this | Should become |
|---|---|
| "we're out of oat milk" | Provisions |
| "I want to check out that ramen place in Hayes Valley" | a Daydream itinerary |
| "I keep thinking about a stamp choker, maybe three hundred dollars" | a Treasury desire |
| "remind me to descale the kettle" | a Kitchen chore |
| "we're out of oat milk and I want to try that ramen place" | **both** — it splits multi-part thoughts |
| "Piranesi by Susanna Clarke" | a Library wishlist entry |

If something lands in the wrong room, hit undo in the Dictations widget and
tell me what it should have done — the routing rules live in `api/capture.js`
under `systemPrompt`, and they are meant to be tuned against real mistakes.

---

## How it decides

`api/capture.js` loads a snapshot of what already exists before asking —
your current itineraries and their ids, trip destinations, Treasury
categories, chore rooms, and the pantry list. That context is why "the ramen
place in Hayes Valley" can attach to an itinerary you already started instead
of creating a second one, and why a new desire gets filed under *Closet*
rather than inventing a category.

Eleven tools are available to it (groceries, tasks, desires, itinerary items,
trips, library, social plans, chores, goals, habits, pantry). It can call
several in one pass, which is how one sentence becomes two entries.

## Safety

- The endpoint is POST-only and rejects anything without the token, using a
  timing-safe comparison.
- Every write sets `user_id` from the server env, never from the request, so
  a leaked token still cannot write into anyone else's rows.
- Transcripts are stored in `captures` so you can see exactly what it heard —
  which is usually the explanation when it files something strangely.
- Nothing is destructive: every tool inserts. The only delete path is undo,
  which runs as you, through RLS, and only touches the ids that capture wrote.
