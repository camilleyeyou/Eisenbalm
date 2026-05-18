# The Eisenbalm Dispatch — API Contracts

This document specifies every interface boundary in the system.
Claude Code must follow these contracts exactly — do not invent field names,
query shapes, or payload structures not defined here.

There are six boundaries:

1. Next.js → Sanity (GROQ reads)
2. Pipeline → Sanity (Python writes)
3. Pipeline → Convex (Python mutation calls)
4. Next.js → Convex (TypeScript query hooks)
5. Sanity → Pipeline (webhook: Andrew publishes)
6. Next.js → Stripe + Stripe → Next.js (commerce)

Plus one internal contract:
7. LangGraph state (inter-agent data contract)

---

## 1. Next.js → Sanity (GROQ reads)

All queries use `@sanity/client` with `useCDN: true` for reads.
Queries live in `apps/web/lib/sanity/queries.ts`.

### 1.1 — Homepage: get latest published issue slug

```groq
// QUERY_LATEST_ISSUE_SLUG
*[_type == "weeklyIssue" && status == "published"]
| order(issueNumber desc)[0] {
  issueNumber,
  "slug": slug.current
}
```

**Returns:**
```typescript
type LatestIssueSlug = {
  issueNumber: number
  slug: string
} | null
```

---

### 1.2 — Issue page: full issue by slug

```groq
// QUERY_ISSUE_BY_SLUG
*[_type == "weeklyIssue" && slug.current == $slug && status == "published"][0] {
  issueNumber,
  publishDate,
  bonusType,
  "runId": pipelineMetadata.runId,

  charity-> {
    name,
    "slug": slug.current,
    location,
    website,
    charityNavigatorUrl,
    foundingYear,
    assetRange,
    focusArea,
    missionStatement,
  },

  theme {
    primaryColor,
    accentColor,
    backgroundColor,
    textColor,
    fontDisplay,
    fontBody,
    visualDirection,
  },

  originStory { headline, body },
  problemStatement { headline, body },
  "problemPdfUrl": problemPdf.asset->url,

  founderBio { headline, body },

  caseStudy {
    subjectName,
    headline,
    body,
  },

  game {
    headline,
    description,
    embedCode,
  },

  bonus {
    headline,
    body,
    lyrics,
    sunoPrompt,
    sunoAudioUrl,
    storyboards[] { asset->{ url } },
  },

  podcast {
    "audioUrl": audioFile.asset->url,
    podcastDescription,
    duration,
    deliberationTranscript,
  },

  selectionDeliberation {
    candidates[] {
      charity->{ name, "slug": slug.current, location },
      scoutSummary,
      advocateArgument,
      advocateScore,
    },
    editorDecision,
    runnerUpNotes,
  },
}
```

**Params:** `{ slug: string }`

**Returns:** `Issue | null` — see `apps/web/types/issue.ts` for full TypeScript type.

---

### 1.3 — Archive: all published issues

```groq
// QUERY_ARCHIVE
*[_type == "weeklyIssue" && status == "published"]
| order(issueNumber desc) {
  issueNumber,
  publishDate,
  "slug": slug.current,
  bonusType,
  charity-> {
    name,
    "slug": slug.current,
    location,
    focusArea,
    assetRange,
  },
}
```

**Returns:** `ArchiveIssue[]`

---

### 1.4 — Charity database: all charities

```groq
// QUERY_ALL_CHARITIES
*[_type == "charity"] | order(name asc) {
  name,
  "slug": slug.current,
  location,
  website,
  foundingYear,
  focusArea,
  assetRange,
  missionStatement,
  "featuredIn": firstFeaturedIn-> {
    issueNumber,
    "slug": slug.current,
    publishDate,
  },
}
```

**Returns:** `CharityListItem[]`

---

### 1.5 — Charity page: single charity by slug

```groq
// QUERY_CHARITY_BY_SLUG
*[_type == "charity" && slug.current == $slug][0] {
  name,
  "slug": slug.current,
  location,
  website,
  charityNavigatorUrl,
  guidestarUrl,
  foundingYear,
  assetRange,
  focusArea,
  missionStatement,
  scoutNotes,
  "featuredIn": firstFeaturedIn-> {
    issueNumber,
    "slug": slug.current,
    publishDate,
  },
}
```

**Params:** `{ slug: string }`

**Returns:** `CharityDetail | null`

