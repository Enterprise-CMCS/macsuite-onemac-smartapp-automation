# SMART Medicaid SPA E2E Flows

Derived from the TestRail export `macpro_onemac_smart.xlsx` (140 cases, all in
section "MEDICAID SPA Records"). Most cases are single-feature checks. This
document groups them into end-to-end flows across roles:

`Intake -> CPOC/SRT -> Concurrer -> Adjudicator`

Case IDs are TestRail IDs. Flows are a proposed draft for review, not
implemented automation. Mutating steps need a nonproduction authorization
boundary before any live run.

## Roles

| Flow role | Fixture `SF_ROLE` | Status |
|---|---|---|
| Intake | `INTAKE` | Registered |
| CPOC | `CPOC` | Registered |
| SRT | `SRT` | Registered |
| Super User | `SUPERUSR` | Registered |
| Concurrer | none | **Missing from role registry** |
| Adjudicator | none | **Missing from role registry** |
| General / General Read-only / Technical Director | none | Missing (only in negative-permission checks) |

`DIVDIR` and `GROUPDIR` are registered but are not referenced by the export.

## Common spine

1. **Intake** creates the Medicaid SPA, sets Subject/Description/Type/SubType/Priority Code,
   marks Submission Verified Complete, and records Intake Complete (C1498123, C1729935,
   C1550989, C1727382, C1736438).
2. **Intake** assigns CPOC and SRT/SME members on the Review tab with assignment notes
   (C1543514, C1634865, C1736438, C1823257) and moves status to Pending - First Clock.
3. **SRT / SME** each set Review Progress and RAI Needed (C1687406, C1689757).
4. **CPOC** sets Review Progress after all SRTs have recommended
   (C1727948 approval, C1760398 disapproval, C1635255).
5. Branch: RAI (flows 2-4), or **Concurrer** then **Adjudicator** (flows 1, 5, 6).
6. Terminal state locks the record (C1719207, C1719208, C1719648).

## Flows

### F1. Happy path: approval, first clock
Intake -> SRT -> CPOC (Recommending Approval) -> Concurrer -> Adjudicator (Approved)

- Intake create and assign (spine 1-2).
- SRT(s) Recommending Approval; CPOC can only recommend approval after all SRTs do (C1727948).
- Status Pending Concurrence, then Pending Approval; Concurrence/Adjudication records are
  created with Date Assigned auto-populated (C1795653, C1811396).
- Concurrer records decision and memo; Adjudicator selects outcome Approved and memo.
  Outcome is restricted by CPOC recommendation (C1758383).
- Approved: first clock stops (Days on Clock/Remaining null), record locks, Companion Letter
  and Documents Posted stay editable, Documents Posted to Medicaid.gov unlocks
  (C1700207, C1719207, C1810957, C1719645).
- History: status in Eastern time, Concurrence/Adjudication History (C1700207, C1800197).

### F2. RAI flow: first clock to second clock to approval
Intake -> SRT/CPOC (RAI needed) -> CPOC prepares RAI -> Intake/CPOC second clock -> SRT
re-review -> CPOC -> Concurrer -> Adjudicator

- Spine 1-3 with at least one SRT RAI Needed = Yes and RAI Questions Completed
  (C1576249, C1577223).
- CPOC prepares RAI, sets RAI Issued Date; First Clock Review Snapshot is created
  (C1763308, C1635255, C1761803).
- Status Pending RAI; clocks pause (C1700229, C1680067).
- RAI Response Received Date set; status Pending - Second Clock; second clock starts at
  Day 0 / 90 remaining (C1700229, C1602696, C1680069).
- Second Clock Intake: CPOC/SRT Assignment Confirmed checked by Intake/SRT/CPOC/Super User;
  read-only afterwards except Super User (C1763650).
- SRT review progress resets to Assigned; Second Clock Review table used; First Clock
  decisions preserved and RAI questions locked (C1763308, C1793646).
- CPOC recommends; then continue as F1 from Concurrer onward.

