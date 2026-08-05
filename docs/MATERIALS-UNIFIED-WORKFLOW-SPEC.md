# Materials Unified Workflow Spec

Version: 1.0
Date: 2026-07-12
Owner: Admin Gateway / Materials Department
Status: Approved for Implementation

## 1) Objective

Build one unified enterprise-grade materials workflow from request creation to final issuance, with:
- clear role separation,
- mandatory approvals,
- auditability,
- inventory-first fulfillment,
- procurement fallback,
- controlled warehouse receipt and issue,
- full notifications to requesting departments.

## 2) Scope

In scope:
- Inter-department material requests.
- Approval chain:
  1. Requesting Department Manager
  2. Materials Department Director
  3. Procurement / Warehouse execution path
- Inventory availability check and reservation.
- Purchase order lifecycle for non-available items.
- Warehouse goods receipt and issuing process.
- Department acknowledgment and request closure.
- KPI/SLA tracking and audit trail.

Out of scope (Phase 2+):
- Supplier performance scoring automation.
- Predictive demand and auto-replenishment AI.
- Full invoice accounting automation (3-way match integration kept as extension).

## 3) Process Flow

1. Section Head creates request.
2. Request goes to Requesting Department Manager for approval.
3. If approved, request goes to Materials Department Director.
4. If approved, system checks availability per item:
- available quantity -> reserve from stock,
- unavailable/partial -> route shortage to procurement.
5. Procurement creates and executes purchase order.
6. Warehouse receives purchased items (GRN).
7. System notifies requesting department when items are ready.
8. Warehouse issues materials.
9. Requesting department confirms receipt.
10. Request is closed.

## 4) Roles and Responsibilities

1. SECTION_HEAD_REQUESTER
- create request,
- edit draft before submission,
- track status,
- confirm receipt.

2. DEPARTMENT_MANAGER_REQUESTER
- approve/reject/return request with mandatory reason on reject/return.

3. MATERIALS_DIRECTOR
- approve/reject/return request,
- choose fulfillment policy (inventory first is default enforced).

4. PROCUREMENT_OFFICER
- create RFQ/PO for shortages,
- update procurement status.

5. WAREHOUSE_KEEPER
- perform stock reservation,
- execute goods receipt (GRN),
- execute stock issue,
- register handover.

6. FINANCE_CONTROLLER (integration-ready)
- budget validation gate for above-threshold requests.

7. AUDITOR
- read-only access to full audit log and transition history.

## 5) State Model (Canonical)

### 5.1 Request Statuses

- DRAFT
- PENDING_DEPT_MANAGER_APPROVAL
- RETURNED_TO_REQUESTER
- REJECTED_BY_DEPT_MANAGER
- PENDING_MATERIALS_DIRECTOR_APPROVAL
- REJECTED_BY_MATERIALS_DIRECTOR
- APPROVED_PENDING_AVAILABILITY_CHECK
- PARTIALLY_RESERVED_PENDING_PROCUREMENT
- FULLY_RESERVED_READY_FOR_ISSUE
- SENT_TO_PROCUREMENT
- PROCUREMENT_PO_CREATED
- PROCUREMENT_IN_PROGRESS
- RECEIVED_IN_WAREHOUSE
- READY_FOR_PICKUP
- PARTIALLY_ISSUED
- FULLY_ISSUED_PENDING_ACK
- CLOSED
- CANCELLED

### 5.2 Transition Rules

1. DRAFT -> PENDING_DEPT_MANAGER_APPROVAL
- actor: SECTION_HEAD_REQUESTER
- conditions: at least one valid line item.

2. PENDING_DEPT_MANAGER_APPROVAL -> PENDING_MATERIALS_DIRECTOR_APPROVAL
- actor: DEPARTMENT_MANAGER_REQUESTER
- action: approve.

3. PENDING_DEPT_MANAGER_APPROVAL -> RETURNED_TO_REQUESTER
- actor: DEPARTMENT_MANAGER_REQUESTER
- action: return
- conditions: return_reason required.

4. PENDING_DEPT_MANAGER_APPROVAL -> REJECTED_BY_DEPT_MANAGER
- actor: DEPARTMENT_MANAGER_REQUESTER
- action: reject
- conditions: reject_reason required.

5. RETURNED_TO_REQUESTER -> PENDING_DEPT_MANAGER_APPROVAL
- actor: SECTION_HEAD_REQUESTER
- action: resubmit.