---

### 1.6 — Agent profiles (deliberation layer)

```groq
// QUERY_AGENT_PROFILES
*[_type == "agentProfile"] {
  "agentId": agentId.current,
  displayName,
  role,
  personality,
  "avatarUrl": avatar.asset->url,
}
```

**Returns:** `AgentProfile[]`

Called once on app init, cached. Used to render agent identity cards
in the deliberation layer alongside Convex event data.

---

### 1.7 — Issue runId (for Convex deliberation queries)

```groq
// QUERY_ISSUE_RUN_ID
*[_type == "weeklyIssue" && slug.current == $slug][0] {
  "runId": pipelineMetadata.runId,
}
```

**Params:** `{ slug: string }`

**Returns:** `{ runId: string } | null`

The issue page uses this runId to subscribe to Convex deliberation queries.

---

## 2. Pipeline → Sanity (Python writes)

All writes use the Sanity Python client.

```python
# packages/pipeline/lib/sanity_client.py
from sanity import Client

client = Client(
    project_id=os.environ['NEXT_PUBLIC_SANITY_PROJECT_ID'],
    dataset='production',
    token=os.environ['SANITY_API_TOKEN'],
    api_version='2024-01-01',
    use_cdn=False,  # writes always bypass CDN
)
```

---

### 2.1 — Create or update charity document

Called by the Scout agent for each candidate found, and again
by the pipeline before writing the issue draft.

```python
def write_charity(charity: CharityCandidate) -> str:
    """Returns the Sanity document _id."""
    slug = slugify(charity['name'])  # use python-slugify
    doc = {
        '_type': 'charity',
        '_id': f'charity-{slug}',          # deterministic — no duplicates
        'name': charity['name'],
        'slug': {'_type': 'slug', 'current': slug},
        'location': charity['location'],
        'website': charity.get('website', ''),
        'charityNavigatorUrl': charity.get('charityNavigatorUrl'),
        'guidestarUrl': charity.get('guidestarUrl'),
        'foundingYear': charity.get('foundingYear'),
        'assetRange': charity.get('assetRange', ''),
        'focusArea': charity.get('focusArea', ''),
        'missionStatement': charity.get('missionStatement', ''),
        'scoutNotes': charity.get('scoutSummary', ''),
    }
    client.create_or_replace(doc)
    return doc['_id']
```

---

### 2.2 — Create weeklyIssue draft

Called once after all section agents complete and QA/Editor final has run.
Status is always `'draft'` — Andrew changes it to `'published'`.

```python
def write_issue_draft(state: DispatchState) -> str:
    """Returns the Sanity document _id."""
    issue_id = f'issue-{state["issue_number"]}'

    doc = {
        '_type': 'weeklyIssue',
        '_id': issue_id,
        'issueNumber': state['issue_number'],
        'slug': {
            '_type': 'slug',
            'current': f'issue-{state["issue_number"]}',
        },
        'publishDate': state['publish_date'],   # ISO 8601 date string
        'status': 'draft',
        'bonusType': state['style_brief']['bonusType'],

        'charity': {
            '_type': 'reference',
            '_ref': state['winning_charity_sanity_id'],
        },

        'theme': state['theme'],               # dict, matches schema fields exactly

        'originStory': {
            'headline': state['origin_story']['headline'],
            'body': text_to_portable_text(state['origin_story']['body']),
        },

        'problemStatement': {
            'headline': state['problem_statement']['headline'],
            'body': text_to_portable_text(state['problem_statement']['body']),
        },

        'founderBio': {
            'headline': state['founder_bio']['headline'],
            'body': text_to_portable_text(state['founder_bio']['body']),
        },

        'caseStudy': {
            'subjectName': state['case_study']['subjectName'],
            'headline': state['case_study']['headline'],
            'body': text_to_portable_text(state['case_study']['body']),
        },

        'game': {
            'headline': state['game']['headline'],
            'description': state['game']['description'],
            'embedCode': state['game']['embedCode'],
        },

        'bonus': _build_bonus(state),

        'podcast': {
            'deliberationTranscript': state['deliberation_transcript'],
            'podcastDescription': _build_podcast_description(state),
            # audioFile left empty — Andrew uploads after NotebookLM
            # duration left empty
        },

        'selectionDeliberation': {
            'candidates': [
                {
                    '_key': f'candidate-{i}',   # required for Sanity array items
                    'charity': {
                        '_type': 'reference',
                        '_ref': f'charity-{slugify(c["name"])}',
                    },
                    'scoutSummary': c['scoutSummary'],
                    'advocateArgument': c.get('advocateArgument', ''),
                    'advocateScore': c.get('advocateScore'),
                }
                for i, c in enumerate(state['candidates'])
            ],
            'editorDecision': state['editor_decision'],
            'runnerUpNotes': state['runner_up_notes'],
        },

        'pipelineMetadata': {
            'runId': state['run_id'],
            'startedAt': state['pipeline_started_at'],
            'completedAt': datetime.utcnow().isoformat() + 'Z',
            'modelVersions': json.dumps(state.get('model_versions', {})),
        },
    }

    client.create_or_replace(doc)
    return issue_id


def _build_bonus(state: DispatchState) -> dict:
    bonus = state['bonus']
    bonus_type = state['style_brief']['bonusType']
    result = {
        'headline': bonus['headline'],
        'body': text_to_portable_text(bonus['body']),
    }
    if bonus_type == 'jingle':
        result['lyrics'] = bonus.get('lyrics', '')
        result['sunoPrompt'] = bonus.get('sunoPrompt', '')
        # sunoAudioUrl intentionally omitted — Andrew populates
    return result
```

