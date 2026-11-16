# SMART Medicaid SPA E2E Flow Steps

Draft steps for each flow in [e2e-flows.md](./e2e-flows.md), for review before any
automation. The source export has no P1/P2 labels (every case is Medium), so the
flows F1-F10 are used as the grouping.

Items marked **(confirm)** are inferred from the export and need a manual check. Export
steps are often one-line or copied from another case, so they are not enough to automate
on their own.

Roles: Intake, CPOC, SRT, Concurrer, Adjudicator, Super User. Concurrer and Adjudicator
are not in the fixture yet.

## F1. Happy path: approval, first clock

| # | Role | Step | Expected result |
|---|---|---|---|
| 1 | Intake | Log in and create a Medicaid SPA with Subject, Description, Type, SubType, Priority Code. | Record is created in Pending - First Clock. |
| 2 | Intake | Mark Submission Verified Complete, then record Intake Complete. | Intake fields are saved. |
| 3 | Intake | On the Review tab, assign CPOC and SRT/SME members with assignment notes. | Assignments are saved. |
| 4 | SRT (each) | Set Review Progress to Recommending Approval and RAI Needed to No. | Progress is saved per SRT. |
| 5 | CPOC | Set Review Progress to Recommending Approval. | Allowed only after all assigned SRTs have recommended approval. |
| 6 | System | Check status and assignments. | Concurrence and Adjudication records exist; Date Assigned is filled. |
| 7 | Concurrer | Record the concurrence decision and memo. | Concurrence is saved. **(confirm: role and screen)** |
| 8 | Adjudicator | Select outcome Approved and enter a memo. | Outcome options are restricted by the CPOC recommendation. |
| 9 | System | Check the approved record. | Status is Approved; first clock stops (Days on Clock and Remaining are blank); record is locked. |
| 10 | Intake | Check editable fields. | Companion Letter and Documents Posted to Medicaid.gov are editable; Documents Posted unlocks. |
| 11 | Any | Open History. | Status and Concurrence/Adjudication history are shown in Eastern time. |

## F2. RAI flow: first clock, second clock, approval

| # | Role | Step | Expected result |
|---|---|---|---|
| 1 | Intake | Run F1 steps 1-3. | Record is in Pending - First Clock. |
| 2 | SRT | Set RAI Needed to Yes and complete RAI questions. | RAI record is created when the SRT completes review. |
| 3 | CPOC | Prepare the RAI and set RAI Issued Date. | First Clock Review Snapshot is created; status is Pending RAI. |
| 4 | System | Check the clocks. | First clock is paused. |
| 5 | Intake | Enter RAI Response Received Date. | Status is Pending - Second Clock; second clock starts at Day 0 with 90 days remaining. |
| 6 | Intake | Complete Second Clock Intake. CPOC/SRT Assignment Confirmed is checked. | Second clock fields are read-only except for Super User. |
| 7 | SRT | Review in the Second Clock Review table. | Review progress resets to Assigned; First Clock RAI decisions are kept and RAI questions are locked. |
| 8 | CPOC | Recommend approval. | Continue as F1 from the Concurrer step. |

## F3. RAI response withdrawn and resubmitted

| # | Role | Step | Expected result |
|---|---|---|---|
| 1 | Intake or CPOC | With a received RAI response, enter a Withdrawn Date later than the Received Date. | Status moves to Pending RAI; second clock stops; Second Clock tables are hidden. |
| 2 | Intake | Enter a new Received Date. | Second clock restarts; tables reappear; SRT progress resets. |

## F4. No RAI needed

| # | Role | Step | Expected result |
|---|---|---|---|
| 1 | Intake | Run F1 steps 1-3. | Record is in Pending - First Clock. |
| 2 | SRT (all) | Set RAI Needed to No. | No RAI record is created. |
| 3 | CPOC | Recommend approval. | Continue as F1 from the Concurrer step. |

