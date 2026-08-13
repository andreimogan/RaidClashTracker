# User guide — running the clan tracker (living doc)

<!-- Written for the ONE person who signs in: the clan admin/owner. Plain language,
     no setup and no architecture — those live in docs/engineer-onboarding.md.
     Every behavioural claim below was re-derived from the code cited beside it,
     not from another doc. Kept current as the app changes; update it, don't
     append to it. -->

This is the guide for **the person who signs in** — the clan admin. It answers three
questions: what the app is doing with your clash data, what you can do in it, and
**which actions can lose data**.

It does not cover installing or deploying the app (that is
[`docs/engineer-onboarding.md`](engineer-onboarding.md)), and it is not the project
overview (that is [`README.md`](../README.md)).

---

## Read this first

Four things that will bite you if nobody tells you:

1. **Restore has no confirmation.** The moment you choose a file in the picker, every
   row in the database is deleted and replaced. There is no "are you sure".
2. **An in-app JSON import replaces** the week+clash you selected. Anyone missing from
   the file you pasted is **deleted** from that clash.
3. **"Participation" and "Trend" each mean two different things** depending on which
   page you are looking at. Nothing on screen says so.
4. **Export a backup regularly and keep the file.** It is the only undo this app has.

---

## What the app tracks

Your clan plays two weekly clashes — **Hydra** and **Chimera** — and every member gets a
fixed number of keys per clash. The app stores, per member per week per clash, **how many
keys they used and how much damage they dealt**, and derives everything else from that:
totals, averages, damage per key, participation, week-over-week trends, and who is still
in the clan.

| Fact | Value | Where it comes from |
|---|---|---|
| Hydra keys per member per week | **3** | `lib/constants.ts:7` |
| Chimera keys per member per week | **2** | `lib/constants.ts:7` |
| Combined ("Total") keys per week | **5** | `lib/constants.ts:10-12` |
| Clan capacity used on the Settings card | 30 | `lib/constants.ts:4` |

**Clash dates are never typed in.** They are computed from the real in-game schedule, in
UTC, from the week number (`lib/week.ts:1-8`, `lib/week.ts:40-50`):

- **Hydra** — starts Wednesday 14:00 UTC, ends the following Wednesday 08:00 UTC.
- **Chimera** — starts Friday 11:30 UTC, ends the following Thursday 11:30 UTC.
- Both belong to **the same numbered week**, which is anchored on the Hydra Wednesday.
  The Chimera window is simply that Wednesday + 2 days through + 8 days.

So the date range you see beside a clash is derived from the week number you picked. You
cannot enter a different one from the app, and you do not need to.

---

## The pages

The sidebar has six entries (`components/Sidebar.tsx:14-21`):

| Page | What it shows |
|---|---|
| **Home** `/` | Both clash cards for the selected week, the Clan Performance table (Hydra / Chimera / Total-All-Weeks tabs), the timeline strip and the key-usage donut. |
| **Hydra** `/hydra` | One clash: the clash card, a weekly bar chart, and the sortable **Player Breakdown** table (the one with the Trend column). |
| **Chimera** `/chimera` | The same, for Chimera. |
| **Timeline** `/timeline` | Weekly Hydra vs Chimera damage totals across every tracked week. |
| **Members** `/members` | The roster — active first, then former — with lifetime Hydra/Chimera totals. Click a name for that member's page. |
| **Settings** `/settings` | Clan Settings: clan counters, data-source status, admin access, **the Import data tab**, and Data Management (backup / restore / reset). |

Two things that are deliberately **not** in the sidebar:

- **There is no sign-in link in the sidebar.** Sign-in lives at `/login`, and four
  places link to it — always only while the database is live and you are signed out:
  the Settings → Admin Access card (`app/settings/page.tsx:245`), and the short notice
  left behind by each hidden write control — the Import data tab
  (`components/ImportPanel.tsx:98`), Data Management
  (`components/DataManagement.tsx:113`) and a member page's week-by-week history
  (`components/MemberHistoryTable.tsx:72`). In demo mode the app shows no `/login` link
  anywhere, on purpose — all four branch on the demo reason first, and signing in would
  not unlock anything.
