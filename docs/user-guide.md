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
| **Home** `/` | Both clash cards for the selected week, the Clan Performance table (Hydra / Chimera / Total-All-Weeks tabs) with the **[Black List](#the-black-list)** beside it, the timeline strip and the key-usage donut. **This page is taller than a screen now** — scroll it like any other page; on a narrower display the Black List sits under Clan Performance instead of beside it. |
| **Hydra** `/hydra` | One clash: the clash card, a weekly bar chart, and the sortable **Player Breakdown** table (the one with the Trend column). |
| **Chimera** `/chimera` | The same, for Chimera. |
| **Timeline** `/timeline` | Weekly Hydra vs Chimera damage totals across every tracked week. |
| **Members** `/members` | Two cards. **Roster** — everyone, active first then former, with lifetime Hydra/Chimera totals. **Benched Roster** — just the players you have benched, names only. Click a name in either for that member's page. |
| **Settings** `/settings` | Clan Settings: clan counters, data-source status, admin access, **the Import data tab**, and Data Management (backup / restore / reset). |

**Every table shows ten players at a time.** Clan Performance, its Total tab, the Black
List, the Hydra/Chimera Player Breakdown and both `/members` cards (Roster and Benched
Roster) all carry the same strip under the table: *"1–10 of 34 players"* and a **Page N of
M** with prev/next arrows (`components/Pagination.tsx:79` sets the ten). Five things worth
knowing:

- **The `#` column keeps counting.** Rank 11 is rank 11 on page 2, not rank 1 again.
- **The arrows dim at the first and last page** rather than disappearing, so the row of
  controls doesn't jump around under your cursor. They stay clickable-looking but do
  nothing, and — unlike a normal greyed-out button — they keep their place in the Tab
  order, so keyboard users don't get thrown back to the top of the page at the end of a
  table.
- **A table that fits on one page shows no arrows at all** — just the *"1–6 of 6 players"*
  count. Nothing to page through, so nothing to press.
- **Sorting and searching apply to the whole table, not to the page you are on.** Sort by
  damage and page 1 really is the top ten. **Searching, sorting, switching tab or changing
  the Active/Former filter puts you back on page 1**, because the results you asked for
  should start at the top — otherwise a search that leaves 22 players would show you
  matches 21 and 22 and look as though it had only found two.
- **Changing the week does *not* send you back to page 1.** That is a change the app makes
  to you rather than one you asked for, so your place is kept. If the new week has fewer
  players than the page you were on, the table simply shows you the last page that has
  rows on it.

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
| `/hydra`, `/chimera` → Player Breakdown | this week's keys ÷ max keys for that clash | `components/ClashTable.tsx:174`, `lib/compute.ts:160-164` |
| Home → Clan Performance (Hydra / Chimera tabs) | the same | `components/PerformanceTable.tsx:279`, `lib/compute.ts:160-164` |
| Member page → week-by-week history row | that week's total keys ÷ 5 | `components/MemberHistoryTable.tsx:94`, `lib/compute.ts:285` |
| Member page → Lifetime card and each clash card | total keys ÷ (weeks present × max keys) | `app/members/[memberId]/page.tsx:47`, `lib/compute.ts:245` |
| Home → **Black List** | combined keys used ÷ (weeks judged × 5) — see [The Black List](#the-black-list) | `components/BlackListTable.tsx:171-177`, `lib/compute.ts:465` |

So on a Hydra table, **one key used = 33%**, two = 67%, three = 100%. On Chimera, one key
= 50%.

**B — attendance** (weeks you played ÷ weeks you were on the roster):

| Where | Formula | Code |
|---|---|---|
| `/members` → Roster table | weeks with at least one key used ÷ weeks the member has any row | `components/RosterTable.tsx:108`, `app/members/page.tsx:40` |

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
| `/hydra`, `/chimera` → Player Breakdown, column **"Trend"** | this week's **damage per key** vs the **previous week in the whole dataset**, same clash | `components/ClashTable.tsx:178`, `lib/compute.ts:166-172` |
| Member page → the Hydra / Chimera card badge | the same damage-per-key figure, taken from that member's most recent week with data | `app/members/[memberId]/page.tsx:57`, `lib/compute.ts:229-234` |
| Member page → history column **"Dmg vs Prev Week"** | this week's **total damage** vs that member's **most recent earlier week they were present for** | `components/MemberHistoryTable.tsx:97-99`, `lib/compute.ts:269-287` |

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
  (`lib/compute.ts:286`, `components/TrendBadge.tsx:10-11`). Everywhere the
  damage-per-key figure is shown instead — the `/hydra` and `/chimera` **Trend** column
  *and* the **Hydra / Chimera card badges on that same member page**, which re-read it
  (`lib/compute.ts:229-234`) — the identical situation is **flattened to `0%`**
  (`lib/compute.ts:172` ends with `?? 0`), which looks exactly like a genuinely
  unchanged week. So a member in their first week shows an em-dash in the history column
  and `0%` in the cards **on one screen**. **A `0%` on anything showing the
  damage-per-key trend may mean "no previous data", not "no change".**

The CSV **Export** buttons inherit whichever flavour the page uses — the Hydra/Chimera
export's `Trend %` is damage-per-key (`components/ClashDetailView.tsx:59`), the member
export's is total-damage-vs-prior-present-week (`app/members/[memberId]/page.tsx:190`).

### While we are here: "Progress"

The bar on each clash card is **clan key usage**, not a boss health bar. It is total keys
used ÷ (everyone with a row that week × that clash's max keys)
(`lib/compute.ts:105-107`, `lib/compute.ts:117`). 100% means every tracked member spent
every key. It has nothing to do with how far into the boss you got.

Two neighbouring numbers on the same card, for completeness: **Key Usage (Average)**
counts only members who used at least one key (`lib/compute.ts:102`, `lib/compute.ts:110`),
while **Members Participated** shows `used ≥1 key / everyone with a row that week`
(`lib/compute.ts:113` over `lib/compute.ts:116`).

---

## The Black List

On **Home**, beside the Clan Performance table. It names the members of your **current
roster** who have been short on keys often enough to be worth a conversation. Nobody
curates it — it is recomputed from the same imported rows as every other number on the page
(`lib/compute.ts:381`). You cannot type a name onto it or cross one off it. There is exactly
one manual lever, and it only ever removes: **the Bench**, below.

### A half-imported week is never judged — read this before the rule

**A week is only looked at once *both* its clashes are in the database.** You import Hydra
and Chimera separately, and between those two imports the newest week holds one clash's
rows and not the other's. If the app judged that week it would measure everybody against
five keys when only three keys' worth of rows exist, and invent missed weeks out of data
you simply hadn't uploaded yet — on a page every clanmate can read. It also, in the older
version, made a genuinely struggling player *disappear* from the list, because the roster
was read off that same half-imported week.

So: **while an import is half done, the Black List behaves exactly as if that week did not
exist at all** (`lib/compute.ts:350`, `:385-387`). It reaches one week further back to keep
its four-week window, and it goes back to normal the moment the second clash lands.

**You cannot see this happen from the header any more.** Until 2026-08-18 the header listed
the week numbers it had judged, so a half-imported week was visible at a glance; the header
now says nothing about which weeks are in the window. The information did not disappear — it
moved into the rows: the **Missed Weeks** column still prints real week numbers, and the
*weeks judged* count sits under each Participation percentage. If no row is listed, the
empty-state message tells you how many weeks are fully imported. What you have lost is the
at-a-glance check on an empty-looking list, so —

The practical consequence for your weekly routine: **finish both imports before you read
the Black List.** Between them it is showing you last week's answer, correctly labelled.

### The rule, in numbers you can check by hand

Every threshold is a named constant in `lib/constants.ts:19-38`. As of 2026-08-18 the card
header is a single line —

> **Last 4 weeks of participation.**

— and on the clan database as it stands today that is the whole of it
(`components/BlackListTable.tsx:96-98`). No list of week numbers, no listing rule. The `4` is
still read off the rule rather than typed as a digit, so it follows `BLACKLIST_WINDOW_WEEKS`
if that is ever re-pinned; but it names the window the rule is **written for**, not the
number of weeks actually judged today. On a young database with two complete weeks the line
still says four. That is the owner's call, made knowing it overstates a young window: it is a
plain label, not a report.

**A second header line appears the moment you bench somebody**, and only then. Under the line
above you get *"N players are excused from this list."* (singular *"1 player is…"*), counting
the roster members the Bench has removed — `components/BlackListTable.tsx:111-116`, gated so
that at zero benched players the header is exactly the one line quoted above. See **The
Bench**, below, for why the count is worth printing at all.

The header used to carry two other sentences — a subtitle listing the judged week numbers and
the key threshold, and below it a conditional sentence stating the listing rule. **Both are
gone**, and the excused line is not a return of either: it counts people, not thresholds. If
you remember them and are looking for them, stop looking; nothing is broken.

**Part of the rule did come back, in the table itself.** The **Missed Weeks** column header
now spells out what "missed" means — it reads *"Missed weeks (under 3 of 5 keys)"*
(`components/BlackListTable.tsx:136-138`), with both numbers read off the rule like every
other figure on this card. So the definition of the accusation now sits in the same row as
the accusation, which is where it is most useful: a reader looking at "W21, W23" beside a
player who used two keys in W21 no longer has to guess whether that counts. The **listing**
threshold — how many missed weeks get you named — is still nowhere on screen except in the
all-clear message, so the table below remains the place to check the rest: read the constant
names in the code, not the dashboard.

| | Value | Constant |
|---|---|---|
| Weeks looked at | the last **4** weeks that are **fully imported** (both clashes) | `BLACKLIST_WINDOW_WEEKS` |
| Keys available per week | **5** (3 Hydra + 2 Chimera) | `maxKeysFor("total")` |
| A week counts as **missed** when combined keys are | **under 3** of those 5 | `BLACKLIST_MIN_KEYS_PER_WEEK` |
| Listed at | **2 or more** missed weeks | `BLACKLIST_MIN_MISSES` |
| Too new to judge below | **2** weeks present in the window | `BLACKLIST_MIN_WEEKS_PRESENT` |

Read it as four steps:

1. **Take the last four fully imported weeks.** If week 24 is the newest and both its
   clashes are in, the window is **21, 22, 23, 24** and week 20 is not judged. If week 24
   is still missing its Chimera import, the window is **20, 21, 22, 23** instead — four
   weeks either way. (Fewer than four complete weeks in the database? The window is simply
   however many there are.) **The header does not name these weeks** — it says only "Last 4
   weeks of participation" — so this is the one step you do have to work out, from which
   weeks you know you have imported both clashes for.
2. **Only current roster members can be listed** — and "current" here means *has a row in
   the newest **judged** week*, i.e. the last of the weeks from step 1. In normal use that
   is the same derived Active you see on `/members`; the two only differ mid-import, and
   this is the reading that doesn't lose people while you are half way through uploading.
   Someone who has gone Former cannot appear here, however badly they played on the way
   out. **Nor can anyone you have put on the Bench** — see below; they are not measured at
   all.
3. **Go through the window weeks that player actually has results for.** Add their Hydra
   and Chimera keys for the week. **0, 1 or 2 keys is a missed week. 3, 4 or 5 is not.**
   (A **zero-key week** — present on the roster, 0 keys used — is a missed week. It is a
   real row, not a gap.)
4. **Two or more missed weeks and they are listed**, worst first: most missed weeks, then
   lowest participation, then alphabetically.

The **Missed Weeks** column prints the actual week numbers, so you can go and look at
them. The **Participation** figure is their keys over the weeks they were judged on, e.g.
`9 / 15 keys` beside `60%` — and that `15` is three judged weeks × 5 keys, which is the
next thing to know.

### The two things that surprise people

**A week they were absent for is *not* a missed week.** If a player has no row at all for
week 22 — they were not on the roster that week — week 22 is a gap, not a black mark. The
app only judges weeks a player was actually there for. This is why a member who joined
two weeks ago and has played perfectly since is never on the list: there is nothing to
miss before they arrived.

**So the number of weeks judged differs from player to player**, and the Participation
denominator moves with it. Four judged weeks is `x / 20 keys`; three judged weeks is
`x / 15`. You do not have to hunt for that number: the **Participation cell is two lines**,
the percentage above and `8 / 15 keys · 3 weeks judged` beneath it
(`components/BlackListTable.tsx:171-177`). Hovering the same cell repeats it as a longer
sentence (`:169`) — that tooltip is a convenience, not the only copy, because a tooltip
can't be reached by keyboard and never appears on a phone.

**Do not compare two players' key totals directly** — compare the percentages, or check the
denominators first. **This warning is no longer standing text on the screen.** It used to be
the closing clause of the header's second sentence, and that whole sentence was removed on
2026-08-18 along with the rest of the old header. It survives in exactly one place, the hover
sentence on each Participation cell above — which is to say: not on a phone, not for a
keyboard, and not in a screenshot. The advice is unchanged and still correct; it is largely
this page's job now rather than the dashboard's. What the screen still gives you unprompted
is the raw material for it: every Participation cell states its own denominator and its own
weeks-judged count on the second line, so two cells that disagree are visibly measured over
different numbers of weeks. If you brief a clan officer off a screenshot, say this part out
loud; the screen will not.

### It does not move with the week picker

**The Black List always covers its own trailing window of fully imported weeks.** Changing the week
at the top of the page changes the clash cards, the donut and the Hydra/Chimera tabs — it
does **not** change the Black List, exactly like the **Total (All Weeks)** tab of Clan
Performance. If you pick week 21 and the list still names weeks 22–24, that is correct,
not a stale screen.

### When it is empty

**Three** different empty messages, each with its own icon, and only one of them is good
news. Read the icon first:

All three sit under the same header, which does not change with the data — the only thing
above them that ever moves is the excused-players line, and that tracks the Bench, not the
import state. So **the message in the empty table is the only thing that tells you which
state you are in.** Read it, not the top of the card.

- 🛡 **"Nobody is on the Black List — none of the N players judged missed 2 or more of the
  weeks they played."** Green shield. **Genuinely good news**: the app measured N people
  and none of them fell short (`components/BlackListTable.tsx:218-229`). **N counts only
  players the list is allowed to measure** — so anyone you have put on the Bench is not in
  it, and neither are Former members or anyone too new to judge. A clan of 30 with 4 benched
  reads "26 players judged", and that is correct, not a missing-data bug. **When anyone is
  benched the sentence says so itself**, gaining a closing clause — *"…, and 4 excused
  players were not measured."* (singular *"1 excused player was…"*) — so the shrunken N is
  explained where it is read (`components/BlackListTable.tsx:222-227`). With nobody benched
  the clause is absent and the sentence ends at "the weeks they played."
- ⏳ **"Nobody can be judged yet — N weeks are fully imported, and a player is judged once
  they have results for at least 2 of them."** Gold hourglass. There *are* weeks, but
  nobody has been in enough of them to measure — the state a clan sits in after its first
  import and after every Reset (`components/BlackListTable.tsx:199-205`). **This is not an
  all-clear.** It used to render the green shield, which was a cheerful lie about players
  nobody had looked at. Note this message is now the **only** place the screen tells you how
  many weeks are fully imported.
- 📥 **"No clash week is fully imported yet — a week is judged once both Hydra and Chimera
  results are in, so there is nothing to measure participation against."** Gold inbox.
  There is no complete week at all: a fresh or freshly-reset database, or a very first
  import with only one clash in so far (`components/BlackListTable.tsx:189-194`). The header
  above it still says "Last 4 weeks of participation" — it always does — so this message is
  what distinguishes an empty database from a clean roster.

### The Bench — excusing someone from the list entirely

Some absences are agreed in advance: a clanmate on holiday, in hospital, mid house-move,
or someone you have told to sit a week out. The numbers are still true — they really did
use no keys — but listing them is the wrong conversation. **The Bench is how you say "this
one is settled" without touching the data.**

**Where it lives.** On the member's own page, `/members/<player>`, in the header row beside
the Export button. One button: it reads **Bench** for a player who is not benched and
**Unbench** for one who is, so the word always names what pressing it will do. It saves
immediately and the page refreshes itself — there is no confirmation and no Save step.

**It is admin-only, and it is hidden rather than greyed.** A clanmate reading the member
page does not see the button at all, and neither do you while the app is running on
sample data. If it is missing and you expect it, check that you are signed in and that the
app is connected to the clan database, not showing the demo dataset.

**What it does — the shield.** A benched player gets a small **gold shield** immediately
after their name, everywhere their name appears: all five tables (Clan Performance, its
Total tab, the Hydra/Chimera Player Breakdown, the Members Roster and the
Members Benched Roster) and the big heading on their own page. Hovering it says *"This player is safe from the blacklist."*
Nothing else about them changes — same keys, same damage, same participation percentage,
same position in every sort. The shield is a note about a decision you made, not about how
they played. **Gold, not green, on purpose**: green is this app's good-number colour — it is
what a 95% participation cell and a rising trend already use in the very rows the shield
appears in — so a green shield read as "good player" rather than "excused". Gold is not a
performance grade anywhere in the app, so it cannot be mistaken for one. The one place you
will *never* see the shield is the Black List itself: a benched player is removed from that
card before it is drawn, which is exactly why the card counts them in a line of its own
instead.

**Where you can see the whole bench at once — the Benched Roster.** `/members` shows two
cards: the **Roster** you already know, and a **Benched Roster** beside it (underneath it on
a narrower screen) listing only the players you have benched — rank and name, nothing else.
**Benching takes nobody off the Roster.** That is the whole point of the feature, so the
same name appears on both cards, with its gold shield in both. The Benched Roster is an
extra view, not a split: it answers *"who is sitting out right now"* without you scanning
the roster for shields. Two things to expect from it. It is **read-only for everybody,
including you** — the Bench/Unbench button stays on the member's own page, and there is
nothing to press on this card. And it is **always on screen**, even when it is empty: with
nobody benched it says so plainly and explains what benching is for, rather than vanishing
and reappearing the day you bench somebody.

**What it does — the removal, and it is total.** A benched player is dropped **before the
Black List measures anything**, so they are:

- not listed, no matter how many weeks they missed;
- **not in the "N players judged" count** in the all-clear message either — they are not
  measured, so they are not part of the denominator. Bench four of thirty and a clean week
  reads *"none of the 26 players judged, and 4 excused players were not measured."*

That second half is the part that surprises people, and it is deliberate: the all-clear
sentence should be a statement about the players the list actually looked at. Benching is
therefore not the same as "excusing a bad week" — it takes the player out of the exercise
until you unbench them.

**The card tells the reader it has done this**, so a shrunken denominator is never a mystery.
Bench anybody and the Black List header gains a second line, *"N players are excused from
this list."*, and the all-clear sentence gains the closing clause quoted above. Both vanish
again when nobody is benched. The count is of your **current roster** only — benching
somebody who has already gone Former does not move it, because they were never going to be
judged, and printing them would give you a number that reconciles with nothing on screen.

**What it does not do.**

- **It changes no numbers.** Every other page, table, chart and CSV is identical with the
  bench on or off. It only ever affects the Black List.
- **It is not in any CSV export** — not the Home export, not the member export. If you need
  the bench state somewhere else, read it off the shields.
- **It is per player, not per week.** There is no "benched for week 23"; it is on until you
  turn it off. Set a reminder to unbench somebody when they are back, because nothing in the
  app will.
- **An import cannot clear it.** Importing new weeks — or the same weeks again — leaves the
  bench exactly as you set it, the same way it leaves photos and Active/Former alone.
- **A backup carries it**, and a restore puts it back. A backup file taken before this
  feature existed restores with **nobody** benched, which is that file's truth.

**One setup step, and it has now been done.** The bench needs a database column,
`is_benched`, which arrives with migration `0003` in `supabase/migrations/`. The clan
database was re-inspected read-only later on 2026-08-18 and **does have that column** (one
player is benched on it today) — this is measured, not an assumption. Nothing below is
blocking you any more; it is kept because it is exactly what you will see on a database
that has not had `npm run db:migrate` run on it — a fresh clone, or a second environment:

- **The Bench itself does nothing until you do.** Press Bench on an unmigrated database and
  the button reports *"This database is missing the bench column. Run `npm run db:migrate`
  first."* and nothing is written — a clear refusal, not a silent failure.
- **Restore is also blocked, and this one can catch you out**, because it has nothing to do
  with the Bench. Backups now carry the bench state, so restoring any backup into an
  unmigrated database fails on the first member row and reports *"This database is missing a
  column the backup needs. Run `npm run db:migrate` first."* The whole restore runs in one
  transaction, so it rolls back and **no data is lost** — the database is exactly as it was —
  but the restore does not happen. If Restore is part of your recovery plan, migrate now
  rather than finding this out on the day you need it.

### What it is not

It is **not** stored anywhere, so it is not in a backup as a list — a restore recreates
it from the restored rows. It is **not** in the Home CSV export. And apart from the Bench
above — which only ever removes someone — there is no way to add or remove a name by hand:
fix the data, or accept the answer.

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
tracked week" (`lib/compute.ts:53-60`). So:

- Import a new week without someone in it, and they immediately show as **Former** on
  `/members` and on their own page. Nothing was deleted; they just aren't in the latest
  week.
- Import the next week with them back in it, and they are Active again.

**A week is a number plus its derived dates.** Weeks appear when data is imported into
them. Nothing in the app deletes a week; the only ways to remove one are a full **Reset**
or a **Restore** from a backup that predates it.

**Zero keys is a real row, not a missing one.** A player listed with `keys_used: 0` has a
**zero-key week** — present on the roster that week, contributing nothing. That is
different from being absent from the file entirely, which means they were not on the
roster at all. The distinction drives "Members Participated", `/members` Participation,
and who counts as Active.

> **Two different things, one old word.** This guide says **zero-key week** for the row
> above, and **Bench** only for the admin control that excuses a player from the Black List.
> They are unrelated: a zero-key week is imported data, the Bench is a decision you make.
> Parts of the code still use the older word for the zero-key sense (`lib/parse.ts`,
> `lib/results.ts`), so expect to meet it there.

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
  (`lib/results.ts:90-101`). They now have a zero-key Chimera week rather than being
  absent — which changes the Chimera "Members Participated" denominator and their
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
| empty, `null`, or omitted | **0** — the zero-key value |

**The one asymmetry that can cost you a number:** an unrecognised string like `"16.61 bil"`
or `"apx 3B"` is **silently stored as 0** on the import paths (`lib/parse.ts:12`), with no
error and no warning — the row imports, the damage is just gone. The **member-edit dialog
rejects it** with a message instead (`lib/results.ts:28-31`). So a typo in a pasted JSON
payload shows up as a player who mysteriously appears to have done nothing, not as a failed
import. If a top player suddenly reads 0, suspect the damage string before suspecting them.

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

**Restore needs migration `0003`, and as of 2026-08-18 the clan database has not had it.**
This is not a Bench thing even though the column came from the Bench: backups now carry
`is_benched`, so *every* restore writes that column, and a database without it refuses with
*"This database is missing a column the backup needs. Run `npm run db:migrate` first."* The
transaction rolls back and nothing is lost — but nothing is restored either. Run
`npm run db:migrate` now, not on the day you need the backup.

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
- **Every table control** — sorting, the player search box, the Active/Former filter, the
  page arrows under every table, and the week selector with its prev/next arrows.
- **The CSV Export button on every data page** — Home, Hydra, Chimera, Timeline, Members
  and each member page (`components/ExportButton.tsx:26-33`, `components/TopBar.tsx:56`,
  `app/members/[memberId]/page.tsx:261`). Settings and the sign-in page have none.
  Exports are computed in their browser from what is already rendered; there is no admin
  gate on them.

What they do **not** get:

- Every write control is **hidden, not greyed out** — the import form, the backup and
  restore buttons, the reset panel, the edit pencils, the avatar camera and the
  Bench/Unbench button are not in the page at all for them
  (`components/ImportPanel.tsx:67-70`, `components/DataManagement.tsx:137`,
  `components/MemberHistoryTable.tsx:100-104`, `components/AvatarEditor.tsx:58-72`,
  `app/members/[memberId]/page.tsx:260`). Each missing control leaves a short sentence
  explaining which account it needs — except Bench, which is silent on purpose, because the
  avatar right beside it already prints the reason.
- **The whole-dataset backup download.** `/api/backup` is gated exactly like the writes —
  an anonymous request gets the same refusal, never a file
  (`app/api/backup/route.ts:14-16`).

**The interface is not the lock.** All seven write endpoints check the admin identity on the
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
6. Repeat for the other clash. **Do both before you read the Black List** — it ignores a
   week until both clashes are in, so between the two imports it is still answering for
   last week (correctly, and it says which weeks it judged).
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
