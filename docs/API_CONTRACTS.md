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

  narrator-> {
    name,
    "slug": slug.current,
    active,
  },   // Phase 16 (NRR-08): masthead narrator chip projection — name + slug + active ONLY; voiceConstraints / voiceRubric / exampleSamples are pipeline-only and MUST NOT be projected to the reader-facing query (security: no system prompt leak).

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
    conversation[] { speaker, text },   // Phase 13 (DEL-CONV): Chronicler dialogue turns for the chat-thread render
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

**Phase 16 note:** `narrator` is intentionally NOT part of the write payload. Narrator is an editorial-only Sanity field that Andrew sets in Studio; the pipeline READS it (via load_narrator_from_issue in lib/sanity_client.py) but never writes it. Narrator change history is preserved by Sanity's built-in revision tracking — no pipeline-side audit field needed (CONTEXT D-15).

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
            'conversation': [   # Phase 13 (DEL-CONV): Chronicler turns; _key required for Sanity array items
                {'_type': 'object', '_key': f'turn-{i:03d}', 'speaker': t['speaker'], 'text': t['text']}
                for i, t in enumerate(state.get('deliberation_conversation') or [])
            ] or None,
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

**Phase 18 update (long-read sections):** For the five long-read sections
(`originStory`, `problemStatement`, `founderBio`, `caseStudy`, and `bonus` when
`style_brief["bonusType"] == "specAd"`), the Python write path calls
`compose_section_body(body_blocks)` instead of `text_to_portable_text(body_str)` because
each long-read writer's Pydantic `body` field is now `list[BodyBlock]` (a discriminated
union of Paragraph / Heading / Blockquote — see §7). `compose_section_body` dispatches each
block on its `type` field to the matching builder (`block_paragraph`, `block_h2`,
`block_h3`, `block_blockquote`) and returns a `list[dict]` of Sanity Portable Text blocks.

`text_to_portable_text(body_str)` remains valid for:
- `BigBudgetBonus.body` (D-04 — body remains str; visual variety comes from `storyboards[]`)
- `JingleBonus.body`    (D-04 — body remains str; visual variety comes from lyrics + sunoPrompt)
- Stub-mode fixtures that emit `body: str` (legacy backward-compat — see Plan 18-06)

The `_build_bonus` helper in `lib/sanity_client.py` branches on `style_brief["bonusType"]`:
`specAd` uses `compose_section_body`; `bigBudget` and `jingle` use `text_to_portable_text`.

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

### Phase 18: Portable Text block builders (long-read sections)

Defined in `packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py` (Plan 18-03 adds):

- `block_paragraph(text: str) -> dict` — emits one block with `style: "normal"`
- `block_h2(text: str) -> dict` — emits one block with `style: "h2"`
- `block_h3(text: str) -> dict` — emits one block with `style: "h3"`
- `block_blockquote(text: str) -> dict` — emits one block with `style: "blockquote"`
- `compose_section_body(blocks: list[dict]) -> list[dict]` — dispatches each block on `block['type']`
  to the matching builder; returns a list of Sanity Portable Text block dicts ready to write to Sanity.

All four builders follow the same `_type: 'block'` + `_key: f'block-{uuid.uuid4().hex[:8]}'`
+ `markDefs: []` + single-span pattern as the existing `text_to_portable_text` helper.

Sanity's `weeklyIssue.body` field type is `type: 'array', of: [{type: 'block'}]` with NO
custom `styles` restriction (verified `apps/studio/schemas/weeklyIssue.ts`) — Sanity's default
block type accepts `h2`, `h3`, `blockquote` styles natively. **No Sanity schema change.**