---

### 2.3 — Upload PDF and patch issue

Called by the Publisher agent after generating the Problem Statement PDF.

```python
async def upload_pdf_to_issue(issue_id: str, pdf_path: str, issue_number: int):
    filename = f'dispatch-issue-{issue_number}-problem-statement.pdf'

    with open(pdf_path, 'rb') as f:
        asset = client.assets.upload('file', f, filename=filename)

    client.patch(issue_id).set({
        'problemPdf': {
            '_type': 'file',
            'asset': {
                '_type': 'reference',
                '_ref': asset['_id'],
            },
        }
    }).commit()
```

---

### 2.4 — Portable Text helper (critical — do not bypass)

The pipeline must never construct Portable Text blocks manually inline.
Use this helper everywhere body text is written to Sanity.

```python
# packages/pipeline/lib/portable_text.py
import uuid

def text_to_portable_text(text: str) -> list[dict]:
    """
    Converts plain text (paragraph breaks = double newline) to
    Sanity Portable Text block array.

    Args:
        text: Plain text with paragraphs separated by blank lines.

    Returns:
        List of Portable Text block dicts ready to write to Sanity.
    """
    paragraphs = [p.strip() for p in text.strip().split('\n\n') if p.strip()]
    return [
        {
            '_type': 'block',
            '_key': f'block-{uuid.uuid4().hex[:8]}',
            'style': 'normal',
            'markDefs': [],
            'children': [
                {
                    '_type': 'span',
                    '_key': f'span-{uuid.uuid4().hex[:8]}',
                    'text': para,
                    'marks': [],
                }
            ],
        }
        for para in paragraphs
    ]
```

---

### 2.5 — Update firstFeaturedIn on charity (Publisher)

Called by Publisher after the issue goes live.

```python
def set_charity_first_featured(charity_id: str, issue_id: str):
    # Only set if not already set (charity may appear in future issues)
    existing = client.get_document(charity_id)
    if existing and not existing.get('firstFeaturedIn'):
        client.patch(charity_id).set({
            'firstFeaturedIn': {
                '_type': 'reference',
                '_ref': issue_id,
            }
        }).commit()
```

---

## 3. Pipeline → Convex (Python mutation calls)

The pipeline calls Convex mutations via the Convex HTTP API.
All calls are async.

```python
# packages/pipeline/lib/convex_client.py
import httpx
import os

CONVEX_URL = os.environ['NEXT_PUBLIC_CONVEX_URL'].rstrip('/')
CONVEX_KEY = os.environ['CONVEX_DEPLOY_KEY']

async def convex_mutation(path: str, args: dict) -> dict:
    """
    Call a Convex mutation from Python.
    path: e.g. "pipelineRuns:create"
    """
    async with httpx.AsyncClient(timeout=10.0) as http:
        r = await http.post(
            f'{CONVEX_URL}/api/mutation',
            json={'path': path, 'args': args},
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Convex {CONVEX_KEY}',
            },
        )
        r.raise_for_status()
        return r.json()
```

---