- **There is no separate Import page.** `/import` still works, but it forwards you
  straight to Clan Settings (`app/import/page.tsx:1-6`); the import UI is the
  **"Import data" tab** inside Settings (`components/SettingsTabs.tsx:5-8`).

**Sign out** exists in exactly one place: Settings → Admin Access
(`app/settings/page.tsx:185-189`).

---

## The two words that mean two things

This is the single most important section in this guide. Two column labels appear on
several pages, computed from **different formulas**, with nothing on screen to warn you.

### "Participation"

There are two genuinely different quantities behind that one word:

**A — key usage** (keys you actually used ÷ keys you could have used):

| Where | Formula | Code |
|---|---|---|
| `/hydra`, `/chimera` → Player Breakdown | this week's keys ÷ max keys for that clash | `components/ClashTable.tsx:50`, `lib/compute.ts:150-154` |
| Home → Clan Performance (Hydra / Chimera tabs) | the same | `components/PerformanceTable.tsx:174`, `lib/compute.ts:150-154` |
| Member page → week-by-week history row | that week's total keys ÷ 5 | `components/MemberHistoryTable.tsx:94`, `lib/compute.ts:275` |
| Member page → Lifetime card and each clash card | total keys ÷ (weeks present × max keys) | `app/members/[memberId]/page.tsx:47`, `lib/compute.ts:235` |

So on a Hydra table, **one key used = 33%**, two = 67%, three = 100%. On Chimera, one key
= 50%.

**B — attendance** (weeks you played ÷ weeks you were on the roster):

| Where | Formula | Code |
|---|---|---|
| `/members` → Roster table | weeks with at least one key used ÷ weeks the member has any row | `app/members/page.tsx:87`, `app/members/page.tsx:39` |

**These are not the same number and they do not move together.** A member who shows up
every week and burns exactly one Hydra key has **33%** on the Hydra table and **100%** on
`/members`. A member who plays all five keys every other week has **100%** on the clash
table for the weeks they played and **50%** on `/members`.

Rule of thumb: **`/members` answers "did they turn up"; everywhere else answers "did they
spend their keys".**

### "Trend"

Also two quantities:

| Where | What it compares | Code |
|---|---|---|
| `/hydra`, `/chimera` → Player Breakdown, column **"Trend"** | this week's **damage per key** vs the **previous week in the whole dataset**, same clash | `components/ClashTable.tsx:51`, `lib/compute.ts:156-162` |
| Member page → the Hydra / Chimera card badge | the same damage-per-key figure, taken from that member's most recent week with data | `app/members/[memberId]/page.tsx:57`, `lib/compute.ts:219-224` |
| Member page → history column **"Dmg vs Prev Week"** | this week's **total damage** vs that member's **most recent earlier week they were present for** | `components/MemberHistoryTable.tsx:97-99`, `lib/compute.ts:259-277` |

Three differences, all of which change the answer:

- **Per key vs total.** Someone who used 3 keys last week and 1 this week can be up on
  the clash table (their one key hit harder) and heavily down on their own page (they
  dealt a third of the damage).
- **Global week vs their week.** The clash table steps back exactly one numbered week,
  even if the member was not in the clan then. The member page **skips gaps** — it
  compares against the last week they actually appear in, however long ago that was.
- **What "no baseline" looks like — this splits by *column vs card*, not by page.** The
  member page's history column **"Dmg vs Prev Week"** shows an **em-dash** for a first
  week (or one whose baseline dealt no damage) — "nothing to compare against"
  (`lib/compute.ts:276`, `components/TrendBadge.tsx:10-11`). Everywhere the
  damage-per-key figure is shown instead — the `/hydra` and `/chimera` **Trend** column
  *and* the **Hydra / Chimera card badges on that same member page**, which re-read it
  (`lib/compute.ts:219-224`) — the identical situation is **flattened to `0%`**
  (`lib/compute.ts:162` ends with `?? 0`), which looks exactly like a genuinely
  unchanged week. So a member in their first week shows an em-dash in the history column
  and `0%` in the cards **on one screen**. **A `0%` on anything showing the
  damage-per-key trend may mean "no previous data", not "no change".**