6. PENDING_MATERIALS_DIRECTOR_APPROVAL -> APPROVED_PENDING_AVAILABILITY_CHECK
- actor: MATERIALS_DIRECTOR
- action: approve.

7. PENDING_MATERIALS_DIRECTOR_APPROVAL -> REJECTED_BY_MATERIALS_DIRECTOR
- actor: MATERIALS_DIRECTOR
- action: reject
- conditions: reject_reason required.

8. APPROVED_PENDING_AVAILABILITY_CHECK -> FULLY_RESERVED_READY_FOR_ISSUE
- actor: system/warehouse service
- conditions: all lines reserved.

9. APPROVED_PENDING_AVAILABILITY_CHECK -> PARTIALLY_RESERVED_PENDING_PROCUREMENT
- actor: system/warehouse service
- conditions: partial reserve only.

10. APPROVED_PENDING_AVAILABILITY_CHECK -> SENT_TO_PROCUREMENT
- actor: system/warehouse service
- conditions: no reserve possible.

11. PARTIALLY_RESERVED_PENDING_PROCUREMENT -> SENT_TO_PROCUREMENT
- actor: system
- conditions: shortage lines generated.

12. SENT_TO_PROCUREMENT -> PROCUREMENT_PO_CREATED
- actor: PROCUREMENT_OFFICER
- conditions: PO id linked.

13. PROCUREMENT_PO_CREATED -> PROCUREMENT_IN_PROGRESS
- actor: PROCUREMENT_OFFICER
- conditions: supplier confirmed.

14. PROCUREMENT_IN_PROGRESS -> RECEIVED_IN_WAREHOUSE
- actor: WAREHOUSE_KEEPER
- conditions: GRN posted.

15. RECEIVED_IN_WAREHOUSE -> READY_FOR_PICKUP
- actor: WAREHOUSE_KEEPER
- conditions: stock moved to available bins.

16. FULLY_RESERVED_READY_FOR_ISSUE -> READY_FOR_PICKUP
- actor: WAREHOUSE_KEEPER
- conditions: reservation released to issue counter.

17. READY_FOR_PICKUP -> PARTIALLY_ISSUED
- actor: WAREHOUSE_KEEPER
- conditions: partial quantity issued.

18. READY_FOR_PICKUP -> FULLY_ISSUED_PENDING_ACK
- actor: WAREHOUSE_KEEPER
- conditions: full quantity issued.

19. PARTIALLY_ISSUED -> FULLY_ISSUED_PENDING_ACK
- actor: WAREHOUSE_KEEPER
- conditions: remaining quantity issued.

20. FULLY_ISSUED_PENDING_ACK -> CLOSED
- actor: SECTION_HEAD_REQUESTER or delegated receiver
- action: acknowledge receipt.

21. Any open state -> CANCELLED
- actor: SECTION_HEAD_REQUESTER (before materials approval) or MATERIALS_DIRECTOR (after)
- conditions: cancellation_reason required.

## 6) Line Item-Level Model

Each request line tracks:
- requested_qty
- reserved_qty
- procured_qty
- received_qty
- issued_qty
- remaining_qty
- fulfillment_mode: STOCK | PROCUREMENT | MIXED

Rule:
remaining_qty = requested_qty - issued_qty

Request closure condition:
all lines remaining_qty = 0 and acknowledged = true

## 7) Approval Matrix

1. Department manager approval mandatory for all requests.
2. Materials director approval mandatory for all requests.
3. Finance approval required only if total_estimated_value >= FINANCE_THRESHOLD.
4. Emergency flag bypass not allowed without post-facto approval within SLA.

## 8) Notifications

Trigger events:
1. Submitted to manager.
2. Approved/rejected/returned by manager.
3. Approved/rejected by materials director.
4. Sent to procurement.
5. PO created.
6. Received in warehouse.
7. Ready for pickup.
8. Issued.
9. Closed.

Channels:
- in-app notification,
- mobile push (if subscribed),
- optional email (phase 2).

Notification payload minimum:
- request_id,
- request_no,
- old_status,
- new_status,
- actor_name,
- timestamp,
- action_url.

## 9) Audit and Compliance

Every transition writes an immutable event row:
- event_id,
- request_id,
- from_status,
- to_status,
- action,
- actor_id,
- actor_role,
- reason,
- metadata_json,
- created_at.