### 3.1 — pipelineRuns:create

Called at pipeline start.

```python
await convex_mutation('pipelineRuns:create', {
    'runId': state['run_id'],        # UUID string
    'issueNumber': state['issue_number'],
    'startedAt': int(time.time() * 1000),  # Unix ms
})
```

---

### 3.2 — pipelineRuns:updateStatus

Called when pipeline status changes.

```python
# When awaiting Andrew's review:
await convex_mutation('pipelineRuns:updateStatus', {
    'runId': state['run_id'],
    'status': 'awaiting-review',
})

# When complete:
await convex_mutation('pipelineRuns:updateStatus', {
    'runId': state['run_id'],
    'status': 'complete',
    'completedAt': int(time.time() * 1000),
})

# On failure:
await convex_mutation('pipelineRuns:updateStatus', {
    'runId': state['run_id'],
    'status': 'failed',
    'completedAt': int(time.time() * 1000),
    'errorMessage': str(error),
})
```

---

### 3.3 — pitchLog:insert

Called by Scout for each candidate found, as they are found (not batched).

```python
await convex_mutation('pitchLog:insert', {
    'runId': state['run_id'],
    'charityId': charity_sanity_id,     # optional — may not exist yet
    'charityName': candidate['name'],
    'charityLocation': candidate['location'],
    'charityWebsite': candidate.get('website'),
    'assetRange': candidate.get('assetRange'),
    'focusArea': candidate.get('focusArea'),
    'scoutSummary': candidate['scoutSummary'],
    'selected': False,                  # updated after Editor gate 1
})
```

After Editor gate 1 selects the winner:

```python
await convex_mutation('pitchLog:markSelected', {
    'runId': state['run_id'],
    'charityName': state['winning_charity']['name'],
})
```

---

### 3.4 — deliberationEvents:insert

Called throughout the pipeline as events occur. Payload is always a JSON string.

```python
# Scout finding
await convex_mutation('deliberationEvents:insert', {
    'runId': run_id,
    'agentId': 'scout',
    'eventType': 'scout-finding',
    'charityId': charity_id,           # optional
    'payload': json.dumps({
        'charityName': candidate['name'],
        'whyOverlooked': candidate['whyOverlooked'],
        'assetRange': candidate.get('assetRange'),
    }),
})

# Advocate argument
await convex_mutation('deliberationEvents:insert', {
    'runId': run_id,
    'agentId': 'advocate',
    'eventType': 'advocate-argument',
    'charityId': charity_id,
    'payload': json.dumps({
        'charityName': candidate['name'],
        'argument': candidate['advocateArgument'],
        'score': candidate['advocateScore'],
    }),
})

# Editor gate 1 decision
await convex_mutation('deliberationEvents:insert', {
    'runId': run_id,
    'agentId': 'editor',
    'eventType': 'editor-decision',
    'payload': json.dumps({
        'winner': state['winning_charity']['name'],
        'rationale': state['editor_decision'],
    }),
})

# Section draft completed (one call per section agent)
await convex_mutation('deliberationEvents:insert', {
    'runId': run_id,
    'agentId': agent_id,               # e.g. 'origin-story'
    'eventType': 'section-draft',
    'sectionName': section_name,       # e.g. 'originStory'
    'payload': json.dumps({
        'headline': content['headline'],
        'wordCount': len(content['body'].split()),
    }),
})

# QA corrections summary
await convex_mutation('deliberationEvents:insert', {
    'runId': run_id,
    'agentId': 'qa',
    'eventType': 'qa-correction',
    'payload': json.dumps({
        'totalCorrections': len(corrections),
        'majorCount': sum(1 for c in corrections if c['severity'] == 'major'),
    }),
})

# Editor final
await convex_mutation('deliberationEvents:insert', {
    'runId': run_id,
    'agentId': 'editor',
    'eventType': 'editor-final',
    'payload': json.dumps({
        'approved': True,
        'notes': state.get('editor_final_notes', ''),
    }),
})

# Publisher deploy
await convex_mutation('deliberationEvents:insert', {
    'runId': run_id,
    'agentId': 'publisher',
    'eventType': 'publisher-deploy',
    'payload': json.dumps({
        'issueNumber': state['issue_number'],
        'sanityIssueId': state['sanity_issue_id'],
    }),
})
```

---

### 3.5 — agentVotes:insert