The CSV **Export** buttons inherit whichever flavour the page uses — the Hydra/Chimera
export's `Trend %` is damage-per-key (`components/ClashDetailView.tsx:59`), the member
export's is total-damage-vs-prior-present-week (`app/members/[memberId]/page.tsx:190`).

### While we are here: "Progress"

The bar on each clash card is **clan key usage**, not a boss health bar. It is total keys
used ÷ (everyone with a row that week × that clash's max keys)
(`lib/compute.ts:95-97`, `lib/compute.ts:107`). 100% means every tracked member spent
every key. It has nothing to do with how far into the boss you got.

Two neighbouring numbers on the same card, for completeness: **Key Usage (Average)**
counts only members who used at least one key (`lib/compute.ts:92`, `lib/compute.ts:100`),
while **Members Participated** shows `used ≥1 key / everyone with a row that week`
(`lib/compute.ts:103` over `lib/compute.ts:106`).

---

## How the app thinks about members and weeks

**A member is created by an import.** There is no "add member" screen anywhere. The first
time a name appears in imported data, a member row is created for it
(`lib/persist.ts:56-57`, `lib/persist.ts:103-107`).

**The identity is a slug of the in-game name** (`lib/persist.ts:22-23`): lower-cased, with
every run of non-letter/non-digit characters turned into a hyphen. `"[ΚΛΕΩ] Hell"` becomes
`m-κλεω-hell`. Two consequences:

- **Case and punctuation don't create duplicates.** `"cleon"` and `"Cleon"` are the same
  member. The most recently imported spelling becomes the displayed name
  (`lib/persist.ts:104-107`).
- **A real rename does create a new member.** If someone changes their in-game name, the
  next import files them as a brand-new member and the old one becomes "Former". The app
  has no merge tool.

**"Active" is not a stored flag — it is derived.** Active means "has a row in the newest
tracked week" (`lib/compute.ts:43-50`). So:

- Import a new week without someone in it, and they immediately show as **Former** on
  `/members` and on their own page. Nothing was deleted; they just aren't in the latest
  week.
- Import the next week with them back in it, and they are Active again.

**A week is a number plus its derived dates.** Weeks appear when data is imported into
them. Nothing in the app deletes a week; the only ways to remove one are a full **Reset**
or a **Restore** from a backup that predates it.

**Zero keys is a real row, not a missing one.** A player listed with `keys_used: 0` is
recorded as **benched** — present on the roster that week, contributing nothing. That is
different from being absent from the file entirely, which means they were not on the
roster at all. The distinction drives "Members Participated", `/members` Participation,
and who counts as Active.

---

## Getting data in

There are three ways in, and **they do not behave the same way.** The difference between
*replace* and *upsert* is the difference between "this file is the complete truth for that
clash" and "add these rows to whatever is already there".

### 1. In-app JSON import — **replaces** the week + clash you chose

Settings → **Import data** tab. Pick a week, pick Hydra or Chimera, then paste or upload a
flat array of player results:

```json
[
  { "player_name": "[ΚΛΕΩ] Hell", "damage_dealt": "16.61B", "keys_used": 3 },
  { "player_name": "Smash69",     "damage_dealt": null,     "keys_used": 0 }
]
```

`data/sample-week-flat.json` is a working example. Only `player_name`, `damage_dealt` and
`keys_used` are read (`lib/import.ts:133-151`) — extra fields like `rank` are ignored
harmlessly.

**What "replace" means, precisely** (`app/api/import/route.ts:25-38` →
`lib/persist.ts:91-99` and `lib/persist.ts:120-123`): every existing row for **that week
and that clash** is deleted, then your file is inserted. So:

- A player in the database for that clash but **missing from your file is removed** from
  it. Pasting only the top 10 of a 28-player clash silently deletes the other 18.
- The delete is scoped to the week+clash pairs **present in your payload**, so importing
  Hydra never touches that week's Chimera, and importing Week 26 never touches Week 25.
- You cannot blank a clash by importing an empty array — the app rejects it
  (`lib/import.ts:127-130`).

**Guardrails:** if the target already holds rows, a yellow warning names the count and the
button changes to **"Replace data"**, which then asks **Replace / Cancel**
(`components/ImportPanel.tsx:326-360`). That is a **second click, not a typed word** — it
is easy to click through. The preview strip above the button shows how many players and
how much total damage your payload contains; check that the player count looks like a full
roster before confirming.

**Choosing the wrong week does not error — it creates that week.** Week rows are upserted
from the number you selected, with dates derived from the schedule
(`app/api/import/route.ts:27-30`, `lib/persist.ts:110-118`). If you import Week 36 by
mistake, Week 36 now exists, it is the newest week, and **it now defines who is "Active"**.
Fix it by restoring a backup, or by re-importing the correct week and resetting if the
phantom week is in the way.

### 2. CSV from the terminal — **upserts**

`npm run import -- <file>` adds and updates rows without clearing anything
(`scripts/import-csv.ts:14`). Columns are
`week_number, start_date, end_date, player, clash_type, keys_used, total_damage [, progress]`
— see `data/sample-import.csv`. This is the path that will not delete anyone; it is also
the path where a stale row simply survives forever. Full CLI syntax is in
[`docs/engineer-onboarding.md`](engineer-onboarding.md).

> There is also `npm run import:json`. With a **flat array** it behaves exactly like the
> in-app import — a **replace** of that week+clash (`scripts/import-json.ts:44`). With the
> older nested `{ week, clashes }` shape it upserts (`scripts/import-json.ts:50`). If you
> use it, know which shape your file is.

### 3. Editing one member's week — **upserts that member's two rows**

Member page → week-by-week history → the pencil on a row. You get four fields (Hydra keys
and damage, Chimera keys and damage). Saving writes **both clash rows for that member in
that week** and touches nothing else (`lib/results.ts:52-54`, `lib/results.ts:133`).

This path is **stricter** than the import paths — see damage formats below — and it cannot
invent a week: the week must already exist or the save is refused
(`lib/results.ts:112-115`).

**Two side effects worth knowing before you use it:**

- **Both rows are always written.** Edit a member who only ever had a Hydra row for that
  week, and a **Chimera 0-keys / 0-damage row is created** for them
  (`lib/results.ts:90-101`). They now count as benched in Chimera for that week rather
  than absent — which changes the Chimera "Members Participated" denominator and their
  `/members` Participation.
- **The em-dash rows are editable.** The history table lists *every* tracked week, and
  weeks the member was absent for render as dashes (`app/members/[memberId]/page.tsx:129-140`)
  — but they still get a pencil (`components/MemberHistoryTable.tsx:150-161`). Editing one
  **adds the member to that week**. If that week is the newest one, they become
  **Active**. Saving it as 0/0 still counts as present, so it raises their "weeks present"
  without raising "weeks active" — i.e. it *lowers* their `/members` Participation.

### Damage values: what the app accepts

All three paths run damage through the same parser (`lib/parse.ts:4-16`):

| You type | Stored |
|---|---|
| `16610000000` | 16,610,000,000 |
| `"16.61B"` | 16,610,000,000 |
| `"250m"` (any case) | 250,000,000 |
| `"1,200K"` (commas stripped) | 1,200,000 |
| empty, `null`, or omitted | **0** — the benched value |

**The one asymmetry that can cost you a number:** an unrecognised string like `"16.61 bil"`
or `"apx 3B"` is **silently stored as 0** on the import paths (`lib/parse.ts:12`), with no
error and no warning — the row imports, the damage is just gone. The **member-edit dialog
rejects it** with a message instead (`lib/results.ts:28-31`). So a typo in a pasted JSON
payload shows up as a mysteriously benched-looking player, not as a failed import. If a
top player suddenly reads 0, suspect the damage string before suspecting them.

**Don't retype shorthand over an exact number.** Displayed damage is shorthand, rounded —
two decimals for `B` and `M`, only **one** for `K` (`lib/format.ts:4-6`) — so typing
`16.61B` over a stored `16,614,382,110` writes the rounded value. This is why the edit dialog prefills the **raw digits** rather than the
pretty shorthand (`components/MemberHistoryTable.tsx:204-211`) — leave a field alone and
it saves unchanged.

Keys are validated on the edit path: whole numbers, 0–3 for Hydra and 0–2 for Chimera
(`lib/results.ts:40-50`).

---

## Backups — the only undo

**Settings → Data Management → Export backup** downloads the complete dataset as one JSON
file: members, weeks, results and clash meta (`lib/backup.ts:26-50`,
`app/api/backup/route.ts:18-25`). The filename carries the date.

**That file is the only undo in this app.** There is no version history, no trash, no
"revert last import" — and the free Supabase tier takes no automated backups of its own.
A bad import, a mistaken reset and a wrong edit are all recovered the same way: restore the
last good export.

Practical habit: **export before every import**, and keep the file somewhere outside this
machine. It is a few hundred KB.

---

## The actions that can lose data, ranked

### 1. Restore — no confirmation at all

Settings → Data Management → **Restore from backup** opens your operating system's file
picker. **Choosing a file performs the restore immediately**
(`components/DataManagement.tsx:189`) — there is no confirm step, no summary, no "are you
sure". The restore itself **deletes every row in all four tables** and then inserts the
file's contents (`lib/backup.ts:131-156`).

The only warning on screen is one line of small faint text: *"Restore replaces all current
data."* (`components/DataManagement.tsx:191`).

So: **do not open that picker to browse.** Pick the file you mean, and only after you have
exported a fresh backup of what you have now.

(If the file is not a valid backup it is rejected before anything is written —
`lib/backup.ts:92-97` — and the whole restore runs in one transaction, so a failure part
way through leaves the database as it was. That protects you from a corrupt file, not from
the wrong valid one.)

### 2. Reset — protected, but total

Settings → Data Management → Danger zone → **Reset database** reveals a field; you must
type **`RESET`** exactly, uppercase, before the confirm button enables
(`components/DataManagement.tsx:74-88`). It then empties **all four tables** — results,
clash meta, weeks and members (`lib/backup.ts:10`, `lib/backup.ts:52-57`) — the same
four a restore replaces.

This is the most destructive action in the app and the hardest to trigger by accident.
Restore is the opposite on both counts.

### 3. Import — one click away from wiping a clash

Covered above: a replace, guarded by a warning banner and a second click. The realistic
accident is not clicking the wrong button — it is **pasting an incomplete payload**
(a truncated copy, only the visible rows of a screenshot tool, one clash's worth of players
into the other clash). The preview's **Players** count is your check; compare it to your
roster before confirming.

### 4. Importing into the wrong week — creates the week

Covered above. It does not error, and the new week takes over as "latest", which
re-computes who is Active across the whole app.

### 5. Remove photo — immediate, no confirmation

On a member page, **Remove photo** saves as soon as it is clicked
(`components/AvatarEditor.tsx:169-180`). Only an avatar is lost, and only that member's.
Avatars are not part of clash data, but they *are* included in a backup.

### 6. Retyping a shorthand damage value — silently rounds

Covered above. Small, easy to miss, and permanent unless you have the original figure.

**Not on this list, because the app cannot do it:** deleting a member, deleting a week, or
deleting a single result. The only surgical removal available is re-importing a clash
without that player in the payload.

---

## What everyone else sees

Reading the dashboard requires no account. A clanmate opening your Vercel deployment gets:

- **Every page and every number**, identical to yours — Home, Hydra, Chimera, Timeline,
  Members, every member page, Settings' clan counters.
- **Every table control** — sorting, the player search box, the Active/Former filter, and
  the week selector with its prev/next arrows.
- **The CSV Export button on every data page** — Home, Hydra, Chimera, Timeline, Members
  and each member page (`components/ExportButton.tsx:26-33`, `components/TopBar.tsx:74`,
  `app/members/[memberId]/page.tsx:233`). Settings and the sign-in page have none.
  Exports are computed in their browser from what is already rendered; there is no admin
  gate on them.

What they do **not** get:

- Every write control is **hidden, not greyed out** — the import form, the backup and
  restore buttons, the reset panel, the edit pencils and the avatar camera are not in the
  page at all for them (`components/ImportPanel.tsx:67-70`,
  `components/DataManagement.tsx:137`, `components/MemberHistoryTable.tsx:100-104`,
  `components/AvatarEditor.tsx:58-72`). Each missing control leaves a short sentence
  explaining which account it needs.
- **The whole-dataset backup download.** `/api/backup` is gated exactly like the writes —
  an anonymous request gets the same refusal, never a file
  (`app/api/backup/route.ts:14-16`).

**The interface is not the lock.** All six write endpoints check the admin identity on the
server as the first thing they do, and return the same `401` refusal to an anonymous
visitor and to any signed-in non-admin alike (`lib/auth.ts:76-79`). Hiding the buttons is
tidiness; the server is the security. A clanmate cannot break your data by finding a URL.
The details are in [`docs/reference/auth.md`](reference/auth.md).

---

## When something goes wrong

**Failure looks different depending on which action failed** — worth knowing so you can
tell "it failed" from "it did nothing":

| Action | On success | On failure |
|---|---|---|
| **Import** | Green banner with the row count and a link to the week | Red banner in the panel, keeping multi-line validation messages intact — it names the row and field it rejected (`components/ImportPanel.tsx:39-46`) |
| **Restore / Reset** | Green banner with the summary | Red banner in the same panel (`components/DataManagement.tsx:16-28`) |
| **Edit a member's week** | The dialog just closes and the page refreshes — **there is no success toast** | The dialog **stays open** with the message inline under the fields (`components/MemberHistoryTable.tsx:257-264`) |
| **Export backup** | The file downloads | The button is a plain link, so a failure **navigates you away to a page of raw JSON** rather than showing a banner (`components/DataManagement.tsx:178`, `app/api/backup/route.ts:26-31`). Press Back. |
| **Avatar** | The new image appears | Small red text beside the avatar (`components/AvatarEditor.tsx:182`) |

**"Demo mode (sample data)" on the Settings page** means the app is not connected to your
clan database and is showing a bundled sample dataset — none of those numbers are yours,
and every write is refused (`lib/data.ts:48-51`, `lib/results.ts:61-72`). The Settings →
Data Source card tells you which state you are in, and distinguishes it from **"Connected
— no clash data yet"**, which is a real, empty database waiting for its first import
(`app/settings/page.tsx:105-160`). Fixing a demo-mode deployment is a configuration job:
see [`docs/reference/deployment.md`](reference/deployment.md).

**A full-page error screen** means the database was reachable-but-broken (a paused project,
a wrong password, a network failure). That is deliberate: the app will not quietly show
sample data in place of a real outage, so the numbers on screen are never fake.

---

## Weekly routine

1. The clash ends. **Export a backup** (Settings → Data Management).
2. Settings → **Import data** tab. Pick the week — it defaults to the current clash week —
   and the clash.
3. Check the derived date range beside it matches the clash you are uploading.
4. Paste or upload the standings. **Check the preview's player count against your roster.**
5. Import. If it says *"Replace data"*, that week+clash already has rows and they are about
   to be replaced — confirm only if your payload is the complete standings.
6. Repeat for the other clash.
7. Spot-check Home for the new week, and `/members` for anyone who has unexpectedly flipped
   to Former (that means they were missing from the newest week's data).

---

## See also

- [`docs/engineer-onboarding.md`](engineer-onboarding.md) — installing, configuring and
  deploying the app; the CLI scripts in full.
- [`docs/reference/auth.md`](reference/auth.md) — how the admin-only rule is enforced.
- [`docs/reference/data-pipeline.md`](reference/data-pipeline.md) — the ingest pipeline in
  engineering terms.
- [`docs/reference/deployment.md`](reference/deployment.md) — hosting, environments and the
  shared-database caveat.
- [`README.md`](../README.md) — project overview and index.
