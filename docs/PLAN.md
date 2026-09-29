# Confession Enquiry & Booking Dashboard: Phase 1 Plan

This is the plan for review before any code is written. It covers what data the
dashboard keeps, which pages it has, how the files are organised and how it
connects to HubSpot and Mailchimp. Anything marked **(decision needed)** has a
matching question in the "Questions" section at the end.

---

## 0. What the Confession documents changed

Based on the brand guidelines, Client Journey, Booking Journey Map, Marketing Strategy
and Audience Persona brief:

- **The venue:** CONFESSION, 60 Marryatt Street, Port Adelaide SA 5015. A reclaimed 1850s
  church, one event at a time. The Altar Room (up to 150 guests) is the standard offer. A
  second space is only a costed exception for 160+ confirmed guests.
- **Audience segment field added.** Every contact is tagged as *Milestone & Celebration*,
  *Corporate* or *Accessibility-led*. The strategy says to track bookings and conversion by
  segment, so the reports include a "by audience" view alongside "by event type".
- **Event types follow the strategy:** celebration, not ceremony. Wedding enquiries are
  *wedding after-party / reception kick-on*. 18ths and hens/bucks aren't marketed to, but
  they can still be logged (and marked Lost) if they enquire.
- **KPIs from the Marketing Strategy become report targets:**
  - Enquiry response time: same business day, always within 24 hours. Contacts over 24
    hours without a reply are flagged in red.
  - Proposal turnaround: 24–48 hours after the tour. A new "tour to proposal sent" speed
    metric, with overdue proposals flagged.
  - Tour booking rate, tour to proposal to booking conversion (split by audience).
  - Weekday vs weekend bookings.
- **Guest counts over 150** get a "second-room conversation" flag, matching the Booking
  Journey Map.
- **Post-event tracking (proposed):** a "review requested" date and a "review received" tick
  on Event held contacts. The strategy calls the thin review base "the single most fixable
  gap", so this shows who hasn't been asked yet.
- **Privacy for accessibility needs:** the dashboard stores only that a booking is
  accessibility-led, never details of anyone's disability or health. That counts as
  *sensitive information* under the Privacy Act and should stay in direct correspondence.
- **Email is one-to-one, not broadcast.** Mailchimp EDMs are rare for now, so the
  Mailchimp phase matters mainly for signups. Engagement tracking will be ready for when
  segmented sends start.
- **Brand:** St Patricks Blue `#252466`, Amaranth Pink `#F391BC`, Rich Black `#25282A`
  (Pantone 426C). Bebas Neue for headings, Montserrat (Regular/Bold) for body text, and
  Golden Hopes (script) used sparingly as a flourish. The layout takes its cues from the
  Booking Journey Map: navy feature cards, pink numerals, soft pink tints. The copy can
  have a little of the brand's cheek ("Confessions this week") but stays in functions
  language, not nightlife language.