Called by Advocate for each charity-agent combination.
In v1, only the Advocate votes. Future versions may have multiple agents vote.

```python
await convex_mutation('agentVotes:insert', {
    'runId': run_id,
    'agentId': 'advocate',
    'charityId': charity_sanity_id,
    'charityName': candidate['name'],
    'vote': 'for',                     # Advocate always votes 'for' (it's the advocate)
    'reasoning': candidate['advocateArgument'],
})
```

---

### 3.6 — qaCorrections:insert

Called once per correction the QA agent makes.

```python
for correction in qa_corrections:
    await convex_mutation('qaCorrections:insert', {
        'runId': run_id,
        'sectionName': correction['sectionName'],  # e.g. 'originStory'
        'fieldName': correction['fieldName'],       # e.g. 'body'
        'original': correction['original'],         # what the agent wrote
        'corrected': correction['corrected'],       # what QA changed it to
        'reason': correction['reason'],
        'severity': correction['severity'],         # 'minor' | 'moderate' | 'major'
        'accepted': correction['accepted'],         # whether Editor final kept the fix
    })
```

---

## 4. Next.js → Convex (TypeScript query hooks)

These are the Convex query function files.
Place in `convex/` directory.

### 4.1 — convex/pipelineRuns.ts

```typescript
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return await ctx.db
      .query('pipelineRuns')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .first()
  },
})

export const create = mutation({
  args: {
    runId: v.string(),
    issueNumber: v.number(),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('pipelineRuns', {
      ...args,
      status: 'running' as const,
    })
  },
})

export const updateStatus = mutation({
  args: {
    runId: v.string(),
    status: v.union(
      v.literal('running'),
      v.literal('awaiting-review'),
      v.literal('complete'),
      v.literal('failed'),
    ),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query('pipelineRuns')
      .withIndex('by_runId', q => q.eq('runId', args.runId))
      .first()
    if (!run) throw new Error(`Run not found: ${args.runId}`)
    const { runId, ...updates } = args
    await ctx.db.patch(run._id, updates)
  },
})
```

---

### 4.2 — convex/pitchLog.ts

```typescript
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return await ctx.db
      .query('pitchLog')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .order('asc')
      .collect()
  },
})

export const insert = mutation({
  args: {
    runId: v.string(),
    charityId: v.optional(v.string()),
    charityName: v.string(),
    charityLocation: v.string(),
    charityWebsite: v.optional(v.string()),
    assetRange: v.optional(v.string()),
    focusArea: v.optional(v.string()),
    scoutSummary: v.string(),
    selected: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('pitchLog', {
      ...args,
      timestamp: Date.now(),
    })
  },
})

export const markSelected = mutation({
  args: {
    runId: v.string(),
    charityName: v.string(),
  },
  handler: async (ctx, { runId, charityName }) => {
    const entries = await ctx.db
      .query('pitchLog')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .collect()
    await Promise.all(
      entries.map(entry =>
        ctx.db.patch(entry._id, { selected: entry.charityName === charityName })
      )
    )
  },
})
```

---

### 4.3 — convex/deliberationEvents.ts

```typescript
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return await ctx.db
      .query('deliberationEvents')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .order('asc')
      .collect()
  },
})

export const byRunIdAndType = query({
  args: {
    runId: v.string(),
    eventType: v.string(),
  },
  handler: async (ctx, { runId, eventType }) => {
    return await ctx.db
      .query('deliberationEvents')
      .withIndex('by_runId_and_type', q =>
        q.eq('runId', runId).eq('eventType', eventType as any)
      )
      .order('asc')
      .collect()
  },
})

export const insert = mutation({
  args: {
    runId: v.string(),
    agentId: v.string(),
    eventType: v.union(
      v.literal('scout-finding'),
      v.literal('advocate-argument'),
      v.literal('editor-decision'),
      v.literal('section-draft'),
      v.literal('qa-correction'),
      v.literal('editor-final'),
      v.literal('publisher-deploy'),
    ),
    payload: v.string(),
    charityId: v.optional(v.string()),
    sectionName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('deliberationEvents', {
      ...args,
      timestamp: Date.now(),
    })
  },
})
```

---

### 4.4 — convex/agentVotes.ts

