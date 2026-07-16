import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // One record per weekly pipeline run
  pipelineRuns: defineTable({
    runId: v.string(),           // UUID, matches pipelineMetadata.runId in Sanity
    issueNumber: v.number(),
    status: v.union(
      v.literal('running'),
      v.literal('awaiting-review'), // paused at Andrew gate
      v.literal('complete'),
      v.literal('failed'),
    ),
    startedAt: v.number(),       // Unix timestamp ms
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    // ── Phase 4 additions (CONTEXT D-22, D-23, D-39) ────────────────────────
    durationMs: v.optional(v.number()),  // PIP-12: pipeline wall-clock ms
    cost: v.optional(v.string()),         // PIP-11 + OPS-03: JSON-stringified per-agent cost summary
    awaitingHumanAt: v.optional(v.number()), // PIP-10: Unix ms when Editor gate 1 called interrupt() and paused for Andrew. Enables SLA alerting on stuck runs.
    sanityIssueId: v.optional(v.string()), // Phase 26 — Sanity weeklyIssue _id; written by publisher so publish endpoint can resolve Sanity issue from runId
  })
    .index('by_runId', ['runId'])
    .index('by_issueNumber', ['issueNumber']),

  // All agent events during a pipeline run — the raw deliberation stream
  // This feeds the deliberation layer on the frontend in real time
  deliberationEvents: defineTable({
    runId: v.string(),
    agentId: v.string(),         // matches agentProfile.agentId in Sanity
    eventType: v.union(
      v.literal('scout-finding'),      // Scout found a candidate charity
      v.literal('advocate-argument'),  // Advocate built case for a candidate
      v.literal('editor-decision'),    // Editor gate 1 selected winner
      v.literal('section-draft'),      // Section agent produced draft
      v.literal('qa-correction'),      // QA flagged and corrected something
      v.literal('editor-final'),       // Editor final approved
      v.literal('publisher-deploy'),   // Publisher built and deployed
      v.literal('cost-warning'),                // Phase 5 D-08: CostRecorder soft-warn at 70% of PIPELINE_COST_CAP_USD
      v.literal('agent-tool-limit-exceeded'),   // Phase 5 D-21: max_tool_calls overrun on Scout/Researcher
    ),
    payload: v.string(),         // JSON string — structure varies by eventType
    charityId: v.optional(v.string()), // Sanity charity _id, for candidate-specific events
    sectionName: v.optional(v.string()), // e.g. 'originStory', 'founderBio'
    timestamp: v.number(),
  })
    .index('by_runId', ['runId'])
    .index('by_runId_and_type', ['runId', 'eventType']),

  // Explicit votes with reasoning — subset of deliberationEvents but queryable
  agentVotes: defineTable({
    runId: v.string(),
    agentId: v.string(),
    charityId: v.string(),       // Sanity charity _id
    charityName: v.string(),     // Denormalized for fast reads
    vote: v.union(
      v.literal('for'),
      v.literal('against'),
      v.literal('abstain'),
    ),
    reasoning: v.string(),
    timestamp: v.number(),
  })
    .index('by_runId', ['runId'])
    .index('by_runId_and_charity', ['runId', 'charityId']),

  // QA corrections as a queryable table — shown in the deliberation layer
  // as a record of what QA caught and why
  qaCorrections: defineTable({
    runId: v.string(),
    agentId: v.optional(v.string()),         // Phase 5 D-01: always 'qa' for new rows
    sectionName: v.string(),                  // which editorial section
    fieldName: v.optional(v.string()),        // Phase 5 unused; legacy compat (Phase 4 rewrite-shape)
    original: v.optional(v.string()),         // Phase 5 unused; legacy compat
    corrected: v.optional(v.string()),        // Phase 5 unused (D-02 annotation-only); legacy compat
    reason: v.string(),                       // Phase 5 maps Pydantic `reason` directly into this
    severity: v.union(
      v.literal('info'),                     // Phase 5 D-01: minor suggestion; Andrew may ignore
      v.literal('warning'),                  // Phase 5 D-01: borderline; Andrew should review
      v.literal('error'),                    // Phase 5 D-01: clear voice/factual violation; Andrew must review
    ),
    accepted: v.boolean(),                    // Phase 5 writes `false` on every row; Andrew flips in Phase 9
    // ── New Phase 5 fields (D-01 LLM-judge structured output) ─────────────
    axis: v.optional(v.union(
      v.literal('gravity'),
      v.literal('sentiment'),
      v.literal('irony-signaling'),
      v.literal('precision'),
      v.literal('cross-section-consistency'),
      v.literal('hard-rule'),                // Layer-1 deterministic findings
      v.literal('machine-tell'),             // Phase 36 §36.1: Voice Pass machine-tell axis
      v.literal('structural-variety'),       // Phase 18 gap-close: judge structural-variety axis
    )),
    quotedSpan: v.optional(v.string()),       // exact offending text
    suggestedFix: v.optional(v.string()),     // concrete alternative
    blockIndexHint: v.optional(v.number()),   // Phase 32 D-11: QA-recorded block ordinal within the section body; a resolver hint, never authoritative
    // ── Phase 33 resolution fields (D-01, additive optional — §33.1) ───────
    resolution: v.optional(v.union(v.literal('accepted'), v.literal('dismissed'))), // Phase 33 D-01: absent = open
    resolutionReason: v.optional(v.string()), // required-for-dismiss enforced at the ENDPOINT, not the schema
    resolvedBy: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    timestamp: v.number(),
  })
    .index('by_runId', ['runId'])
    .index('by_runId_and_section', ['runId', 'sectionName']),

  // Pitch log — the Scout's candidate pitches before deliberation
  // Displayed in the deliberation layer as "the pitch log this week"
  pitchLog: defineTable({
    runId: v.string(),
    charityId: v.optional(v.string()),  // Sanity charity _id (if already exists)
    charityName: v.string(),
    charityLocation: v.string(),
    charityWebsite: v.optional(v.string()),
    assetRange: v.optional(v.string()),
    focusArea: v.optional(v.string()),
    scoutSummary: v.string(),    // Why Scout surfaced this one
    selected: v.boolean(),       // Whether this one won
    timestamp: v.number(),
  })
    .index('by_runId', ['runId'])
    .index('by_runId_and_selected', ['runId', 'selected']),

  // ── Stripe events: idempotency dedup table (Phase 8 — CMR-06) ────────────
  // One row per unique Stripe event.id we have processed. The unique
  // by_eventId index + Convex per-table mutation serialization gives us
  // atomic check-and-insert via the `claim` mutation (see convex/stripeEvents.ts).
  stripeEvents: defineTable({
    eventId: v.string(),       // Stripe evt_... — unique per event delivery
    eventType: v.string(),     // e.g. 'checkout.session.completed'
    livemode: v.boolean(),     // matches event.livemode from Stripe
    receivedAt: v.number(),    // Date.now() server-side
  })
    .index('by_eventId', ['eventId']),

  // ── Stripe orders: minimal audit trail (Phase 8 — Open Question 2) ───────
  // Behind STRIPE_RECORD_ORDERS env flag (default 'true'). One row per
  // checkout.session.completed event we processed. Stripe Dashboard remains
  // source of truth for orders; this exists so we can answer
  // "how much went to charity X this week" without paginating Stripe API.
  stripeOrders: defineTable({
    sessionId: v.string(),     // cs_test_... or cs_live_...
    eventId: v.string(),       // evt_... that fulfilled this order
    amountTotal: v.number(),   // cents (Stripe convention)
    currency: v.string(),      // 'usd', 'eur', etc.
    customerEmail: v.optional(v.string()),
    charitySlug: v.optional(v.string()),  // current charity at click time
    createdAt: v.number(),     // Date.now() server-side
    // ── Phase CMR-SHIP-01 / CMR-DONATE-01 additive fields ────────────────────
    amountSubtotal: v.optional(v.number()),   // product subtotal in cents (excludes shipping)
    amountShipping: v.optional(v.number()),   // shipping in cents
    donationAmount: v.optional(v.number()),   // == amountSubtotal; 100%-to-charity figure
    stripeFee: v.optional(v.number()),        // cached Stripe fee in cents (Phase 27 RCN-01, D-08)
    customerName: v.optional(v.string()),
    phone: v.optional(v.string()),
    shippingAddress: v.optional(v.object({
      line1: v.optional(v.string()),
      line2: v.optional(v.string()),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      postalCode: v.optional(v.string()),
      country: v.optional(v.string()),
    })),
  })
    .index('by_sessionId', ['sessionId'])
    .index('by_charitySlug_createdAt', ['charitySlug', 'createdAt'])
    .index('by_createdAt', ['createdAt']),

  // ── Email lifecycle: consent ledger (Phase 20 — EMAIL-03) ────────────────
  emailSubscribers: defineTable({
    email: v.string(),
    consentState: v.union(v.literal('subscribed'), v.literal('unsubscribed')),
    source: v.string(),                  // 'post-purchase-flow' | 'newsletter-optin'
    unsubscribeToken: v.string(),        // 64-char hex; globally unique
    createdAt: v.number(),
    unsubscribedAt: v.optional(v.number()),
  })
    .index('by_email', ['email'])
    .index('by_token', ['unsubscribeToken']),

  // ── Email lifecycle: idempotent send ledger (Phase 20 — EMAIL-02) ────────
  emailSends: defineTable({
    orderId: v.id('stripeOrders'),
    email: v.string(),                   // denormalized for fast suppression queries
    step: v.number(),                    // 1-8
    status: v.union(
      v.literal('scheduled'),
      v.literal('sent'),
      v.literal('failed'),
      v.literal('cancelled'),            // unsubscribe cancelled this pending step
      v.literal('skipped'),              // customerEmail absent at enqueue time
    ),
    scheduledFnId: v.optional(v.string()),     // Convex scheduled-fn id for ctx.scheduler.cancel
    providerMessageId: v.optional(v.string()), // Resend / fake provider message id
    sentAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_orderId', ['orderId'])
    .index('by_orderId_step', ['orderId', 'step'])
    .index('by_email_step', ['email', 'step'])
    .index('by_status', ['status']),

  // ── notificationsLedger: operational notification idempotency (Phase 27 NTF-01/02) ──
  // Mirrors the emailSends idempotency pattern: insertScheduled (queued) →
  // markSent / markFailed / markSkipped. The (runId, eventType, channel) index
  // guarantees each event sends at most once per channel; re-fires are safe.
  notificationsLedger: defineTable({
    workspace_id: v.string(),
    runId: v.string(),                  // pipeline runId, or eventKey for budget events
    eventType: v.string(),              // 'complete' | 'failed' | 'awaiting-review' | 'budget'
    channel: v.string(),                // 'email' | 'slack'
    status: v.string(),                 // 'queued' | 'sent' | 'failed' | 'skipped'
    providerId: v.optional(v.string()), // Resend id / 'slack-<ts>'
    sentAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_runId_eventType_channel', ['runId', 'eventType', 'channel'])
    .index('by_workspace_createdAt', ['workspace_id', 'createdAt']),

  // ── Mission Control v2.0 — Phase 21 ─────────────────────────────────────────

  // ── workspaces: single-tenant seed (Phase 21 CFG-05) ────────────────────────
  workspaces: defineTable({
    workspace_id: v.string(),    // slug — "eisenbalm"
    name: v.string(),            // "The Eisenbalm Dispatch"
    createdAt: v.number(),       // Unix ms
  })
    .index('by_workspace', ['workspace_id']),

  // ── users: JIT upsert on first authenticated load (Phase 21 AUTH-04) ────────
  users: defineTable({
    workspace_id: v.string(),
    clerkUserId: v.string(),     // Clerk "sub" claim — primary lookup key
    email: v.string(),
    displayName: v.optional(v.string()),
    role: v.optional(v.string()),  // "admin" | "operator" — RBAC deferred to Phase 28
    createdAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index('by_workspace', ['workspace_id'])
    .index('by_clerkUserId', ['clerkUserId']),

  // ── runs: dashboard superset of frozen pipelineRuns (Phase 21 AUTH-04, Phase 23) ──
  runs: defineTable({
    workspace_id: v.string(),
    runId: v.string(),           // same UUID as pipelineRuns.runId (join key)
    triggerSource: v.string(),   // "manual" | "cron" | "webhook"
    triggeredBy: v.optional(v.string()), // Clerk userId — optional until Phase 23 wires trigger
    configSnapshot: v.optional(v.string()), // JSON — populated by Phase 22
    status: v.string(),          // mirrors pipelineRuns.status; updated alongside it
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    cost: v.optional(v.string()),    // JSON cost summary — sourced from pipelineRuns.cost
    durationMs: v.optional(v.number()),
    cancelRequested: v.optional(v.boolean()), // Phase 25 RUN-04 cooperative cancel flag the wrapper polls
    scheduledPublishAt: v.optional(v.number()), // Phase 26 RVW-03 / D-02: approve-and-schedule target time (Unix ms)
  })
    .index('by_workspace', ['workspace_id'])
    .index('by_runId', ['runId']),

  // ── audit_log: operator action trail (Phase 21 AUTH-04) ─────────────────────
  audit_log: defineTable({
    workspace_id: v.string(),
    actorId: v.string(),         // Clerk userId from ctx.auth.getUserIdentity()?.subject
    action: v.string(),          // "workspace.seed" | "run.triggered" | etc.
    resourceType: v.optional(v.string()),  // "run" | "prompt_version" | "config" | etc.
    resourceId: v.optional(v.string()),
    before: v.optional(v.string()),  // JSON snapshot
    after: v.optional(v.string()),   // JSON snapshot
    timestamp: v.number(),
    // ── NEW additive decision fields (Phase 43 §43.1, TSK-06) ─────────────────
    // Legacy rows omit all four and render tolerantly — see auditLog.ts
    // isDecisionRow / listDecisions for the reason-in-`after`-JSON fallback.
    reason: v.optional(v.string()),
    issueNumber: v.optional(v.number()),
    runId: v.optional(v.string()),
    instructionVersion: v.optional(v.string()),
  })
    .index('by_workspace', ['workspace_id'])
    .index('by_workspace_timestamp', ['workspace_id', 'timestamp']),

  // ── STUB TABLES (shape only — mutations added in later phases) ───────────────

  // ── agents: per-agent config (Phase 22) ─────────────────────────────────────
  agents: defineTable({
    workspace_id: v.string(),
    agentKey: v.string(),        // "scout" | "advocate" | "editor" | etc.
    enabled: v.boolean(),
    model: v.optional(v.string()),
    temperature: v.optional(v.number()),
    top_p: v.optional(v.number()),       // from SAMPLING_BY_AGENT
    max_tokens: v.optional(v.number()),  // from MAX_TOKENS_BY_AGENT
    description: v.optional(v.string()), // Phase 23 dashboard display
  })
    .index('by_workspace', ['workspace_id'])
    .index('by_workspace_agentKey', ['workspace_id', 'agentKey']),

  // ── prompt_versions: versioned prompt store (Phase 24) ──────────────────────
  prompt_versions: defineTable({
    workspace_id: v.string(),
    agentKey: v.string(),
    version: v.number(),
    content: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    createdBy: v.optional(v.string()),  // Clerk userId
    note: v.optional(v.string()),
  })
    .index('by_workspace', ['workspace_id'])
    .index('by_workspace_agentKey', ['workspace_id', 'agentKey'])
    .index('by_workspace_agentKey_version', ['workspace_id', 'agentKey', 'version']),

  // ── eval_scores: append-only scenario-run time-series (Phase 38, §38.2) ─────
  eval_scores: defineTable({
    workspace_id: v.string(),
    scenarioId: v.string(),       // matches the repo-fixture Scenario.id (§38.1)
    agentKey: v.string(),
    promptVersion: v.string(),    // String(prompt_versions.version) — see §38.3
    overall: v.number(),          // 0-10, from ScoreResponse.overall (§3A.2)
    axes: v.string(),             // JSON-encoded ScoreResponse.axes
    costUsd: v.number(),          // combined test-run + score cost for this row
    ranAt: v.number(),            // Date.now(), server-side
    source: v.string(),           // "drawer" | "commit" | "manual"
  })
    .index('by_workspace', ['workspace_id'])
    .index('by_workspace_scenario', ['workspace_id', 'scenarioId'])
    .index('by_workspace_agentKey', ['workspace_id', 'agentKey'])
    .index('by_workspace_agentKey_version', ['workspace_id', 'agentKey', 'promptVersion']),

  // ── pipeline_config: global pipeline settings (Phase 22) ────────────────────
  pipeline_config: defineTable({
    workspace_id: v.string(),
    key: v.string(),             // "schedule_enabled" | "cost_cap_usd" | etc.
    value: v.string(),           // JSON-encoded
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  })
    .index('by_workspace', ['workspace_id'])
    .index('by_workspace_key', ['workspace_id', 'key']),

  // ── agent_runs: per-node live progress (Phase 23) ───────────────────────────
  agent_runs: defineTable({
    workspace_id: v.string(),
    runId: v.string(),
    agentKey: v.string(),
    status: v.string(),          // "queued" | "running" | "done" | "failed"
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    tokensIn: v.optional(v.number()),    // Phase 23 OBS-03
    tokensOut: v.optional(v.number()),   // Phase 23 OBS-03
    error: v.optional(v.string()),       // Phase 23 OBS-03 — error message on failure
    retryCount: v.optional(v.number()),  // Phase 37 §37.1 — genuine LLM regenerate-retries, legacy = 0/absent
  })
    .index('by_workspace', ['workspace_id'])
    .index('by_runId', ['runId']),

  // ── agent_run_payloads: per-agent I/O snapshots (Phase 23 OBS-05) ──
  agent_run_payloads: defineTable({
    workspace_id: v.string(),
    runId: v.string(),
    agentKey: v.string(),
    inputSnapshot: v.optional(v.string()),   // JSON, truncated ~2000 chars
    outputSnapshot: v.optional(v.string()),  // JSON, truncated ~2000 chars
    inputKeys: v.optional(v.array(v.string())),  // Phase 44 §44.5 — untruncated top-level input key list for the missing-inputs diff; legacy rows omit it
  })
    .index('by_workspace', ['workspace_id'])
    .index('by_runId_agentKey', ['runId', 'agentKey']),

  // ── charities: registry with dedup (Phase 26) ────────────────────────────────
  charities: defineTable({
    workspace_id: v.string(),
    name: v.string(),
    status: v.string(),          // "candidate" | "featured" | "blocklisted"
    timesFeatured: v.optional(v.number()),
    lastFeaturedAt: v.optional(v.number()),
    // ── Phase 26 additive fields (API_CONTRACTS §26.1) ────────────────────────
    dedupKey: v.optional(v.string()),        // case-folded "{name.trim().toLowerCase()}|{domain}"
    website: v.optional(v.string()),          // raw website URL
    domain: v.optional(v.string()),           // bare domain, case-folded
    sanityCharityId: v.optional(v.string()),  // Sanity charity slug/_id cross-reference
    firstSeenRunId: v.optional(v.string()),   // runId that first logged this as candidate
  })
    .index('by_workspace', ['workspace_id'])
    .index('by_workspace_dedupKey', ['workspace_id', 'dedupKey'])  // dedup lookup
    .index('by_workspace_status', ['workspace_id', 'status']),      // Scout filter

  // ── charity_corrections: append-only corrections log (Phase 39, MEM-02) ────
  // Never updated or deleted — the log IS the durable record. Keyed by the
  // SAME dedupKey format as charities.dedupKey (§26.1). API_CONTRACTS §39.1.
  charity_corrections: defineTable({
    workspace_id: v.string(),
    charityKey: v.string(),                   // registry dedupKey — PRIMARY match key
    sanityCharityId: v.optional(v.string()),  // denormalized display/fallback convenience
    text: v.string(),                         // the correction itself
    author: v.string(),                       // Clerk actorId from requireOperator(ctx)
    createdAt: v.number(),
  })
    .index('by_workspace_charityKey', ['workspace_id', 'charityKey'])
    .index('by_workspace', ['workspace_id']),

  // ── model_pricing: cost projection table (Phase 27) ─────────────────────────
  model_pricing: defineTable({
    workspace_id: v.string(),
    model: v.string(),
    inputPricePer1M: v.number(),   // USD
    outputPricePer1M: v.number(),  // USD
    updatedAt: v.number(),
  })
    .index('by_workspace', ['workspace_id'])
    .index('by_workspace_model', ['workspace_id', 'model']),

  // ── payouts: per-issue payout tracking (Phase 27 RCN-02) ─────────────────────
  // Operator marks a payout sent (date + reference) from the finance view so the
  // "100% of proceeds" promise is auditable across all issues. Mutations are
  // Clerk-JWT-guarded + audit-logged (D-11/D-12, AUD-01). Tracking only — no
  // disbursement integration this phase.
  payouts: defineTable({
    workspace_id: v.string(),
    issueNumber: v.number(),
    issueId: v.optional(v.string()),
    charitySlug: v.string(),
    amount: v.number(),                                  // net cents to charity
    status: v.union(v.literal('pending'), v.literal('sent')),
    sentAt: v.optional(v.number()),
    reference: v.optional(v.string()),                   // payout reference / memo
    actor: v.optional(v.string()),                       // Clerk user who marked sent
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspace_issueNumber', ['workspace_id', 'issueNumber'])
    .index('by_workspace_status', ['workspace_id', 'status']),

  // ── claim_checks: per-claim factual sign-off checklist (Phase 26 RVW-05) ─────
  // One row per extracted factual claim from an issue run (number/date/proper_noun).
  // The operator checks or skips each before the approve action is enabled.
  // API_CONTRACTS §26.2
  claim_checks: defineTable({
    workspace_id: v.string(),
    runId: v.string(),
    claimIndex: v.number(),       // stable ordinal position from extraction
    text: v.string(),             // extracted claim text
    claimType: v.string(),        // "number" | "date" | "proper_noun"
    context: v.string(),          // 60-char surrounding window for review
    status: v.string(),           // "pending" | "checked" | "skipped"
    checkedAt: v.optional(v.number()), // Phase 33 D-13: stamped by setStatus on checked/skipped
    // ── Phase 35 provenance (PRV-01/03/04) — additive optional; legacy rows omit all five ──
    claimId: v.optional(v.string()),        // present only for writer-bound (sourced) rows
    sourceUrl: v.optional(v.string()),      // index-bound Tavily URL; absent => unsourced
    retrievedAt: v.optional(v.number()),    // Unix ms, code-stamped at Tavily query time
    sectionName: v.optional(v.string()),    // galley section this claim occurs in (all new rows)
    blockIndexHint: v.optional(v.number()), // hint-only anchor, mirrors qaCorrections
    // ── Phase 42 Fact Check Stage (FCT-01/07) — additive optional; legacy rows omit all three ──
    // API_CONTRACTS §42.1
    importance: v.optional(v.union(         // Researcher-emitted tier; absent => 'Supporting' (D-03)
      v.literal('Load-bearing'), v.literal('Supporting'), v.literal('Incidental'),
    )),
    changedSinceCheck: v.optional(v.boolean()), // set by markChanged/_reset_touched_claims (D-20)
    conflict: v.optional(v.boolean()),          // set only by Replace-source/Ask-agent flows (D-07)
  })
    .index('by_runId', ['runId'])
    .index('by_workspace', ['workspace_id']),

  // ── review_actions: content review trail (Phase 26) ─────────────────────────
  review_actions: defineTable({
    workspace_id: v.string(),
    runId: v.string(),
    actorId: v.string(),
    action: v.string(),          // "approved" | "rejected" | "requested_changes"
    note: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index('by_workspace', ['workspace_id'])
    .index('by_runId', ['runId']),

  // ── sign_offs: two-sign-off publish gate (Phase 34 PUB-01) ──────────────────
  // One active row per (runId, kind). "Active" = revokedAt absent. Both kinds
  // active (unrevoked) is the publish/schedule gate (§34.4) and the webhook
  // re-check (§34.5). Content mutations revoke both (§34.6). Re-signing PATCHES
  // the same row and clears the revocation (§34.2).
  sign_offs: defineTable({
    workspace_id: v.string(),
    runId: v.string(),
    kind: v.union(v.literal('facts-cleared'), v.literal('sounds-human')),
    actorId: v.string(),          // verified-upstream Clerk sub from the FastAPI endpoint
    signedAt: v.number(),         // Unix ms
    revokedAt: v.optional(v.number()),      // present = revoked; absent = active
    revokedReason: v.optional(v.string()),
  })
    .index('by_runId', ['runId'])
    .index('by_runId_and_kind', ['runId', 'kind'])
    .index('by_workspace', ['workspace_id']),

  // ── issues: first-class issue entity (Phase 40 ISS-01/02/03/04) ───────────
  // Operational state Convex owns; Sanity stays content-of-record (D-01).
  // `held` and `published` are the ONLY stored status inputs — issue status is
  // DERIVED (lib/derivedState.ts, §40.6), never persisted (D-18). There is no
  // `status` column; a persisted status is exactly the stale "ready" ISS-06 bans.
  issues: defineTable({
    workspace_id: v.string(),
    issueNumber: v.number(),
    scheduledFor: v.optional(v.number()),
    held: v.boolean(),
    heldReason: v.optional(v.string()),
    heldBy: v.optional(v.string()),
    heldAt: v.optional(v.number()),
    published: v.boolean(),
    publishedAt: v.optional(v.number()),
    sanityIssueId: v.optional(v.string()),
    lastVisitedStage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_workspace', ['workspace_id'])
    .index('by_workspace_issueNumber', ['workspace_id', 'issueNumber']),

  // ── story_leads: Signal Editor's dated story leads (Phase 46, SGE-01) ──────
  // Dedicated table, NOT a new deliberationEvents.eventType literal — that union
  // is FROZEN (§37.3) and Phase 47 (BRF-02) needs a patchable per-lead row, which
  // an append-only event stream cannot support. API_CONTRACTS §46.5/§46.6.
  story_leads: defineTable({
    runId: v.string(),
    premise: v.string(),
    datedPeg: v.string(),
    pegSourceUrl: v.string(),
    readerEnergy: v.string(),
    charitableAngle: v.string(),
    category: v.string(),
    confidence: v.string(),
    brandRiskFlag: v.boolean(),
    brandRiskReason: v.optional(v.string()),
    repetitionWarning: v.optional(v.string()),
    recommended: v.boolean(),
    timestamp: v.number(),
  })
    .index('by_runId', ['runId']),

  // ── verification_records: verify_candidates's per-org record (Phase 46, SGE-03) ──
  // obscurity: {pressHits, verdict} is flattened here; the pipeline
  // VerificationRecord dict re-nests it. API_CONTRACTS §46.5/§46.6.
  verification_records: defineTable({
    runId: v.string(),
    candidateId: v.string(),
    candidateName: v.string(),
    domainLive: v.boolean(),
    registrationId: v.optional(v.string()),
    registrationVerified: v.boolean(),
    pressHits: v.number(),
    obscurityVerdict: v.string(),
    status: v.union(v.literal('pass'), v.literal('fail'), v.literal('unverified')),
    killed: v.boolean(),
    killReason: v.optional(v.string()),
    checkedAt: v.number(),
    timestamp: v.number(),
  })
    .index('by_runId', ['runId'])
    .index('by_runId_and_candidate', ['runId', 'candidateId']),
})