Rules:
- reject/return/cancel must have non-empty reason.
- no direct status jumps outside transition table.
- manual overrides require privileged role and are explicitly tagged.

## 10) APIs (Target Contract)

### 10.1 Request APIs

1. POST /api/v1/material-requests
- create request draft or submit.

2. GET /api/v1/material-requests
- list by requester/department/status/date.

3. GET /api/v1/material-requests/{id}
- request details + line-level fulfillment + audit timeline.

4. POST /api/v1/material-requests/{id}/submit
- draft to pending manager approval.

5. POST /api/v1/material-requests/{id}/action
- approve/reject/return/cancel based on role and status.

### 10.2 Availability and Reservation APIs

1. POST /api/v1/material-requests/{id}/availability-check
- system action after materials approval.

2. POST /api/v1/material-requests/{id}/reserve
- reserve stock lines.

### 10.3 Procurement APIs

1. POST /api/v1/material-requests/{id}/procurement/create-po
- create PO for shortage lines.

2. POST /api/v1/procurement/orders/{po_id}/status
- update procurement status.

### 10.4 Warehouse APIs

1. POST /api/v1/inventory/receipts
- post GRN against PO/request.

2. POST /api/v1/inventory/issues
- issue against request lines.

3. POST /api/v1/material-requests/{id}/ack
- requester acknowledgment and close.

## 11) Data Model (Minimum)

Tables:
1. material_requests
- id, request_no, tenant_id, requester_dept, requester_id, manager_id, materials_director_id,
  status, priority, emergency_flag, total_estimated_value, submitted_at, approved_at,
  ready_for_pickup_at, closed_at, created_at, updated_at.

2. material_request_items
- id, request_id, item_id, item_name_snapshot, unit, requested_qty,
  reserved_qty, procured_qty, received_qty, issued_qty,
  estimated_unit_cost, actual_unit_cost, fulfillment_mode, notes.

3. material_request_events
- id, request_id, from_status, to_status, action, actor_id, actor_role, reason, metadata_json, created_at.

4. material_request_links
- id, request_id, po_id, grn_id, issue_id, created_at.

Indexes:
- material_requests(tenant_id, status, created_at)
- material_requests(requester_dept, status)
- material_request_events(request_id, created_at)

## 12) SLA and KPIs

Primary SLAs:
1. Manager approval <= 24h.
2. Materials approval <= 24h.
3. Availability check <= 2h after materials approval.
4. Procurement PO creation <= 48h (non-emergency).
5. Warehouse readiness <= 8h after GRN posting.

KPIs:
1. End-to-end cycle time.
2. Approval lead time by role.
3. Stock fulfillment ratio vs procurement ratio.
4. On-time closure rate.
5. Rejection/return rate and root causes.
6. Emergency request ratio.

## 13) Security and Access Control

1. Enforce RBAC by backend policy, not UI only.
2. Actor identity comes from token claims; no free-text actor authority.
3. Tenant isolation mandatory on every query/write.
4. Sensitive actions logged with actor, IP, and user agent when available.

## 14) Implementation Phases

### Phase A (Stabilization) - 1 week
1. unify route map and wrappers,
2. fix broken redirects/runtime blockers,
3. enforce canonical navigation.

### Phase B (Workflow Engine) - 1 to 2 weeks
1. implement canonical statuses and transition guard,
2. role-based action authorization,
3. mandatory reason validations,
4. full event timeline.

### Phase C (Inventory + Procurement Integration) - 2 weeks
1. line-level availability check,
2. reservation and shortage split,
3. PO creation linkage,
4. GRN and issue linkage,
5. pickup notification and closure.

### Phase D (Governance and Reporting) - 1 week
1. SLA dashboard,
2. KPI reports,
3. audit export,
4. exception handling playbooks.

## 15) Acceptance Criteria

1. No request can bypass manager and materials approvals.
2. No issue from warehouse without approved request.
3. Every state transition is auditable with actor and timestamp.
4. Request line quantities always reconcile (requested = issued + remaining).
5. Request closes only after full issue and requester acknowledgment.
6. Notifications are generated for all mandatory transition events.

## 16) Immediate Next Technical Tasks

1. align frontend actions to canonical statuses in materials requests module.
2. replace free-text actor in approval actions with authenticated user context.
3. add transition guard in backend endpoint /material-requests/{id}/action.
4. link procurement and warehouse documents by request_id and line_id.
5. add timeline component showing immutable event history.