```typescript
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return await ctx.db
      .query('agentVotes')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .order('asc')
      .collect()
  },
})

export const byRunIdAndCharity = query({
  args: { runId: v.string(), charityId: v.string() },
  handler: async (ctx, { runId, charityId }) => {
    return await ctx.db
      .query('agentVotes')
      .withIndex('by_runId_and_charity', q =>
        q.eq('runId', runId).eq('charityId', charityId)
      )
      .collect()
  },
})

export const insert = mutation({
  args: {
    runId: v.string(),
    agentId: v.string(),
    charityId: v.string(),
    charityName: v.string(),
    vote: v.union(v.literal('for'), v.literal('against'), v.literal('abstain')),
    reasoning: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('agentVotes', {
      ...args,
      timestamp: Date.now(),
    })
  },
})
```

---

### 4.5 — convex/qaCorrections.ts

```typescript
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return await ctx.db
      .query('qaCorrections')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .order('asc')
      .collect()
  },
})

export const insert = mutation({
  args: {
    runId: v.string(),
    sectionName: v.string(),
    fieldName: v.string(),
    original: v.string(),
    corrected: v.string(),
    reason: v.string(),
    severity: v.union(
      v.literal('minor'),
      v.literal('moderate'),
      v.literal('major'),
    ),
    accepted: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('qaCorrections', {
      ...args,
      timestamp: Date.now(),
    })
  },
})
```

---

### 4.6 — Frontend hook usage (Next.js components)

```typescript
// In a deliberation layer component:
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

// Get the runId from the Sanity issue object, then:
const pitches = useQuery(api.pitchLog.byRunId, { runId })
const votes = useQuery(api.agentVotes.byRunId, { runId })
const corrections = useQuery(api.qaCorrections.byRunId, { runId })
const events = useQuery(api.deliberationEvents.byRunId, { runId })
const run = useQuery(api.pipelineRuns.byRunId, { runId })

// All return undefined while loading, null if not found, data when ready.
// useQuery auto-subscribes — UI updates reactively when data changes.
```

---

## 5. Sanity → Pipeline (webhook: Andrew publishes)

### 5.1 — Sanity webhook configuration

Configure in Sanity project settings → API → Webhooks:

```
URL:    https://<railway-domain>/webhook/sanity-publish
Filter: _type == "weeklyIssue" && status == "published"
Projection: { _id, _type, status, issueNumber, "runId": pipelineMetadata.runId }
Secret:  <SANITY_WEBHOOK_SECRET>  (set in Railway env vars)
HTTP method: POST
```

### 5.2 — Webhook payload shape

```typescript
type SanityPublishWebhookPayload = {
  _id: string           // e.g. "issue-12"
  _type: "weeklyIssue"
  status: "published"
  issueNumber: number
  runId: string         // from pipelineMetadata.runId
}
```

### 5.3 — FastAPI handler

> **Algorithm correction (Phase 6 / 2026-05-18):** the Sanity webhook
> signature is NOT `sha256=<hex>` — that was a guess pinned in this doc
> before the upstream algorithm was verified. The canonical algorithm
> (from `@sanity/webhook` v5+ source) is:
>
>     header   = f"t={timestamp_ms},v1={signature}"
>     payload  = f"{timestamp_ms}.".encode("utf-8") + raw_body_bytes
>     signature = base64url_no_pad(HMAC_SHA256(secret_utf8, payload))
>
> The canonical Python implementation lives in
> `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py`
> (Phase 6 / Plan 06-04). Sources:
> https://github.com/sanity-io/webhook-toolkit/blob/main/src/signature.ts
> · `.planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md`
> Pattern 1.