### F3. RAI response withdrawn and resubmitted (loop)
Intake/CPOC -> RAI response received -> response withdrawn -> Pending RAI -> new response received

- Withdrawn Date > Received Date moves status to Pending RAI; second clock stops and
  Second Clock tables hide (C1729214, C1700229 steps 11-12, C1763308 steps 17-22,
  C1763650 steps 22-27).
- New Received Date restarts second clock; tables reappear; SRT progress resets.

### F4. No RAI needed
Intake -> SRT (RAI Needed = No) -> CPOC -> Concurrer -> Adjudicator

- No RAI record is created when all SRTs choose No (C1654712, C1654768, C1634503).
- Continue as F1.

### F5. Disapproval
Intake -> SRT (one or more Disapproval) -> CPOC (Recommending Disapproval) -> Concurrer -> Adjudicator (Disapproved)

- CPOC cannot recommend disapproval until all active SRTs have recommended (C1760398).
- Adjudicator is auto-assigned from the disapproving SRT group; with multiple groups a
  Disapproving Groups dropdown is shown (C1810674).
- Adjudicator outcome is validated against the CPOC recommendation (C1758383).
- Disapproved: clock stops and record locks (C1700207, C1719208).

### F6. Reversed recommendation after review
CPOC/SRT -> Concurrer/Adjudicator -> sent back to Review Team -> recommendation reversed -> new Adjudicator record

- C1816133 (new Adjudicator record on reversal); history in C1800197, C1811396.

### F7. Withdrawal
Intake (or Super User) -> Withdraw at any stage

- Withdraw from intake and later stages; lock rules and clocks (C1729936, C1753834,
  C1700207 step 13, C1719217, C1719648).

### F8. Companion Letter / Monitoring Action
Intake or CPOC -> Companion Letter created -> Monitoring Action issues -> CL status updates

- Create CL, review team, notes/files/alerts, auto-status from issues, field history
  (C1760459, C1787059, C1787062, C1787325, C1795649-C1795651, C1789686, C1800373,
  C1810675-C1810676).
- Stays editable after SPA is Approved/Disapproved/Withdrawn (C1719645, C1719649).

### F9. Post-adjudication lock and Super User override
Any role -> verify read-only -> Super User unlocks

- Per-role pencil icons disabled for Intake, General, General Read-only, CPOC, SRT,
  Concurrer, Adjudicator (C1719207, C1719208, C1719217).
- Super User unlock after Approved/Disapproved/Withdrawn (C1719222).

### F10. Super User and CPOC overrides with justification
- Super User or CPOC changes SRT Review Progress with a Justification Memo; unassigned
  CPOC receives an error (C1747913, C1759863, C1759865).

## Cross-cutting checks to attach to flows (not separate flows)

- Clocks and milestones: C1680067, C1680069, C1601083, C1601138, C1585411, C1585412,
  C1500463, C1634481.
- Field history tracking: C1541066, C1719268, C1720383, C1656055, C1792898,
  C1759452, C1810677.
- Progress bar: C1687657.
- Role dashboards on login: C1816123, C1816124, C1816126, C1816127, C1816132, C1816128.
- Reports: C1824164. CHIP SPA intake: C1827192.

## Open questions

1. Do Concurrer and Adjudicator users exist in SMART sandboxes? The fixture needs
   `CONCURRER` and `ADJUDICATOR` roles added to `smartRoles`.
2. Is the order always Concurrence then Adjudication, or is Concurrence skipped for some
   outcomes or groups? The export only says concurrence "and/or" adjudication.
3. How does status move Pending Concurrence -> Pending Approval: automatic or manual?
   C1700207 says "if not automated".
4. The export has no steps for returning a record to the review team (F6 beyond
   C1816133); confirm the trigger.
5. Super User is required to backdate Initial Submission Date (C1700207 step 6). Should
   flows use Super User for that setup step?
6. Which flows should be automated first? A reasonable start is F1 and F4 (no RAI),
   then F2.
7. Several cases (QA Validation - 3 Con/Adj, 5 System) have steps that are short
   one-liners; a manual walkthrough would be needed to capture locators and outcomes.