## F5. Disapproval

| # | Role | Step | Expected result |
|---|---|---|---|
| 1 | Intake | Run F1 steps 1-3. | Record is in Pending - First Clock. |
| 2 | SRT | Set one or more SRTs to Recommending Disapproval. | Progress is saved. |
| 3 | CPOC | Try to recommend disapproval before all active SRTs have recommended. | Blocked until every active SRT has given a recommendation. |
| 4 | CPOC | Recommend disapproval after all SRTs have recommended. | Recommendation is saved. |
| 5 | System | Check the adjudicator. | Adjudicator is set from the disapproving SRT group; a Disapproving Groups dropdown appears when there is more than one group. |
| 6 | Adjudicator | Record decision Disapprove on the Adjudication row. | SPA status becomes Disapproved. Concurrence is skipped. |
| 7 | System | Check the record. | Clock stops; record is locked. |

## F6. Reversed recommendation after review

| # | Role | Step | Expected result |
|---|---|---|---|
| 1 | Concurrer or Adjudicator | Send the record back to the Review Team. **(confirm: how a record is returned)** | Record is in the Review Team queue. |
| 2 | CPOC | Reverse the recommendation. | A new Adjudicator record is created. |
| 3 | Any | Check History. | Concurrence and Adjudication history shows both records. |

## F7. Withdrawal

| # | Role | Step | Expected result |
|---|---|---|---|
| 1 | Intake | Withdraw the submission at an intake stage. | Status is Withdrawn; clocks stop; record is locked. |
| 2 | Super User | Withdraw a submission at a later stage. | Status is Withdrawn; lock rules apply. |
| 3 | Intake | Try to edit after withdrawal. | Editing is blocked, except the Companion Letter (see F8). |

## F8. Companion Letter and Monitoring Action

| # | Role | Step | Expected result |
|---|---|---|---|
| 1 | CPOC | Create a Companion Letter from the SPA. | Companion Letter record is created. |
| 2 | CPOC | Add a Monitoring Action Review Team and Monitoring Issues. | Validation rules apply to Monitoring Action fields. |
| 3 | CPOC | Add notes, files, and milestone alerts. | Items are saved on the Companion Letter. |
| 4 | System | Change Monitoring Issue status. | Companion Letter status updates automatically. **(confirm: rules)** |
| 5 | Any | Check Field History. | Changes to the Companion Letter are tracked, including from the SPA page. |
| 6 | Intake | Approve, disapprove, or withdraw the SPA. | Companion Letter stays editable. |

## F9. Post-adjudication lock and Super User unlock

| # | Role | Step | Expected result |
|---|---|---|---|
| 1 | Intake | After Approved, Disapproved, or Withdrawn, check the record. | Pencil icons are disabled; actions are blocked. |
| 2 | CPOC, SRT, Concurrer, Adjudicator | Check the record. | Same lock as Intake. |
| 3 | Super User | Unlock the record. | Editing is restored. |

## F10. Super User and CPOC overrides with a justification memo

| # | Role | Step | Expected result |
|---|---|---|---|
| 1 | Super User | Change SRT Review Progress. | A Justification Memo is required. |
| 2 | CPOC | Change SRT Review Progress with a memo. | Change is saved with the memo. |
| 3 | CPOC not assigned | Try to change SRT Review Progress. | Error is shown. |

## Gaps to resolve before automation

1. Concurrer and Adjudicator roles are missing from `smartRoles` and their sandbox users are unknown.
2. F6 has one export case with no detailed steps.
3. The export does not say whether Concurrence is skipped for some outcomes.
4. The trigger for Pending Concurrence -> Pending Approval is not stated (automatic or manual).
5. Super User is needed to backdate Initial Submission Date during setup.
6. Several cases are one-liners or contain only pasted HTML, so each needs a manual walkthrough.

Suggested first automation targets: F4 (no RAI), then F1, then F2.