```python
# packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py
# CANONICAL implementation: see lib/sanity_webhook.py for the verifier.

from fastapi import APIRouter, Request, HTTPException
from eisenbalm_pipeline.lib.sanity_webhook import (
    SIGNATURE_HEADER_NAME,
    SignatureError,
    SignatureExpiredError,
    verify_sanity_signature,
)

router = APIRouter()

@router.post('/webhook/sanity-publish')
async def sanity_publish(request: Request):
    # 1. Verify HMAC signature (raw body — DO NOT call request.json() first)
    raw = await request.body()
    sig_header = request.headers.get(SIGNATURE_HEADER_NAME)
    secret = os.environ['SANITY_WEBHOOK_SECRET']
    try:
        ts_ms = verify_sanity_signature(raw, sig_header, secret)
    except SignatureExpiredError:
        # WHK-03 — older than 5 minutes (or future-skewed beyond 5 min)
        raise HTTPException(status_code=410, detail='Signature too old')
    except SignatureError as e:
        # WHK-02 — bad format or HMAC mismatch
        raise HTTPException(status_code=401, detail=str(e))

    # 2. Parse payload
    payload = json.loads(raw)

    # 3. Guard: only trigger on published status
    if payload.get('status') != 'published':
        return {'ok': True, 'skipped': 'not-published'}

    # 4. WHK-04 — idempotency-key dedup (Plan 06-04 lib/idempotency.py)
    idem = request.headers.get('idempotency-key')
    if idem and request.app.state.pool is not None:
        first = await claim_idempotency_key(
            request.app.state.pool,
            source='sanity-publish',
            idempotency_key=idem,
            run_id=payload.get('runId'),
        )
        if not first:
            return {'ok': True, 'duplicate': True}

    # 5. Trigger Publisher async — return 200 immediately
    #    (asyncio.create_task pattern from Phase 4 Research Pitfall 4;
    #     BackgroundTasks is cancelled on client disconnect.)
    task = asyncio.create_task(_run_publisher(
        request.app,
        issue_id=payload['_id'],
        issue_number=payload['issueNumber'],
        run_id=payload.get('runId'),
    ))
    request.app.state.background_tasks.add(task)
    task.add_done_callback(request.app.state.background_tasks.discard)

    return {'ok': True, 'scheduled': True}
```

**Signature header parsing notes:**

- The regex `^t=(\d+)[, ]+v1=([^, ]+)$` is permissive on whitespace between
  the two components — Sanity uses `, ` (comma + space) historically but
  `,` alone is accepted.
- The `t=` timestamp is the canonical age signal. The separate
  `sanity-transaction-time` header (ISO 8601) is a monitoring convenience;
  the 5-minute age check uses `t=` from the signature.
- Symmetric tolerance: reject `now - ts > MAX_AGE_MS` AND `ts - now >
  MAX_AGE_MS`. Either direction's skew beyond 5 min is rejected.
- The signature value uses **base64url WITHOUT padding** (`urlsafe_b64encode`
  + `.rstrip(b'=')`). Validators that accept padded base64 will fail.

### 5.4 — Publisher agent triggers Vercel deploy

```python
async def trigger_vercel_deploy():
    async with httpx.AsyncClient(timeout=30.0) as http:
        r = await http.post(os.environ['VERCEL_DEPLOY_HOOK_URL'])
        r.raise_for_status()
```

---

## 6. Commerce (Stripe)

### 6.1 — Create checkout session

```typescript
// apps/web/app/api/checkout/route.ts

export async function POST(request: Request) {
  const { quantity = 1 } = await request.json()

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID,  // pre-created in Stripe dashboard
        quantity,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/shop/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/shop`,
    metadata: { source: 'eisenbalm-dispatch' },
  })

  return Response.json({ url: session.url })
}
```

**Client-side call:**
```typescript
const { url } = await fetch('/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ quantity: 1 }),
}).then(r => r.json())

window.location.href = url
```

---

### 6.2 — Stripe webhook handler

```typescript
// apps/web/app/api/webhooks/stripe/route.ts

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      // Log order — no fulfillment needed (digital + single physical SKU)
      // Future: send confirmation email
      console.log('Order completed:', session.id, session.customer_email)
      break
    }
    case 'payment_intent.payment_failed': {
      // Log only — no action required
      console.log('Payment failed:', event.data.object)
      break
    }
  }

  return Response.json({ received: true })
}
```

---

## 7. LangGraph State Contract (inter-agent)

This is the internal data contract between all pipeline agents.
Every agent reads from `DispatchState` and writes its outputs back to it.
Do not add fields to this TypedDict without updating this document.

```python
# packages/pipeline/types.py
from typing import TypedDict, Optional, Literal
from datetime import datetime

class StyleBrief(TypedDict):
    voice: str                          # Jesse voice constraints for this issue
    constraints: list[str]              # specific rules this week
    bonusType: Literal['bigBudget', 'jingle', 'specAd']
    visualDirection: str                # aesthetic direction for Design agent
    previousBonusTypes: list[str]       # to avoid repeating