The frontend `apps/web/components/issue/PortableTextRenderer.tsx` (Phase 10) has rendering
handlers for `h2` / `h3` / `blockquote` block styles that are dead-coded at the live URL today
— Phase 18 activates them by emitting the markers writers currently omit.

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
# NOTE: Phase 37 §37.2 adds 'confidence' + 'runnerUpNotes' to this payload —
# see §37.2 for the full amended shape.
await convex_mutation('deliberationEvents:insert', {
    'runId': run_id,
    'agentId': 'editor',
    'eventType': 'editor-decision',
    'payload': json.dumps({
        'winner': state['winning_charity']['name'],
        'rationale': state['editor_decision'],
        'confidence': state['editor_confidence'],
        'runnerUpNotes': state['runner_up_notes'],
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

## 3A. Dashboard → Pipeline (single-agent test-run)

Phase 24 (PRM-05) adds a single-agent prompt-evaluation endpoint to the FastAPI
pipeline service. It lets an operator test the CURRENT unsaved editor draft (D-03)
against sample, manual, or prior-real input and see the raw output plus cost —
WITHOUT touching any real run/issue table.

### 3A.1 — `POST /agents/{agent_key}/test-run`

```python
# packages/pipeline/src/eisenbalm_pipeline/api/agents.py

POST /agents/{agent_key}/test-run
Auth: Depends(require_clerk_jwt)   # returns {"sub": <clerkUserId>}; same guard as POST /dashboard/whoami

# Request body (Pydantic)
{
  "workspace_id": str,
  "draft_prompt": str,                 # the unsaved SYSTEM prompt text (D-03)
  "draft_user_template": Optional[str],# unsaved user-template text, if the agent has one
  "variables": dict[str, str],         # template variable values (manual entry or fixture)
  "prior_run_id": Optional[str],       # if set, load inputs from agent_run_payloads (mode 1)
}

# Response body (Pydantic)
{
  "output": str,                       # raw LLM output text or JSON
  "cost_usd": float,
  "tokens_in": int,
  "tokens_out": int,
  "model": str,
  "duration_ms": int,
}
```

**Isolation contract (PRM-05, CONTEXT Pitfall 8):**

- The handler MUST call `acomplete(...)` **directly** — NOT `graph.ainvoke()`,
  and NOT the `@agent_node` decorator. It is a prompt-evaluation utility, not a
  pipeline invocation.
- It MUST NOT write to `agent_runs`, `agent_run_payloads`, `deliberationEvents`,
  or any real run / issue table. No `pipelineRuns:create`, no Sanity write.
- Cost is read from the EXISTING `acomplete` usage path (`{tokens_in, tokens_out,
  usd, resolved_model}`) — there is **no second cost recorder**.
- Input sourcing (D-04, four modes): (1) prior-real via `agent_run_payloads`
  read query `agentRuns:payloadByRunIdAgentKey` when `prior_run_id` is set;
  (2) unsaved draft via `draft_prompt` / `draft_user_template`; (3) manual
  variable entry via `variables`; (4) canned fixture via a `SAMPLE_FIXTURES`
  constant in `api/agents.py`.

---

### 3A.2 — `POST /agents/{agent_key}/score`

Phase 28 (PRC-09) adds a voice-rubric scoring endpoint to the FastAPI pipeline.
It scores ONE arbitrary agent output against the live active voice rubric and
returns a per-axis breakdown + an overall headline number + a 1-2 line
rationale. It is the standout authoring-loop guardrail: Andrew sees WHICH voice
axis drifted on a test-run output. **Advisory only — it never gates anything.**

```python
# packages/pipeline/src/eisenbalm_pipeline/api/agents.py

POST /agents/{agent_key}/score
Auth: Depends(_require_operator)   # same Clerk-operator gate as §3A.1 test-run

# Request body (Pydantic ScoreRequest)
{
  "workspace_id": str,
  "agent_key": str,                  # advisory/labeling only — the rubric is global;
                                     #   the path param is canonical, the body is echo
  "output": str,                     # a SINGLE arbitrary agent output (ANY agent, not
                                     #   only the six narrative sections)
}

# Response body (Pydantic ScoreResponse)
{
  "overall": float,                  # headline 0-10
  "axes": [
    { "axis": str, "score": float, "pass": bool, "note": str }  # per-axis breakdown
  ],
  "rationale": str,                  # 1-2 line summary
  "rubric_source": "convex" | "disk",# which rubric the scorer resolved
  "cost_usd": float,
  "tokens_in": int,
  "tokens_out": int,
  "model": str,
  "duration_ms": int,
}
```

**Isolation contract (PRC-09, mirrors §3A.1):**

- Loads the SAME rubric the QA judge uses: the active `rubric` row via
  `promptVersions:getActive` (`{workspace_id, agentKey: "rubric"}`) → on missing
  row or any error, the on-disk `rubric.md` via `judge._load_rubric` (records
  which in `rubric_source`). This mirrors `config_loader._hydrate_asset`'s
  active-row-then-disk resolution.
- A SINGLE `acomplete` call over ONE output — NOT `run_llm_judge`'s six-section
  batch (`sections_json`) shape. The scorer is `judge.score_output`, a standalone
  single-output call.
- Brand-agnostic: scores against whatever the rubric defines; no Eisenbalm-hardcoded
  axes. The per-output-applicable axes are gravity / sentiment / irony-signaling /
  precision (cross-section-consistency and structural-variety are batch-only and
  do not apply to a single output).
- Advisory ONLY — it NEVER gates save/activate (D-06). It writes to NO real run /
  issue table (no `pipelineRuns`, no `deliberationEvents`, no `agent_runs`, no
  Sanity write).
- Cost is read from the EXISTING `acomplete` usage path (`{tokens_in, tokens_out,
  usd, resolved_model}`) — there is **no second cost recorder**.
- Additive: frozen `pipelineRuns` (§4) and `deliberationEvents` are unchanged.

---

## 3B. Dashboard → Pipeline (run control)

Phase 25 (RUN-01..RUN-06) adds four run-control endpoints to the FastAPI pipeline
service. All are authenticated; the operator identity from Clerk is threaded into
every audit row and the `triggeredBy` field on `runs`.

**Status-split invariant (Pitfall 1):** `runs.status = "cancelled"` is the
dashboard-facing record (free `v.string()` — no migration). `pipelineRuns.status`
stays on the frozen union (`running|awaiting-review|complete|failed`); a cancelled
run writes `pipelineRuns.status = "failed"` with `errorMessage = "cancelled by
operator"`. The public site only reads `pipelineRuns`; it never needs to
distinguish `cancelled` from `failed`.

---

### 3B.1 — `POST /pipeline/run`

```python
POST /pipeline/run
Auth: Depends(require_clerk_jwt)   # Clerk JWT → claims["sub"] = triggeredBy

# Request body (Pydantic)
{
  "issueNumber": Optional[int],     # override if omitted: auto-increment
  "narratorSlug": Optional[str],    # optional narrator profile slug
}

# Response body
{ "runId": str }
```

**Behavior (D-12):** One-at-a-time gate — returns `409 "A run is already in
progress"` when `runs:latest` status == `"running"`. Budget start-gate — returns
`409 "Projected cost would exceed monthly cap"` when month-to-date + trailing
average projection exceeds `monthly_cap_usd` (D-06). On pass, runs the same work
as `/run/weekly` with `triggerSource="manual"` and `triggeredBy` set from the
Clerk JWT `sub` claim. Emits an `audit_log` row for `"run.triggered"`.

---

### 3B.2 — `POST /pipeline/tick`

```python
POST /pipeline/tick
Auth: X-Pipeline-Trigger-Secret header   # Railway cron calls this, NOT Clerk

# Response body
{
  "status": "triggered" | "skipped",
  "reason": Optional[str],               # present when status == "skipped"
  "runId": Optional[str],                # present when status == "triggered"
}
```

**Behavior order (D-10, Pitfall 4 — kill switch FIRST):**

1. Read `schedule_enabled` from `pipelineConfig:getAll` — return
   `{"status":"skipped","reason":"schedule_disabled"}` when `false`.
2. `_is_due` check against `schedule_cadence` / `schedule_next_run_at` (UTC) —
   return `{"status":"skipped","reason":"not_due"}` when not due.
3. One-at-a-time gate via `runs:latest` — return
   `{"status":"skipped","reason":"run_in_progress"}` when a run is `"running"`.
4. Budget start-gate projection — return
   `{"status":"skipped","reason":"budget_projection_exceeds_cap"}` when MTD +
   projection > `monthly_cap_usd`.
5. Fire run with `triggerSource="cron"`, advance `schedule_next_run_at` to the
   next occurrence strictly after `now`, return
   `{"status":"triggered","runId":"<uuid>"}`.

**Note:** Do NOT call `/run/weekly` from this handler — that route bypasses the
kill switch. Call the internal `_start_run` logic only after all gates pass
(Pitfall 4.2).

---

### 3B.3 — `POST /runs/{run_id}/cancel`

```python
POST /runs/{run_id}/cancel
Auth: Depends(require_clerk_jwt)

# Response body
{
  "runId": str,
  "status": str,                     # current runs.status
  "alreadyTerminal": Optional[bool], # true when run is not "running"
  "cancelRequested": Optional[bool], # true when flag was set
}
```

**Behavior (D-01/D-02):**

- `404` if `runs:byRunId` returns no row.
- Idempotent no-op `{"runId":..., "status":..., "alreadyTerminal":true}` if the
  run is not in status `"running"` (already terminal or never started).
- When the run IS `"running"`: set the cooperative cancel flag via
  `runs:requestCancel` and return `{"runId":..., "cancelRequested":true}`.
  The `wrap_agent_node` wrapper polls `runs:isCancelRequested` before running each
  node; when set, it raises `RunCancelled` (no-op the node cleanly — no
  started/completed emit). `_execute_run` in `api/runs.py` catches `RunCancelled`
  and writes `runs.status="cancelled"` / `pipelineRuns.status="failed"` +
  `errorMessage="cancelled by operator"`. Emits an `audit_log` row for
  `"run.cancel_requested"`.

---

### 3B.4 — `POST /runs/{run_id}/agents/{agent_key}/rerun`

```python
POST /runs/{run_id}/agents/{agent_key}/rerun
Auth: Depends(require_clerk_jwt)

# Response body
{
  "runId": str,
  "agentKey": str,
  "rerolled": bool,   # always true on success
}
```

**Behavior (D-03/D-04/D-05):**

- `422` if `agent_key` is not in the re-rollable set — the 7 section writers:
  `origin_story`, `problem`, `founder_bio`, `case_study`, `game`, `bonus`,
  `design`. (`design` respects `DESIGNAGENT_SUPPRESSED` automatically because
  `RE_ROLLABLE` derives from `SECTION_WRITERS`.)
- `409 "Run is still executing — re-roll only on a finished/awaiting-review run"` 
  if `runs:byRunId` status == `"running"` (D-04).
- `409 "No checkpoint state for run {run_id}"` if the LangGraph checkpoint has no
  state for the given `run_id`.
- On success: fork the checkpoint (`aget_state` → call bare node fn → 
  `aupdate_state(as_node=agent_key)` → re-call `write_issue_draft(merged_state)`).
  Returns `{"runId":..., "agentKey":..., "rerolled":true}`.

**CRITICAL (Pitfall 2):** Does NOT call `ainvoke(None, config)` after
`aupdate_state`. Running the successor chain (validate_sections → QA →
editor_final → publisher) is NOT automatic — sibling sections are untouched by
construction (`write_issue_draft` createOrReplace's the whole doc from merged
state). Emits an `audit_log` row for `"run.agent_rerolled"`.

---

### 3B.5 — Cancel-flag contract

**Schema addition (additive — no migration):**

```typescript
// convex/schema.ts — runs table addition
cancelRequested: v.optional(v.boolean()), // Phase 25 RUN-04 cooperative cancel flag
```

**New Convex mutations (convex/runs.ts — Plan 03 implements):**

| Mutation | Args | Behavior |
|----------|------|----------|
| `runs:requestCancel` | `{ runId: str }` | Sets `cancelRequested = true` on the row |
| `runs:isCancelRequested` | `{ runId: str }` | Returns `boolean` (false if field absent) |
| `runs:updateStatus` | `{ runId: str, status: str, completedAt?: number, cost?: str, durationMs?: number }` | Patches the row |

**Wrapper polling (lib/agent_wrapper.py):** `wrap_agent_node` calls
`runs:isCancelRequested` BEFORE emitting the `agentRuns:started` event. If set,
raises `RunCancelled(run_id)` — the node never shows as "running" and no work is
done. `_execute_run` in `api/runs.py` catches `RunCancelled` at the top level and
writes terminal status.

**`RunCancelled` exception (lib/errors.py):**

```python
class RunCancelled(Exception):
    """Raised by wrap_agent_node when the cooperative cancel flag is set (RUN-04,
    D-02). The wrapper no-ops the node cleanly (no started/completed emit) and
    raises this; api/runs.py::_execute_run catches it and writes
    runs.status='cancelled' (Pitfall 1: pipelineRuns.status stays 'failed' +
    errorMessage)."""
    def __init__(self, run_id: str) -> None: ...
```

---

### 3B.6 — `pipeline_config` run-control keys (extends §4A.3)

Five new keys added by Phase 25. Values are JSON-encoded strings (same contract
as existing `require_review` / `auto_publish` / `schedule_enabled` keys):

| Key | Default JSON value | Description |
|-----|--------------------|-------------|
| `per_run_cap_usd` | `10.0` | Per-run hard-stop cap (USD). Overrides `PIPELINE_COST_CAP_USD` env var when set. |
| `monthly_cap_usd` | `200.0` | Monthly budget cap (USD). Exceeded at run start → refuse to start (D-06). Exceeded mid-run → alert only, not cancel (D-07). |
| `alert_threshold_pct` | `80` | Percentage of `monthly_cap_usd` at which a `cost-warning` event is emitted (50–100). |
| `schedule_cadence` | `{"dayOfWeek":4,"hourUtc":14,"minuteUtc":0}` | Structured cadence (Thursday 14:00 UTC, matching `cli.py 0 14 * * 4`). Used by `_is_due` to compute the next fire time. |
| `schedule_next_run_at` | `0` | Unix milliseconds (UTC). The tick fires when `now >= schedule_next_run_at`; advanced to the next occurrence strictly after `now` on every fire. `0` means never triggered yet. |

**`schedule_enabled`** is intentionally NOT seeded by the Phase 25 seed script —
it was seeded by Phase 22 with a default of `false`, and automation stays off by
default until the operator explicitly enables it.

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

## 4A. Phase-22 control-plane tables (Mission Control config)

These tables are the dashboard-writable / pipeline-readable control plane added
for the v2.0 Mission Control milestone. They are **NOT** the frozen
deliberation tables (`pipelineRuns`, `deliberationEvents`, `agentVotes`,
`qaCorrections`, `pitchLog`) — those remain untouched. Every row is scoped by
`workspace_id` (the slug string `"eisenbalm"` for the single tenant) and carries
a `by_workspace` index, per the Phase-21 multi-tenant-bones convention.

The pipeline reads these ONCE at run start via `load_run_config()` (Phase 22),
resolves a full per-agent config, and freezes it to `runs.configSnapshot` before
`graph.ainvoke()`. See §7 `DispatchState.config` for the in-memory shape.

### 4A.1 — `agents` (per-agent model + sampling config)

```typescript
agents: defineTable({
  workspace_id: v.string(),           // "eisenbalm"
  agentKey: v.string(),               // canonical key, e.g. "editor_gate1", "bonus_big_budget"
  enabled: v.boolean(),               // Phase 22: stored + snapshotted only (no skip-gating yet — D-08)
  model: v.optional(v.string()),      // overrides llm_config.MODEL_BY_AGENT[agentKey]
  temperature: v.optional(v.number()),// overrides SAMPLING_BY_AGENT[agentKey].temperature
  top_p: v.optional(v.number()),      // Phase 22 ADD — overrides SAMPLING_BY_AGENT[agentKey].top_p
  max_tokens: v.optional(v.number()), // Phase 22 ADD — overrides MAX_TOKENS_BY_AGENT[agentKey]
  description: v.optional(v.string()),// Phase 22 ADD — Phase 23 dashboard display label
})
  .index('by_workspace', ['workspace_id'])
  .index('by_workspace_agentKey', ['workspace_id', 'agentKey']),
```

Seed roster = the full 15-key `llm_config.MODEL_BY_AGENT` set (D-04):
`calibrator, chronicler, editor_gate1, editor_final, qa, researcher,
origin_story, problem, founder_bio, case_study, bonus, game, scout, advocate,
design`. `null`/absent override columns mean "use the in-code default"
(`llm_config.py` remains the fallback source — D-05).

### 4A.2 — `prompt_versions` (versioned system prompts)

```typescript
prompt_versions: defineTable({
  workspace_id: v.string(),
  agentKey: v.string(),               // canonical key (see AGENT_KEY_TO_PROMPT_FILE below)
  version: v.number(),                // v1 at seed; bumped on dashboard edit (Phase 24)
  content: v.string(),                // body between <!-- PROMPT START/END -->, byte-identical to load_prompt()
  isActive: v.boolean(),              // exactly one active row per (workspace_id, agentKey)
  createdAt: v.number(),
  createdBy: v.optional(v.string()),  // Clerk userId
  note: v.optional(v.string()),
})
  .index('by_workspace', ['workspace_id'])
  .index('by_workspace_agentKey', ['workspace_id', 'agentKey'])
  .index('by_workspace_agentKey_version', ['workspace_id', 'agentKey', 'version']),  // Phase 24 ADD — efficient getByVersion
```

Seed = the **11** migrated `.md` prompt files (CFG-02), each as a `version: 1`,
`isActive: true` row whose `content` is **byte-identical** to `load_prompt()`
output (NOT a raw file read — `load_prompt()` strips one leading + one trailing
newline via `_extract()`). The canonical agentKey → prompt-file mapping:

| agentKey | prompt file | llm_config key |
|---|---|---|
| `scout` | `scout` | `scout` |
| `advocate` | `advocate` | `advocate` |
| `editor_gate1` | `editor` | `editor_gate1` |
| `editor_final` | `editor-final` | `editor_final` |
| `calibrator` | `calibrator` | `calibrator` |
| `researcher` | `researcher` | `researcher` |
| `design` | `design` | `design` |
| `game` | `game` | `game` |
| `bonus_big_budget` | `bonus-big-budget` | `bonus` (shared) |
| `bonus_jingle` | `bonus-jingle` | `bonus` (shared) |
| `bonus_spec_ad` | `bonus-spec-ad` | `bonus` (shared) |

`chronicler`, `qa`, `origin_story`, `problem`, `founder_bio`, `case_study` have
no migrated prompt file this phase (Section-writer prompts deferred to Phase 24 —
D-02); their `system_prompt` resolves to `""` in `RunConfig` until then.

#### 4A.2a — Phase 24 versioning mutations

Phase 24 layers four versioning functions onto the existing `prompt_versions`
table (the Phase-22 `upsertActive` / `getActive` remain untouched). These are
the dashboard's write/read surface for prompt editing, diff, activation, and
rollback. All emit to `internal.auditLog.write` (see §4A audit pattern).

```typescript
// convex/promptVersions.ts (Phase 24 additions)

saveVersion(workspace_id: string, agentKey: string, content: string,
            createdBy?: string, note?: string) → Id<'prompt_versions'>
//   Inserts a NEW row with version = max(existing.version)+1 (1 when none exist),
//   isActive: false. NEVER overwrites or mutates a prior version (PRM-03).
//   Emits audit action 'prompt_version.saved'.

activate(workspace_id: string, agentKey: string, version: number,
         actorId: string) → { blocked: boolean, reason?: string }
//   In-progress guard (D-02): if any `runs` row for the workspace has
//   status === 'running', returns { blocked: true, reason: <explanation> }
//   and performs NO isActive flip. Otherwise: deactivates every row for the
//   agentKey, patches the target `version` to isActive: true, emits audit
//   action 'prompt_version.activated', returns { blocked: false }.
//   ROLLBACK == activate(olderVersion) — there is no separate rollback mutation.

listForAgent(workspace_id: string, agentKey: string) → PromptVersion[]
//   All versions for the agentKey, sorted newest-first (descending version).

getByVersion(workspace_id: string, agentKey: string, version: number)
            → PromptVersion | null
//   One exact row (or null). Uses the new by_workspace_agentKey_version index.
```

#### 4A.2b — Phase 24 newly-externalized agentKeys

Phase 24 externalizes additional assets into `prompt_versions` as new rows
(NOT a new table). Each is seeded as a `version: 1`, `isActive: true` row whose
`content` is **byte-identical** to its in-code constant / on-disk source (the
same byte-oracle discipline as the CFG-02 seed). The canonical agentKeys:

| agentKey group | agentKeys | byte-source |
|---|---|---|
| user-template prompts | `scout_user`, `advocate_user`, `calibrator_user`, `editor_gate1_user`, `editor_final_user`, `researcher_user`, `game_user`, `design_user`, `bonus_big_budget_user`, `bonus_jingle_user`, `bonus_spec_ad_user` | the in-code user-message string in each agent's `_build_messages` |
| section guidance | `section_guidance_origin`, `section_guidance_problem`, `founder_bio_verified`, `founder_bio_anonymous`, `case_study_verified`, `case_study_anonymous` | `SECTION_GUIDANCE` / `GUIDANCE_VERIFIED` / `GUIDANCE_ANONYMOUS` constants (the anonymous variants seed the UNFORMATTED constant, still containing the literal `{role}` token) |
| QA rubric | `rubric` | `agents/qa/rubric.md` |
| voice | `voice_constraints` | `lib/voice.py` `VOICE_CONSTRAINTS` (full assembled string) |

`founder_bio` / `case_study` use TWO agentKeys each (`_verified` + `_anonymous`)
rather than one delimited row, so the runtime `founderNameVerified` branch reads
a clean row per path (D-06 Option A). The `voice_constraints` row stores the FULL
assembled `VOICE_CONSTRAINTS` string, not just `JESSE_PERSONA_BLOCK`; it is
hydrated into `RunConfig.voice_constraints` at run start (see §7).

### 4A.3 — `pipeline_config` (global key/value settings)

```typescript
pipeline_config: defineTable({
  workspace_id: v.string(),
  key: v.string(),                    // "require_review" | "auto_publish" | "schedule_enabled" | ...
  value: v.string(),                  // JSON-encoded value
  updatedAt: v.number(),
  updatedBy: v.optional(v.string()),  // Clerk userId
})
  .index('by_workspace', ['workspace_id'])
  .index('by_workspace_key', ['workspace_id', 'key']),
```

Phase 22 reads three keys at run start: `require_review` (default `true`),
`auto_publish` (default `false`), `schedule_enabled` (default `false`).

### 4A.4 — `runs.configSnapshot`

The `runs` table (Phase-21 stub) carries `configSnapshot: v.optional(v.string())`.
Phase 22 populates it with a **JSON string of the full resolved `RunConfig`**
(post-fallback per-agent `{model, temperature, top_p, max_tokens, enabled,
system_prompt}` + pipeline-level `{require_review, auto_publish,
schedule_enabled}`). The snapshot write is the FIRST awaited op after
`runs`/`pipelineRuns:create` and **BEFORE** `graph.ainvoke()` (D-10) so a
mid-run dashboard edit cannot alter an in-flight run. The resume path does NOT
re-snapshot — the original snapshot stays authoritative.

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

**Request body:**

`POST /api/checkout/create-session` accepts an optional JSON body `{ quantity?: number }`. The route validates it as an integer 1–20 and defaults to 1 on missing/invalid/out-of-range input. Stripe `line_items[0].quantity` is set to the validated value.

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
    body: list[dict]   # Phase 18: discriminated-union BodyBlock; Pydantic at writer enforces; TypedDict can't express the union

class CaseStudyContent(TypedDict):
    subjectName: str
    headline: str
    body: list[dict]   # Phase 18: discriminated-union BodyBlock; Pydantic at writer enforces; TypedDict can't express the union

class GameContent(TypedDict):
    headline: str
    description: str
    embedCode: str                      # self-contained HTML/JS for iframe srcdoc

class BonusContent(TypedDict):
    headline: str
    body: list[dict]   # Phase 18: discriminated-union BodyBlock; Pydantic at writer enforces; TypedDict can't express the union
    lyrics: Optional[str]               # jingle only
    sunoPrompt: Optional[str]           # jingle only
```

## Phase 18: BodyBlock discriminated union

`SectionContent.body`, `CaseStudyContent.body`, and `BonusContent.body` (when
`style_brief["bonusType"] == "specAd"`) are typed `list[dict]` at the TypedDict layer
because Python's `TypedDict` cannot express a discriminated union. The actual write-time
shape is enforced by each writer agent's Pydantic response model via:

```python
from typing import Annotated, Literal, Union
from pydantic import BaseModel, Field

class Paragraph(BaseModel):
    type: Literal['paragraph'] = 'paragraph'
    text: str

class Heading(BaseModel):
    type: Literal['h2', 'h3']      # writer picks per local hierarchy
    text: str

class Blockquote(BaseModel):
    type: Literal['blockquote'] = 'blockquote'
    text: str

BodyBlock = Annotated[
    Union[Paragraph, Heading, Blockquote],
    Field(discriminator='type'),
]
```

The shared `BodyBlock` declaration lives in `packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py`
(created in Plan 18-03) and is imported by all five long-read writer Pydantic models
(`OriginStoryOutput`, `ProblemOutput`, `FounderBioOutput`, `CaseStudyOutput`, `SpecAdBonus`).

A `@field_validator('body')` named `_enforce_structural_floor` runs on each writer's response
and raises `ValueError` if `count(type in ('h2','h3')) < 2` OR `count(type == 'blockquote') < 1`.
The existing Phase 5 `acomplete` retry-once-then-fail path (`lib/openrouter_client.py` lines
169-179) handles structural-validation retries automatically — no new mechanism.

`BigBudgetBonus.body` and `JingleBonus.body` remain `str` (CONTEXT D-04 — those branches'
structured payloads `storyboards[]` / `lyrics + sunoPrompt` already provide visual variety).

`ProblemOutput.pdfContent` is UNCHANGED (CONTEXT D-03 — Phase 6 WeasyPrint contract preserved).

```python
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


# ── Phase 22: RunConfig (control-plane config snapshot) ───────────────────────
#
# The in-memory config object loaded ONCE at run start by
# `lib/config_loader.load_run_config()`. It is a `@dataclass` (NOT a TypedDict)
# so it serializes cleanly via `dataclasses.asdict()` + `json.dumps()` for the
# `runs.configSnapshot` write (§4A.4). It captures the RESOLVED (post-fallback)
# per-agent config — the exact prompts + model params that produced the issue.
# See §4A for the Convex tables it is hydrated from.

@dataclass
class AgentConfig:
    model: str                          # resolved model id (Convex override OR llm_config default)
    temperature: float
    top_p: float
    max_tokens: Optional[int]
    enabled: bool                       # Phase 22: snapshotted only — no skip-gating yet (D-08)
    system_prompt: str                  # resolved prompt body (Convex active row OR load_prompt() fallback); "" for un-migrated agents

@dataclass
class RunConfig:
    workspace_id: str                   # "eisenbalm"
    agents: dict[str, AgentConfig]      # keyed by canonical agentKey (all 15 llm_config keys)
    require_review: bool                # pipeline_config; default True
    auto_publish: bool                  # pipeline_config; default False
    schedule_enabled: bool              # pipeline_config; default False
    voice_constraints: Optional[str] = None  # Phase 24 PRM-06 ADD — None → use code-constant VOICE_CONSTRAINTS; hydrated from the active `voice_constraints` prompt_versions row at run start and threaded into assemble_voice(..., db_voice_override=voice_constraints). assemble_voice(None) without an override stays byte-identical to VOICE_CONSTRAINTS (import-time sentinel + test_voice.py invariants preserved).
    user_templates: dict[str, str] = {}      # Phase 24 PRM-01 ADD (Plan 03) — per-agent user-message templates keyed by the USER_TEMPLATE_KEYS agentKeys (scout_user … bonus_spec_ad_user). Each entry hydrated at run start from the active prompt_versions row for the matching agentKey; disk/code fallback per CFG-03. Empty between Wave 2 and Wave 3 until Plan 04 seeds the .md files.
    section_guidance: dict[str, str] = {}    # Phase 24 PRM-01 ADD (Plan 03) — section-guidance blocks keyed by the SECTION_GUIDANCE_KEYS agentKeys (section_guidance_origin/_problem + founder_bio/case_study _verified/_anonymous). Each entry hydrated at run start from the active prompt_versions row for the matching agentKey; disk/code fallback per CFG-03. Empty until Plan 05 seeds the .md files.
    rubric: Optional[str] = None             # Phase 24 PRM-01 ADD (Plan 03) — QA rubric. Hydrated at run start from the active `rubric` prompt_versions row; disk/code fallback per CFG-03 (agents/qa/rubric.md byte-source). None until Plan 05 seeds the row/file.


class DispatchState(TypedDict):
    # ── Identity ──────────────────────────────────────────────────────────────
    run_id: str                         # UUID, set at pipeline start
    issue_number: int
    publish_date: str                   # ISO 8601 date, e.g. "2026-05-14"
    pipeline_started_at: str            # ISO 8601 datetime

    # ── Phase 22: control-plane config (loaded once at run start) ─────────────
    # Loaded by `load_run_config()` in the HTTP handler and threaded into the
    # initial state BEFORE `graph.ainvoke()`. IMMUTABLE after run start — the
    # snapshot (§4A.4) commits before any agent runs. Consumed by all 11
    # `load_prompt` call sites: each agent reads
    # `state["config"].agents[<key>].system_prompt` instead of `load_prompt(...)`.
    # Carries per-agent `{model, temperature, top_p, max_tokens, enabled,
    # system_prompt}` plus pipeline-level `{require_review, auto_publish,
    # schedule_enabled}`. `NotRequired`/`Optional` for backward-compat with
    # pre-Phase-22 tests that construct DispatchState without it.
    config: NotRequired[Optional[RunConfig]]

    # ── Phase 1: Selection ────────────────────────────────────────────────────
    style_brief: Optional[StyleBrief]
    candidates: Optional[list[CharityCandidate]]
    winning_charity: Optional[CharityCandidate]
    winning_charity_sanity_id: Optional[str]    # set after Sanity write
    deliberation_transcript: Optional[str]      # full Scout+Advocate+Editor text
    deliberation_conversation: Optional[list[dict]]   # Phase 13 (DEL-CONV): Chronicler dialogue turns — [{"speaker": "scout|advocate|editor", "text": "plain prose, no Markdown"}]; written by the chronicler node; flattened into deliberation_transcript for the podcast/NotebookLM export

    # ── Phase 16: Narrator (editorial-only, loaded from Sanity at pipeline start) ──
    narrator: Optional[dict]                # Loaded narratorProfile dict {name, slug, voiceConstraints, voiceRubric, exampleSamples, active} or None — VERBATIM from docs/API_CONTRACTS.md §7 (Phase 16 addition). Set unset = default Jesse voice. The Calibrator is the single agent that reads this (CONTEXT D-05); all downstream agents consume style_brief["voice"] which Calibrator assembles via lib/voice.assemble_voice(narrator).

    editor_decision: Optional[str]              # why this charity won
    runner_up_notes: Optional[str]
    editor_confidence: Optional[float]          # Phase 37 §37.2 — EditorDecision.confidence, persisted (was computed then discarded)

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

---

## Phase 26 — Review Gate + Charity Registry

**Phase 26 additive — frozen pipelineRuns/deliberationEvents shapes unchanged.**

All new fields are additive only. No existing field is renamed or removed.
Amend this section before consuming any new endpoint, table field, mutation, or query.

---

### §26.1 — charities table additive fields

The existing stub table at `convex/schema.ts` has 5 fields (workspace_id, name, status,
timesFeatured, lastFeaturedAt) and 1 index (by_workspace). Phase 26 adds:

```typescript
// additive fields (after lastFeaturedAt):
dedupKey: v.optional(v.string()),        // case-folded "{name.trim().toLowerCase()}|{domain}" — pipe separator
website: v.optional(v.string()),          // raw website URL for display + domain extraction
domain: v.optional(v.string()),           // bare domain, case-folded (pre-computed via _domain_of)
sanityCharityId: v.optional(v.string()),  // Sanity charity slug/_id cross-reference
firstSeenRunId: v.optional(v.string()),   // runId that first logged this entry as a candidate

// additive indexes (after by_workspace):
.index('by_workspace_dedupKey', ['workspace_id', 'dedupKey'])  // dedup lookup
.index('by_workspace_status', ['workspace_id', 'status'])       // Scout filter
```

**Status enum** (unchanged): `"candidate"` | `"featured"` | `"blocklisted"`

**Dedup key construction:** `dedupKey = f"{name.strip().lower()}|{domain}"` where
`domain = _domain_of(website)`. Matches the existing `scout.py:104-110` `_candidate_keys()` logic.
The `|` separator makes the two components clearly distinct.

---

### §26.2 — claim_checks table (NEW)

```typescript
claim_checks: defineTable({
  workspace_id: v.string(),
  runId: v.string(),
  claimIndex: v.number(),       // stable ordinal position from extraction
  text: v.string(),             // extracted claim text
  claimType: v.string(),        // "number" | "date" | "proper_noun"
  context: v.string(),          // 60-char surrounding window for review
  status: v.string(),           // "pending" | "checked" | "skipped"
})
  .index('by_runId', ['runId'])
  .index('by_workspace', ['workspace_id'])
```

**Status enum:** `"pending"` (initial) | `"checked"` (operator verified) | `"skipped"` (operator dismissed)

**Approve gate:** The FastAPI publish endpoint and the dashboard approve button both require
`claimChecks:allSignedOff(runId)` → true before proceeding. Empty list = false (conservative:
if extraction hasn't run yet, do not enable approve).

---

### §26.3 — runs table additive field

```typescript
// additive field (after cancelRequested):
scheduledPublishAt: v.optional(v.number()), // Unix ms — D-02: approve-and-schedule target time
```

**Query:** `runs:dueForPublish({workspace_id, nowMs})` — returns runs where
`status === "awaiting-review"` AND `scheduledPublishAt !== undefined` AND `scheduledPublishAt <= nowMs`.
Called by the Phase 25 `/pipeline/tick` sweep to fire scheduled publishes.

---

### §26.4 — pipelineRuns table additive field

```typescript
// additive field (after awaitingHumanAt):
sanityIssueId: v.optional(v.string()), // Phase 26 — Sanity weeklyIssue _id; written by publisher so publish endpoint can resolve the Sanity issue from a runId
```

Used by `POST /issues/{run_id}/publish` to resolve the Sanity issue document from a runId
without requiring the caller to know the Sanity ID.

---

### §26.5 — review_actions action enum (canonical vocabulary)

The `action` field in `review_actions` MUST use exactly these strings (Pitfall 7):

| Value | When written |
|-------|-------------|
| `"approved_and_published"` | Operator approved + issue published immediately |
| `"approved_and_scheduled"` | Operator approved + scheduled for later publish |
| `"rejected"` | Operator rejected the run |
| `"section_rerolled"` | Operator re-rolled a section from the review screen |
| `"auto_publish_enabled"` | Operator enabled auto_publish |
| `"auto_publish_disabled"` | Operator disabled auto_publish |
| `"charity_blocklisted"` | Operator blocklisted a charity from the registry |
| `"charity_status_changed"` | Operator changed charity status (other changes) |

`review_actions` is the per-run decision trail. `audit_log` is the workspace-level trail.
Both should be written for approve/reject/schedule decisions; `audit_log` alone is sufficient
for registry mutations (setStatus).

---

### §26.6 — Convex function signatures

All new functions — one-line signatures. Thread `workspace_id` on every row.

**convex/charities.ts:**

```typescript
// Mutations
upsertCandidate({ workspace_id, name, website, runId }): Promise<void>
  // Guard: never downgrade featured|blocklisted → candidate (Pitfall 3)
  // Computes dedupKey = name.trim().toLowerCase() + "|" + bareDomain(website)
  // Looks up by_workspace_dedupKey; if existing.status in ["featured","blocklisted"] → return without change
  // If existing candidate → patch website/domain only
  // If none → insert {workspace_id, name, status:"candidate", website, domain, dedupKey, firstSeenRunId: runId, timesFeatured:0}

upsertFeatured({ workspace_id, name, website, sanityCharityId }): Promise<void>
  // Finds via by_workspace_dedupKey; if exists → patch status:"featured", timesFeatured+1, lastFeaturedAt, sanityCharityId
  // If not → insert with status:"featured", timesFeatured:1, lastFeaturedAt: Date.now()

setStatus({ workspace_id, charityId: Id<'charities'>, status }): Promise<void>
  // Validates status in ["candidate","featured","blocklisted"]; throws on invalid

seedFromPublished({ workspace_id, rows: Array<{name, website?, sanityCharityId?}> }): Promise<void>
  // Idempotent backfill — calls upsertFeatured logic for each row

// Queries
listByWorkspace({ workspace_id, status?: string }): Promise<Doc<'charities'>[]>
  // Uses by_workspace index; filters by status when provided; sorted by name

listForDedup({ workspace_id }): Promise<Array<{dedupKey,name,domain,status}>>
  // Returns only featured + blocklisted rows (Scout dedup set); projects minimal shape

getByDedupKey({ workspace_id, dedupKey }): Promise<Doc<'charities'> | null>
  // Uses by_workspace_dedupKey index; returns first() or null
```

**convex/claimChecks.ts:**

```typescript
insertBatch({ workspace_id, runId, claims: Array<{claimIndex,text,claimType,context}> }): Promise<void>
  // Idempotent: first deletes existing claim_checks for runId, then inserts each with status:"pending"

setStatus({ runId, claimIndex, status }): Promise<void>
  // Finds via by_runId matching claimIndex; validates status in ["pending","checked","skipped"]

listByRunId({ runId }): Promise<Doc<'claim_checks'>[]>
  // Uses by_runId index; sorted by claimIndex asc

allSignedOff({ runId }): Promise<{total: number, signedOff: number, allSignedOff: boolean}>
  // allSignedOff = total > 0 && every row status != "pending"
  // Empty list → {total:0, signedOff:0, allSignedOff:false} (conservative — prevents race at dashboard load)
```

**convex/reviewActions.ts:**

```typescript
record({ workspace_id, runId, actorId, action, note?: string }): Promise<void>
  // Inserts into review_actions with timestamp: Date.now()
  // Canonical action values: see §26.5

listByRunId({ runId }): Promise<Doc<'review_actions'>[]>
  // Uses by_runId index; sorted by timestamp desc
```

**convex/runs.ts additions:**

```typescript
setScheduledPublish({ runId, scheduledPublishAt?: number }): Promise<void>
  // Finds via by_runId; patches scheduledPublishAt field (undefined to clear)

dueForPublish({ workspace_id, nowMs }): Promise<Doc<'runs'>[]>
  // Uses by_workspace index; filters status === "awaiting-review" && scheduledPublishAt !== undefined && scheduledPublishAt <= nowMs
```

**convex/pipelineRuns.ts additions:**

```typescript
// Extend existing updateStatus — add optional sanityIssueId arg:
updateStatus({ runId, status, completedAt?, errorMessage?, durationMs?, cost?, awaitingHumanAt?, sanityIssueId? }): Promise<void>
  // Same behavior as existing; patches sanityIssueId when provided
  // Callers that don't pass sanityIssueId are unaffected (backward-compatible)
```

**convex/pipelineConfig.ts additions:**

```typescript
setAutoPublish({ workspace_id, enabled: boolean, actorId: string }): Promise<void>
  // 1. Read auto_publish_enabled_at config key
  // 2. If enabled === true AND prior enabled timestamp exists within 24h → throw new Error("rate_limited")
  // 3. Upsert auto_publish = JSON.stringify(enabled)
  // 4. If enabling: upsert auto_publish_enabled_at = JSON.stringify(Date.now())
  // 5. If enabling: insert deliberationEvents row with eventType:"auto-publish-enabled" (Phase 27 NTF hook)
  // 6. Call auditLog:write with action: enabled ? "auto_publish_enabled" : "auto_publish_disabled"
  // Rate-limit window: 24 hours after last enable (re-disable is immediate; re-enable requires 24h cooldown)
```

---

### §26.7 — FastAPI endpoints (review gate)

These endpoints live in `packages/pipeline/src/eisenbalm_pipeline/api/review.py`
(or extend `api/control.py`). Auth guard: `Depends(require_clerk_jwt)`.

#### `POST /issues/{run_id}/publish`

```
Auth:    Depends(require_clerk_jwt)
Path:    run_id — the pipeline run UUID (NOT the Sanity _id)
Guards:
  - Resolve pipelineRuns.sanityIssueId via pipelineRuns:byRunId (run_id)
  - Check run.status == "awaiting-review" (409 if not)
  - Check claimChecks:allSignedOff(run_id) → allSignedOff == true (409 {"reason":"claims_not_signed_off"} if not)
  - If pipelineRuns.status == "complete" already → 200 {"alreadyPublished":true} (idempotency guard)
Action:
  - Patch Sanity weeklyIssue.status = "published" (Sanity Python client)
  - Write review_actions row: action="approved_and_published"
  - Write audit_log row: action="run.approved_and_published", resourceType="run", resourceId=run_id
Response: {"issueId": str, "published": true}
Note:    Does NOT call _run_publisher directly — Sanity webhook fires _run_publisher (D-01)
```

#### `POST /issues/{run_id}/schedule`

```
Auth:    Depends(require_clerk_jwt)
Body:    {"scheduledAt": int}  # Unix ms
Guards:
  - run.status == "awaiting-review" (409 if not)
  - claimChecks:allSignedOff(run_id) → allSignedOff == true (409 {"reason":"claims_not_signed_off"} if not)
  - scheduledAt > now (422 if in the past)
Action:
  - Write runs.scheduledPublishAt via runs:setScheduledPublish
  - Write review_actions row: action="approved_and_scheduled"
  - Write audit_log row: action="run.approved_and_scheduled"
Response: {"issueId": str, "scheduledAt": int}
Note:    The Phase 25 /pipeline/tick sweep checks runs:dueForPublish and fires publish for due runs
```

#### `POST /issues/{run_id}/reject`

```
Auth:    Depends(require_clerk_jwt)
Body:    {"note": Optional[str]}
Guards:  None (reject is always allowed while awaiting-review)
Action:
  - Write review_actions row: action="rejected", note=body.note
  - Write audit_log row: action="run.rejected"
  - runs.status unchanged (the run stays in awaiting-review for reference)
Response: {"issueId": str, "rejected": true}
```

---

### §26.8 — apps/web draft-preview route

**Route:** `GET /issue/[slug]/preview` (file: `apps/web/app/issue/[slug]/preview/page.tsx`)

**Token auth:**
```
HMAC-SHA256(PREVIEW_SECRET, runId + ":" + slug + ":" + floor(now/300000))
```
5-minute TOTP-style sliding window. `dispatch-control` generates the token server-side.
Preview URL: `https://<web-domain>/issue/<slug>/preview?token=<hmac>&runId=<runId>`

**Server-side GROQ query (no status filter — differs from published page):**
```groq
*[_type == "weeklyIssue" && slug.current == $slug][0]{ ...same projections as QUERY_ISSUE_BY_SLUG... }
```
Note: MUST omit `&& status == "published"` filter or drafts return null (Pitfall 1).

**Sanity client:** Server-only instance with `perspective: 'previewDrafts'` and
`token: process.env.SANITY_API_TOKEN` (read-only token). MUST NOT be exported to client components.

**CSP header (per-route only — does not affect public pages):**
```typescript
// next.config.ts headers() — additive, scoped to preview route
{
  source: '/issue/:slug/preview',
  headers: [
    { key: 'Content-Security-Policy',
      value: "frame-ancestors 'self' ${PREVIEW_ALLOWED_ORIGIN}" },
    { key: 'X-Frame-Options', value: 'ALLOWALL' },
  ],
}
```
`PREVIEW_ALLOWED_ORIGIN` env var — production dispatch-control domain. For local dev:
include `http://localhost:3001` as a comma-separated value.

**frame-ancestors** is a per-route override — public issue pages at `/issue/[slug]`
do NOT get this header (they remain unembeddable by default). (Pitfall 2)

---

*All Phase 26 changes are additive. Frozen shapes: pipelineRuns (except sanityIssueId addition),
deliberationEvents, agentVotes, qaCorrections, pitchLog — unchanged.*

---

## 27. Money + Notifications (Phase 27)

Two operator-facing capabilities, both observe-first (no new money movement):
financial reconciliation (RCN-01/02) and operational notifications (NTF-01/02).
This section is the **contract-first** source of truth (CLAUDE.md D-14) — all
Wave 1+ schema and code implement against these shapes. **All Phase 27 schema
changes are additive.**

---

### §27.1 — Finance queries (RCN-01)

**Convex query `finance:perIssueRevenue`** — returns one row per published issue,
computed from **actual recorded `stripeOrders` rows** (NEVER from `model_pricing`
estimates — `model_pricing` is projection-only, see §27 close).

Return shape (per issue):

```typescript
{
  issueNumber: number,
  issueId: string,              // Sanity weeklyIssue _id
  charitySlug: string,
  charityName: string,
  windowStart: number,          // issue.publishedAt (Unix ms)
  windowEnd: number | null,     // next issue's publishedAt; null for the latest/open issue
  orderCount: number,
  grossCents: number,           // sum(stripeOrders.amountTotal)
  feeCents: number | null,      // sum(stripeOrders.stripeFee); null until fees fetched
  netCents: number,             // sum(stripeOrders.donationAmount) (== amountSubtotal, 100%-to-charity)
}
```

Aggregation rules:
- `grossCents` = sum of `stripeOrders.amountTotal` (gross charged, cents).
- `netCents` = sum of `stripeOrders.donationAmount` (== `amountSubtotal`, the
  100%-to-charity figure).
- `feeCents` = sum of the cached `stripeOrders.stripeFee` (cents); `null` while
  any contributing order's fee is unfetched.
- Reconciliation is computed **from actuals, NEVER from `model_pricing`** (D-08).
  `model_pricing` is a cost projection only and is rendered read-only (D-13, §27 close).

**Sales-window attribution (D-10):** an order attributes to the issue whose window
is `[issue.publishedAt, nextIssue.publishedAt)`, matched by `charitySlug`. Issues are
ordered by `publishedAt`; each issue's window upper bound is the next issue's
`publishedAt`. The **latest** issue's window is open: upper bound =
`nextIssuePublishedAt ?? Date.now()`.

**Unattributed orders fallback:** orders whose `(charitySlug, createdAt)` does not
fall within any issue window (e.g. pre-launch or between-issue orders) are collected
into an **"Unattributed orders"** bucket surfaced separately in the finance view.

---

### §27.2 — Stripe fee reconciliation (RCN-01, D-08)

Stripe fees are fetched server-side via the **sessionId path** — the `paymentIntentId`
field does **NOT** exist in `stripeOrders`, so fees are resolved from the session:

```typescript
const session = await stripe.checkout.sessions.retrieve(sessionId, {
  expand: ['payment_intent.latest_charge.balance_transaction'],
})
const feeCents = (session.payment_intent as Stripe.PaymentIntent)
  .latest_charge.balance_transaction.fee   // cents
```

- Stripe API version pin: `'2025-04-30.basil'`.
- Fee value (cents) comes from `balance_transaction.fee`.

**Additive cache field (frozen-shape exception):**

```typescript
stripeOrders.stripeFee: v.optional(v.number())   // cached Stripe fee in cents
```

Written **once per order** by a Convex `internalAction` (only `internalAction` may
make external HTTP calls); subsequent reads skip the Stripe API and read the cache.

**`STRIPE_SECRET_KEY` must be present in the Convex deployment environment** (the
finance `internalAction` reads `process.env.STRIPE_SECRET_KEY` from Convex's node
runtime — the `apps/web` Next.js env is separate and does NOT cover Convex). There is
no fallback; the fee fetch fails silently without it.

---

### §27.3 — `payouts` table + mutations (RCN-02, D-11/D-12)

**Additive `payouts` table:**

```typescript
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
  .index('by_workspace_status', ['workspace_id', 'status'])
```

**Mutation `payouts:markPayoutSent({ payoutId, reference, sentAt })`:**
- Clerk-JWT-guarded: `ctx.auth.getUserIdentity()` (reject if null).
- Sets `status: 'sent'`, `sentAt`, `reference`, `actor`, `updatedAt`.
- Audit-logged via `internal.auditLog.write` with `action: 'payout:markSent'` and
  `before`/`after` JSON of the payout row (D-12, AUD-01).

**Query `payouts:listByWorkspace`** — returns all payout rows for the workspace,
for the finance dashboard's at-a-glance payout-status view across all issues.

---

### §27.4 — `notificationsLedger` table + config keys (NTF-01/02, D-06/D-07)

**Additive `notificationsLedger` table** (mirrors the `emailSends` idempotency pattern):

```typescript
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
  .index('by_workspace_createdAt', ['workspace_id', 'createdAt'])
```

**Idempotency key (D-07):** `(runId|eventKey, eventType, channel)` — each event sends
at most once per channel. Re-fires / retries are safe. Mirror the `emailSends`
two-step pattern: `insertScheduled` (status `queued`) → `markSent` / `markFailed` /
`markSkipped`. A second dispatch decision for an existing `sent` ledger row is a no-op.

**`pipeline_config` keys (D-06):**
- `notify_email` — recipient email address.
- `notify_slack_webhook_url` — Slack incoming-webhook URL (secret).
- `notify_on_complete` — enable flag for run-complete notifications.
- `notify_on_failed` — enable flag for run-failed notifications.
- `notify_on_awaiting_review` — enable flag for awaiting-review notifications.
- `notify_on_budget` — enable flag for budget-threshold notifications.

Both channels are independently toggleable (Slack and/or email — either, both, or
neither; D-03).

---

### §27.5 — Notification dispatch seams (NTF-01/02, D-01/D-04/D-05)

Notifications originate **Convex-side** — no new outbound HTTP egress is added to the
Python pipeline (D-01). External sends run in an `internalAction`, dispatched via
`scheduler.runAfter(0, …)` so the triggering mutation stays non-blocking and a
transport failure never wedges a run's status write (D-05).

- **complete / failed / awaiting-review** dispatch from `pipelineRuns:updateStatus`:
  ```typescript
  scheduler.runAfter(0, internal.notificationActions.sendNotification, {
    runId, eventType: status,   // status ∈ 'complete' | 'failed' | 'awaiting-review'
  })
  ```
- **budget** dispatch from the `deliberationEvents:insert` mutation when
  `eventType === 'cost-warning'` → dispatch with `eventType: 'budget'`.

The `deliberationEvents.eventType` union stays **FROZEN** (reuse the existing
`cost-warning` literal — do NOT add new literals; D-04).

---

### §27.6 — Slack provider shape (NTF-01, D-02)

Reuse the Phase 20 `SendEmailProvider` seam (`packages/emails`). Add a Slack
incoming-webhook provider behind the same selection seam — do NOT fork a second
send path. No new npm package (native `fetch`).

```typescript
// packages/emails/src/slackProvider.ts
class SlackWebhookProvider implements SendEmailProvider {
  constructor(private webhookUrl: string) {}
  async send(params: SendEmailParams): Promise<{ id: string }> {
    const res = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: params.subject + '\n' + stripHtml(params.html) }),
    })
    if (!res.ok) throw new Error(`slack webhook failed: ${res.status}`)
    return { id: `slack-${Date.now()}` }
  }
}

export function selectSlackProvider(webhookUrl: string): SendEmailProvider
```

---

*All Phase 27 changes are additive. Frozen shapes: `stripeOrders` (except the additive
`stripeFee` field), `model_pricing`, `emailSends`, and the `deliberationEvents.eventType`
union — unchanged.*

---

## Phase 31 — Content-Patch Endpoints + Full Editing

Content-patch endpoint family (EDT-01/EDT-02/EDT-03/EDT-05) that lets the operator edit
a run's Sanity content directly from dispatch-control — per-section prose, structured
fields (headlines, theme, game, PDF data points, bonus variants, deliberation
conversation, podcast transcript), and binary asset uploads (podcast audio, Suno audio,
storyboards) — with an optimistic-concurrency revision guard on every write. This
contract is written BEFORE any endpoint or UI code exists (CLAUDE.md contract-first
hard rule).

### §31.1 — Target document identity (load-bearing correction)

Every endpoint resolves `run_id → sanityIssueId` via `pipelineRuns:byRunId` (identical
resolution to `api/review.py`), and every Sanity patch targets the PLAIN Sanity `_id`
`issue-{n}`. **This app does NOT use Sanity's drafts/publish system — there is no
`drafts.` prefix anywhere in this codebase.** Endpoints must never target
`drafts.issue-{n}`. There is exactly one live document per issue; edits mutate it
directly, guarded by `ifRevisionID` (§31.4).

### §31.2 — Endpoint family

All routes are Clerk-JWT-guarded via `_require_clerk_jwt_control` (the same dev-mode-safe
dependency used by `api/control.py` / `api/review.py`), mounted in a new
`packages/pipeline/src/eisenbalm_pipeline/api/content.py`:

```
PATCH /issues/{run_id}/sections/{section_name}   # EDT-01 prose body — section_name in: originStory, problemStatement, founderBio, caseStudy
PATCH /issues/{run_id}/headlines/{section_name}  # EDT-02 headline string
PATCH /issues/{run_id}/theme                     # EDT-02 theme (hex+font HARD-validated)
PATCH /issues/{run_id}/game                      # EDT-02 game.headline/description/embedCode (embed size cap)
PATCH /issues/{run_id}/pdf-data-points            # EDT-02 problemStatement.pdfContent.{problemStatement,keyDataPoints[3],interventionMechanism}
PATCH /issues/{run_id}/bonus                     # EDT-01/02 variant-shaped: specAd→body / bigBudget→storyboards / jingle→lyrics+sunoPrompt
PATCH /issues/{run_id}/deliberation-conversation # EDT-01 selectionDeliberation.conversation[] turn list ({speaker,text})
PATCH /issues/{run_id}/podcast-transcript        # EDT-01 podcast.deliberationTranscript textarea
POST  /issues/{run_id}/assets/{slot}             # EDT-03 raw-binary upload; slot in: podcast-audio, suno-audio, storyboard-{i}
GET   /issues/{run_id}/draft                     # read path for the editor
```

### §31.3 — Request body shape

Every PATCH body includes `ifRevisionID: string` (required) plus a payload specific to
the route.

Section-body payload (prose sections):
```json
{ "ifRevisionID": "string", "blocks": [{ "type": "paragraph|h2|h3|blockquote", "text": "string" }] }
```

Bonus payload (variant-shaped, `PATCH /issues/{run_id}/bonus`):
```json
{
  "ifRevisionID": "string",
  "variant": "specAd|bigBudget|jingle",
  "blocks": [{ "type": "paragraph|h2|h3|blockquote", "text": "string" }],
  "headline": "string",
  "body": "string",
  "lyrics": "string",
  "sunoPrompt": "string"
}
```
`variant` is REQUIRED — every caller must send it (it discriminates the write and guards
against a mismatched stored `bonusType`). `blocks` (specAd rows), `headline`, `body`
(bigBudget/jingle prose string), `lyrics`, and `sunoPrompt` are ALL optional: the endpoint
patches ONLY the fields present in the request body — an omitted field is left untouched
in Sanity. A `specAd` caller sends rows under `blocks`, never under `body` (`body` on the
server is the bigBudget/jingle prose string, a different field).

Theme payload:
```json
{
  "ifRevisionID": "string",
  "primaryColor": "#RRGGBB", "accentColor": "#RRGGBB",
  "backgroundColor": "#RRGGBB", "textColor": "#RRGGBB",
  "fontDisplay": "string", "fontBody": "string",
  "visualDirection": "string"
}
```

### §31.4 — Revision guard

`ifRevisionID` is a TOP-LEVEL key of the Sanity patch object (a sibling of `id` / `set`
in the patch mutation, NOT nested under `options`). A revision mismatch causes Sanity to
return HTTP 409; the endpoint re-raises as a FastAPI
`HTTPException(409, detail={"reason": "revision_mismatch", "message": "This section
changed since you loaded it. Reload and reapply your edit."})`.

### §31.5 — Validation split (D-08)

**HARD-block** (return 4xx `{"reason": "validation_failed", "message": "...", "fields": [...]}`):
- Theme hex fields must match `^#[0-9a-fA-F]{6}$`.
- Theme font fields must be members of the canonical 9-font whitelist — this list
  MIRRORS `apps/web/lib/theme.ts` `FONT_WHITELIST` (the render-time gate, since that is
  what actually breaks if violated): `Playfair Display`, `Lora`, `Inter`,
  `Cormorant Garamond`, `Merriweather`, `DM Serif Display`, `Fraunces`, `Newsreader`,
  `IBM Plex Mono`.
- Game embed code must be `<= 50000` bytes (50KB) UTF-8 encoded.

**WARN-only** (return 200 with `"warnings": ["..."]`, never blocks the save): the
editorial structural floor (>=2 sub-headers `h2`/`h3` + >=1 `blockquote`) on the 5
long-read sections (origin story, problem statement, founder bio, case study, spec-ad
bonus). This is a WARN-only counter for operator edits — distinct from the raise-based
Pydantic `_enforce_structural_floor` validator used at agent-generation time.

### §31.6 — Asset upload

`POST /issues/{run_id}/assets/{slot}` accepts a **raw binary body** (NOT multipart —
`python-multipart` is not an installed dependency). Inbound headers: `X-Filename`,
`Content-Type` (the asset MIME type).

Flow:
1. POST the raw bytes to the Sanity assets endpoint (`/assets/files/{dataset}` or
   `/assets/images/{dataset}` depending on asset kind) → receive
   `{"document": {"_id": ..., "url": ...}}`.
2. Scoped `patch()` the reference onto the slot field:
   `{"_type": "file"|"image", "asset": {"_type": "reference", "_ref": assetId}}`.
3. Response: `{"assetUrl": str, "assetId": str, "revisionId": str}` — `assetUrl` is the
   Sanity CDN URL, used for inline preview (D-13).

D-12: overwriting a slot leaves the prior asset document in Sanity (no delete) and
records the swap in the audit row (before/after asset IDs).

**EXCEPTION — `suno-audio` slot:** `bonus.sunoAudioUrl` is declared `type: 'url'` (a
plain string field) in `weeklyIssue.ts` (~L289), and the live site renders
`<audio src={bonus.sunoAudioUrl}>`. For this slot ONLY, the endpoint uploads the asset
via the same Sanity assets flow, then `set`s the returned CDN **URL string** directly
into `bonus.sunoAudioUrl` — NOT a `{_type: 'file', asset: {_ref}}` reference object. No
schema change is required. The `podcast-audio` and `storyboard-{i}` slots use asset
references as normal (not this string exception).

### §31.7 — Draft-read GET response

`GET /issues/{run_id}/draft` returns:
```json
{
  "revisionId": "string",
  "sections": {
    "<sectionName>": {
      "headline": "string",
      "blocks": [{ "type": "...", "text": "..." }],
      "lossy": false,
      "pdfContent": {
        "problemStatement": "string",
        "keyDataPoints": [{ "stat": "string", "source": "string" }],
        "interventionMechanism": "string"
      }
    }
  },
  "theme": { "...": "..." },
  "game": { "...": "..." },
  "bonus": {
    "headline": "string",
    "body": [{ "type": "...", "text": "..." }],
    "bodyLossy": false,
    "lyrics": "string",
    "sunoPrompt": "string",
    "sunoAudioUrl": "string",
    "storyboards": [{ "asset": { "url": "string" }, "...": "..." }]
  },
  "bonusType": "specAd|bigBudget|jingle",
  "podcast": { "audioUrl": "string", "...": "..." },
  "deliberation": { "...": "..." }
}
```

Phase 32 (GLY-01, D-05): `podcast.audioUrl` is a dereferenced `audioFile.asset->url`
projection, present ALONGSIDE the existing raw `podcast` fields (additive — Phase 31
consumers ignore the new key). `bonus.storyboards[]` entries carry a dereferenced
`asset->{ url }` (bigBudget bonus only). These asset-URL projections mirror
`apps/web/lib/sanity/queries.ts` and let the galley render an `<audio>` player /
storyboard `<img src>` directly from draft-read without a second fetch.

`bonusType` (one of `specAd` | `bigBudget` | `jingle`) is the TOP-LEVEL `weeklyIssue`
field (a sibling of `bonus`, `weeklyIssue.ts` ~L103) — the editor UI switches its
bonus-editor variant on this field (D-05). `lossy: true` is set on a section when a
stored Portable Text block had `markDefs.length > 0` OR `children.length > 1` — those
inline marks/spans are flattened by the naive text-join in `pt_to_blocks()` (§31 lib
addition; see `pt_to_blocks` docstring).

`pdfContent` is present ONLY on `sections.problemStatement` (verbatim
`problemStatement.pdfContent` from Sanity — `{problemStatement, keyDataPoints[3x
{stat,source}], interventionMechanism}` — no reshaping, so the PDF-data-points editor can
prefill real values on load instead of starting blank).

`bonus.body` is DECOMPOSED into `{type,text}[]` rows via `pt_to_blocks()` (mirroring the
4 canonical long-reads), with a sibling `bonus.bodyLossy: boolean` flag using the same
lossy-detection rule as section `lossy`. All other `bonus` fields (`headline`, `lyrics`,
`sunoPrompt`, `sunoAudioUrl`, `storyboards`) are returned verbatim.

The frontend MUST send `variant` on every `/bonus` PATCH (§31.3 below) — it is the
required discriminator the endpoint uses to route the write and to 409-guard against a
mismatched stored `bonusType`.

### §31.8 — Audit shape (D-09)

Every content mutation writes exactly one `auditLog:record` row via `_emit_audit`, with
`action` values such as `content.section_patched`, `content.headline_patched`,
`content.theme_patched`, `content.game_patched`, `content.pdf_data_points_patched`,
`content.bonus_patched`, `content.deliberation_conversation_patched`,
`content.podcast_transcript_patched`, `content.asset_uploaded`. `_emit_audit` is
extended (additively) with optional `before` / `after` kwargs, each forwarded into the
Convex mutation args dict only when non-`None`, and each truncated to a 2000-char cap
with an `"...[truncated]"` suffix (mirrors the existing `lib/agent_wrapper.py::_truncate`
pattern).

### §31.9 — Known interaction risk (rerun-clobber ordering rule)

`rerun_agent` (RUN-05, `api/control.py`) rebuilds state from the LangGraph checkpoint and
calls the full `write_issue_draft` (`createOrReplace`), which will OVERWRITE any operator
content-patch edits to sibling sections with checkpoint content. v1 position: this is a
documented ordering rule, not a code guard — **"re-roll a section BEFORE making console
edits, never after."** The editor surfaces a static advisory to this effect (Plan 05).
A full re-read-current-Sanity guard (merging live Sanity content into the rerun's
sibling-section state before `write_issue_draft`) is deferred to a later phase.

---

## Phase 32 — Native Galley Read-Only Span Resolver

### §32.1 — `qaCorrections.blockIndexHint` (GLY-02, D-11)

Convex `qaCorrections` (schema + `insert` mutation, §4.5) gains an additive optional
field: `blockIndexHint: v.optional(v.number())`. QA agent runs compute it post-hoc in
`agents/qa/__init__.py::qa()` as the ordinal (0-based) of the ONE block within the
section's raw Portable Text body whose joined text contains the finding's `quotedSpan`
as a substring. When zero or more-than-one block matches, no hint is recorded (the key
is simply omitted from the mutation payload) — QA never guesses.

`blockIndexHint` is a **disambiguating hint only, never authoritative**: the galley's
client-side span resolver (Phase 32 frontend work) always falls back to a full
unique-substring search across all blocks in the section when the hint is absent,
stale (points past the block list), or the block at that index doesn't actually
contain `quotedSpan`. Legacy findings recorded before Phase 32 have no `blockIndexHint`
and remain fully valid — the resolver treats a missing hint identically to a
stale one.

---

*All Phase 31 changes are additive. No `drafts.` prefix is introduced anywhere in this
codebase — every content-patch endpoint operates on the plain `issue-{n}` document ID.*

---

## Phase 33 — Accept-Fix Wiring + Decision Rail

Findings become actionable (GLY-03, GLY-04, EDT-04, EDT-06): the operator can Accept fix
/ Edit inline / Dismiss any QA finding from the galley, every action flows dashboard →
pipeline API → Sanity/Convex with an audit row ("nothing silent"), and a blockers-first
decision rail gates Publish on open error-severity findings — client-side AND
server-side. This contract is written BEFORE any endpoint or schema code exists
(CLAUDE.md contract-first hard rule). Plans 33-02..33-05 implement these shapes
verbatim — no field names, endpoint paths, or 409 reason strings may be invented later.

### §33.1 — `qaCorrections` resolution fields + `setResolution` mutation (D-01, additive optional)

Convex `qaCorrections` (schema + §4.5/§32.1 shapes unchanged otherwise) gains four
additive optional fields:

```typescript
resolution: v.optional(v.union(v.literal('accepted'), v.literal('dismissed'))), // absent = open
resolutionReason: v.optional(v.string()),  // required-for-dismiss enforced at the ENDPOINT, not the schema
resolvedBy: v.optional(v.string()),
resolvedAt: v.optional(v.number()),
```

Legacy `accepted: boolean` STAYS and is kept in sync for Phase 26 back-compat:
accept → `accepted: true`; dismiss → `accepted: false` (a no-op in practice — open
findings already carry `false`); reopen → `accepted: false`.

A NEW `qaCorrections:setResolution` mutation is **pipeline-lane**: it MUST call
`requirePipelineSecret` and MUST be added to `_PIPELINE_SECRET_GUARDED_PATHS` in
`packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` (both edits land
together — the set's docstring demands sync). The existing `insert` mutation's public
GAM-05 exception is UNCHANGED — do not copy its no-auth pattern.

```typescript
export const setResolution = mutation({
  args: {
    id: v.id('qaCorrections'),
    resolution: v.optional(v.union(v.literal('accepted'), v.literal('dismissed'))), // absent = reopen
    resolutionReason: v.optional(v.string()),
    resolvedBy: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    pipelineSecret: v.optional(v.string()),
  },
  // handler: requirePipelineSecret(pipelineSecret); patch the row and set
  // accepted = (resolution === 'accepted'). Passing resolution: undefined
  // clears resolution/resolutionReason/resolvedBy/resolvedAt (reopen).
})
```

A tiny public `qaCorrections:byId` query (`args: { id: v.id('qaCorrections') }`) is
added so the pipeline can load one finding by its Convex `_id`; reads are public per
existing convention.

### §33.2 — `claim_checks.checkedAt` (D-13, additive optional)

`claim_checks` gains one additive optional field: `checkedAt: v.optional(v.number())`.
It is stamped inside the existing `claimChecks:setStatus` mutation with `Date.now()`
whenever status flips to `checked` or `skipped` (NOT when a claim is set back to
`pending`). Legacy rows without `checkedAt` degrade to an honest "not yet checked"
state in the rail — never blank. The Phase 26 `ClaimsChecklist.tsx` component needs
ZERO changes: the stamp lives entirely server-side in the mutation it already calls.

### §33.3 — Findings endpoints (D-02, EDT-04)

Three new POST routes in a NEW `packages/pipeline/src/eisenbalm_pipeline/api/findings.py`
router, all Clerk-JWT-guarded via `_require_clerk_jwt_control` (the same dependency as
`api/review.py` / `api/content.py`). The Convex resolution flip flows through these
endpoints — never a dashboard-side Convex mutation (write boundary preserved).

```
POST /issues/{run_id}/findings/{finding_id}/accept   # body { ifRevisionID: string }
POST /issues/{run_id}/findings/{finding_id}/dismiss  # body { reason: string }
POST /issues/{run_id}/findings/{finding_id}/reopen   # no body
```

**Accept** flow (in order):
1. Load finding via `qaCorrections:byId` — 404 if missing or wrong run; 409
   `{"reason": "already_resolved"}` if `resolution` is already set.
2. 409 `{"reason": "accept_unavailable"}` if `suggestedFix` or `quotedSpan` is absent
   (D-07 — nothing to apply / nothing to anchor; also covers `game` and
   non-specAd `bonus`, which have no block body).
3. Map the QA `sectionName` → draft key (Python mirror of `sectionIdMap.ts`;
   `problem` → `problemStatement` is the one non-obvious mapping) →
   `get_issue_draft`.
4. Server-side span resolution (§33.5). No match or ambiguous → 409
   `{"reason": "span_not_resolved", "message": "Couldn't locate this text in the
   current draft. Use Edit inline instead."}` (D-05 — never guess).
5. Apply via Phase 31 machinery:
   `patch_issue_field(field_path=f"{section}.body", value=compose_section_body(blocks),
   if_revision_id=body.ifRevisionID)` — a stale revision raises the standard 409
   `{"reason": "revision_mismatch"}` (D-06).
6. `qaCorrections:setResolution` with `resolution='accepted'`, `resolvedBy`,
   `resolvedAt`.
7. `_emit_audit(action="finding.accepted", before=quotedSpan, after=suggestedFix)`
   (truncated snapshots per §31.8).

Returns `{ "revisionId": string, "findingId": string, "resolution": "accepted" }`.

**Dismiss** flow: empty/whitespace `reason` → 422. Load finding (404 / 409
`already_resolved` as above) → `qaCorrections:setResolution` with
`resolution='dismissed'`, `resolutionReason=reason`, `resolvedBy`, `resolvedAt` →
`_emit_audit(action="finding.dismissed", after=reason)`. Returns
`{ "findingId": string, "resolution": "dismissed" }`. NO Sanity write.

**Reopen** flow (D-04 — no text revert): load finding (404; 409
`{"reason": "not_resolved"}` if `resolution` is absent) →
`qaCorrections:setResolution` with `resolution` omitted (clears the four resolution
fields, sets `accepted=false`) → `_emit_audit(action="finding.reopened")`. Returns
`{ "findingId": string, "resolution": null }`.

### §33.4 — Publish/schedule open-error-findings gate (D-14, D-11b, GLY-04 server)

`review.py::publish_issue` AND `review.py::schedule_issue` BOTH gain a new guard,
slotted in AFTER the existing claims-signoff gate (`claims_not_signed_off`) in each
endpoint's guard chain: read `qaCorrections:byRunId`, compute
`open_errors = [f for f in findings if f.severity == "error" and not f.resolution]`,
and if non-empty raise:

```json
409 { "reason": "open_error_findings",
      "message": "{n} error finding(s) must be accepted or dismissed before publishing.",
      "count": n }
```

The check is **anchor-state-blind**: an orphaned error finding (one whose `quotedSpan`
no longer resolves against the current draft) still blocks until explicitly accepted or
dismissed — losing an anchor must never silently un-block Publish (D-11b).
`schedule_issue` gets the SAME gate explicitly (Pitfall 8): scheduled runs publish via
the tick sweep and must not bypass the gate by scheduling instead of publishing.
Phase 34 layers its additional server-enforced sign-offs on top of this same guard
chain; nothing beyond the error-findings check belongs to Phase 33.

### §33.5 — Server-side span resolution (D-05)

A NEW `packages/pipeline/src/eisenbalm_pipeline/lib/span_resolver.py` is a 1:1 Python
port of `apps/dispatch-control/lib/galley/spanResolver.ts`, so client and server
resolution always agree (a finding the galley renders as anchored must not 409 on
accept). Three stages, each searched block-by-block (NEVER against joined section
text — cross-block matches are not real matches):

1. **Exact:** `str.find(quotedSpan)` per block.
2. **Curly-quote-normalized:** map `‘ ’ → '` and `“ ” → "` on BOTH sides — a 1:1,
   length-preserving character swap, so offsets computed on normalized text index the
   original text directly.
3. **Whitespace-tolerant:** `re.escape` the quote-normalized span with every `\s+` run
   collapsed to a `\s+` pattern, matched via `re.finditer` over the quote-normalized
   block text; use the match's own `start()`/`end()` (the matched run in the TEXT may
   differ in length from `quotedSpan`).

Disambiguation (identical to the TS `disambiguate`): 0 matches → next stage; exactly
1 → winner; 2+ → `blockIndexHint` wins ONLY if it names an actual candidate block,
otherwise ambiguous = unresolved (→ 409 `span_not_resolved`). **Never guess.**

Replacement is `text[:start] + suggestedFix + text[end:]` applied to the ORIGINAL block
text (valid because normalization is length-preserving — offsets index the original).

### §33.6 — Editor memo payload key (D-16 correction)

The decision rail's editor memo reads the `editor-final` row from `deliberationEvents`
(`byRunIdAndType`). The `payload` is a JSON **string** whose key is **`notes`** —
`{"approved": bool, "notes": str}` per `agents/editor.py::_editor_final_payload` —
NOT `editor_final_notes` (the CONTEXT D-16 wording is corrected here). Consumers
`JSON.parse(payload).notes` inside a try/catch and render an honest empty state
("No editor memo for this run") for legacy/malformed rows.

### §33.7 — Hook card + verification data sources (D-12, D-13)

**Hook card:** renders the run's selected pitch — a NEW public query
`pitchLog:selectedByRunId` (`args: { runId: v.string() }`) on the EXISTING
`by_runId_and_selected` index, filtered `selected === true` — surfacing `charityName`
+ `scoutSummary`. Phase 37's `hookClaim`/`hookVerified` model upgrades this card in
place; no fake data in the meantime.

**Verification summary:** reads `claimChecks:listByRunId` — "X/Y claims checked"
where X = rows with `status !== 'pending'`, and "checked Nm ago" from
`max(checkedAt)` across done rows. Affirmative states only, never blank: no rows →
"No claims extracted yet"; rows without `checkedAt` → "not yet checked".

*All Phase 33 changes are additive: `qaCorrections`/`claim_checks` gain only optional
fields; the `insert` public exception and all Phase 26/31/32 shapes are unchanged.*

---

## Phase 34 — Two-Sign-Off Publish Gate + Studio Bypass Retirement

An issue cannot be published without two independent, server-enforced sign-offs —
**"Facts cleared"** and **"Sounds human"** — recorded per run with actor + timestamp
(PUB-01..PUB-04). The Sanity publish webhook handler re-validates sign-off state
before running the publisher, closing the Studio status-flip bypass (PUB-02). Sanity
Studio's publish action for `weeklyIssue` is disable-able behind a flag (PUB-03). This
contract is written BEFORE any endpoint or schema code exists (CLAUDE.md contract-first
hard rule, mirroring §31/§32/§33). Plans 34-02..34-06 implement these shapes verbatim —
no field name, path, literal, or 409 reason string may be invented later.

### §34.1 — Convex `sign_offs` table (D-02, additive, new table)

Appended after `review_actions` (~convex/schema.ts:424). Frozen shape:

```typescript
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
  .index('by_workspace', ['workspace_id'])
```

Semantics: exactly ONE row per `(runId, kind)`. "Active" = `revokedAt` absent.
Revocation PATCHES the row's `revokedAt`/`revokedReason` (per Research Open Question #3
recommendation — the `audit_log` carries the immutable actor+timestamp+reason trail, so
the row itself need not be an append log). Re-signing after a revocation PATCHES the
same row (clears `revokedAt`/`revokedReason`, refreshes `actorId`/`signedAt`).

### §34.2 — `convex/signOffs.ts` functions

- `record` (mutation, pipeline-lane — MUST call `requirePipelineSecret`, MUST be added
  to `_PIPELINE_SECRET_GUARDED_PATHS`): args
  `{ workspace_id: v.string(), runId: v.string(), kind: v.union(v.literal('facts-cleared'), v.literal('sounds-human')), actorId: v.string(), pipelineSecret: v.optional(v.string()) }`.
  Handler: upsert by `(runId, kind)` via the `by_runId_and_kind` index — if a row
  exists, PATCH `{ actorId, signedAt: Date.now(), revokedAt: undefined, revokedReason: undefined }`;
  else INSERT `{ workspace_id, runId, kind, actorId, signedAt: Date.now() }`.
- `revokeAll` (mutation, pipeline-lane — MUST call `requirePipelineSecret`, MUST be in
  `_PIPELINE_SECRET_GUARDED_PATHS`): args
  `{ runId: v.string(), reason: v.string(), pipelineSecret: v.optional(v.string()) }`.
  Handler: for every row with matching `runId` and `revokedAt` absent, PATCH
  `{ revokedAt: Date.now(), revokedReason: reason }`. No-op when none active.
- `activeByRunId` (query, PUBLIC — no guard, per the existing unguarded-read
  convention of `claimChecks:allSignedOff`/`qaCorrections:byRunId`; Research Pitfall
  2): args `{ runId: v.string() }`. Returns an object keyed by kind for ACTIVE rows
  only, e.g. `{ 'facts-cleared': { actorId, signedAt }, 'sounds-human': { actorId, signedAt } }`.
  A kind absent from the returned object = not signed (or revoked).
- `listByRunId` (query, PUBLIC): args `{ runId: v.string() }`. Returns all rows for
  the run (active + revoked) for the rail's who-signed-when display.

### §34.3 — Sign-off record endpoint (D-01, D-05, D-06)

One new Clerk-JWT-guarded (`_require_clerk_jwt_control`) POST route in a NEW
`api/signoffs.py` router:

```
POST /issues/{run_id}/sign-off      # body { kind: "facts-cleared" | "sounds-human" }
```

Body is a Pydantic `Literal["facts-cleared", "sounds-human"]` — any other value → 422.

Flow: run lookup via `pipelineRuns:byRunId` (404 if missing) →
**if `kind == "facts-cleared"`** enforce the RELOCATED prerequisites (D-04):
(a) `claimChecks:allSignedOff` → 409
`{"reason": "claims_not_signed_off", "message": "All claim checks must be signed off before clearing facts."}`
when not all signed; (b) `qaCorrections:byRunId` open-error scan
(`[f for f in findings if f.severity == "error" and not f.resolution]`) → 409
`{"reason": "open_error_findings", "message": "{n} error finding(s) must be accepted or dismissed before clearing facts.", "count": n}`
(anchor-blind, D-11b) →
**if `kind == "sounds-human"`** NO prerequisites (D-06, ungated — nothing
machine-checkable until Phase 36) →
record via `signOffs:record({workspace_id: "eisenbalm", runId, kind, actorId: claims["sub"]})` →
`_emit_audit(action="signoff.recorded", resource_type="run", resource_id=f"{run_id}:{kind}")` →
return `{ "runId": run_id, "kind": kind, "signedAt": <ms> }`.

NOTE: there is NO manual revoke endpoint — revocation happens ONLY via D-08
auto-revoke on content mutation (§34.6). NOTE: no override path (D-03) — a
missing/ambiguous sign-off ALWAYS resolves to "not signed," never a lenient default
(Research Anti-Pattern 4).

### §34.4 — Publish/schedule gate restructure (D-04, D-09, PUB-01)

In `review.py::publish_issue` AND `review.py::schedule_issue`: REMOVE the existing
`claims_not_signed_off` guard AND the `open_error_findings` guard (both relocate to
§34.3's facts-cleared sign-off). ADD, in their place (after the `wrong_status` guard,
before the `no_sanity_issue` guard), a single new guard:

```python
active = await _cc.convex_query(http, "signOffs:activeByRunId", {"runId": run_id}) or {}
missing = [k for k in ("facts-cleared", "sounds-human") if k not in active]
if missing:
    raise HTTPException(status_code=409, detail={
        "reason": "missing_signoffs",
        "message": "Both sign-offs (Facts cleared + Sounds human) are required before publishing.",
        "missing": missing})
```

`schedule_issue` uses the identical guard (D-09 — a scheduled publish must not
bypass by scheduling; the D-07 webhook re-check covers fire-time if a sign-off is
revoked between scheduling and the tick). Message may say "…before scheduling." for
schedule. The existing `wrong_status`, `no_sanity_issue`, `schedule_in_past` guards
and the `reviewActions`/`audit_log` writes are UNCHANGED.

### §34.5 — Webhook re-validation + revert (D-07, PUB-02)

In `webhooks.py::sanity_publish`, insert ONE guard AFTER the idempotency-dedup block
and BEFORE the `asyncio.create_task(_run_publisher(...))` call. Read `convex_http` and
`sanity_http` from `request.app.state` (same pattern as `review.py`). Logic:
`run_id = payload.get("runId")`;
`active = await _cc.convex_query(convex_http, "signOffs:activeByRunId", {"runId": run_id}) or {}`
when `run_id` is truthy else `{}`;
`missing = [k for k in ("facts-cleared", "sounds-human") if k not in active]`.

**BLOCK when `run_id` is None OR `missing` is non-empty** (Research Open Question #2
— a run-less Studio-authored draft can never carry sign-offs, so it blocks by default
per D-03/D-07 spirit): call
`_revert_sanity_status(sanity_http, issue_id, status="in-review")` (§34.7 helper),
`_emit_audit(convex_http, actor_id="webhook", action="run.publish_bypass_blocked", resource_type="run", resource_id=run_id or issue_id, after=json.dumps({"missing": missing, "reason": "missing_signoffs" if run_id else "no_run_id"}))`,
emit the D-07 alert (§34.6b), and
`return {"ok": True, "blocked": "missing_signoffs", "missing": missing}` WITHOUT
launching `_run_publisher`.

Ordering fact (document it): the legitimate dashboard-publish path flips Sanity to
`published` only AFTER its own §34.4 gate passed, so both sign-offs are already active
when the webhook fires for a legit publish — the re-check passes naturally, no race.
The ONLY failing case is a direct Studio status-flip that skipped the gate.

### §34.6 — D-08 auto-revoke on content mutation (D-08, PUB-01 integrity)

A shared helper `_revoke_active_signoffs(http, *, run_id, reason)` (co-located with
`_emit_audit` in `api/control.py`, fail-open — a revoke failure must not block the
content save) calls `signOffs:revokeAll({runId, reason})`. It is invoked (one extra
line after the existing `_emit_audit` call) in EVERY content-mutating endpoint: all 9
`content.py` routes (`patch_section`, `patch_headline`, `patch_theme`, `patch_game`,
`patch_pdf_data_points`, `patch_bonus`, `patch_deliberation_conversation`,
`patch_podcast_transcript`, `upload_content_asset`), all 3 `findings.py` routes
(`accept_finding`, `dismiss_finding`, `reopen_finding` — accept mutates the draft;
dismiss/reopen change the facts-cleared prerequisite basis so they too void the
sign-offs and close the gate-integrity hole created by relocating the error-findings
check to §34.3), and `control.py::rerun_agent`. Revocation clears BOTH kinds (per
CONTEXT discretion recommendation). Because `DecisionRail.tsx` subscribes to
`signOffs:activeByRunId` live, any revocation flips the rail red with zero polling.

### §34.6b — D-07 bypass alert (Research Pitfall 3 / Open Question #1 — resolved to the precedent)

The bypass alert reuses the FROZEN `deliberationEvents.eventType` union (Phase 27
D-04 — do NOT add a new literal): insert a `deliberationEvents` row with outer
`eventType: "cost-warning"` and an inner `payload` JSON
`{ "eventType": "publish-bypass-blocked", "runId": <id>, "missing": <list> }`, exactly
as the `auto-publish-enabled` alert did. Document the known label tradeoff in a code
comment (the notification email subject renders "budget" — accepted codebase
tradeoff, matches CONTEXT's "same pattern as the auto_publish alert").

### §34.7 — `_revert_sanity_status` helper (D-07)

A new helper in `lib/sanity_publish.py`, the mirror image of the existing
`_flip_sanity_published`: same `POST /{_API_VERSION}/data/mutate/{dataset}`
PATCH-mutate shape, `{"set": {"status": status}}` where `status` defaults to
`"in-review"` (the valid non-published `weeklyIssue.status` value confirmed in
`apps/studio/schemas/weeklyIssue.ts`).

### §34.8 — `_PIPELINE_SECRET_GUARDED_PATHS` additions

`signOffs:record` and `signOffs:revokeAll` MUST be added to the frozenset in
`packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` (Research Pitfall 1 —
a guarded mutation missing from this set 401s at runtime). Reads
(`signOffs:activeByRunId`, `signOffs:listByRunId`) are PUBLIC queries — NOT added
(Pitfall 2).

### §34.9 — Studio publish-action override (D-10, PUB-03)

`apps/studio/sanity.config.ts` gains a `document.actions` resolver gated by
`process.env.SANITY_STUDIO_DISABLE_PUBLISH === 'true'`: when the flag is `'true'` and
`context.schemaType === 'weeklyIssue'`, filter out the `'publish'` action; otherwise
return `prev` unchanged. The flag defaults OFF (unset) during the soak; ending the
soak = set the flag + redeploy Studio, no new code. `SANITY_STUDIO_*` vars are
build-time-inlined (same convention as the existing `SANITY_STUDIO_PROJECT_ID`). The
webhook re-check (§34.5) protects the gate regardless of flag state.

```typescript
// apps/studio/sanity.config.ts
export default defineConfig({
  // ...existing config...
  document: {
    actions: (prev, context) => {
      const disablePublish = process.env.SANITY_STUDIO_DISABLE_PUBLISH === 'true'
      if (disablePublish && context.schemaType === 'weeklyIssue') {
        return prev.filter(({ action }) => action !== 'publish')
      }
      return prev
    },
  },
})
```

Do NOT introduce any de-slop/rewrite-popover screen shapes (deferred to Phase 36,
which upgrades this sign-off in place) or per-claim source-binding shapes (deferred
to Phase 35) — "Sounds human" here is a pure ungated attestation.

*All Phase 34 changes are additive: a new `sign_offs` table + `signOffs.ts`; the
publish/schedule guards are restructured (two checks relocate to the facts-cleared
sign-off, one new missing_signoffs guard added); no field is renamed; Phase
26/31/32/33 shapes are unchanged.*

---

## §35 — Provenance (Phase 35)

Every claim the Researcher extracts carries `{claim, sourceUrl, retrievedAt}` and
survives into final prose: the writers reference claim IDs at generation time (never
post-hoc fuzzy matching), and the galley renders sourced claims (marigold) and
unsourced claims (rust) as first-class states (PRV-01..PRV-04). This contract is
written BEFORE any schema/agent code exists (CLAUDE.md contract-first hard rule,
mirroring §31/§32/§33/§34). Plans 35-02..35-06 implement these shapes verbatim — no
field name, claim-ID scheme, or row shape may be invented later.

### §35.1 — Researcher LLM output claim (D-01)

The Researcher's Pydantic response model gains a `claims` field. The LLM emits a
**source index**, never a URL — code numbers each Tavily result (S1, S2, …) before
the parse call, and the LLM references those indices:

```python
class ClaimOutput(BaseModel):
    text: str
    sourceIndex: int | None = None   # 1-based index into the numbered Tavily results (S1=1, S2=2, …); None = writer asserts no source
```

`ResearchOutputModel.claims: list[ClaimOutput] = []` (additive field, `researcher.py`).
Absorbs `keyStatistics` (D-02 — the old unsourced-strings field is removed; verified
3 total repo references, all safe to update — see 35-RESEARCH.md Pitfall 2). The
existing paired fields `founderName`/`founderNameSourceUrl`/`subjectName`/
`subjectNameSourceUrl` are UNCHANGED and stay as-is for back-compat.

### §35.2 — Code-side research claim (D-01, assembled in `researcher()`)

Immediately after the LLM call returns, code maps `sourceIndex` → the real Tavily
result at that position (the same `SearchResult` list the numbering was drawn from)
and assigns a stable `claimId`. The assembled shape written to
`state["research"]["claims"]`:

```python
{
    "claimId": str,               # code-assigned, stable, collision-free — e.g. f"{run_id[:8]}-{ordinal}"
    "text": str,
    "sourceUrl": str | None,      # the real Tavily result URL at position sourceIndex; None if sourceIndex absent/out-of-range
    "retrievedAt": int | None,    # Unix ms, stamped at the moment that Tavily query ran; None alongside a None sourceUrl
}
```

Out-of-range or absent `sourceIndex` → `sourceUrl=None, retrievedAt=None` (honestly
unsourced — never a fabricated or best-guess URL). `graph/state.py::ResearchOutput`
gains `claims: NotRequired[list[dict]]` (TypedDict cannot express `ClaimOutput`'s
shape precisely; the Pydantic model at the writer/researcher boundary is
authoritative, matching the existing `body: list[dict]` precedent for BodyBlock).

### §35.3 — Writer `claimSpans` sidecar (D-05, D-06)

The five prose writers (`origin_story`, `problem`, `founder_bio`, `case_study`, and
`bonus` — SpecAd branch ONLY, per D-06) gain a flat sibling field next to `body`:

```python
# packages/pipeline/src/eisenbalm_pipeline/graph/blocks.py — new sibling class
class ClaimSpanRef(BaseModel):
    claimId: str
    asWritten: str = ""   # the verbatim phrase as the writer wrote it in the body — handles rewording, e.g. "$2.3M annual budget" -> "a budget of $2.3 million"
```

Each writer's output model (e.g. `OriginStoryOutput`) adds
`claimSpans: list[ClaimSpanRef] = []`. **HARD CONSTRAINT: no `oneOf`/discriminated
unions** — Anthropic's structured-output API rejects `oneOf` with HTTP 400 (see
`graph/blocks.py`'s "Phase 18 post-launch fix" docstring for the production incident
that already forced `BodyBlock` into a flat single-class shape; `ClaimSpanRef` is
already flat, so it is compliant by construction — do not later "improve" it into a
union). Writers whitelist-drop any `claimId` not present in
`state["research"]["claims"]` in the AGENT FUNCTION body (D-07 — lenient, logged,
never fatal; the whitelist isn't visible to a Pydantic field validator). `claimSpans`
is NEVER forwarded to Sanity — `write_issue_draft` builds each section's payload as an
explicit dict literal (`headline`, `body` only), so no stripping code is needed
(verified, `lib/sanity_client.py`). The game and non-prose outputs are exempt (D-06)
— their factual content still reaches the checklist via the D-04 regex catch-all,
unsourced by default.

### §35.4 — `claim_checks` additive fields (D-03) — amends §26.2 in place

`claim_checks` (§26.2) gains five additive optional fields, mirroring the
`qaCorrections` `sectionName`/`blockIndexHint` precedent (§32/§33) exactly:

```typescript
claim_checks: defineTable({
  // ── existing (Phase 26/33, unchanged) ──
  workspace_id: v.string(),
  runId: v.string(),
  claimIndex: v.number(),
  text: v.string(),
  claimType: v.string(),
  context: v.string(),
  status: v.string(),
  checkedAt: v.optional(v.number()),
  // ── NEW additive (Phase 35) ──
  claimId: v.optional(v.string()),        // present ONLY for writer-bound (sourced) rows
  sourceUrl: v.optional(v.string()),      // present only when index-bound to a real Tavily result
  retrievedAt: v.optional(v.number()),    // Unix ms, code-stamped at Tavily query time
  sectionName: v.optional(v.string()),    // §35 claim_checks additive field: galley section this claim occurs in — NEW for ALL rows (sourced + unsourced), not just legacy global rows
  blockIndexHint: v.optional(v.number()), // hint-only anchor, mirrors qaCorrections' semantics — never authoritative
})
  .index('by_runId', ['runId'])
  .index('by_workspace', ['workspace_id'])
```

**Invariant:** a row with `claimId` present = sourced (marigold in the galley); a row
with `claimId` absent = unsourced (rust). Legacy rows (all five fields absent —
pre-Phase-35 runs) degrade honestly to unsourced with zero migration — the absence of
`claimId` alone is sufficient, no backfill script, no schema version flag.

### §35.5 — `insertBatch` signature change (§26.6 amendment) + one-row-per-occurrence (D-13)

Each object in the `claims: v.array(v.object({...}))` validator gains the same five
optional fields as §35.4, and the handler's `ctx.db.insert('claim_checks', {...})`
call passes them through (Convex omits `undefined` optionals automatically, so legacy
callers with no provenance fields keep producing legacy-shaped rows — zero consumer
break):

```typescript
claims: v.array(
  v.object({
    claimIndex: v.number(),
    text: v.string(),
    claimType: v.string(),
    context: v.string(),
    claimId: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    retrievedAt: v.optional(v.number()),
    sectionName: v.optional(v.string()),
    blockIndexHint: v.optional(v.number()),
  }),
)
```

**Row model change (D-13, 35-RESEARCH.md Pitfall 6, deliberate and visible):** the
row model moves to **ONE-ROW-PER-OCCURRENCE**. Phase 26/33's `extract_claims` joined
all sections into one string before dedup, producing one global row per unique claim
text. Phase 35 restructures extraction to run per-section, per-block, so the same
fact stated in two sections (e.g. a founding year mentioned in both the origin story
and the founder bio) becomes TWO independent rows with distinct `claimIndex` values,
each carrying its own `sectionName`/`blockIndexHint` — every row owns a jump-link
target in the galley (D-14 — no row can point at more than one span). This is a
checklist-size increase for repeated facts versus Phase 26 behavior; it is
intentional, not a regression.

### §35.6 — `ResearchOutput` TypedDict drift (Research Pitfall 3) — documented as KNOWN, left unchanged

`graph/state.py::ResearchOutput` and its byte-identical copy in this document's §7
list fields (`foundingMoment`, `founderBackground`, `caseStudySubject`,
`caseStudyOutcome`, `verifiedFacts`, `sources`) that **do not exist** on the real
`ResearchOutputModel` the Researcher actually emits (`summary`, `foundingYear`,
`annualBudget`, `founderName`, `founderNameSourceUrl`, `founderRole`, `founderBio`,
`subjectName`, `subjectNameSourceUrl`, `subjectRole`, `subjectStory`,
`keyStatistics`, `fundingSources`). Consequently `lib/voice.py::build_section_writer_prompt`'s
`research_lines` block — which reads `research.get("foundingMoment")`,
`research.get("caseStudySubject")`, `research.get("verifiedFacts")`, etc. — has been
**silently empty since Phase 5**: those keys are always absent from the real research
dict, so no research context has ever reached the five prose writers through that
code path.

This is pre-existing drift, not something Phase 35 caused. **Decision recorded for
Phase 35:** the drift is documented here as **known** and the existing broken
`research_lines` fields are **left unchanged** — reconciling the whole naming split is
out of scope for a provenance phase. Phase 35 ONLY adds `claims: list[ClaimOutput]`
to `ResearchOutputModel`/`ResearchOutput`/this section, and adds the claims-whitelist
injection to the writer user prompt (§35.3) as a NEW, separate mechanism from the
stale `research_lines` block. A future phase may reconcile `ResearchOutput` vs
`ResearchOutputModel` field names; this phase does not silently paper over the gap by
pretending it doesn't exist.

*All Phase 35 changes are additive: `claim_checks` gains five optional fields;
`ResearchOutputModel`/`ResearchOutput` gain one `claims` field; five writer output
models gain one `claimSpans` field. No existing field is renamed or removed; Phase
26/31/32/33/34 shapes are unchanged.*

---

## §36 — Voice Pass (Phase 36)

A dedicated `/voice-pass/[runId]` screen lights machine-tells and voice violations
inline over the same draft prose the Review Desk renders, lets the operator rewrite
each tell to house voice via the existing content-patch machinery, and carries its
own "Sounds human" sign-off — distinct from "Facts cleared" — that upgrades Phase
34 D-06's interim ungated attestation now that voice is machine-checkable
(VOX-01..VOX-04). Detection reuses the existing two-layer QA detector
(`agents/qa/rules.py` deterministic predicates + `agents/qa/judge.py` Opus judge) —
no new detector (VOX-04, binding). This contract is written BEFORE any
endpoint/schema code exists (CLAUDE.md contract-first hard rule, mirroring
§31/§32/§33/§34/§35). Plans 36-02..36-06 implement these shapes verbatim — no field
name, axis literal, endpoint path, or 409 reason string may be invented later.

### §36.1 — `qaCorrections.axis` gains `machine-tell` (additive literal)

Both `convex/schema.ts`'s `qaCorrections` table definition AND
`convex/qaCorrections.ts`'s `insert` mutation's `axis` union ADD two literals,
alongside the existing six:

```typescript
axis: v.optional(v.union(
  v.literal('gravity'),
  v.literal('sentiment'),
  v.literal('irony-signaling'),
  v.literal('precision'),
  v.literal('cross-section-consistency'),
  v.literal('hard-rule'),
  v.literal('machine-tell'),        // NEW Phase 36 §36.1 — Voice Pass machine-tell axis
  v.literal('structural-variety'),  // NEW Phase 36 §36.1 — closes the pre-existing Phase 18 gap (judge already emits this Python-side, Convex never accepted it)
)),
```

Failure mode being closed: pipeline writes go through `convex_mutation_safe`
(`lib/convex_client.py`), which wraps every call in try/except and only
`log.warning`s on failure — never raises. A missing literal does not crash the
pipeline; it silently drops the finding (confirmed already happening today for
`"structural-variety"`, a valid Python `Literal` since Phase 18 MEL-04 that has
never once round-tripped through Convex — Research Pitfall 1). Both literals are
added in the SAME change as D-05's new predicate so this class of gap cannot
regress silently again.

### §36.2 — Layer-1 axis passthrough

`agents/qa/__init__.py::qa()` STOPS collapsing every Layer-1 (`rules.py`) finding's
axis to `"hard-rule"` before writing to Convex. Each Layer-1 finding is written with
its predicate's true axis (`gravity` / `sentiment` / `irony-signaling` / `precision`
/ `machine-tell`) instead. This is a deliberate MODIFICATION of shipped Phase 5
behavior (Research Pitfall 3, option 2) — the collapse existed only so Andrew could
tell which layer produced a finding while reading `qaCorrections` in Sanity Studio;
Studio is being retired as an editing/publish surface (PUB-03), and no test asserts
the collapsed `"hard-rule"` value at the orchestrator/integration level (only
`test_rules.py`, which tests the raw predicates BEFORE the collapse, is unaffected
either way). Stopping the collapse also correctly routes `check_unverified_name`'s
`precision`-axis output to the factual side (§36.3) instead of leaving it
indistinguishable from genuine voice tells inside a shared `"hard-rule"` bucket
(Research Pitfall 5).

### §36.3 — Voice/factual axis partition

```python
VOICE_AXES = {"gravity", "sentiment", "irony-signaling", "machine-tell"}
FACTUAL_AXES = {"precision", "cross-section-consistency", "structural-variety", "hard-rule"}
```

Voice Pass lights findings whose axis is in `VOICE_AXES`; the Review Desk galley
lights findings whose axis is in `FACTUAL_AXES`. A finding whose axis is `None`/
absent (legacy rows, pre-Phase-5 shapes) counts as factual — it surfaces on the
Review Desk / blocks "Facts cleared", never Voice Pass (the conservative default:
no finding is ever silently invisible to both screens). `"hard-rule"` remains in
`FACTUAL_AXES` as a legacy label for any row written before §36.2 ships; no
backfill — old rows keep reading exactly as they do today.

### §36.4 — `POST /issues/{run_id}/voice-recheck`

New Clerk-JWT-guarded (`_require_clerk_jwt_control`) POST route in a NEW
`packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py` router:

```
POST /issues/{run_id}/voice-recheck   # no body
```

Flow (in order):
1. `_resolve_sanity_id(request, run_id, claims)` → `get_issue_draft(sanity_http,
   sanity_id)` (identical draft-read path `findings.py`/`content.py` already use).
2. `_draft_to_qa_sections(draft)` — a NEW helper that mirrors
   `agents/qa/__init__.py::_extract_sections`'s flattening logic, but reads
   `get_issue_draft`'s `{headline, blocks, lossy}` shape per section (origin_story,
   problem, founder_bio, case_study, game, bonus) instead of `DispatchState`'s
   Portable-Text-block-list shape.
3. Auto-supersede dedup (Research Pitfall 4): read `qaCorrections:byRunId`, find any
   OPEN row where `agentId == "qa-recheck"` and `resolution` is absent (a prior
   re-check's still-unresolved findings), and for each call
   `qaCorrections:setResolution(resolution="dismissed", resolutionReason="superseded
   by re-check")`. Rule-layer findings (`agentId == "qa"`) are NEVER superseded here
   — they are stable/idempotent (same predicate, same text, same result every time).
4. `run_llm_judge(sections, run_id=run_id, narrator=None, rubric=None)` — narrator is
   always `None` for the on-demand path (Research Pitfall 6: narrator resolution is
   an in-memory, run-start-only concern with no persisted, independently-queryable
   record; `narrator=None` is the documented byte-compatible legacy default, NRR-10
   — a safe fallback, not a hack).
5. Write each returned finding via `qaCorrections:insert` with `agentId="qa-recheck"`,
   `accepted=False`, passing through `axis`/`severity`/`quotedSpan`/`reason`/
   `suggestedFix`/`sectionName` from the judge finding unchanged. Use the RAISING
   `convex_mutation` (not `convex_mutation_safe`) for this write — this is a live,
   synchronous, operator-triggered call; a silently-swallowed failure here is worse
   than the pipeline's fire-and-forget writes (the operator would believe they got a
   fresh check when they got nothing — Research Pitfall 1's exact failure mode,
   surfaced instead of hidden).

Returns `{ "runId": run_id, "findingCount": n }`.

### §36.5 — `POST /issues/{run_id}/voice-rewrite`

Same router, same guard:

```
POST /issues/{run_id}/voice-rewrite   # body { findingId: string }
```

Flow: load the finding via `qaCorrections:byId` (404 if missing or wrong run) →
build a house-voice rewrite instruction over `finding.quotedSpan`, using
`VOICE_CONSTRAINTS` (Jesse's voice, or the resolved narrator's constraints where
NRR-04 propagation already applies) — the instruction MUST NOT introduce AI
self-reference or hedging language (CLAUDE.md: "Voice is non-negotiable") — and call
`acomplete` (the OpenRouter client wrapper with cost recording; NEVER a raw
OpenRouter/Anthropic client) to generate the replacement text. Returns
`{ "findingId": finding_id, "suggestedFix": <generated text> }`.

This endpoint ONLY generates text — it does not mutate the draft, does not call
`qaCorrections:setResolution`, and does not patch Sanity. The client passes the
returned `suggestedFix` straight into the existing `POST
/issues/{run_id}/findings/{finding_id}/accept` call (§33.3) as
`suggestedFixOverride` (§36.6) to actually apply it.

### §36.6 — `_AcceptBody.suggestedFixOverride`

`api/findings.py::_AcceptBody` (§33.3) gains one new optional field:

```python
class _AcceptBody(BaseModel):
    ifRevisionID: str
    suggestedFixOverride: Optional[str] = None  # NEW Phase 36 §36.6
```

Inside `accept_finding`, the line that reads `suggested_fix =
finding.get("suggestedFix")` becomes:

```python
suggested_fix = body.suggestedFixOverride or finding.get("suggestedFix")
```

Every other step of the §33.3 accept flow (finding load, `already_resolved` 409,
`accept_unavailable` 409 when BOTH `suggestedFixOverride` and the finding's stored
`suggestedFix` are absent, section-key mapping, server-side span resolution,
`patch_issue_field` with the `ifRevisionID` guard, `qaCorrections:setResolution`,
audit emission) is UNCHANGED. This lets a rule-only tell (no stored `suggestedFix`
— Layer-1 predicates do not emit one) be accepted with an on-demand §36.5 rewrite,
with zero new mutation path (Research Code Example 2).

### §36.7 — Sign-off prerequisite partition

`api/signoffs.py::record_sign_off` (§34.3) changes in two places:

**(a) NARROW the existing `facts-cleared` branch** (Research Pitfall 2 — this
MODIFIES already-shipped, tested Phase 34 code, not a pure addition) so its open-
error scan excludes voice axes:

```python
open_errors = [
    f for f in findings
    if f.get("severity") == "error"
    and not f.get("resolution")
    and f.get("axis") not in VOICE_AXES   # NEW Phase 36 §36.7(a) narrowing
]
```

Without this narrowing, a single open `sentiment`/`gravity`/`machine-tell` error
would block BOTH sign-offs once (b) below exists, contradicting VOX-03's "distinct
from factual clearance."

**(b) ADD a new `elif body.kind == "sounds-human":` branch**, mirroring (a)'s
pattern exactly but scoped to `VOICE_AXES` (D-12/D-14):

```python
elif body.kind == "sounds-human":
    findings = await _cc.convex_query(http, "qaCorrections:byRunId", {"runId": run_id}) or []
    open_voice_errors = [
        f for f in findings
        if f.get("severity") == "error"
        and not f.get("resolution")
        and f.get("axis") in VOICE_AXES
    ]
    if open_voice_errors:
        raise HTTPException(status_code=409, detail={
            "reason": "open_voice_findings",
            "message": f"{len(open_voice_errors)} voice finding(s) must be accepted or dismissed before signing sounds-human.",
            "count": len(open_voice_errors),
        })
```

This check is anchor-state-blind exactly like facts-cleared's D-11b guard — an
orphaned (unresolvable-span) voice error finding still has no `resolution` and
still blocks; losing the anchor must never silently un-block the gate. This branch
REPLACES §34.3's prior "no prerequisites (D-06, ungated)" behavior for
`kind == "sounds-human"` — the ungated interim attestation is upgraded in place, as
Phase 34 D-06 anticipated. The rest of §34.3's flow (run lookup, `signOffs:record`,
audit emission, response shape) is UNCHANGED.

*All Phase 36 changes are: additive to `convex/schema.ts`/`convex/qaCorrections.ts`
(two new axis literals); a MODIFICATION to `agents/qa/__init__.py`'s axis-collapse
(§36.2) and to `api/signoffs.py`'s facts-cleared prerequisite (§36.7a) — both called
out explicitly since they touch already-shipped, tested Phase 5/34 code; and purely
additive elsewhere (two new endpoints, one new optional request field). No field is
renamed; Phase 26/31/32/33/34/35 shapes are otherwise unchanged.*

---

## §37 — Run Monitor v2 + Signal Desk (Phase 37)

Two operator surfaces over EXISTING run data — no new pipeline agents, no topology
change (MON-01..MON-04, SIG-01..SIG-03). Run Monitor v2 rebuilds the existing
`run-monitor/graph` view in place into a vertical forensic spine (agents as dots,
`verify_research`/`validate_sections` code gates as marigold diamonds) with a
handoff inspector, per-section strength scores on the 7-writers node, and a
run-vs-trailing-8 drift strip. Signal Desk builds out the existing stub into the
Gate 1 candidate slate + decision panel + adjudication mode over the existing
`editor_gate_1` interrupt and `POST /run/{run_id}/resume`. All changes additive; no
field renames. This contract is written BEFORE any schema/agent/endpoint code exists
(CLAUDE.md contract-first hard rule, mirroring §31/§32/§33/§34/§35/§36). Plans
37-02..37-05 implement these shapes verbatim — no field name, endpoint path, or read
pattern may be invented later.

### §37.1 — `agent_runs.retryCount` (additive optional)

```typescript
// convex/schema.ts — agent_runs table
retryCount: v.optional(v.number()),  // Phase 37 §37.1 — genuine LLM regenerate-retries, legacy = 0/absent
```

```typescript
// convex/agentRuns.ts — completed internalMutation args
retryCount: v.optional(v.number()),
```

Semantics: the count of genuine LLM regenerate-retries `acomplete()` performed for
that node in that run — specifically the one-shot invoke-error retry and the
one-shot schema-miss regenerate already present in
`lib/openrouter_client.py::acomplete()` (~L196-212). Legacy rows (written before
this field existed) and non-retrying nodes read `0`/absent. **No new node-retry
mechanism is introduced** — this surfaces a retry signal that already occurs inside
`acomplete()` today but is currently discarded before it reaches `agent_runs`
(Research Pitfall 1). `wrap_agent_node`'s own exception→`agentRuns:failed`→re-raise
path is unchanged; `retryCount` never reflects a full node-level retry, only the
in-flight LLM-call regenerate that `acomplete()` already silently performs.

### §37.2 — editor-decision payload gains `confidence` + `runnerUpNotes` (amends the inline `editor-decision` example above)

The `deliberationEvents:insert` `editor-decision` payload (the inline example
earlier in this document, and `agents/editor.py::_editor_decision_payload`) becomes:

```python
await convex_mutation('deliberationEvents:insert', {
    'runId': run_id,
    'agentId': 'editor',
    'eventType': 'editor-decision',
    'payload': json.dumps({
        'winner': state['winning_charity']['name'],
        'rationale': state['editor_decision'],
        'confidence': state['editor_confidence'],   # NEW Phase 37 §37.2
        'runnerUpNotes': state['runner_up_notes'],  # NEW Phase 37 §37.2 — already in state, zero new plumbing
    }),
})
```

`confidence` is the float `EditorDecision.confidence` (0.0-1.0) that `editor_gate_1`
already computes to decide whether to interrupt, but today discards — never added to
`state`, never returned, never emitted (Research Pitfall 2). `DispatchState` (§7)
gains a plain sequential field:

```python
editor_confidence: Optional[float]   # NEW Phase 37 §37.2 — EditorDecision.confidence, persisted (was computed then discarded)
```

placed immediately after `runner_up_notes: Optional[str]`. No `Annotated` reducer is
needed — `editor_gate_1` runs once, sequentially, not in the parallel phase-2
fan-out. The `deliberationEvents.eventType` union is UNCHANGED (still `'editor-decision'`
— this only adds keys to that event's `payload` JSON).

### §37.3 — `POST /issues/{run_id}/adjudicate` (Clerk-guarded adjudication bridge)

```
POST /issues/{run_id}/adjudicate
Authorization: Bearer <Clerk JWT>   # _require_clerk_jwt_control — NOT the trigger secret
Body: { "selection": { "charityName": str }, "reason": str }
```

Behavior, in order:
1. 409 unless the run is paused at Gate 1 (§37.4(c) below is the exact predicate).
2. `_emit_audit` the operator's pick + `reason` ("nothing silent" — every dashboard
   write is audit-logged like every other v3.0 mutation). The `reason` is stored via
   `audit_log` (`action`/`before`/`after` free-form strings) ONLY — it is NEVER
   threaded into `Command(resume=...)` or into any `deliberationEvents` payload,
   because the `deliberationEvents.eventType` union is FROZEN (no new literal may be
   added for it).
3. Invoke the existing resume machinery server-side with the chosen `charityName` —
   the same `Command(resume={"editorSelection": charityName})` path
   `POST /run/{run_id}/resume` already uses (`api/runs.py::resume_run`). The
   dashboard/operator NEVER handles the `_require_trigger_secret` value; this bridge
   is the only path from a Clerk-authenticated browser session to a resume.

Returns `{ "runId": run_id, "charityName": <selection.charityName> }`.

### §37.4 — Read-model notes (no new tables/queries)

(a) **Drift strip (MON-04)**: aggregates `pipelineRuns:byRunId(runId).cost` /
`.durationMs` per trailing run (trailing 8, plus the current run). `runs.cost` /
`runs.durationMs` are declared-but-never-written dead fields on the `runs` table —
**do not read them** for drift (Research Pitfall 5); `pipelineRuns`'s mirror of
those two fields is reliably populated by the Publisher and by the failure/cancel
paths.

(b) **Candidate slate (SIG-01)** is a client-side JOIN, not a single-table read:
`pitchLog:byRunId` (name/location/website/assetRange/focusArea/scoutSummary) joined
with `deliberationEvents:byRunIdAndType(runId, 'advocate-argument')` (payload JSON
`{charityName, score, argument, keyStrengths, primaryConcern}`, row keyed by
`charityId`) on `charityId` (fallback to `charityName`). Advocate data is NOT in
`pitchLog` (Research Pitfall 3). `primaryConcern` is rendered always-visible, never
truncated.

(c) **Gate-1-paused detection (SIG-03)**: `status === 'awaiting-review' && completedAt
== null` on `pipelineRuns`. Both the Gate-1 interrupt write (`editor.py`) and the
finished-pipeline review-gate write (`publisher/__init__.py`) use the identical
`status: 'awaiting-review'` literal, but only the Publisher's write ever sets
`completedAt` (Research Pitfall 4) — this is the reliable disambiguator between
"paused at Gate 1, needs adjudication" and "finished, awaiting Review Desk decision."

*All Phase 37 changes are: additive to `convex/schema.ts`/`convex/agentRuns.ts` (one
new optional field, `retryCount`); additive to `DispatchState` and the
`editor-decision` payload JSON (`editor_confidence`, `confidence`, `runnerUpNotes` —
no eventType change); one new Clerk-guarded endpoint
(`POST /issues/{run_id}/adjudicate`); and read-model conventions for two screens that
introduce zero new tables/queries. No field is renamed; Phase 26/31/32/33/34/35/36
shapes are otherwise unchanged.*

---

## Error handling rules

All contract boundaries must follow these rules:

**Sanity writes:** Wrap every `client.create_or_replace()` and `client.patch().commit()` in try/except. On failure, log the error, set `state['error']`, and update Convex `pipelineRuns` status to `'failed'`.

**Convex mutations:** Failures are non-blocking for the pipeline. Log the error but do not halt the pipeline. The deliberation layer being incomplete is acceptable — the content is what matters.

**GROQ queries:** All queries return `null` when nothing is found. Components must handle `null` gracefully — no query should throw on an empty result.

**Stripe webhook:** Always return `200` to Stripe even if processing fails internally. Log failures for manual review. Never return `4xx` or `5xx` to Stripe webhook calls (Stripe will retry aggressively).

**Sanity webhook:** Return `200` immediately. Run the Publisher async. Never make Sanity wait for the Publisher to complete.