### Decisions confirmed after phase 1
- Follow-up list: open leads with no contact in **5+ days** (calls, emails and tours count; notes don't).
- Pricing is **TBC**. Estimated value is typed in by hand for now, and no hire fees are assumed.
- Event types as listed in section 2 are confirmed.
- Fonts: **Bebas Neue + Montserrat** only (no Golden Hopes).
- The 2023 logo is current.
- Team members: to be confirmed. The preview uses three made-up names.
- Confirmed events move to Event held automatically the day after the event date (can be switched off).

---

## 1. How it fits together

```
 HubSpot (forms, contacts, deals)      Mailchimp (audience, campaigns)
            │  read-only                         │  read-only
            ▼                                    ▼
   ┌──────────────────────────────────────────────────────┐
   │  Netlify Functions: small server-side scripts that   │
   │  run every hour. The API keys live here and nowhere  │
   │  else.                                               │
   └──────────────────────────────────────────────────────┘
                           │ writes
                           ▼
   ┌──────────────────────────────────────────────────────┐
   │  Supabase: the database (Postgres) plus team login.  │
   │  Row Level Security: only signed-in team can read.   │
   └──────────────────────────────────────────────────────┘
                           │ reads / updates
                           ▼
   ┌──────────────────────────────────────────────────────┐
   │  The dashboard website, hosted on Netlify.           │
   │  Contains no secret keys.                            │
   └──────────────────────────────────────────────────────┘
```

- **Data only flows in.** The dashboard reads from HubSpot and Mailchimp and never
  writes back to them or sends emails. HubSpot and Mailchimp keep handling all client
  communication.
- **Changes made in the dashboard stay in the dashboard.** For example, dragging a card
  on the pipeline or logging a call.

### Tools used to build it

| Piece | Tool | Why |
|---|---|---|
| Website | React + TypeScript, built with Vite | A standard, well-supported way to build an app-like website |
| Charts | Drawn directly in the page (no chart library) | Exact brand colours, light and fast |
| Drag and drop | dnd-kit | Moving cards on the pipeline board, works on touch screens too |
| Styling | Hand-written CSS using Confession's colours and fonts | So it looks like Confession, not a generic template |
| Database + login | Supabase (Sydney region) | Keeps customer data in Australia |
| Hosting + scheduled sync | Netlify + Netlify Scheduled Functions | Hosts the site and runs the hourly sync |

Supabase and Netlify both have free plans that should cover a venue this size. One
thing to know: free Supabase projects go to sleep after a week with no activity.
The hourly sync counts as activity, so this won't be a problem once sync is running.

---

## 2. Database tables

Think of each table as a spreadsheet tab. Every table has Row Level Security switched
on, so the database refuses all requests unless they come from a signed-in team
member.

### `team_members`: who can log in
| Field | Notes |
|---|---|
| name, email | e.g. the people who handle enquiries |
| role | `admin` (can manage settings and team) or `member` |
| active | switch off to remove access without deleting their history |

Login is **invite-only**. Public sign-up is switched off in Supabase, and a login only
works if the email is also on this list.

### `contacts`: one row per person or enquiry
| Field | Notes |
|---|---|
| first_name, last_name, email, phone, company | Email is used to match people across HubSpot and Mailchimp |
| event_type | From the event types list (see below) |
| audience | Milestone & Celebration, Corporate, or Accessibility-led. Filled in from the event type, can be changed |
| event_date, guest_count, estimated_value | Estimated value can be filled in automatically as guests × price per head **(decision needed)** |
| source | Website form, Instagram, Google, Referral, Wedding expo, Mailchimp signup, Other |
| owner | A team member |
| tags | Free-form, e.g. "Hot", "Repeat client" |
| stage | Prospect, Lead, Tour booked, Toured, Proposal sent, Confirmed, Event held, or Lost |
| lost_reason, lost_reason_note | Required when stage is Lost. `lost_from_stage` records the stage they were in when lost |
| first_replied_at | When the team first replied. Used for the 24-hour response KPI |
| review_requested_at, review_received | Post-event review tracking (proposed) |
| last_contacted_at | Updated automatically when a call, email or tour is logged. Used by the follow-up list |
| hubspot_contact_id, hubspot_deal_id, mailchimp_id | Links back to the original records, used by the sync |
| created_at, updated_at | Set automatically |

**Status tag** (Prospect / Lead / Client / Lost) is **worked out from the stage
automatically**, so nobody has to set it and it can't fall out of step:

| Stage | Status |
|---|---|
| Prospect | Prospect |
| Lead, Tour booked, Toured, Proposal sent | Lead |
| Confirmed, Event held | Client |
| Lost | Lost |

### `stage_changes`: history of every move
| Field | Notes |
|---|---|
| contact, from_stage, to_stage, changed_at | Written automatically by the database whenever a stage changes, however it was changed |
| changed_by | Team member, or "HubSpot sync" |

This table powers the speed reports (how long people take to move between stages)
and the funnel. When someone skips a stage (e.g. straight from Lead to Proposal
sent), the funnel still counts them as having passed through the stages they skipped.

### `tours`: venue tours
| Field | Notes |
|---|---|
| contact, scheduled_for (date + time), host | Host is a team member |
| booked_at | When the tour was booked, so we can compare booked date with tour date |
| status | Booked, Attended, No-show, Cancelled |
| notes | Optional |

Booking a tour moves the contact to **Tour booked**. Marking it attended moves them to
**Toured**. Both are added to the timeline.

### `activities`: the timeline
One row per interaction: form submission, email (sent or received), call, note, tour
booked/attended/no-show, stage change, Mailchimp signup, EDM open, EDM click.

| Field | Notes |
|---|---|
| contact, type, occurred_at | |
| summary | A short line, e.g. "Opened: Spring Weddings EDM" or "Call: discussed Saturday dates" |
| created_by | Team member, or which sync added it |
| external_id | Stops the hourly sync adding the same thing twice |

**Privacy choice:** for emails we store the subject line, the date and whether it was
sent or received, but **not the email body**. For EDMs we store the campaign name and
whether it was an open or a click (plus the link clicked), but not full Mailchimp
activity history.

### Reference lists (editable in Settings)
- `event_types`: name, default audience, typical value, display order. Proposed starting list:
  Milestone birthday, Engagement party, Anniversary, Wedding after-party / reception
  kick-on, Celebration of life, Corporate end-of-year / Christmas party, Corporate
  milestone or launch, Small gala / fundraiser, Community or organisation function, Other
- `sources`: the source list above
- Lost reasons are fixed: date unavailable, over budget, chose another venue, went
  quiet, guest count too large, other.

### Sync bookkeeping
- `sync_runs`: when each sync ran, how many records it added or updated, and any
  errors. Shown on the Settings page so you can see if the sync has stopped.
- `sync_state`: bookmarks so each hourly sync only fetches what's new since the last run.

---

## 3. Pages

| Page | What's on it |
|---|---|
| **Login** | Email sign-in for the team |
| **Home** | Four headline numbers: new enquiries this week, tours in the next 7 days, open pipeline value, bookings confirmed in the last 30 days. Plus the funnel, follow-up list and upcoming tours |
| **Pipeline** | Board with one column per stage. Drag cards between columns. Filter by event type and owner. Dropping a card on Lost asks for the reason. Each column shows its count and total value |
| **Contacts** | Searchable, sortable list with status tags, filters (stage, status, event type, source, owner, tag) and an "Add contact" button |
| **Contact profile** | Details (editable), status tag, stage, tags, and the full timeline. Buttons to log a call, add a note, book a tour, or change stage |
| **Tours** | Upcoming tours grouped by day. Mark each as attended or no-show. A "needs outcome" list for past tours nobody has marked yet |
| **Follow-ups** | Open leads (Lead through Proposal sent) with no contact in 5+ days, oldest first. Also shown on Home |
| **Reports** | Date range picker (30 days, 90 days, 6 months, all time) and sections for: funnel and conversion rates, enquiries and tours booked per week, performance by source, performance by event type, speed, tour attendance, and lost reasons |
| **Settings** | Team members, event types and prices per head, sources, and sync status (admins only for editing) |

### Report definitions (so the numbers mean what you expect)
- **Enquiry** = a contact that became a Lead during the date range.
- **Funnel**: how many contacts reached each stage in the range, and the % that moved
  from each step to the next.
- **First reply time**: time from their first enquiry to the first outgoing email or
  call logged against them. This needs replies to be recorded in HubSpot
  **(decision needed)**.
- **Enquiry to tour**: time from becoming a Lead to the tour date.
- **Tour booking to tour date**: time between `booked_at` and `scheduled_for`.
- **Tour to proposal sent**: target 24–48 hours.
- **Tour to confirmed**: time from tour attended to Confirmed.
- **No-show rate**: no-shows ÷ (attended + no-shows).
- **Tour-to-booking conversion**: attended tours whose contact later reached Confirmed.
- **Pipeline value**: sum of estimated value for open contacts (Lead through Proposal
  sent). Confirmed value is the same sum for Confirmed and Event held.

All dates and times use Adelaide time (it switches between ACST and ACDT automatically).

---

## 4. Folder structure

```
confession-dashboard/
├── brand/                     Logos, fonts, brand guide (you upload these)
├── docs/PLAN.md               This document
├── src/                       The website
│   ├── pages/                 One file per page (Home, Pipeline, Contacts…)
│   ├── components/            Reusable pieces (contact card, status tag, charts…)
│   ├── lib/
│   │   ├── stages.ts          The stages, status rules and lost reasons, all in one place
│   │   ├── reports.ts         The calculations behind every report
│   │   └── supabase.ts        Connection to the database (public key only)
│   ├── styles/                Brand colours, fonts, spacing
│   └── sample-data/           Phase 2 only: ~60 fake contacts, deleted in phase 3
├── netlify/functions/
│   ├── sync-hubspot.ts        Hourly HubSpot import (phase 5)
│   ├── sync-mailchimp.ts      Hourly Mailchimp import (phase 6)
│   └── _shared/               Matching by email, saving to the database
├── supabase/migrations/       SQL files that create the tables and security rules
├── netlify.toml               Netlify settings, including the hourly schedule
└── README.md                  How to run it, where keys go, how sync works (phase 7)
```

---

## 5. Integrations

### HubSpot (phase 5)
- Connected with a **HubSpot private app** that has read-only permissions. You'll create
  it in HubSpot and paste its token straight into Netlify, not into chat. I'll give
  step-by-step instructions when we get there.
- Hourly, it pulls new or changed contacts, form submissions and deals (plus emails and
  calls logged in HubSpot, for the timeline and first reply time).
- New form submissions come in as **Leads**, or update the existing contact with that
  email.
- How dashboard stages map to HubSpot depends on whether you use **lifecycle stages or
  a deal pipeline (decision needed)**. Once I know, I'll write the mapping table out
  for you to check before building it.

### Mailchimp (phase 6)
- Connected with a Mailchimp API key, stored in Netlify only.
- New audience signups come in as **Prospects** (source: Mailchimp signup). If the email
  already exists, the contact is left in its current stage.
- Campaign opens and clicks are added to the timelines of contacts **already in the
  dashboard**. We won't create a contact just because someone opened an EDM.
- Heads-up: Apple Mail's privacy features auto-"open" emails, so open counts run high.
  Clicks are the more reliable signal.

### Matching
Everything is matched on email address (ignoring upper/lower case and extra spaces).
If one person uses two email addresses, they'll show up as two contacts. A "merge
contacts" button could be added later if that turns out to happen often.

---

## 6. Security and privacy checklist
- Row Level Security on every table. Only active team members can read or write.
- Invite-only login with public sign-up turned off.
- The Supabase "service role" key (full database access), the HubSpot token and the
  Mailchimp key are stored **only** in Netlify environment variables, and are used
  **only** inside Netlify Functions. The browser only gets Supabase's public key, which
  can't do anything without a valid login because of Row Level Security.
- Database hosted in Supabase's Sydney region.
- Data minimisation: no email bodies, no full Mailchimp activity history, no fields we
  don't report on (no addresses, dates of birth, etc.).
- A way to delete a contact completely (with its timeline), for privacy requests.
- Proposed: a retention rule for old Lost contacts **(decision needed)**.

---

## 7. Phases (with a check-in after each)
1. **Plan** (this document)
2. **Dashboard with sample data**: all pages clickable with ~60 realistic fake
   contacts. Nothing to set up on your side. I'll send a preview link or screenshots.
3. **Supabase + login**: you create a free Supabase account and project. I'll create
   the tables and security rules, and switch the dashboard to the real database.
4. **Deploy to Netlify**: you create a Netlify account and connect this GitHub repo.
   You'll copy two *public* Supabase values into Netlify settings.
5. **HubSpot**: you create a read-only private app in HubSpot and paste its token
   into Netlify.
6. **Mailchimp**: you create an API key and paste it into Netlify.
7. **README**

---

## 8. Automations requested after phase 2 (proposed, needs decisions)

These go beyond the original "read-only" rule, so each needs an explicit yes before it's built.

### Google Calendar (tours)
- **Recommended:** when a tour is booked, rescheduled or cancelled in the dashboard, a Netlify
  Function creates, moves or deletes the event on the venue manager's Google Calendar
  (Google Calendar API). Setup depends on whether the venue uses Google Workspace or a personal Gmail.
- **Optional:** add the client as a guest on that event. Google then sends them the invite,
  updates it when the tour moves and cancels it if it's cancelled. This gives a free, automatic
  confirmation, but it looks like a calendar invite rather than a branded email.
- A read-only "subscribe to calendar" feed is simpler but Google only refreshes those every
  few hours, which is too slow for tours.

### Tour confirmation and reminder emails
- The dashboard itself still never sends email. It would pass the tour details to the tool
  that sends the email:
  - **HubSpot:** set "tour date/time" properties on the contact; a HubSpot workflow sends
    the confirmation and a reminder the day before. Needs a HubSpot plan that includes workflows.
  - **Mailchimp:** Mailchimp is built for marketing to subscribers. One-off confirmations to
    people who haven't opted in belong in Mailchimp Transactional (a paid add-on), not a normal
    audience journey.
- Recommendation: HubSpot workflows if the plan allows, because HubSpot already owns client
  email. Otherwise use the Google Calendar guest invite.

### Built in the preview already
- New leads section on Home (unactioned HubSpot enquiries and this week's Mailchimp signups).
- Client journey map on each profile, following the Client Journey A3.
- Tours: calendar view by default, list view with cards, reschedule and cancel.
  Cancelling the only booked tour moves the contact back to Lead.

### Later
- Drag-and-drop on the client journey map itself (e.g. said yes → booked → paid).

### Added after the second round of feedback
- **Bookings** replaces Tours: one calendar for venue tours and events. Drag a booking to another
  day, click it to see the client (with edit and open-profile buttons), click an empty spot to book.
  Events can be *held* (pencilled in, not paid) or *confirmed* (deposit paid, moves the contact to
  Confirmed). The venue runs one event at a time, so a second event on the same date is flagged as a clash.
  An optional layer shows the dates open leads have asked for.
- New table: `events` (contact, date, start and end time, space, guests, status hold/confirmed/cancelled, notes).
- **Forms:** a Confession-branded enquiry form that the dashboard hosts at `/forms/enquiry` (public,
  no login) and WordPress embeds with a Custom HTML block. Submissions go to a Netlify Function that
  blocks spam, saves straight into Supabase and shows up in New leads. Known email addresses are added to
  the existing contact rather than duplicated. Optional extras (need a yes): forward a copy to
  HubSpot through its Forms API so HubSpot workflows still run, and add "keep me posted"
  opt-ins to Mailchimp.

---

## 9. Revised direction: the dashboard replaces HubSpot (decided after phase 2)

- **The dashboard becomes the CRM.** Existing HubSpot contacts are imported once from a HubSpot CSV
  export, then HubSpot can be cancelled. There's no ongoing HubSpot sync.
- **Mailchimp stays for EDMs**, synced both ways:
  - Out to Mailchimp: contacts who've agreed to marketing (`marketing_consent = subscribed`), with
    tags for status, stage, event type, audience, source and any free-form tags.
  - Back from Mailchimp: new signups (arrive as Prospects), opens, clicks and unsubscribes.
  - Never sent: accessibility needs, notes, emails, values.
- **Gmail (Google Workspace) for one-to-one email.** Each team member connects their own Workspace
  account (an "internal" Google app, so no Google review process). From a contact they can:
  - Send an email from a template, edited first, through the Gmail API. It lands in their Gmail
    Sent folder like any other email.
  - See the whole email history with that client on the timeline, including emails sent from Gmail
    itself and the client's replies. The dashboard stores the date, subject and direction, and loads
    the email text from Gmail when it's opened, so full email bodies aren't copied into the database.
  - Replies reset the follow-up clock and count toward first reply time automatically.
- **Google Calendar:** tours and events are added to, moved on or removed from the venue manager's calendar.
- **Login:** "Sign in with Google", limited to the Confession Workspace domain.

New contact fields: `accessibility_needs` (sensitive, only shown inside the dashboard) and `marketing_consent`.

### Revised phases
3. Supabase database + Google sign-in (Workspace only), replacing sample data, with the data-safety
   protections in [DATA-SAFETY.md](DATA-SAFETY.md) in place before any real data goes in.
4. Deploy to Netlify; the enquiry form goes live for WordPress.
5. Import existing contacts from a HubSpot export (with a preview and duplicate check first).
6. Mailchimp two-way sync.
7. Gmail: send from the dashboard, email history on the timeline. Google Calendar sync.
8. README.

---

## 10. Added after the proposal (29 September 2026)

- **Email from anywhere:** an Email button on pipeline cards, the contacts list, tour and event cards, the booking
  details window and the Home lists. Clicking a client's email address also opens the email window.
- **Editable Settings** (admins once login is on): Rules, Event types (add and rename), Email templates (add, edit,
  delete), Mailchimp organisation, and Website tracking rules. Stored in `settings`, `email_templates` and
  `tracking_rules`, each with change history.
- **Disciples newsletter form** (`/forms/newsletter`): name, email, optional interests and a required consent tick.
  Creates a Prospect, source "Newsletter form". Changes to forms go through Shona or Nic.
- **Mailchimp organisation:** one audience, "Confession Disciples". Newsletter interests become **groups**. Persona,
  event type, status, stage, source, website interest and team tags become **tags**. Segments are built from these.
- **Website tracking (proposed, UI in preview):** a first-party script on the WordPress site records page views
  under a Confession-only cookie, after cookie consent. Visits link to a contact when they submit a form or click a
  tracked link in an EDM or dashboard email. Interest rules add tags and can alert the team. Anonymous visitors are
  deleted after 90 days. Tables: `web_visitors`, `web_visits`.
- **Documents and e-signing (proposed):** see the proposal document.