class CharityCandidate(TypedDict):
    name: str
    location: str
    website: str
    charityNavigatorUrl: Optional[str]
    guidestarUrl: Optional[str]
    foundingYear: Optional[int]
    assetRange: str                     # e.g. "$100K–$500K"
    focusArea: str
    missionStatement: str
    scoutSummary: str                   # why Scout surfaced this one
    whyOverlooked: str                  # the specific reason it's overlooked
    advocateArgument: Optional[str]     # populated by Advocate
    advocateScore: Optional[int]        # 1–10, populated by Advocate

class ResearchOutput(TypedDict):
    foundingMoment: str                 # the weird, specific origin moment
    founderName: str
    founderBackground: str
    caseStudySubject: str               # name/description of one real person
    caseStudyOutcome: str               # what happened to them
    verifiedFacts: list[str]            # fact-checked claims with sources
    sources: list[str]                  # URLs used

class SectionContent(TypedDict):
    headline: str
    body: str                           # plain text, paragraphs separated by \n\n

class CaseStudyContent(TypedDict):
    subjectName: str
    headline: str
    body: str

class GameContent(TypedDict):
    headline: str
    description: str
    embedCode: str                      # self-contained HTML/JS for iframe srcdoc

class BonusContent(TypedDict):
    headline: str
    body: str
    lyrics: Optional[str]               # jingle only
    sunoPrompt: Optional[str]           # jingle only

class Theme(TypedDict):
    primaryColor: str                   # hex, e.g. "#1D4E89"
    accentColor: str
    backgroundColor: str
    textColor: str
    fontDisplay: str                    # Google Fonts name
    fontBody: str
    visualDirection: str                # text description for Andrew

class QACorrection(TypedDict):
    sectionName: str
    fieldName: str
    original: str
    corrected: str
    reason: str
    severity: Literal['minor', 'moderate', 'major']
    accepted: bool                      # set by Editor final

class DispatchState(TypedDict):
    # ── Identity ──────────────────────────────────────────────────────────────
    run_id: str                         # UUID, set at pipeline start
    issue_number: int
    publish_date: str                   # ISO 8601 date, e.g. "2026-05-14"
    pipeline_started_at: str            # ISO 8601 datetime

    # ── Phase 1: Selection ────────────────────────────────────────────────────
    style_brief: Optional[StyleBrief]
    candidates: Optional[list[CharityCandidate]]
    winning_charity: Optional[CharityCandidate]
    winning_charity_sanity_id: Optional[str]    # set after Sanity write
    deliberation_transcript: Optional[str]      # full Scout+Advocate+Editor text
    editor_decision: Optional[str]              # why this charity won
    runner_up_notes: Optional[str]

    # ── Phase 2: Content (populated in parallel) ───────────────────────────────
    research: Optional[ResearchOutput]
    origin_story: Optional[SectionContent]
    problem_statement: Optional[SectionContent]
    problem_pdf_content: Optional[str]          # structured text for PDF generator
    founder_bio: Optional[SectionContent]
    case_study: Optional[CaseStudyContent]
    game: Optional[GameContent]
    bonus: Optional[BonusContent]
    theme: Optional[Theme]

    # ── Post-parallel ──────────────────────────────────────────────────────────
    qa_corrections: Optional[list[QACorrection]]
    editor_final_notes: Optional[str]

    # ── Pipeline output ────────────────────────────────────────────────────────
    sanity_issue_id: Optional[str]              # set after writing draft to Sanity
    model_versions: Optional[dict[str, str]]    # agent_id -> model name

    # ── Error handling ─────────────────────────────────────────────────────────
    error: Optional[str]
```

---

## Error handling rules

All contract boundaries must follow these rules:

**Sanity writes:** Wrap every `client.create_or_replace()` and `client.patch().commit()` in try/except. On failure, log the error, set `state['error']`, and update Convex `pipelineRuns` status to `'failed'`.

**Convex mutations:** Failures are non-blocking for the pipeline. Log the error but do not halt the pipeline. The deliberation layer being incomplete is acceptable — the content is what matters.

**GROQ queries:** All queries return `null` when nothing is found. Components must handle `null` gracefully — no query should throw on an empty result.

**Stripe webhook:** Always return `200` to Stripe even if processing fails internally. Log failures for manual review. Never return `4xx` or `5xx` to Stripe webhook calls (Stripe will retry aggressively).

**Sanity webhook:** Return `200` immediately. Run the Publisher async. Never make Sanity wait for the Publisher to complete.
