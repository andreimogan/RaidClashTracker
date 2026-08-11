# Task ledger: member-links

order: "On the members page, in the table, i can click a member and it opens that member's page. I want every table that contains a member to have this functionality."
status: done
created: 2026-07-06

## Tasks

- id: t1
  summary: Extract shared MemberCell (avatar + linked name + former-state) and use it in all four member tables
  owns:
    - components/MemberCell.tsx
    - components/PerformanceTable.tsx
    - components/TotalPerformanceTable.tsx
    - components/ClashTable.tsx
    - app/members/page.tsx
    - docs/reference/design-system.md
  depends_on: []
  done_when: >
    Member names in PerformanceTable, TotalPerformanceTable, and ClashTable link to
    /members/[member.id] exactly like the members page (name-only link, real anchor);
    the members page uses the same shared component with formerStyle="muted" and its
    visuals are unchanged (muted inactive names, Status column intact); Former pill
    still renders in the three tables; npm run build passes; design-system.md
    documents MemberCell.
  claimed_by: ui-design-specialist
  state: done
  docs_touched:
    - docs/reference/design-system.md
  changelist:
    - components/MemberCell.tsx — new shared server-safe cell: Avatar + Link to
      /members/[id] + former-state (formerStyle "badge" = pill, "muted" = dim name)
    - components/PerformanceTable.tsx — Player cell now <MemberCell member={r.member} />;
      Avatar import removed
    - components/TotalPerformanceTable.tsx — same swap; Avatar import removed
    - components/ClashTable.tsx — same swap; Avatar import removed
    - app/members/page.tsx — Player cell now
      <MemberCell member={{ ...s.member, isActive: s.isActive }} formerStyle="muted" />
      (Status column untouched); Avatar + Link imports removed
    - docs/reference/design-system.md — MemberCell added to reference implementations
  notes: >
    The members page must pass the derived s.isActive (activeIds.has(member.id))
    into MemberCell: the raw s.member object carries the DB is_active column, which
    defaults to 1 and is never written to 0, so on a live DB it is effectively always
    true and would leave former members' names undimmed. The three tables need no
    override because lib/compute.ts replaces isActive with the derived value before
    rows reach them. npm run build passes.
