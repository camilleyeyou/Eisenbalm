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

#### 4A.2c — Phase 50 (WBN-04, D-13) `originRef` — "why this draft exists"

`prompt_versions` gains ONE ADDITIVE, OPTIONAL field. No existing field is
renamed or removed, no index changes, and every existing row (and every row
saved without it going forward) remains valid — `originRef` is simply absent:

```typescript
prompt_versions: defineTable({
  // ...unchanged fields (§4A.2)...
  originRef: v.optional(v.object({
    runId: v.string(),        // the run whose output motivated this draft
    sectionName: v.string(),  // the drafted section (e.g. "founderBio")
    excerpt: v.string(),      // a short, real (verbatim) excerpt of that output
    issueNumber: v.optional(v.number()),
  })),
})
```

Captured from the inspector's "Improve this agent →" deep link
(`InspectorFooter.tsx`, §44.7): the link now carries `fromRun` / `section` /
`excerpt` query params into `/prompt-lab/[agentKey]`. When a NEW version is
saved during that deep-linked session, the assembled `originRef` object is
passed to `saveVersion` and persisted on the inserted row. This is a STORED
back-reference, not an inference engine — Agent Instructions
(`AgentPromptEditorView.tsx`) renders it as "why this draft exists", linking
back to the run whose output motivated the draft. It does not affect
active-version resolution (`getActive`/`activate`), the eval-gate, or any
other existing versioning behavior.

`saveVersion`'s signature (§4A.2a) gains one additional optional arg:

```typescript
saveVersion(workspace_id: string, agentKey: string, content: string,
            createdBy?: string, note?: string,
            originRef?: { runId: string; sectionName: string; excerpt: string;
                          issueNumber?: number })
            → Id<'prompt_versions'>
//   Persists originRef on the inserted row when supplied. Omitted (the
//   overwhelmingly common case — most saves are NOT deep-linked from the
//   inspector) → the field is simply absent. All other saveVersion behavior
//   (immutable versioning, isActive: false, the 'prompt_version.saved'
//   audit row) is unchanged.
```

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

# ── Phase 47: Brief (Story & Brief stage) ──────────────────────────────────
#
# The Brief is the one genuinely new cross-boundary artifact of Phase 47
# (§47, BRF-05). Convex is the editable source of truth (the `briefs` table,
# §47.1); the pipeline reads/writes it and threads it into DispatchState for
# the 7 section writers. It is deterministically ASSEMBLED inside
# `editor_gate_1` immediately after `winning_charity` resolves — no new
# graph node, no new LLM call (§47.3 documents the exact assembly). The
# console makes it editable afterward; edits refine later revision passes
# ("Match the brief") and seed Phase 48's hand-authored entry point — see
# §47.5 for this tradeoff stated explicitly.
class Brief(TypedDict):
    premise: str                        # the story angle, one or two sentences
    currentPeg: str                     # what makes this current/timely right now
    centralClaim: str                   # the thesis this issue argues
    readerEffect: str                   # what a reader should feel/understand/do
    knownRisks: str                     # brand-risk/repetition/sensitivity notes to keep in mind while drafting
    voiceIntention: str                 # the aesthetic/voice direction for this issue

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

    # ── Phase 46: Signal Editor leads + verify_candidates records (see §46.1-§46.4) ──
    story_leads: Optional[list[StoryLead]]
    verification_records: Optional[list[VerificationRecord]]

    # ── Phase 47: Brief (Story & Brief stage) ───────────────────────────────────
    brief: Optional[Brief]                      # JSON-serializable dict — mirrors the story_leads/
                                                 # verification_records checkpoint-safety precedent.
                                                 # Deterministically assembled inside editor_gate_1
                                                 # right after winning_charity resolves (§47.3); the
                                                 # console's briefs Convex table is the editable
                                                 # source of truth the pipeline reads back (§47.1).
                                                 # Threaded to the 7 section writers via
                                                 # build_section_writer_prompt's new brief= kwarg.

    # ── Phase 48: Brief Entry Point (ENT-01..04, see §48) ───────────────────────
    entry_mode: NotRequired[Optional[Literal['discovery', 'brief']]]
                                                 # Routes the two conditional edges
                                                 # (calibrator->{signal_editor|verify_candidates},
                                                 # verify_candidates->{advocate|researcher}).
                                                 # Absent/None -> 'discovery' via the router fn's
                                                 # `state.get("entry_mode") or "discovery"` default
                                                 # (back-compat with every pre-Phase-48 DispatchState
                                                 # test fixture — NotRequired mirrors the existing
                                                 # `config` field precedent for the identical reason).
    source_material: NotRequired[Optional[str]]
                                                 # D-10: optional free-text (URLs + pasted notes),
                                                 # threaded into the Researcher's user prompt as
                                                 # prioritized seed context. Only ever set on
                                                 # brief-mode runs (via _start_run); None/absent on
                                                 # discovery runs -> the {source_material} template
                                                 # token renders as "" (byte-equivalent prompt,
                                                 # mirrors the existing {corrections} empty-string
                                                 # precedent).

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

> Phase 39 extends the registry with a coverage-memory strip + append-only corrections log — see §39.

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

## §38 — Prompt Lab Evals + Eval Center (Phase 38)

Golden scenarios run single-agent through the EXISTING `test-run`/`score` endpoints
(§3A.1/§3A.2, unchanged); editing a prompt auto-selects and runs the scenarios for
that `agentKey`, scoring draft vs active and showing per-scenario deltas; committing
a prompt version is gated on target-metric-up-with-no-regressions, with a logged
override-with-reason escape hatch; the Eval Center shows scenario cards plus an
append-only scoreboard time-series — the editorial drift detector; and a read-only
shadow run previews Scout's live discovery without touching run state (EVL-01..EVL-05).
This contract is written BEFORE any schema/agent/endpoint code exists (CLAUDE.md
contract-first hard rule, mirroring §31-§37). Plans 38-02..38-0N implement these
shapes verbatim — no field name, endpoint path, or gate predicate may be invented
later.

### §38.1 — `GET /eval/scenarios` (pipeline, `api/eval.py`, prefix `/eval`)

```
GET /eval/scenarios
GET /eval/scenarios?agentKey={agentKey}
Auth: Depends(_require_operator)   # same optional-bearer pattern as api/agents.py
                                    # (dev-mode no-op, prod-mode delegates to Clerk verify)

# Response body
{
  "scenarios": [
    {
      "id": str,                       # stable scenario id, e.g. "scout_normal_week"
      "agentKey": str,                 # the single agentKey this scenario exercises (D-02)
      "description": str,              # human-readable summary for the scenario card
      "whatItCatches": str,            # the failure mode this scenario is designed to surface
      "input": dict[str, str],         # EXACTLY a TestRunRequest.variables map (§3A.1) —
                                        #   NOT a full test-run request body; draft_prompt
                                        #   varies per run (draft vs active) and is never
                                        #   part of the fixture
      "scoringTarget": { "min_overall": float }  # absolute floor for this scenario (0-10)
    }
  ]
}
```

Scenarios are read from versioned repo fixtures (D-01) — the pipeline is the only
reader/writer of scenario definitions; the Eval Center and eval drawer read them
ONLY via this endpoint. No scenario data is duplicated into Convex. The optional
`agentKey` query param filters the returned list to scenarios for that agent
(mirrors the eval drawer's auto-select behavior, D-04).

### §38.2 — `eval_scores` Convex table (append-only, D-09)

```typescript
// convex/schema.ts
eval_scores: defineTable({
  workspace_id: v.string(),
  scenarioId: v.string(),       // matches §38.1 Scenario.id
  agentKey: v.string(),
  promptVersion: v.string(),    // String(prompt_versions.version) — see §38.3 freshness rule
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
```

**Append-only invariant:** rows are inserted, never patched or deleted — the
time-series IS the drift record (D-09/D-10). `convex/evalScores.ts` exports:

- `record` (mutation, `requireOperator` — dashboard-only, mirrors
  `prompt_versions`/`audit_log`; NOT a pipeline-authenticated write; no
  `pipelineSecret` arg): inserts one row per scenario per side (draft or active)
  scored by the eval drawer or the pre-commit gate check.
- `listForScenario` (query, `by_workspace_scenario` index): time-series rows for
  one scenario, ascending by `ranAt` — the drift chart's data source.
- `listForAgent` (query, `by_workspace_agentKey` index): rows for one agent,
  newest-first — the scenario card's "last result" source.

Written directly dashboard → Convex, mirroring how `prompt_versions` already works
(no pipeline round-trip). The EDT-05 write-boundary rule ("dashboard → pipeline API
→ Sanity for every write") governs Sanity *content* writes only — it does not apply
to Convex-native entities like `eval_scores`, exactly as it already does not apply to
`prompt_versions` or `audit_log`.

### §38.3 — `promptVersions.activate` eval-gate + override (EVL-03, extends the existing mutation)

`convex/promptVersions.ts::activate` (the existing `{blocked, reason}` mutation) gains
one new guard clause and one new optional argument — this is NOT a new endpoint:

```typescript
// convex/promptVersions.ts — activate args gain:
override: v.optional(v.object({ reason: v.string() })),
```

**Gate logic** (evaluated after the existing in-progress-run guard, reads
`eval_scores` only):

- **Freshness:** block unless a FRESH `eval_scores` row exists for the target
  version — a row with `promptVersion === String(version)` AND
  `ranAt >= ` the target `prompt_versions` row's `createdAt`.
- **No regression:** block if any scenario's `overall` for the target version is
  worse than the currently-active version's `overall` for that same scenario
  beyond a tolerance (`targetOverall < activeOverall - TOLERANCE`, `TOLERANCE = 0.5`
  on the 0-10 scale — absorbs LLM-judge scoring non-determinism).
- **Aggregate:** block if the aggregate average `overall` across all scenarios for
  the target version is lower than the aggregate average for the active version.
- **First-ever activation** (no currently-active version for this `agentKey`)
  always passes the eval-gate (nothing to regress against).

On failure: `{ blocked: true, reason: str }` (same shape as the existing
in-progress-run guard) — `isActive` is NOT flipped.

**Override:** an `override: { reason: string }` arg bypasses the eval-gate check
ONLY — it NEVER bypasses the in-progress-run guard. When supplied (and the
in-progress-run guard passes), activation proceeds and an additional `audit_log`
row is written with `action: 'prompt_version.activate_override'`,
`resourceType: 'prompt_version'`, `resourceId: '{agentKey}:{version}'`, and
`after: JSON.stringify({ agentKey, version, reason })` — logged alongside (not
instead of) the existing `prompt_version.activated` audit row ("nothing silent").

**Return shape:** `{ blocked: false }` on a normal pass, `{ blocked: false,
overridden: true }` when the override path was used.

### §38.4 — `POST /eval/shadow-run` (pipeline, `api/eval.py`)

```
POST /eval/shadow-run
Auth: Depends(_require_operator)   # same pattern as §38.1

# Request body
{ "workspace_id": str }

# Response body
{
  "candidates": [ /* CharityCandidate shape — same as scout.py's real-run output */ ],
  "featuredKeysCount": int   # size of the registry-dedup featured-keys set consulted
}
```

Runs Scout's PURE `discover_candidates()` helper (extracted from `scout.py` for this
purpose — registry-dedup read → live Tavily search → LLM parse → Python dedup
filter) against LIVE search, previewing what a paid discovery run would surface.

**Isolation contract (D-12, hard requirement):** writes NOTHING. No
`pipelineRuns`, `pitchLog`, `charities` (`upsertCandidate`), `agent_runs`, or
`deliberationEvents` Convex rows; no Sanity `write_charity`. This is a read-only
preview — the isolation test for this endpoint MUST assert absence of both the
Convex mutation prefixes AND any Sanity `write_charity` call (the latter is a gap
the existing `test-run`/`score` isolation tests do not need to cover, since neither
of those endpoints ever calls Scout).

*All Phase 38 changes are additive: one new pipeline router (`api/eval.py`, two
endpoints); one new Convex table (`eval_scores`) + `convex/evalScores.ts`; one new
optional arg (`override`) + one new guard clause on the existing
`promptVersions.activate` mutation. No existing field is renamed or removed; Phase
26/31/32/33/34/35/36/37 shapes are unchanged.*

---

## §39 — Registry Coverage-Memory Strip (Phase 39)

The operator can see thematic repetition across recent issues at a glance (a
coverage-memory strip of the last 8 featured charities' cause/geo/signal chips,
MEM-01) and keep a durable, append-only record of corrections to a charity that
the Researcher actually re-reads on any future mention of that charity (MEM-02/
MEM-03). This contract is written BEFORE any schema/agent/endpoint code exists
(CLAUDE.md contract-first hard rule, mirroring §31-§38). Plan 39-01 implements
these shapes verbatim — no field name, endpoint path, or match-key scheme may be
invented later.

### §39.1 — `charity_corrections` Convex table (NEW, append-only)

```typescript
// convex/schema.ts
charity_corrections: defineTable({
  workspace_id: v.string(),
  charityKey: v.string(),                  // registry dedupKey (§26.1 format) — PRIMARY match key
  sanityCharityId: v.optional(v.string()), // denormalized display/fallback convenience
  text: v.string(),                        // the correction itself
  author: v.string(),                      // Clerk actorId from requireOperator(ctx) — NEVER client-supplied
  createdAt: v.number(),
})
  .index('by_workspace_charityKey', ['workspace_id', 'charityKey'])
  .index('by_workspace', ['workspace_id']),
```

`charityKey` uses the SAME dedupKey format as `charities.dedupKey`
(`{name.trim().toLowerCase()}|{domain}`, §26.1) — not a new key scheme.

**APPEND-ONLY invariant:** rows are inserted, never patched or deleted — the log
IS the durable record (mirrors `audit_log`/`eval_scores`, §38.2). No
`update`/`patch`/`remove`/`delete` function is ever defined against this table.

### §39.2 — `convex/charityCorrections.ts` functions (NEW)

```typescript
// Mutation — dashboard-only (requireOperator, matches promptVersions.saveVersion,
// NOT a pipeline endpoint, NOT pipelineSecret-guarded):
append({ workspace_id, charityKey, sanityCharityId?, text }): Promise<Id<'charity_corrections'>>
  // const actor = await requireOperator(ctx)
  // const id = await ctx.db.insert('charity_corrections', {
  //   workspace_id, charityKey, sanityCharityId, text, author: actor, createdAt: Date.now(),
  // })
  // await ctx.runMutation(internal.auditLog.write, {
  //   workspace_id, actorId: actor, action: 'charity_correction.added',
  //   resourceType: 'charity_correction', resourceId: charityKey,
  //   after: JSON.stringify({ text }),
  // })
  // return id

// Query — UNGUARDED (matches charities.listForDedup — reads are unguarded, read-only):
listByCharityKey({ workspace_id, charityKey }): Promise<Doc<'charity_corrections'>[]>
  // by_workspace_charityKey index, sorted createdAt ASC (chronological — oldest first)
```

`charityKey` is ALWAYS supplied by the caller (already-loaded from a `charities`
doc's `dedupKey`) — `append` never re-derives a dedup key from a raw name/website
pair. `append` is guarded + audited exactly like `promptVersions.saveVersion`
(NOT like `charities.setStatus`, which currently has no audit-log call — that is
an existing Phase 26 gap, out of scope to fix, and must not be replicated here).

**NO update/patch/remove/delete function is defined against `charity_corrections`**
— append-only enforcement (D-05, Pitfall 3). A source-scan tripwire test asserts
this invariant holds.

### §39.3 — `charities:listRecentFeatured` query (NEW, extends `convex/charities.ts`)

```typescript
listRecentFeatured({ workspace_id, limit? }): Promise<Doc<'charities'>[]>
  // Uses the EXISTING by_workspace_status index (status: 'featured');
  // sorted by lastFeaturedAt desc; take(limit ?? 8). Unguarded (read-only).
```

Returns at most 8 (or `limit`, if supplied) featured charities, most-recently-
featured first. Matches the `listByWorkspace`/`listForDedup` convention — no
`requireOperator`/`requirePipelineSecret` guard.

### §39.4 — `GET /registry/coverage-strip` (pipeline, FastAPI, read-only, no audit row)

```
GET /registry/coverage-strip
Auth: Depends(_require_clerk_jwt_control)   # same guard as GET /issues/{run_id}/draft

Action:
  1. rows = await convex_query(http, "charities:listRecentFeatured", {"workspace_id": WORKSPACE_ID, "limit": 8})
  2. ids = [r["sanityCharityId"] for r in rows if r.get("sanityCharityId")]
  3. sanity_rows = await groq_query('*[_type=="charity" && _id in $ids]{_id, focusArea, location, scoutNotes}', params={"ids": ids})
  4. zip sanity_rows back onto `rows` by _id == sanityCharityId, preserving lastFeaturedAt-desc order;
     rows missing sanityCharityId (legacy/backfilled charities) render with empty
     chips — never crash the whole request (Pitfall 6)

Response:
[
  { "name": str, "sanityCharityId": str | null, "lastFeaturedAt": int | null,
    "cause": str | null,   # Sanity charity.focusArea
    "geo": str | null,     # Sanity charity.location
    "signal": str | null   # Sanity charity.scoutNotes (truncated for chip display) }
]  // 8 or fewer rows
```

The server performs the Convex→Sanity join. dispatch-control has ZERO Sanity
access (EDT-05, enforced by the standing `dispatch-control-no-sanity-write.test.ts`
tripwire) — this join CANNOT happen client-side. `signal` is sourced from the
ALREADY-PERSISTED Sanity `charity.scoutNotes` field (populated from the Scout's
`scoutSummary` at candidate-write time) — no new write path, no fabricated
taxonomy (D-03).

### §39.5 — Researcher corrections read (D-08/D-09/D-10)

The Researcher (Phase 2, per the winning charity — NOT the Scout) computes the
dedupKey via the ALREADY-EXISTING `eisenbalm_pipeline.lib.charity_registry.make_dedup_key(name, website)`
helper (do not reimplement domain-stripping/case-folding a fourth time), calls
`charityCorrections:listByCharityKey` with that key, and injects the returned
corrections text into its prompt context before building research queries/messages.
It logs a line recording the count and whether corrections were injected — the
concrete mechanism that makes MEM-03 ("verifiable in pipeline output/logs for a
repeat-charity run") demonstrable rather than merely stored.

*All Phase 39 changes are additive: one new Convex table (`charity_corrections`) +
`convex/charityCorrections.ts` (append + listByCharityKey only); one new query
(`charities:listRecentFeatured`) on the existing `charities` table; one new
pipeline GET endpoint (`/registry/coverage-strip`); one new read-and-inject step
in `researcher.py`. No existing field is renamed or removed; Phase
26/31/32/33/34/35/36/37/38 shapes are unchanged.*

---

## Error handling rules

All contract boundaries must follow these rules:

**Sanity writes:** Wrap every `client.create_or_replace()` and `client.patch().commit()` in try/except. On failure, log the error, set `state['error']`, and update Convex `pipelineRuns` status to `'failed'`.

**Convex mutations:** Failures are non-blocking for the pipeline. Log the error but do not halt the pipeline. The deliberation layer being incomplete is acceptable — the content is what matters.

**GROQ queries:** All queries return `null` when nothing is found. Components must handle `null` gracefully — no query should throw on an empty result.

**Stripe webhook:** Always return `200` to Stripe even if processing fails internally. Log failures for manual review. Never return `4xx` or `5xx` to Stripe webhook calls (Stripe will retry aggressively).

**Sanity webhook:** Return `200` immediately. Run the Publisher async. Never make Sanity wait for the Publisher to complete.

---

## §40 — Issue Entity & Issues Home (Phase 40)

The console stops being run-keyed and becomes **issue-keyed**: a first-class Convex
`issues` table exists *before* any run does, hold/reopen state and derived issue/stage
status are computed rather than stored ad hoc, and the operator console's route tree
moves from `/review-desk/[runId]`-shaped URLs to `/issues/[issueNumber]`-shaped ones
(ISS-01..ISS-06). This contract is written BEFORE any schema/module/endpoint code
exists (CLAUDE.md contract-first hard rule, mirroring §31-§39). Plans 40-02..40-09
implement these shapes verbatim — no field name, endpoint path, function signature, or
state literal may be invented later.

**Naming note:** two unrelated things share the string `/issues/`.

1. The FastAPI **pipeline** already exposes 18 endpoints shaped `/issues/{run_id}/...`
   (`content.py`, `review.py`, `findings.py`, `signoffs.py`, `voice_pass.py`,
   `control.py`). There, `{run_id}` is a **runId**. These are OUT OF SCOPE for this
   phase and are not renamed.
2. This phase creates a **console** (Next.js dashboard) route tree at
   `/issues/[issueNumber]`, keyed by **issueNumber**.

Different hosts, different frameworks, opposite path-param meanings. They collide in
**name only** — every time this contract (or downstream code/comments) writes
"/issues/...", it says which one it means.

### §40.1 — `issues` Convex table (NEW)

```typescript
// convex/schema.ts
issues: defineTable({
  workspace_id: v.string(),
  issueNumber: v.number(),                 // NATURAL KEY (D-02). Unique per workspace — enforced by a
                                           // query-then-insert guard inside ensureByNumber, NOT the
                                           // schema (Convex has no unique constraint; same pattern as
                                           // runs:create's existing-row check, convex/runs.ts:37-41).
  scheduledFor: v.optional(v.number()),    // Unix ms — the slot this issue is reserved for (D-11)
  held: v.boolean(),                       // D-18: one of only TWO stored status inputs
  heldReason: v.optional(v.string()),      // required-when-holding, enforced at the MUTATION (D-16)
  heldBy: v.optional(v.string()),          // Clerk sub from requireOperator(ctx) — NEVER client-supplied
  heldAt: v.optional(v.number()),
  published: v.boolean(),                  // D-18: the other stored status input
  publishedAt: v.optional(v.number()),
  sanityIssueId: v.optional(v.string()),
  lastVisitedStage: v.optional(v.string()),// Phase 41 writes this; Phase 40 only declares it
  createdAt: v.number(),
})
  .index('by_workspace', ['workspace_id'])
  .index('by_workspace_issueNumber', ['workspace_id', 'issueNumber']),
```

**Stored-vs-derived invariant (D-18, load-bearing):** `held` and `published` are the ONLY status
inputs ever persisted. Issue status is recomputed from them plus live `sign_offs` on every read
(§40.6). There is no `status` column and there must never be one — a persisted status is exactly the
silently-stale "ready" ISS-06 forbids.

### §40.2 — `convex/issues.ts` functions (NEW)

```typescript
// ── Queries (PUBLIC, unguarded reads — same convention as claimChecks:allSignedOff) ──
byIssueNumber({ workspace_id, issueNumber }): Promise<Doc<'issues'> | null>
listForWorkspace({ workspace_id }): Promise<Doc<'issues'>[]>   // issueNumber DESC

// ── Mutations ──
ensureByNumber({ workspace_id, issueNumber, scheduledFor?, pipelineSecret? })
  : Promise<{ issueNumber: number; created: boolean }>
  // DUAL LANE — requireOperatorOrPipeline(ctx, pipelineSecret). Console-created (D-03) AND
  // pipeline-defensive (D-04) both call this.
  // IDEMPOTENT insert-if-absent. On an existing row it is a strict NO-OP: it MUST NOT patch
  // `held`, `heldReason`, `heldBy`, `heldAt`, or `published`. D-04's guard — a stray run
  // (POST /run/weekly with an empty body, a curl, a future cron) can never silently resurrect a
  // Held issue. Returns { created: false } on the no-op path.
  // On insert: { workspace_id, issueNumber, scheduledFor, held: false, published: false,
  //              createdAt: Date.now() }.

hold({ workspace_id, issueNumber, reason }): Promise<null>
  // requireOperator(ctx) → actor. THROWS new Error('A reason is required to hold this issue.')
  // when reason.trim() === '' (D-16 — required free text, no preset taxonomy).
  // THROWS new Error('Issue not found') when no row exists.
  // Patches { held: true, heldReason: reason.trim(), heldBy: actor, heldAt: Date.now() }.
  // Then ctx.runMutation(internal.auditLog.write, {
  //   workspace_id, actorId: actor, action: 'issue.held', resourceType: 'issue',
  //   resourceId: String(issueNumber),
  //   before: JSON.stringify({ held: false }),
  //   after:  JSON.stringify({ held: true, heldReason: reason.trim() }),
  // })
  // NOTE: hold does NOT touch runs.cancelRequested. D-14's "also stop the run in progress"
  // checkbox is a SEPARATE client-side call to the existing runs:requestCancel mutation — the two
  // state systems stay distinct in the model.

reopen({ workspace_id, issueNumber }): Promise<null>
  // requireOperator(ctx) → actor. Patches
  // { held: false, heldReason: undefined, heldBy: undefined, heldAt: undefined }.
  // Status re-derives on its own (D-17) — no "restore previous status" bookkeeping.
  // audit_log action: 'issue.reopened' (same envelope as hold).

markPublished({ workspace_id, issueNumber, sanityIssueId?, publishedAt?, pipelineSecret? }): Promise<null>
  // DUAL LANE — requireOperatorOrPipeline(ctx, pipelineSecret). Used by the D-05 backfill script
  // and (later) the publisher. Patches { published: true, publishedAt: publishedAt ?? Date.now(),
  // sanityIssueId }. Idempotent.
```

**No `tasks` table, no `status` column, no `stage` column.** All three are derived (§40.6,
`DERIVED-STATE-CONTRACT.md` §2/§3).

### §40.3 — `convex/pipelineRuns.ts` issue-keyed queries (NEW)

```typescript
// Both PUBLIC/unguarded, matching the existing pipelineRuns:byRunId convention.
// Both use the ALREADY-DECLARED `by_issueNumber` index (convex/schema.ts:25) — no schema change.

byIssueNumber({ issueNumber }): Promise<Doc<'pipelineRuns'> | null>
  // The MOST RECENT run for that issue (startedAt DESC, first). This is the runId the issue-keyed
  // console routes /issues/[n]/review and /issues/[n]/voice resolve to.

listByIssueNumber({ issueNumber }): Promise<Doc<'pipelineRuns'>[]>
  // ALL runs for that issue, startedAt DESC — the run history the issue overview links into at the
  // console route /issues/[n]/runs/[runId] (D-08).
```

### §40.4 — `GET /registry/repetition-note` (pipeline, FastAPI, read-only, no audit row)

New endpoint in `packages/pipeline/src/eisenbalm_pipeline/api/registry.py`, alongside the existing
`GET /registry/coverage-strip`. Same auth guard (`_require_clerk_jwt_control`), same Convex+Sanity
join, read-only, no audit row.

**Why an endpoint and not a client-side derivation:** the cause/geo chips live in Sanity, and
dispatch-control has ZERO Sanity access (EDT-05, tripwire-enforced by
`apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts`).

**No LLM call, no run required (D-10).** The note must render BEFORE a run exists. It is the
Calibrator's *rule* applied outside a run — today's `agents/calibrator.py` only rotates `bonusType`
and emits no such note; nothing in that agent changes.

Request: `GET /registry/repetition-note` (no params).

Response (200):
```json
{
  "note": "avoid US-SE · avoid weather",
  "avoid": [
    { "dimension": "geo",   "value": "US-SE",   "count": 3 },
    { "dimension": "cause", "value": "weather", "count": 3 }
  ],
  "sampleSize": 8
}
```
`note` is `null` and `avoid` is `[]` when nothing is over-represented.

Algorithm (deterministic — no model call):
1. Read the SAME source `coverage-strip` reads: `convex_query(convex_http, "charities:listRecentFeatured", {workspace_id: "eisenbalm", limit: 8})`, then ONE `groq_query('*[_type=="charity" && _id in $ids]{_id, focusArea, location}', params={"ids": ids})` over the rows that have a `sanityCharityId`.
2. `sampleSize` = number of rows returned by Convex (≤ 8).
3. Count only TWO dimensions: `cause` (Sanity `focusArea`) and `geo` (Sanity `location`). **`signal` (`scoutNotes`) is deliberately EXCLUDED** — it is free prose, not a categorical value.
4. Normalize each value with `value.strip()`, compare case-insensitively, keep the first-seen original casing for display. Skip `None`/empty.
5. `REPETITION_THRESHOLD = 3` (module-level constant). A value is over-represented when its count is `>= REPETITION_THRESHOLD`.
6. Sort over-represented values by `count` DESC, then `dimension` in the fixed order `geo` before `cause`, then `value` ascending. Take at most **2** (the UI-SPEC's "avoid X · avoid Y" shape).
7. `note = " · ".join(f"avoid {value}" for each)`, or `None` when empty.

### §40.5 — `apps/dispatch-control/lib/repetitionNoteClient.ts` (NEW)

Mirrors `lib/coverageStripClient.ts` line-for-line: a private `pipelineBaseUrl()` reading
`NEXT_PUBLIC_PIPELINE_URL`, a `RepetitionNoteError extends Error` carrying `status`, and:

```typescript
export interface RepetitionAvoidItem { dimension: 'geo' | 'cause'; value: string; count: number }
export interface RepetitionNote { note: string | null; avoid: RepetitionAvoidItem[]; sampleSize: number }
export async function fetchRepetitionNote(token: string | null): Promise<RepetitionNote>
```

### §40.6 — `apps/dispatch-control/lib/derivedState.ts` (NEW — pure TS, no Convex import)

Pure functions over the RESULTS of existing Convex queries. Unit-testable in isolation. Consumed by
the header (40-06), the issue card (40-05), the issue overview (40-09), Phase 41's stage tabs, and
Phase 43's My Tasks. Editorial policy (severity weights, stage rules) lives HERE, never in the backend.

```typescript
export type IssueStatus = 'unknown' | 'draft' | 'needs-review' | 'ready' | 'published' | 'held'
export type StageState  = 'not-generated' | 'in-progress' | 'needs-you' | 'clean'
export type TaskSeverity = 'must-fix' | 'review-recommended' | 'information'

export interface StageStateResult { state: StageState; openCount: number }

export interface DerivedTask {            // DERIVED-STATE-CONTRACT §2 shape — NO tasks table
  id: string
  sev: TaskSeverity
  title: string                           // plain language
  where: string                           // section / area affected
  why: string                             // why human judgment is required
  rec?: string                            // the agent's recommendation, when one exists
  primary: { label: string; href: string }
  insp?: string                           // inspector target (Phase 44 consumes; may be omitted)
  stage: 1 | 2 | 3 | 4 | 5
}

// D-22 — tunable in ONE place.
export const SEVERITY_MINUTES: Record<TaskSeverity, number> = {
  'must-fix': 6,
  'review-recommended': 3,
  'information': 1,
}

/**
 * `undefined` means NOT LOADED (or the query failed). `null` means loaded-and-absent.
 * The distinction is load-bearing: it is what makes ISS-06 structural.
 */
export interface DerivationInputs {
  issueNumber: number | null
  runId: string | null
  issue: { held: boolean; published: boolean } | null | undefined
  signOffs: Record<string, { actorId: string; signedAt: number }> | undefined
  claimRows: Array<{ status: string; sourceUrl?: string; sectionName?: string; claimText?: string; _id: string }> | undefined
  qaFindings: Array<{ _id: string; severity: 'info'|'warning'|'error'; axis?: string; sectionName: string; reason: string; suggestedFix?: string; accepted?: boolean; resolution?: 'accepted'|'dismissed'|null }> | undefined
  pitchRows: Array<{ selected: boolean }> | undefined
  runStatus: string | undefined            // runs.latest.status
}

export function deriveIssueStatus(i: DerivationInputs): IssueStatus
export function deriveStageStates(i: DerivationInputs): [StageStateResult, StageStateResult, StageStateResult, StageStateResult, StageStateResult]
export function deriveTasks(i: DerivationInputs): DerivedTask[]
export function estimateWorkMinutes(tasks: DerivedTask[]): number
```

**`deriveIssueStatus` (D-18 + ISS-06) — exact precedence:**
```
if (issue === undefined || signOffs === undefined) return 'unknown'   // NOT LOADED / FAILED — never a stale value
if (issue === null)                                 return 'unknown'   // no issue row => nothing to state
if (issue.published)                                return 'published'
if (issue.held)                                     return 'held'
factDone  = signOffs['facts-cleared'] !== undefined
voiceDone = signOffs['sounds-human']  !== undefined
if (factDone && voiceDone)                          return 'ready'     // == DERIVED-STATE-CONTRACT §1 `ready`, plus D-15's `&& !held` (held returned above)
if (runId === null)                                 return 'draft'
return 'needs-review'
```
A silently stale "ready" is IMPOSSIBLE: `ready` is recomputed from `sign_offs` on every read, and an
unloaded/failed input yields `'unknown'`, which the UI renders as "State unknown — refresh".

**`deriveStageStates` (D-19 — ARTIFACT-derived, never pipeline-node-derived). Exactly 5 entries:**

| # | Stage | Rule (evaluated top-down; first match wins) |
|---|-------|---------------------------------------------|
| 1 | Story | `runId === null` → not-generated/0 · `pitchRows === undefined` → in-progress/0 · `pitchRows.some(p => p.selected)` → clean/0 · `pitchRows.length > 0` → needs-you/1 (Gate 1 unresolved) · else in-progress/0 |
| 2 | Draft | `runId === null` → not-generated/0 · `qaFindings === undefined \|\| claimRows === undefined` → in-progress/0 · `qaFindings.length === 0 && claimRows.length === 0` → (`runStatus === 'running'` ? in-progress/0 : not-generated/0) · else N = open findings whose axis is NOT in VOICE_AXES (undefined axis counts as factual, per axisPartition.ts's own rule) → N > 0 ? needs-you/N : clean/0 |
| 3 | Fact Check | `runId === null` → not-generated/0 · `claimRows === undefined` → in-progress/0 · `claimRows.length === 0` → not-generated/0 · U = rows with `status === 'pending'` → U > 0 ? needs-you/U : clean/0 |
| 4 | Voice | `runId === null` → not-generated/0 · `qaFindings === undefined \|\| signOffs === undefined` → in-progress/0 · V = open findings whose axis IS in VOICE_AXES → V > 0 ? needs-you/V : (`signOffs['sounds-human']` ? clean/0 : (`runStatus === 'running'` ? in-progress/0 : needs-you/1)) |
| 5 | Approval | `issue?.published` → clean/0 · `runId === null` → not-generated/0 · `signOffs === undefined` → in-progress/0 · factDone && voiceDone → needs-you/1 · else in-progress/0 |

**"Open" finding = `isOpenFinding(row)` from `lib/galley/findingState.ts` — the ONE shared predicate. Do not re-derive it inline.**

**A completed run with zero checked claims MUST show Fact Check as `needs-you`, never `clean` (D-19's explicit warning).** Stage 3 reads `claim_checks` rows only; it never reads `runStatus`.

**`deriveTasks` (D-21 — the REAL projection Phase 43 renders as a screen):**
- one task per open `qaFindings` row: `sev` = `error → 'must-fix'`, `warning → 'review-recommended'`, `info → 'information'`; `stage` = 4 when `axis ∈ VOICE_AXES` else 2; `where` = `sectionName`; `why` = `reason`; `rec` = `suggestedFix`; `primary.href` = `issueVoiceHref(n)` for stage 4 else `issueReviewHref(n)`.
- one task per `claimRows` row with `status === 'pending'`: `sev` = `'must-fix'` when `sourceUrl` is absent (an unsourced claim blocks) else `'review-recommended'`; `stage` = 3; `title` = `Check claim: {claimText truncated to 60 chars}`; `primary.href` = `issueReviewHref(n)`.
- one task when `runId !== null && runStatus !== 'running' && !signOffs['facts-cleared']`: `sev:'must-fix'`, `stage:5`, `title:'Clear the facts'`.
- one task when `runId !== null && runStatus !== 'running' && !signOffs['sounds-human']`: `sev:'must-fix'`, `stage:5`, `title:'Approve the voice'`.
- returns `[]` when `runId === null`. Sorted `must-fix` → `review-recommended` → `information`, then by `stage` ascending.
- **`deriveTasks(...).length` IS the header's My Tasks count and IS the card's open-task count.** A count-only shim is forbidden (a header saying 3 next to a list of 2).

**`estimateWorkMinutes`** = `tasks.reduce((sum, t) => sum + SEVERITY_MINUTES[t.sev], 0)`. Rendered `~{n} min` (ISS-01). `0` renders as `~0 min`, never blank.

### §40.7 — `apps/dispatch-control/lib/issueRouteResolver.ts` (NEW — pure TS)

```typescript
export function parseIssueNumber(param: string): number | null
  // Strict: /^[0-9]+$/ AND > 0. Rejects '', '-1', '1.5', '07x', 'abc', ' 7 '. Leading zeros ARE
  // accepted ('07' → 7) since Sanity's slug is issue-{n} and operators say "Issue 07".
export function issueHref(issueNumber: number): string        // `/issues/${n}`
export function issueReviewHref(issueNumber: number): string  // `/issues/${n}/review`
export function issueVoiceHref(issueNumber: number): string   // `/issues/${n}/voice`
export function issueRunHref(issueNumber: number, runId: string): string
                                                              // `/issues/${n}/runs/${encodeURIComponent(runId)}`
export function legacyRedirectTarget(surface: 'review' | 'voice', issueNumber: number | null | undefined): string
  // issueNumber resolved  → issueReviewHref(n) / issueVoiceHref(n)
  // issueNumber null/undefined (run has no issue row / unknown runId) → '/issues'
  // NEVER returns a run-keyed URL — that would redirect-loop.
```

### §40.8 — Console route tree (NEW — Next.js dashboard, issue-keyed)

| Console route | Purpose | Notes |
|---|---|---|
| `/issues` | Issues home (ISS-01/03/04/06) | new nav destination |
| `/issues/[issueNumber]` | Issue overview (D-09) | **Phase 41 replaces its CONTENTS at this same URL** — the URL never moves |
| `/issues/[issueNumber]/review` | thin issue→run translation around the already-shipped Review Desk screen (D-07) | internals NOT rewritten |
| `/issues/[issueNumber]/voice` | thin issue→run translation around the already-shipped Voice Pass screen (D-07) | internals NOT rewritten |
| `/issues/[issueNumber]/runs/[runId]` | a run as a HISTORICAL RECORD under its issue (D-08) | ISS-02 |

Legacy run-keyed console URLs redirect (dynamic — a Convex lookup maps `runId → issueNumber`, so this
can NEVER be a `next.config` rewrite):

| Old console URL | Redirects to |
|---|---|
| `/review-desk/[runId]` | `/issues/{n}/review` (or `/issues` when unresolvable) |
| `/voice-pass/[runId]` | `/issues/{n}/voice` (or `/issues` when unresolvable) |
| `/review-desk` | `/issues` |
| `/voice-pass` | `/issues` |
| `/` (dashboard index) | `/issues` |

`/run-monitor/**` and `/signal-desk` are UNCHANGED and remain functional. Run Monitor survives as a
nav item under **System Workbench** (D-08) — ISS-02's "never a top-level nav destination" means a run
stops being the *editorial* object, not that it becomes unreachable.

### §40.9 — `NAV_GROUPS` restructure (`apps/dispatch-control/lib/nav.ts`)

```typescript
Editorial        → Issues (/issues)                                      // My Tasks joins in Phase 43; Workspace in Phase 41
System Workbench → Run Monitor (/run-monitor) · Prompt Lab (/prompt-lab)
                   · Eval Center (/eval-center) · Registry (/registry)
Operations       → Config (/config) · Finance (/finance) · Settings (/settings)
```
`Review Desk`, `Signal Desk`, and `Voice Pass` LEAVE the nav — they are issue sub-routes now. Their
labels are unchanged elsewhere; the nomenclature pass (Run Monitor → Run Details, Registry →
Editorial Memory) is Phase 50.

*All Phase 40 changes are additive: one new Convex table (`issues`) + `convex/issues.ts`; two new
queries on the existing `pipelineRuns` table (using its already-declared `by_issueNumber` index); one
new pipeline GET endpoint (`/registry/repetition-note`) + its dashboard client; two new pure-TS
selector modules (`derivedState.ts`, `issueRouteResolver.ts`); a new issue-keyed route tree plus
dynamic redirects from the old run-keyed routes; and a `NAV_GROUPS` restructure. No existing field is
renamed or removed; Phase 21-39 shapes are unchanged.*

---

## §42 — Fact Check Stage (Phase 42)

Stage 3 (Fact Check) replaces the Phase 41 first-class placeholder with the real
claim-verification workspace: an affirmative summary, a filterable claim table, a claim-detail
provenance card reused across Draft/Approval/the inspector, and six claim actions — including
**Ask agent for better evidence**, which establishes the shared span-scoped agent-revision
contract (claim-scoped first; Phase 45 generalizes the SAME endpoint). This contract is written
BEFORE any schema/endpoint/UI code exists (CLAUDE.md contract-first hard rule, mirroring
§31/§32/§34/§35/§36). Plan 42-01 onward implements these shapes verbatim — no field name,
endpoint path, or row shape may be invented later.

### §42.1 — `claim_checks` additive fields (amends §26.2/§35.4 in place)

`claim_checks` (§26.2, amended §35.4) gains three additive optional fields:

```typescript
claim_checks: defineTable({
  // ── existing (Phase 26/33/35, unchanged) ──
  workspace_id: v.string(),
  runId: v.string(),
  claimIndex: v.number(),
  text: v.string(),
  claimType: v.string(),
  context: v.string(),
  status: v.string(),
  checkedAt: v.optional(v.number()),
  claimId: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  retrievedAt: v.optional(v.number()),
  sectionName: v.optional(v.string()),
  blockIndexHint: v.optional(v.number()),
  // ── NEW additive (Phase 42) ──
  importance: v.optional(v.union(
    v.literal('Load-bearing'), v.literal('Supporting'), v.literal('Incidental'),
  )),
  changedSinceCheck: v.optional(v.boolean()),
  conflict: v.optional(v.boolean()),
})
  .index('by_runId', ['runId'])
  .index('by_workspace', ['workspace_id'])
```

**Invariant:** `importance` absent => treated as `'Supporting'` for `mustFix` purposes (D-03) —
NEVER rendered blank in the UI (D-08). Legacy rows (pre-Phase-42 runs) degrade honestly to
`'Supporting'` with zero migration, mirroring the §35.4 legacy-degrade precedent exactly.

### §42.2 — Researcher `ClaimOutput` gains `importance` (D-01/D-02)

```python
class ClaimOutput(BaseModel):
    text: str = ""
    sourceIndex: int | None = None
    importance: Literal['Load-bearing', 'Supporting', 'Incidental'] = 'Supporting'  # NEW
```

The mapped claim (`state["research"]["claims"][i]`, §35.2) gains `importance` alongside
`claimId`/`sourceUrl`/`retrievedAt`. The publisher's sourced-row construction (the
`research_claims[claimId]` lookup, §35.5) carries `importance` through exactly like
`sourceUrl`/`retrievedAt` today. Unsourced (regex catch-all, §35.3 exempt outputs included) rows
default `importance = 'Supporting'` (D-03) — never silently `'Load-bearing'`, so a deterministic
unsourced claim never fabricates a must-fix.

### §42.3 — `claimChecks.ts` new/changed functions (amends §26.6/§35.5 in place)

```typescript
insertBatch: claims[] objects gain `importance: v.optional(v.union(v.literal('Load-bearing'), v.literal('Supporting'), v.literal('Incidental')))`
  // pass-through only when present, mirrors §35.5 exactly — never persists a null

byRunIdAndIndex({ runId, claimIndex }): Promise<Doc<'claim_checks'> | null>
  // NEW, public read (no guard) — resolves via the by_runId index + claimIndex filter

updateClaim({ runId, claimIndex, text?, sourceUrl?, retrievedAt?, pipelineSecret }): Promise<void>
  // NEW, requirePipelineSecret — patches only the provided fields, stamps updatedAt

markChanged({ runId, claimIndex, pipelineSecret }): Promise<void>
  // NEW, requirePipelineSecret — sets status:'pending', changedSinceCheck:true (D-20)

keepAsWritten({ runId, claimIndex, status?, pipelineSecret }): Promise<void>
  // NEW, requirePipelineSecret — sets status (default 'checked'), changedSinceCheck:undefined,
  // stamps checkedAt. Reuses `status:'checked'` (D-08's locked 5-value chip vocabulary has no
  // separate "Kept" state) — the mandatory reason + audit_log row is the entire distinguishing
  // record between Confirm and Keep-as-written, not a new stored status literal.

remove({ runId, claimIndex, pipelineSecret }): Promise<void>
  // NEW, requirePipelineSecret — sets status:'removed' (soft-delete). A removed row satisfies
  // allSignedOff's `status !== 'pending'` gate with zero code change to that function.

setStatus: UNCHANGED signature (Confirm keeps calling this directly, requireOperator-guarded) —
  // but now ALSO clears `changedSinceCheck` (sets it undefined) whenever the new status is
  // 'checked' or 'skipped' (D-20: cleared when the claim is next checked).
```

All five new functions resolve the target row via the `by_runId` index + `claimIndex` filter
(mirroring `byRunIdAndIndex`'s own lookup) and throw if the row is not found — matching
`setStatus`'s existing "Claim not found" error shape.

### §42.4 — New pipeline endpoints (`api/factcheck.py`, mounted in `api/main.py`)

A new router, structured like `api/findings.py`/`api/voice_pass.py` rather than appended to the
already-811-line `api/content.py`:

```
POST   /issues/{run_id}/claims/{claim_index}/keep             body {reason: string}
PATCH  /issues/{run_id}/claims/{claim_index}                  body {ifRevisionID?, text?, sourceUrl?, retrievedAt?}
POST   /issues/{run_id}/claims/{claim_index}/replace-source   body {sourceUrl: string, retrievedAt?: number}
DELETE /issues/{run_id}/claims/{claim_index}                  body {reason?: string}
POST   /issues/{run_id}/claims/{claim_index}/evidence/preview body {} -> {sourceUrl, sourcePublisher, retrievedAt, rewrittenClaim}
POST   /issues/{run_id}/claims/{claim_index}/evidence/apply   body {ifRevisionID, sourceUrl, retrievedAt, rewrittenClaim}
```

All routes are Clerk-JWT-guarded (`_require_clerk_jwt_control`, the same dependency used by
`api/content.py`/`api/findings.py`/`api/voice_pass.py`). Write-boundary classification (D-14):

| Route | Content-touching? | Convex effect |
|---|---|---|
| `keep` | No (claim record only) | `keepAsWritten` + reject-empty-reason (mirrors `dismiss_finding`) |
| `PATCH` (claim edit) | Yes, only if `text` present (Sanity prose patch via `resolve_span` + `patch_issue_field`) | `updateClaim` |
| `replace-source` | No (metadata only) | `updateClaim` (sourceUrl + code-stamped retrievedAt) |
| `DELETE` (remove) | No | `remove` |
| `evidence/preview` | No — read-only, mirrors `voice_pass.py::voice_rewrite`; NO mutation, NO audit row | — |
| `evidence/apply` | Yes — atomic Sanity content patch + claim update | `updateClaim` (new sourceUrl/retrievedAt/text, status) |

Content-touching routes (`PATCH` when `text` is present, `evidence/apply`) additionally call
`_reset_touched_claims` (§42.5) then `_revoke_active_signoffs`, then `_emit_audit` — mirroring
`api/content.py`'s `patch_section` shape exactly. Per 42-RESEARCH.md Pitfall 3, when an endpoint
both content-patches a block AND sets a terminal status on the specific claim being acted on,
`_reset_touched_claims` fires FIRST and the endpoint's own explicit terminal-status write on that
claim happens LAST, so the explicit action always wins over the generic block-level reset.

**§42.4a — the FCT-06 request/apply contract.** `evidence/preview` asks the Researcher-lane
evidence agent (reusing `lib/search_client.py::web_search` + `lib/openrouter_client.py::acomplete`,
the same index-selection discipline `researcher.py` already uses — never a raw LLM-emitted URL)
for a replacement source AND a rewritten claim together, returning both for a comparison card —
no mutation, no audit row. `evidence/apply` re-resolves the claim's phrase against CURRENT Sanity
content via `claim_checks.text` + `lib/span_resolver.py::resolve_span` (never `claimSpans`, which
is never forwarded to Sanity per §35.3), then atomically: (1) content-patches the claim's prose in
Sanity through the existing `content.py` machinery, (2) updates the `claim_checks` row's
`sourceUrl`/`retrievedAt`/`text`/`status`, and (3) records a decision-log entry — a truncated
before/after `audit_log` row via `_emit_audit` (D-18; the formal Decision Log component is Phase
43 — this phase writes to the SAME `audit_log` trail, no new store). `ifRevisionID` mismatch
returns 409 exactly like `api/content.py`'s revision guard (§31.4). The request/response shape is
designed to generalize to arbitrary passage revision so Phase 45 extends this SAME endpoint rather
than forking a second one.

### §42.5 — `_reset_touched_claims` hook (amends §31 `patch_section`/`patch_bonus` in place)

`patch_section` (all 4 long-reads) and `patch_bonus` (specAd branch's `blocks` payload only —
bigBudget/jingle `bonus.body` is a plain string, exempt per §35.3 D-06) each gain a call to
`_reset_touched_claims(convex_http, run_id=, section_name=, touched=)` immediately alongside the
existing `_revoke_active_signoffs` call (D-19). For any `claim_checks` row anchored to a touched
block (`sectionName` + `blockIndexHint`), this sets `status = 'pending'` and `changedSinceCheck =
true` — **even when the replacement text is itself sourced** (D-06/D-20: block-level
touched-counter, not re-verification).

Index-drift discipline (42-RESEARCH.md Pitfall 2 — `blockIndexHint` is a hint only, never
authoritative, per §32.1): when the before/after section body arrays are the SAME length, a
positional text diff finds the exact touched block indices; when the lengths DIFFER
(insert/delete happened), positional diffing is unreliable and the WHOLE section is conservatively
treated as touched (every `claim_checks` row for that `sectionName` resets, regardless of
`blockIndexHint`). Over-resetting is safe; under-resetting silently leaves a stale "checked" state
next to changed prose, which is the failure mode this hook exists to prevent.

### §42.6 — Provenance card shape (D-09/D-10)

One shared component (e.g. `apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx`)
renders exactly this shape, consumed by Stage 3 Fact Check, Stage 2 Draft, Stage 5 Approval, and
the Phase 44 inspector — do NOT fork three copies:

```typescript
{ text, importance, status, sourceUrl, sourcePublisher, supportingPassage, retrievedAt, agent, confidence }
```

Field sourcing (only `importance` is genuinely new — everything else derives, per
DERIVED-STATE-CONTRACT §5): `text`/`status`/`sourceUrl`/`retrievedAt`/`sectionName` come straight
from `claim_checks`; `sourcePublisher` = derived from `sourceUrl` host (new, tiny helper);
`supportingPassage` = the existing `context` field (± `blockIndexHint` window); `agent` = derived
from `sectionName` via `galleyIdToQaSection` + a 5-entry label map (new, tiny — `sectionName`
absent => `agent = "—"`, never a guess); `confidence` = `"—"` always in this phase (no stored
source for this yet — never invent a value, per D-08's "blank never means verified" extended to
"never fabricate a value").

### §42.7 — Reconciliation note: per-claim chip vocabulary (42-RESEARCH.md Pitfall 7)

`Dispatch Control v3 - Annotations.md`'s "State model" section lists, for "Verification: fact
summary + per claim": `Checked · Partly checked · Check not run · Failed check · Changed since
checking`. This is superseded, for the per-claim chip and the summary line specifically, by
CONTEXT.md's locked **D-08** vocabulary: `✓ Checked / ✕ Must fix / Unchecked / Review recommended /
Changed`. The Annotations "State model" table is a cross-domain summary (Issue status / System
activity / Verification / Attention as four parallel taxonomies); D-08 is the phase-specific
locked decision that governs the actual Stage 3 UI and outranks it for this phase. This is a
documented, deliberate reconciliation — a future reader should not "fix" the chip copy back to the
Annotations wording.

*All Phase 42 changes are additive: `claim_checks` gains three optional fields
(`importance`/`changedSinceCheck`/`conflict`); `ClaimOutput`/`ResearchOutputModel` gain one
`importance` field; `claimChecks.ts` gains five new pipeline-lane functions plus an `insertBatch`
pass-through and a `setStatus` clear-on-check amendment; `api/content.py` gains one
`_reset_touched_claims` hook call in `patch_section`/`patch_bonus`; one new pipeline router
(`api/factcheck.py`) and one new shared component (`ClaimProvenanceCard.tsx`) are introduced. No
existing field is renamed or removed; Phase 26/31/32/33/34/35/36 shapes are unchanged.*

---

## §43 — My Tasks & Decision Log (Phase 43)

Two read-side projections over substrate that already exists — no new stores. **My Tasks**
renders the Phase 40 `deriveTasks()` selector as a real screen (D-01); **Decision Log** is a new,
human-readable component that projects the reason-bearing subset of the existing `audit_log`
trail (D-08/D-09). This contract is written BEFORE any schema/helper/query/UI code exists
(CLAUDE.md contract-first hard rule / D-17, mirroring §31/§35/§40/§42). Plan 43-02 onward
implements these shapes verbatim — no field name, function name, or predicate may be invented
later. Two research-confirmed corrections (43-RESEARCH.md Pitfalls 1 and 3) OVERRIDE CONTEXT.md's
more optimistic characterization of the retrofit surface; they are called out explicitly in §43.5
and §43.7 below.

### §43.1 — `audit_log` additive-optional decision fields (amends §21/§23 `convex/schema.ts` in place)

`audit_log` (schema.ts:266-277) gains four additive-optional structured decision fields. Legacy
rows omit all four and render tolerantly (§43.3's projection predicate handles this):

```typescript
audit_log: defineTable({
  // ── existing (Phase 21/23/25/31, unchanged) ──
  workspace_id: v.string(),
  actorId: v.string(),
  action: v.string(),
  resourceType: v.optional(v.string()),
  resourceId: v.optional(v.string()),
  before: v.optional(v.string()),
  after: v.optional(v.string()),
  timestamp: v.number(),
  // ── NEW additive (Phase 43) ──
  reason: v.optional(v.string()),
  issueNumber: v.optional(v.number()),
  runId: v.optional(v.string()),
  instructionVersion: v.optional(v.string()),
})
  .index('by_workspace', ['workspace_id'])
  .index('by_workspace_timestamp', ['workspace_id', 'timestamp'])
```

**Actor display name is NOT stored.** Per Open Question 3's locked recommendation, only
write-time facts land in the row (`reason`/`issueNumber`/`runId`/`instructionVersion` — none of
which drift after the fact). No `actorName`/`actorKind` column is added; actor identity is
resolved at READ time (§43.4) from the unchanged `actorId`. **No new index is required** —
decisions are read via the existing `by_workspace_timestamp` newest-first order, then filtered by
the §43.3 predicate and optionally scoped by the new `runId`/`issueNumber` fields.

### §43.2 — Shared decision-write helper (D-11 — the ONE helper, two writer paths)

Today there is no shared Convex-side wrapper: `issues.ts::hold`, `issues.ts::reopen`,
`promptVersions.ts::activate` (×2 call sites), and `charityCorrections.ts::append` each construct
their own inline `ctx.runMutation(internal.auditLog.write, {...})` object. D-11 ends this
duplication with a genuinely new function, not a rewrite of `write`/`record`'s existing signature:

**Convex-side — `convex/auditLog.ts`:**

```typescript
// `write` (internal) and `record` (public, pipeline HTTP) both gain the four
// optional decision-field args, additively, forwarded into the insert only
// when provided — mirrors the existing before/after optional-arg pattern.
write(args: { ...existing, reason?, issueNumber?, runId?, instructionVersion? }): Promise<void>
record(args: { ...existing, reason?, issueNumber?, runId?, instructionVersion?, pipelineSecret? }): Promise<void>

// NEW — internalMutation. The one shared decision-write helper D-11 mandates.
// Wraps `write`; every reason-requiring DASHBOARD (status-only) mutation calls
// this directly instead of hand-rolling ctx.runMutation(internal.auditLog.write, {...}).
writeDecision(args: {
  workspace_id: string
  actorId: string
  action: string
  resourceType?: string
  resourceId?: string
  before?: string
  after?: string
  reason: string                 // REQUIRED — a decision always has a reason
  issueNumber?: number
  runId?: string
  instructionVersion?: string
}): Promise<void>
```

**Pipeline-side — `packages/pipeline/src/eisenbalm_pipeline/api/control.py::_emit_audit`:**

```python
async def _emit_audit(
    http: Any,
    *,
    actor_id: str,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    before: str | None = None,
    after: str | None = None,
    # ── NEW additive kwargs (Phase 43) ──
    reason: str | None = None,
    issue_number: int | None = None,
    run_id: str | None = None,
    instruction_version: str | None = None,
) -> None:
    ...
    # each new kwarg forwarded into the auditLog:record args dict only when
    # non-None — mirrors the existing before/after optional-kwarg pattern (§31.8)
```

**Write-boundary discipline (EDT-05, unchanged):** content-touching actions keep the
dashboard → pipeline API → Convex/Sanity → `audit_log` boundary — they call the extended
`_emit_audit`, not `writeDecision` directly. Status-only dashboard actions (no Sanity content
mutation — e.g. Hold, Do-not-use) call `internal.auditLog.writeDecision` directly from an
`requireOperator`-guarded Convex mutation. Both paths converge on the SAME `audit_log` row shape.

### §43.3 — Decision projection query (D-09 — a projection, NOT a new store)

```typescript
// NEW public query, convex/auditLog.ts
listDecisions(args: {
  workspace_id: string
  runId?: string
  issueNumber?: number
  limit?: number
}): Promise<Doc<'audit_log'>[]>   // newest-first, decision rows only
```

**The "is a decision" predicate** (applied server-side after the `by_workspace_timestamp` scan):
a row qualifies as a decision if EITHER (a) it carries the new structured `reason` field, OR (b)
its `after` string parses as JSON to an object containing a reason-like key (`reason` or
`heldReason`) — this second branch is what makes legacy reason-in-`after` rows (Hold, the
`promptVersions.activate` override) project as decisions BOTH before and after their §43.7
retrofit lands, with zero backfill/migration required. Non-reason rows (`run.triggered`,
`run.section_rerolled`, `workspace.seeded`) are excluded — they carry no reason under either
branch. When `runId` or `issueNumber` is passed, scope to rows whose matching NEW field equals it;
legacy rows that predate the new fields (and therefore can never match a scoped query) fall back
to being visible only in the unscoped, workspace-wide call — a scoped call is a stricter subset,
never a superset, of the unscoped call. **`AuditLogViewer.tsx` and `listForWorkspace` are
UNCHANGED** — `listDecisions` is a new sibling query, not a modification of the raw viewer's
substrate (D-08).

### §43.4 — Actor-name resolution (D-12 — read-time, `users` gains its first read query)

`convex/users.ts` today has only `upsertCurrentUser` (a mutation) — no read query exists. NEW:

```typescript
// NEW public query, convex/users.ts
byClerkUserId(args: { workspace_id: string; clerkUserId: string }): Promise<Doc<'users'> | null>
```

The `DecisionLog` component resolves each row's stored `actorId` (unchanged, never rewritten) to a
display name at render time: a human `actorId` (a Clerk `sub`) is looked up via
`users.byClerkUserId` → `displayName ?? email`; a system/agent id (`"pipeline"`, `"cron"`, an
agent key such as `"origin_story"`, or any `"system:*"` prefix) resolves via a small static
display-name map local to the component — NOT a Convex query, since no such row exists in `users`.
No shipped reason-requiring action is agent-initiated today (43-RESEARCH.md Pattern 3), so every
row this phase's retrofit (§43.7) actually produces resolves through the human branch; the
system/agent branch is forward-looking scaffolding for Stage 1 (Phases 46-47).

### §43.5 — `lib/derivedState.ts` amendments (amends §40.6 in place)

**§43.5a — additive `openedAt` (D-02, TSK-02):**

```typescript
export interface DerivedTask {            // §40.6 shape, ONE additive field
  id: string
  sev: TaskSeverity
  title: string
  where: string
  why: string
  rec?: string
  primary: { label: string; href: string }
  insp?: string
  stage: 1 | 2 | 3 | 4 | 5
  openedAt?: number                       // NEW (Phase 43) — raw ms timestamp; absent => age unknown
}
```

`DerivationInputs`'s `qaFindings`/`claimRows` row shapes gain passthrough timestamp fields
(`timestamp` for `qaFindings` — already selected wholesale, no mapper change needed;
`createdAt`/`_creationTime` passthrough added to the `claimRows` mapper in `Masthead.tsx` and
`WorkspaceStateProvider.tsx`, which today explicitly picks fields and drops it). Per-task-type
`openedAt` source:
- QA-finding tasks: the row's `timestamp` (already the finding's creation time, Phase 5).
- Claim tasks: the row's `_creationTime` (mapped through as `createdAt`).
- Missing sign-off tasks: the run's `startedAt` (already queried for `DerivationInputs`) — "since
  run start," per CONTEXT.md's own guidance; there is no per-sign-off "became eligible at"
  timestamp stored anywhere.

Relative-age rendering (`"2h ago"`) is a PURE function `formatTaskAge(openedAt: number | undefined,
now: number): string`, called by the screen — NOT inside `deriveTasks` itself, keeping the
selector free of wall-clock dependence (a re-render five minutes later must not change what
`deriveTasks` returns, only what `formatTaskAge` renders from the same `openedAt`).

**§43.5b — HREF CORRECTIONS (43-RESEARCH.md Pitfall 1 — an in-place bug fix, not new scope):**

`deriveTasks` today resolves the claim-row task's `primary.href` and the `signoff-facts` task's
`primary.href` to `issueDraftHref(n)` — both a mis-wiring left over from the `14103b4` mechanical
retarget-to-`/draft` commit, which predates Fact Check (Phase 42) and Approval's live sign-off
wiring. Both `issueFactCheckHref`/`issueApprovalHref` already exist in `issueRouteResolver.ts`
(§40.7) and route to fully-functional screens today. §43 corrects both, same-shape return value,
no signature change:
- claim-row task `primary.href`: `issueDraftHref(n)` → **`issueFactCheckHref(n)`**
- `signoff-facts` (`'Clear the facts'`) task `primary.href`: `issueDraftHref(n)` →
  **`issueApprovalHref(n)`**
- `signoff-voice` (`'Approve the voice'`) task `primary.href` is verified against
  `issueVoiceHref(n)` — already correct per §40.6's existing rule (stage-4 findings already route
  there) — no change.

### §43.6 — Superseded predicate (D-06/D-07, TSK-05 — client-side, NO pipeline change)

43-RESEARCH.md Pitfall 2 confirms `rerun_agent` (`api/control.py:470-594`, the only in-scope
restart mechanism per D-04) does NOT clear or invalidate `qaCorrections`/`claim_checks` rows for
the re-rolled section — DERIVED-STATE-CONTRACT §2's "a restarted step simply re-derives" premise
does not hold for this restart type. §43 does NOT patch `rerun_agent` (that is pipeline-side scope
beyond a screen+component phase, per Open Question 2's locked recommendation); the predicate is
built entirely client-side against the existing `audit_log` trail:

```typescript
// screen-local type — NEVER added to derivedState.ts / TaskSeverity (Pitfall 4)
type DisplayTask = DerivedTask & {
  sessionState: 'active' | 'resolved' | 'superseded'
  supersededBy?: string
}
```

**`superseded`:** a task is superseded when an `audit_log` row with `action: "run.section_rerolled"`
and `resourceId: "{runId}:{agentKey}"` (emitted by `_emit_audit` inside `rerun_agent`,
`control.py:583-589`) has a `timestamp` strictly newer than the task's own `openedAt` (§43.5a).
Section-vocabulary reconciliation required when matching: `qaCorrections.sectionName` is
snake_case and equals `agentKey` directly (e.g. `origin_story`); `claim_checks.sectionName` is
camelCase (e.g. `originStory`) and must be converted via `qaSectionToGalleyId(agentKey)`
(`lib/galley/sectionIdMap.ts`) before comparing. When superseded, the task renders struck-through
with a link to the new step/stage (`supersededBy`) instead of a normal open task, even though the
underlying `qaCorrections`/`claim_checks` row is technically still `open`/`pending`.

**`resolved`:** a task whose id vanished from the current `deriveTasks()` output relative to the
screen's last-rendered in-session snapshot, WITHOUT a matching `run.section_rerolled` row per the
predicate above, is resolved (the artifact reached a terminal state — claim checked, finding
resolved, sign-off signed). Renders struck-through ("resolved just now") for the session, then
falls out on the next snapshot.

**Type-safety guard (Pitfall 4):** `resolved`/`superseded`/`'Done'` are NEVER added as
`TaskSeverity` union members — `TaskSeverity`/`SEVERITY_MINUTES`/`SEVERITY_ORDER` (§40.6) stay
exactly `'must-fix' | 'review-recommended' | 'information'`. `sessionState` is a screen-local
wrapper field computed by a small pure module (e.g. `lib/taskSupersession.ts`), never inside
`derivedState.ts`.

### §43.7 — Do-not-use retrofit is NET-NEW, not a promotion (43-RESEARCH.md Pitfall 3)

CONTEXT.md D-13 characterizes Do-not-use as an action that "already writes a reason somewhere"
needing only promotion from `after`-JSON into the structured `reason` field, alongside Hold and
Activate-override. 43-RESEARCH.md's direct read of `charities.ts::setStatus` (lines 167-189) and
`RegistryTable.tsx::handleBlocklist` (lines 84-95) confirms this is FALSE for Do-not-use
specifically: `setStatus` has NO `reason` parameter and calls ONLY `ctx.db.patch(charityId,
{ status })` — it never calls `internal.auditLog.write`. Querying `audit_log` for any
`charity.blocklisted`-shaped row today returns zero results. §43 therefore specifies this as
net-new reason-capture work:

- a required `reason: v.string()` parameter added to the blocklist transition (either an amended
  `setStatus` guarded to require `reason` only when the target status is `'blocklisted'`, or a new
  dedicated `charities.markDoNotUse` mutation — implementation plan's discretion, contract-fixed
  requirement is: the blocklist transition cannot commit without a reason)
- a `writeDecision` emission (§43.2) with `action: 'charity.blocklisted'`, `resourceType:
  'charity'`, `resourceId: charityId`, `reason`, `before`/`after` snapshotting the status change
- reason-capture UI added to `RegistryTable.tsx`'s blocklist confirmation flow (today a bare inline
  confirm popover with no text input)

This is NOT a promotion of an existing reason (there is none to promote) — it is the same shape
Hold/Activate-override already have, built from scratch for this one action.

---

*All Phase 43 changes are additive — `audit_log` gains four optional fields
(`reason`/`issueNumber`/`runId`/`instructionVersion`); `convex/auditLog.ts` gains `writeDecision` +
`listDecisions` + additive arg extensions to `write`/`record`; `convex/users.ts` gains its first
read query (`byClerkUserId`); `_emit_audit` gains four optional kwargs
(`reason`/`issue_number`/`run_id`/`instruction_version`); `lib/derivedState.ts` gains an additive
`openedAt` field on `DerivedTask` plus two in-place href corrections (claim task →
`issueFactCheckHref`, `signoff-facts` task → `issueApprovalHref`); a new My Tasks screen, a new
`DecisionLog` component, and a new `lib/taskSupersession.ts` module are introduced; `charities.ts`
gains a required-reason blocklist path + its first `audit_log` emission. No existing field is
renamed or removed; the Settings `AuditLogViewer.tsx` and `auditLog.listForWorkspace` are
unchanged; `TaskSeverity` stays exactly `'must-fix' | 'review-recommended' | 'information'`.*

---

## §44 — Inspect How This Was Made (Phase 44)

One universal 7-tab "Inspect how this was made" side panel, reachable from six editorial
surfaces (brief org card, draft passage toolbar, fact-check claim detail, voice finding, approval
recommendation, My Tasks), that resolves an `InspectorArtifact` (DERIVED-STATE-CONTRACT §8) from
substrate that already exists — `agent_runs` (Phase 23), `agent_run_payloads` (Phase 23 OBS-05),
`prompt_versions` (Phase 24), `PIPELINE_EDGES` (Phase 37), `VARIABLE_REGISTRY`/`VARIABLE_DESCRIPTIONS`
(Phase 24/28). This is a read-side projection + entry-point-wiring phase — no new pipeline
behavior, no new stores beyond one additive-optional field (§44.5). This contract is written
BEFORE any resolver/panel/schema code exists (CLAUDE.md contract-first hard rule, mirroring
§31/§35/§40/§42/§43). Plan 44-02 onward implements these shapes verbatim — no field name, function
name, or predicate may be invented later.

Two research-confirmed corrections OVERRIDE CONTEXT.md's more optimistic characterization of the
missing-inputs diff and the Instructions tab, and are the load-bearing reconciliations this
contract encodes (44-RESEARCH.md Pitfalls 1 and 2 — see §44.4 and §44.9 below).

### §44.1 — `InspectorArtifactKey` and its string encoding

Six artifact types (DERIVED-STATE-CONTRACT §8):

```typescript
type InspectorArtifactType = 'founder' | 'claim' | 'rec' | 'org' | 'signal' | 'qa'

interface InspectorArtifactKey {
  type: InspectorArtifactType
  runId: string
  locator: string
}
```

`locator` meaning per type:

| Type | `locator` |
|---|---|
| `founder` | galley sectionId (e.g. `founderBio`) OR qa sectionName (e.g. `founder_bio`) — the resolver normalizes either form (§44.3) |
| `claim` | `claimId` |
| `rec` | `''` (always resolves to `editor_final` for the run — no sub-locator needed) |
| `qa` | qa sectionName (e.g. `founder_bio`) or `''` for the whole-run QA artifact |
| `org` | candidateId, or `''` for the run's winning-organization artifact |
| `signal` | leadId, or `''` when the run has no signal step (degrades, §44.3) |

**String encoding** — the form carried on `DerivedTask.insp` (§43.5a) and passed to
`openInspector` (§44.6):

```
`${type}:${runId}:${locator}`
```

`runId` never contains `:` (a uuid-like id, generated server-side). `locator` MAY contain `:` (e.g.
a claimId), so parsing splits on the first two colons only — everything after the second colon is
the locator, verbatim, even if it contains further colons. An empty locator renders as a trailing
colon (`rec:abc123:`).

```typescript
function encodeArtifactKey(k: InspectorArtifactKey): string
// `${k.type}:${k.runId}:${k.locator}`

function parseArtifactKey(s: string): InspectorArtifactKey | null
// split into at most 3 parts via the first two colons; null on malformed input
// (missing colon, unknown type). Round-trips encodeArtifactKey exactly, including
// an empty locator and a locator containing ':'.
```

### §44.2 — `InspectorArtifact` shape

Reproduced VERBATIM from DERIVED-STATE-CONTRACT §8 — this is the canonical console-side type. It
is ASSEMBLED in the panel container (Plan 44-06) from Convex query results + the resolver (§44.3)
+ the diff (§44.4) — it is NOT a stored row, NOT a Convex document.

```typescript
interface InspectorArtifact {
  title: string; meta: string          // "step: … · agent: … · instructions v4 · run #7"
  asked: string; result: string        // Summary tab — human-readable, never JSON
  confidence: string; warning: string
  upstream: string; downstream: string
  inputs: string                       // Inputs tab — values actually supplied
  missing: string                      // THE HIGH-VALUE FIELD — the redefined diff, §44.4
  instructionVersion: string; instructions: string; sectionGuidance: string  // Instructions tab
  sharedRules: { label: string; content?: string }[]  // Instructions tab — additive, §44.9
  output: string; outputNote: string   // + note when the issue text has since diverged
  sources: { title: string; mark: string; passage: string; retrievedAt: string }[]
  model: string; timing: string; cost: string; latency: string; validation: string  // Diagnostics
  json: string                         // Technical tab — never the default anywhere
}
```

**Instructions-tab fields note:** `instructionVersion`/`instructions` are populated from the
active `prompt_versions` row for the 11 externalized agents (§44.9's instruction-version mapping);
`sharedRules` carries the shared editorial rules the step references, for EVERY artifact type
(§44.9) — never omitted, never a bare one-liner.

### §44.3 — the pure resolver contract (`lib/inspectorArtifact.ts`)

```typescript
interface ResolvedStep {
  agentKey: string          // agent_runs / agent_run_payloads namespace key
  promptKey: string | null  // prompt_versions / VARIABLE_REGISTRY / prompt-lab namespace key,
                             // or null when the agent is not externalized (§44.9)
  degraded: boolean         // true when the run has no such step (signal/org until Phase 46/47)
  sectionContext?: string   // optional "appears in: Founder Bio" label (claim artifacts)
}

function resolveInspectorStep(
  key: InspectorArtifactKey,
  opts?: { bonusType?: string },
): ResolvedStep
```

**`agentKey` resolution table** (per artifact type):

| Type | `agentKey` resolution |
|---|---|
| `founder` | `galleyIdToQaSection(locator) ?? (KNOWN_RUN_KEYS.has(locator) ? locator : null)`, where `KNOWN_RUN_KEYS = new Set(['origin_story','problem','founder_bio','case_study','game','bonus'])`. Tolerates either the galley camelCase id (`founderBio`) or the qa snake_case name (`founder_bio`) as `locator`. Unresolvable locator → `degraded: true`. |
| `claim` | `researcher` (NOT a `claim_checks.agent` field — that field does not exist, §44.RECONCILIATION below). `sectionContext` is derived from the claim's `sectionName` via `galleyIdToQaSection`, rendered as "appears in: {label}". |
| `rec` | `editor_final` |
| `qa` | `qa` |
| `org` | `scout` (the pitch/candidate data itself). `editor_gate1`/`editor_gate_1` is reachable via the "why this one won" context on the same artifact, not as the primary `agentKey`. |
| `signal` | `signal_editor` — the story leads emitted by the `signal_editor` step (§46.1/§46.2). `degraded: true` only when a legacy run predates Phase 46 (no `signal_editor` `agent_runs` row exists for that `runId`) — never a crash. |

**`bonus` variant selection (D-02 corollary):** the `agent_runs`/`agent_run_payloads` key is
literally `"bonus"` (not the three variant keys). The resolver reads `agent_run_payloads` for
`agentKey="bonus"` for Diagnostics/Inputs/Output tabs, and separately reads
`outputSnapshot.bonusType` (`packages/pipeline/.../agents/bonus.py:317`,
`out_dict["bonusType"] = bonus_type`) to pick the Instructions-tab `promptKey`
(`bonus_big_budget`/`bonus_jingle`/`bonus_spec_ad`) only.

**`promptKey = runKeyToPromptKey(agentKey, opts?.bonusType)`:**

```typescript
function runKeyToPromptKey(agentKey: string, bonusType?: string): string | null {
  if (agentKey === 'editor_gate_1') return 'editor_gate1'          // the one hard alias, §44.RECONCILIATION
  if (['origin_story', 'problem', 'founder_bio', 'case_study', 'qa'].includes(agentKey)) return null
  // deliberately NOT externalized — no prompt_versions row exists (§44.9)
  if (agentKey === 'bonus') {
    if (!bonusType) return null
    const map: Record<string, string> = {
      bigBudget: 'bonus_big_budget',
      jingle: 'bonus_jingle',
      specAd: 'bonus_spec_ad',
    }
    return map[bonusType] ?? null
  }
  return agentKey  // identity for the remaining 10 externalized keys
}
```

### §44.4 — the REDEFINED missing-inputs diff (INS-03 — the headline)

**REJECTED literal recipe (CONTEXT D-04):** diffing `VARIABLE_REGISTRY[agentKey]` (the
fine-grained `{token}` names substituted into a prompt string, e.g. `charity_name`,
`VOICE_CONSTRAINTS`) against `agent_run_payloads.inputSnapshot`'s top-level keys (coarse
`DispatchState` field names, e.g. `research`, `winning_charity`, `style_brief`) is broken by
construction — the two vocabularies never intersect by name (44-RESEARCH.md Pitfall 1), so this
recipe reports EVERY declared token as missing for EVERY agent, always, regardless of what was
actually supplied. The prototype's canonical `characterization_examples` example does not exist
anywhere in the real codebase (verified by grep across `packages/pipeline` and
`apps/dispatch-control`) and MUST NOT be used as a test fixture.

**Shipped diagnostic — redefined onto the "declared state inputs" vocabulary:**

```typescript
// lib/inspector/declaredStateInputs.ts — a TypeScript port of
// packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py::_INPUT_KEYS,
// speaking the SAME DispatchState top-level field-name vocabulary as
// agent_run_payloads.inputSnapshot's actual keys.
const DECLARED_STATE_INPUTS: Record<string, string[]> = {
  calibrator:          ['run_id'],
  scout:                ['style_brief'],
  advocate:            ['candidates'],
  editor_gate_1:        ['candidates'],
  chronicler:           ['candidates', 'winning_charity', 'editor_decision'],
  researcher:           ['winning_charity'],
  verify_research:      ['research'],
  origin_story:         ['research', 'winning_charity', 'style_brief'],
  problem:              ['research', 'winning_charity', 'style_brief'],
  founder_bio:          ['research', 'winning_charity', 'style_brief'],
  case_study:           ['research', 'winning_charity', 'style_brief'],
  game:                 ['research', 'winning_charity', 'style_brief'],
  bonus:                ['research', 'winning_charity', 'style_brief'],
  design:               ['research', 'winning_charity', 'style_brief'],
  validate_sections:    ['run_id'],
  qa:                   ['origin_story', 'problem_statement', 'founder_bio', 'case_study', 'game', 'bonus'],
  editor_final:         ['qa_corrections', 'winning_charity'],
  publisher:            ['sanity_issue_id', 'winning_charity'],
}
```

`declared = DECLARED_STATE_INPUTS[agentKey] ?? []` (empty/unknown agentKey degrades honestly — see
below, never throws). `supplied` = the run's ACTUAL top-level input keys for `(runId, agentKey)`.

```
missing = declared.filter(key => !supplied.includes(key))
```

Each missing key is surfaced with a human gloss (e.g. `winning_charity — expected state input,
absent from this run's captured input`).

**`supplied` source + truncation honesty (D-05):**
1. Prefer the additive-optional, untruncated `agent_run_payloads.inputKeys` (§44.5) when present —
   this is the exact top-level key list, computed before truncation, so the diff against it is
   exact, never approximate.
2. When `inputKeys` is absent (legacy rows predating Plan 44-02), fall back to
   `Object.keys(JSON.parse(inputSnapshot))` AND render an explicit note: **"snapshot was
   truncated — this diff is approximate."**

**HARD RULE:** the diff must never assert a key is `missing` when truncation could have hidden it.
When `inputKeys` is absent, a declared key not found in the parsed (possibly-truncated)
`inputSnapshot` renders **"not captured (snapshot truncated)"**, NEVER a definitive "missing" —
that stronger claim is reserved for the case where `inputKeys` (the untruncated key list) is
present and confirms the key's absence.

**Explicit NON-GOAL (document, do not silently attempt):** fine-grained `{token}`-level
substitution-gap detection (the prototype's literal `characterization_examples` framing) is OUT OF
SCOPE for Phase 44. It requires capturing the resolved token→value map at prompt-build time (a
bigger `agent_wrapper.py` change than this phase's additive-field budget) or a per-agent
nested-path lookup table connecting each `VARIABLE_DESCRIPTIONS` entry to where in the captured
state slice it is sourced from. The `DECLARED_STATE_INPUTS` diagnostic above is the coarser,
actually-correct, immediately achievable substitute — it never produces a false "missing," which
the token-level version would.

### §44.5 — additive `agent_run_payloads.inputKeys` field (D-05, contract-first)

```typescript
agent_run_payloads: defineTable({
  // ── existing (Phase 23, unchanged) ──
  workspace_id: v.string(),
  runId: v.string(),
  agentKey: v.string(),
  inputSnapshot: v.optional(v.string()),   // JSON, truncated ~2000 chars
  outputSnapshot: v.optional(v.string()),  // JSON, truncated ~2000 chars
  // ── NEW additive (Phase 44) ──
  inputKeys: v.optional(v.array(v.string())),  // untruncated top-level key list of the
                                                // input slice, computed BEFORE _truncate()
})
  .index('by_workspace', ['workspace_id'])
  .index('by_runId_agentKey', ['runId', 'agentKey'])
```

Computed in `agent_wrapper.py::_snapshot_input()` as `list(slice_.keys())`, BEFORE the
`_truncate(json.dumps(slice_, ...))` call, and emitted alongside `inputSnapshot`/`outputSnapshot`
in the same `agentRuns:savePayload` mutation call. Legacy rows (pre-Plan-44-02 runs) omit it — the
§44.4 fallback covers them. This is additive-optional exactly like every Phase 35/42/43 field; no
migration, no backfill.

### §44.6 — `openInspector(artifactKey)` opener contract (INS-01, D-06)

```typescript
function openInspector(key: string | InspectorArtifactKey): void
function closeInspector(): void

function useInspector(): {
  openInspector: typeof openInspector
  closeInspector: typeof closeInspector
  activeKey: InspectorArtifactKey | null
}
```

Exposed via a React context/provider. EXACTLY ONE `InspectorPanel` instance is mounted app-wide
(recommended: the `(dashboard)` root layout, so it covers all six entry points including
`/my-tasks`, which is NOT under the issue-workspace frame). All six entry points call the SAME
`openInspector` — never a second panel instance, never a per-screen copy. `openInspector` accepts
either the string-encoded form (parsed via `parseArtifactKey`, §44.1) or the structured
`InspectorArtifactKey` directly.

### §44.7 — footer actions: live deep-links vs reserved (INS-06, D-08)

Six footer actions render on EVERY artifact type:

| Action | State | Target |
|---|---|---|
| **Improve this agent →** | LIVE when `promptKey !== null`; RESERVED when `promptKey === null` | `/prompt-lab/${encodeURIComponent(promptKey)}` (uses the promptKey namespace — i.e. `editor_gate1`, never `editor_gate_1`) |
| **Compare instruction versions** | LIVE when `promptKey !== null`; RESERVED when `promptKey === null` | same `/prompt-lab/${promptKey}` page (version history lives there, no separate route) |
| **Related quality tests** | LIVE when `promptKey !== null`; RESERVED when `promptKey === null` | `/eval-center` (optionally `?agent=${promptKey}` if the page supports a filter — Plan 44-05's discretion, confirm against `ScenarioCard.tsx`'s `agentKey` prop) |
| **Prior & downstream steps** | Always LIVE | resolved inline from `PIPELINE_EDGES` (Summary tab `upstream`/`downstream` fields), with an optional deep-link to `/run-monitor/graph` |
| **Ask agent to revise** | Always RESERVED | disabled, `title="Arrives in Phase 45"` |
| **Restart from this step** | Always RESERVED, for ALL artifact types | disabled, `title="Completed steps are reused, not re-paid — general step restart is not yet wired"` |

**Restart-from-this-step rationale (44-RESEARCH.md Pitfall 6):** `POST /run/{run_id}/resume`
(`packages/pipeline/src/eisenbalm_pipeline/api/runs.py:435-498`, `_resume_paused_run`) is
hardcoded to `Command(resume={"editorSelection": charity_name})` — built exclusively for the
Gate-1 `interrupt()` (the graph's one and only `interrupt()` call site). There is no generic
"resume graph execution from node X" mechanism; wiring this footer action to that endpoint would
either silently no-op or misfire a Gate-1-shaped payload at a non-Gate-1 step. Reserved for all six
artifact types, no exception.

**When `promptKey` is `null`** (the 5 non-externalized agents: `origin_story`, `problem`,
`founder_bio`, `case_study`, `qa`), Improve/Compare/Related-tests all render RESERVED with title
`"This agent's instructions are code-defined, not editable here."`

### §44.8 — Diagnostics "model" field (RESEARCH finding)

`agent_runs` (§44.RECONCILIATION substrate) has NO `model` field
(`convex/schema.ts:346-361` confirmed — `status`/`costUsd`/`durationMs`/`tokensIn`/`tokensOut`/
`error`/`retryCount` only). The resolved LLM model is written only into pipeline
`state["model_versions"]`, which reaches Convex never and Sanity only as a JSON-stringified blob
at publish time — no live per-run, per-agent, Convex-queryable "which model produced this" exists
today. The Diagnostics tab renders `model` as **"not recorded"** (label + icon, D-14 honesty rule)
for Phase 44 — zero schema change. Follow-up option (add `agent_runs.model: v.optional(v.string())`,
populated in `agent_wrapper.py`'s `completed` mutation from `result.get("model_versions", {}).get(agent_key)`)
is noted as a fast, low-risk future addition, explicitly OUT OF SCOPE for this phase — Phase 44's
schema-change budget is spent on `inputKeys` (§44.5).

### §44.9 — Instructions-tab "shared rules referenced" + instruction-version mapping (INS-04, RESEARCH Pitfall 2)

The Instructions tab must show BOTH the active instruction version AND the shared rules the step
references (roadmap success criterion #4) — for EVERY artifact type, never just for the ones with
a `prompt_versions` row.

**The 5 non-externalized agents** (`promptKey === null` per §44.3's `runKeyToPromptKey`:
`origin_story`, `problem`, `founder_bio`, `case_study`, `qa`) have `promptVersions.getActive`
return `null` BY DESIGN — `config_loader.py`'s `SYSTEM_PROMPT_KEYS` (the 11-entry externalized
tuple) explicitly excludes them; they build their prompts via direct Python f-string interpolation
(`lib/voice.py::build_section_writer_prompt`), never an externalized `.replace()` template. This is
the PERMANENT, EXPECTED state for these 5 keys — not a loading/error/not-yet-seeded state. The tab
must STILL render the shared rules, never just a bare "code-defined" one-liner.

```typescript
// Exact name — the container (Plan 44-06) imports this constant directly.
const NON_EXTERNALIZED_SHARED_RULES: Record<string, string[]> = {
  origin_story: ['VOICE_CONSTRAINTS', 'STRUCTURE_CONTRACT'],
  problem:      ['VOICE_CONSTRAINTS', 'STRUCTURE_CONTRACT'],
  founder_bio:  ['VOICE_CONSTRAINTS', 'STRUCTURE_CONTRACT'],
  case_study:   ['VOICE_CONSTRAINTS', 'STRUCTURE_CONTRACT'],
  qa:           ['rubric'],
}
```

Source of truth: the 4 narrative writers always receive `VOICE_CONSTRAINTS` (via
`style_brief.get("voice") or VOICE_CONSTRAINTS`, `lib/voice.py`) and `STRUCTURE_CONTRACT`
(module-level constant appended to each writer's guidance string —
`agents/{origin_story,problem,founder_bio,case_study}.py`); `qa` references `rubric`, a real
`SINGLETON_ASSET_KEYS` entry (`config_loader.py:155`) that IS fetchable via `prompt_versions`.

**Resolution rule (the container, Plan 44-06, follows this exactly):**
- The 4 narrative writers' rules (`VOICE_CONSTRAINTS`, `STRUCTURE_CONTRACT`) are code-defined
  constants — render as LABEL-ONLY rows (no `content` fetch; they are not editable prompt-lab
  rows).
- `qa`'s `rubric` is FETCHABLE — resolve its content via
  `promptVersions.getActive({ agentKey: 'rubric', workspace_id })` and render the active-version
  content (human-readable) when present; label-only when `getActive` returns `null` for `rubric`
  too (never blank either way).

**Additive artifact field** (augments the §44.2 Instructions-tab group without changing the
verbatim `InspectorArtifact` shape's other fields):

```typescript
sharedRules: { label: string; content?: string }[]
```

`label` always present (e.g. `"VOICE_CONSTRAINTS"`, `"STRUCTURE_CONTRACT"`, `"rubric"`); `content`
present only for fetchable rules (`qa` → `rubric`, when its `getActive` row exists). The panel
renders one row per entry under a "Shared rules referenced" heading (label + icon, D-14); `content`
renders human-readable when available.

**Instruction-version mapping for the 11 externalized agents** (this closes the "fetched but never
assembled" gap): the container maps the fetched active `prompt_versions` row into the
Instructions-tab fields —

```
promptVersion.version → instructionVersion   (e.g. "v4")
promptVersion.content  → instructions         (the human-readable active prompt text)
```

This is the EXACT data the Instructions tab reads when `promptKey !== null` (i.e.
`instructionsExternalized === true`, the client-side derived flag `promptKey !== null`). A
`getActive` row that is fetched but never mapped into these two fields would leave the Instructions
tab falsely blank for agents that DO have an active version — the dishonest-blank state D-07/D-14
forbid. Every externalized artifact's Instructions tab renders REAL version content, never a blank
tab, when its active row exists.

### §44.RECONCILIATION — corrections to CONTEXT.md's D-02 characterization

Two CONTEXT.md D-02 characterizations are corrected here by direct source inspection
(44-RESEARCH.md Pitfalls 3 and 4) and are binding for all downstream 44-xx plans:

- **`editor_gate_1` vs `editor_gate1`:** `agent_runs`/`agent_run_payloads`/`PIPELINE_EDGES`/
  `PIPELINE_NODES`/the LangGraph node itself all use `editor_gate_1` (underscore before 1).
  `prompt_versions`/`VARIABLE_REGISTRY`/`config_loader.py`'s `SYSTEM_PROMPT_KEYS`/
  `agents/editor.py`'s `acomplete(agent_id="editor_gate1", ...)`/`AGENT_DISPLAY_NAMES`/eval-center's
  `ScenarioCard.agentKey` all use `editor_gate1` (no underscore). No prior feature needed both
  namespaces simultaneously; the resolver's `runKeyToPromptKey` (§44.3) is the one explicit alias —
  do not assume the two strings are interchangeable anywhere else in new code.
- **`claim_checks` has no `agent` field.** `convex/schema.ts:442-466` confirms `claim_checks`
  carries `sectionName` but NOT an `agent` field — CONTEXT.md D-02's "recorded on the claim_checks
  row" phrasing does not hold. `claim` artifacts resolve to `researcher` structurally (evidence
  sourcing is a Researcher-owned operation, confirmed `api/factcheck.py:570`'s
  `agent_id="researcher"`), with `sectionName` surfaced as contextual "appears in" metadata via
  `galleyIdToQaSection`, never as the resolution key itself.

---

*All Phase 44 changes are additive — `agent_run_payloads` gains one optional field (`inputKeys`);
`InspectorArtifact` gains one additive field beyond DERIVED-STATE-CONTRACT §8's verbatim shape
(`sharedRules`); a new pure resolver module (`lib/inspectorArtifact.ts` +
`lib/inspector/declaredStateInputs.ts`), a new `NON_EXTERNALIZED_SHARED_RULES` constant, a new
7-tab panel component, a new inspector context/provider, and ~6 entry-point wiring changes are
introduced. No existing field is renamed or removed; `agent_runs`/`prompt_versions`/
`VARIABLE_REGISTRY`/`PIPELINE_EDGES`/`ClaimProvenanceCard` (§42.6) are all consumed read-only and
unchanged.*

---

## §45 — Agent Revision (Phase 45)

**"Ask agent to revise" becomes a real editing verb available wherever a passage is selected.**
This contract is written BEFORE any endpoint/UI code exists (CLAUDE.md contract-first hard rule,
mirroring §31/§35/§42/§44). It generalizes §42.4a's FCT-06 preview/apply pair — built by Phase 42
explicitly to be claim-agnostic — to arbitrary passage revision. Plan 45-03 onward implements the
endpoint shapes verbatim; Plan 45-04 onward implements the client verbatim. No field name, path,
or identifier below may be invented later.

### §45.1 — Direction-chip identifiers (locks 45-RESEARCH Open Question #2)

The seven `DirectionChip` literal identifiers and their REV-02-locked display copy:

| Identifier | Display copy |
|---|---|
| `make_clearer` | "Make clearer" |
| `make_more_specific` | "Make more specific" |
| `tighten` | "Tighten" |
| `match_brief` | "Match the brief" |
| `reduce_repetition` | "Reduce repetition" |
| `try_another_approach` | "Try another approach" |
| `custom` | "Custom" |

The chip set never renders a bare "Regenerate" (REV-02). `custom` carries a free-text
`customDirection` field passed verbatim as the directive clause. `try_another_approach` carries a
`priorProposals` array of prior proposal text as avoid-context (D-05) so the revision agent
diverges rather than repeats. `match_brief` degrades gracefully to `style_brief.voice` /
`style_brief.visualDirection` plus the winning charity's `missionStatement` / `whyOverlooked` /
`focusArea` fields today — the closest existing proxy for "premise/peg" — and is forward-compatible
with the Phase 47 Brief entity (D-07); it must never hard-depend on a Brief that does not exist yet.

### §45.2 — New pipeline endpoints (`api/revision.py`, mounted in `api/main.py`)

Two Clerk-JWT-guarded routes (`_require_clerk_jwt_control`, same dependency as
`content.py`/`factcheck.py`/`voice_pass.py`) generalizing §42.4a's SAME preview/apply pair to
arbitrary passages (D-01 — this is NOT a second revision endpoint):

```
POST /issues/{run_id}/revise/preview
  body {sectionName, quotedText, blockIndexHint?, direction, customDirection?, priorProposals?[]}
  -> 200 {proposedText, whatChanged, claimDelta:{added[],removed[],altered[]}}
  -> 409 {reason:"cost_cap_exceeded", message, spentUsd, projectedUsd, capUsd}   (REV-05)

POST /issues/{run_id}/revise/apply
  body {ifRevisionID, sectionName, quotedText, blockIndexHint?, newText}
  -> 200 {revisionId, resolution:"revision_applied"}
  -> 409 {reason:"revision_mismatch"|"span_not_resolved"|"claim_edit_unavailable", message}
```

**Deliberate shape divergence from §42.4a (45-RESEARCH State-of-the-Art table):** the apply body
carries the original passage text (`quotedText`) explicitly, because passages — unlike claims —
have NO stored Convex row to source the original text from server-side (45-RESEARCH Pitfall 3).
This is deliberate, not an oversight to "fix" back to `evidence/apply`'s leaner body.

### §45.3 — Preview = read-only (D-02)

`revise/preview` performs NO Convex mutation, NO Sanity write, and writes NO `audit_log` row —
mirrors `voice_pass.py::voice_rewrite` and `evidence/preview` exactly. It DOES record the revision
LLM call's cost (§45.5) — recording cost is not a mutation of issue content. The revision agent's
structured LLM output is `{proposedText, whatChanged, claimDelta}`; `claimDelta` (`added`/`removed`/
`altered`, each a list of short strings) is ADVISORY narrative for the comparison card's "What
changed" line only (D-09) — it is never the enforced state change (see §45.4).

### §45.4 — Apply = atomic + audited (D-02)

`revise/apply` executes, in this exact order (42-RESEARCH Pitfall 3 ordering, reused verbatim):

1. Resolve `run_id` → `sanityIssueId` (existing `_resolve_sanity_id`).
2. `_patch_prose_span` — span-resolve `quotedText` against **CURRENT** Sanity content via
   `lib/span_resolver.py::resolve_span` (never `claimSpans`, §35.3) → content-patch the prose in
   Sanity → run `_reset_touched_claims` FIRST (block-level touched-counter, §42.5 — increments even
   when the replacement text is itself sourced, D-10/D-11).
3. `_revoke_active_signoffs` — Phase-34 sign-off revocation IS revoked on applied revision (port
   the sentence, not the prototype's "voiceDone survives" bug, per DERIVED-STATE-CONTRACT §10 and
   PROJECT.md's locked decision).
4. `_emit_audit` exactly ONE row: `action: "passage_revised"`, `resource_type: "passage"`,
   `resource_id: f"{run_id}:{sectionName}"`.

`ifRevisionID` mismatch → 409 `{"reason": "revision_mismatch", ...}` exactly like `content.py`'s
revision guard (§31.4). An unresolved span → 409 `{"reason": "span_not_resolved", ...}`. "Edit
before applying" reuses this SAME apply route with the operator-edited `newText` in place of the
agent's `proposedText` — the card's advisory `claimDelta` is NOT recomputed on manual edit; the
deterministic `_reset_touched_claims` at apply time is always correct regardless of a stale
advisory delta (D-11).

### §45.5 — Cost guard (REV-05, D-12/D-13/D-14)

The per-issue denominator is the EXISTING per-run cost cap (`pipeline_config.per_run_cap_usd`,
config `cost_cap_usd`, default 10.0) — no second budget system is invented (D-12). Spend is the SUM
of durable `agentRuns:byRunId({runId})` rows' `costUsd` — NEVER `lib/cost.py`'s in-memory `_store`,
which the Publisher node's `end_run()` clears before any human review stage (Draft/Fact-Check/
Voice) even begins (45-RESEARCH Pitfall 1); relying on `_store`/`_run_caps` here would silently
undercount or reset the true per-issue total.

Each revision LLM call records its cost under the issue's REAL `run_id` (never a
`evidence-preview-{run_id}` pseudo-id — that pre-existing `evidence/preview` pattern is a known,
documented, NOT-fixed-by-this-phase gap, per 45-RESEARCH Open Question #1 — D-13) via the existing
`agentRuns:completed` mutation, with a FRESH, distinct `agentKey` per call:
`f"revision-{uuid.uuid4().hex[:12]}"`. Never reuse an existing pipeline `agentKey` (e.g. `"qa"`,
`"researcher"`) — `agentRuns:completed` is an upsert-by-`(runId, agentKey)`, so reuse would silently
overwrite that agent's real historical cost/timing/token row (45-RESEARCH Pitfall 2).

`revise/preview` calls a `would_exceed_run_cap` predicate (mirrors `budget.py::would_exceed_monthly_cap`'s
shape) BEFORE issuing its LLM call. When the projected next revision call would exceed the cap, the
endpoint returns 409 `{"reason": "cost_cap_exceeded", "message", "spentUsd", "projectedUsd",
"capUsd"}` (D-14) and the chip UI renders disabled-with-explanation — never a silent failure,
consistent with the milestone's locked-render philosophy (§6).

### §45.6 — Toolbar + entry points (REV-01, D-16/D-17/D-18)

The shared galley selection toolbar (mounted once, used by both Draft/Stage 2 and Voice/Stage 4 —
the same component instance, D-18) offers all six actions: **Edit text** (existing `BlockEditor`
flow), **Ask agent to revise** (this section's new flow), **Compare with previous** and **Restore
previous** (render visible-but-reserved with an explanatory `title` — no shipped content-version
endpoint exists; general passage version history is DEFERRED, D-17), **Related facts & sources**
(shared `ClaimProvenanceCard`, §42.6), and **Inspect how this was made** (Phase 44 `onInspect`,
already threaded by the galley).

The same revision flow additionally mounts from the Phase-44 `InspectorFooter`, whose "Ask agent to
revise" button flips from RESERVED (§44.7, `title="Arrives in Phase 45"`) to LIVE (D-18). The
revision flow is one component + one endpoint pair regardless of which surface invokes it.

The EDT-05 no-direct-Sanity-write tripwire (`dispatch-control-no-sanity-write.test.ts`) needs ZERO
edits for this phase: the new `revisionClient.ts` only ever calls `NEXT_PUBLIC_PIPELINE_URL`,
exactly like `factCheckClient.ts` (45-RESEARCH Pitfall 7) — the test passes automatically, by
construction.

*All Phase 45 changes are additive: one new pipeline router (`api/revision.py`) exposing
`revise/preview`/`revise/apply`; a claim-agnostic `_patch_prose_span` extracted from
`factcheck.py::_patch_claim_prose` into `content.py` (both the existing claim path and the new
passage path call the SAME implementation); one new `would_exceed_run_cap` predicate in
`budget.py`; new frontend components (`PassageToolbar`, `DirectionChips`,
`RevisionComparisonCard`) and a `revisionClient.ts`; the Phase-44 `InspectorFooter`'s "Ask agent to
revise" button flips from RESERVED to LIVE. No existing field is renamed or removed; §31/§35/§42/
§44 shapes are unchanged; `revise/preview`+`revise/apply` GENERALIZE §42.4a's `evidence/preview`+
`evidence/apply` rather than forking a second endpoint pair.*

---

## §46 — Signal Editor & Candidate Verification (Phase 46)

The v3.0 deferral (V3-DEF-02) comes due: the pipeline grows from 18 to 20 nodes so Stage 1
(Phases 47-48) has real leads and verification records to render. A **Signal Editor** LLM agent
runs *before* Scout and emits 3-5 dated story leads (SGE-01); it never self-selects a
brand-risk-flagged lead — that routes to the human (SGE-02). A **`verify_candidates`** deterministic
(non-LLM) node runs *after* Scout and produces a verification record per organization, killing
only definitive failures (SGE-03). This contract is written BEFORE any `state.py`/agent/Convex code
exists (CLAUDE.md contract-first hard rule, mirroring §39/§42). Plan 46-01 implements these shapes
verbatim — no field name, table name, or match-key scheme may be invented later.

### §46.1 — `StoryLead` TypedDict (NEW)

```python
# packages/pipeline/src/eisenbalm_pipeline/graph/state.py
class StoryLead(TypedDict):
    premise: str                        # the story angle, one or two sentences
    datedPeg: str                       # what makes this current/timely right now
    pegSourceUrl: str                   # a REAL, sourced URL for the dated peg — never invented (D-19)
    readerEnergy: str                   # why a reader would care
    charitableAngle: str                # how this connects to a charitable response
    category: str                       # e.g. "disaster relief", "housing", "food security"
    confidence: str                     # 'low' | 'medium' | 'high' — constrained at the Pydantic boundary
    brandRiskFlag: bool                 # true when the lead carries reputational/sensitivity risk
    brandRiskReason: Optional[str]      # populated ONLY when brandRiskFlag is true; else None
    repetitionWarning: Optional[str]    # SGE-05 advisory, e.g. "avoid US-SE · avoid weather"; never suppresses the lead
    recommended: bool                   # SGE-02 gate — MUST be False whenever brandRiskFlag is True
```

A Pydantic model (`SignalEditorOutput` / a per-lead `StoryLeadModel`) enforces this shape at the
`signal_editor` agent boundary — the `body: list[BodyBlock]` / `claims: list[dict]` (§18, §35)
structured-output precedent. **Invariant (D-08, enforced in Python, not only prompted):** a lead
with `brandRiskFlag: true` MUST have `recommended: false`. The Signal Editor's own code flips
`recommended` to `false` after the LLM call for any flagged lead, exactly like Scout's dedup filter
and Advocate's positional-alignment fallback enforce their own invariants in Python.

### §46.2 — `story_leads` DispatchState field (NEW)

```python
class DispatchState(TypedDict):
    # ── Phase 46: Signal Editor leads ──────────────────────────────────────────
    story_leads: Optional[list[StoryLead]]   # JSON-serializable list[dict] — mirrors the
                                              # featured_charity_keys ("list NOT set") and
                                              # claims: list[dict] precedents so it survives
                                              # the Postgres checkpoint across signal_editor →
                                              # scout → verify_candidates (SGE-04).
```

### §46.3 — `VerificationRecord` TypedDict (NEW)

```python
# packages/pipeline/src/eisenbalm_pipeline/graph/state.py
class VerificationRecord(TypedDict):
    candidateId: str                    # f"charity-{slugify(name)}" — the SAME join key already
                                         # used across Sanity _id / pitchLog.charityId /
                                         # agentVotes.charityId (agents/advocate.py::_charity_id_for)
    candidateName: str
    domainLive: bool                    # httpx-resolved: DNS-resolves + 2xx/3xx after redirects
    registrationId: Optional[str]       # reachable charityNavigatorUrl/guidestarUrl identifier, if any
    registrationVerified: bool
    obscurity: dict                     # {"pressHits": int, "verdict": str} — bounded Tavily press scan
    status: Literal['pass', 'fail', 'unverified']   # 'unverified' on any transient/ambiguous error (D-12)
    killed: bool
    killReason: Optional[str]           # non-empty whenever killed is True — never silently dropped
    checkedAt: int                      # Unix ms
```

**Conservative posture (D-12):** a candidate is `killed` ONLY on a DEFINITIVE failure (domain does
not resolve, no registration found at all, or clearly not-obscure). Transient/ambiguous errors
(timeout, 5xx, SSL/DNS blip, rate-limit) mark the affected check `'unverified'` and KEEP the
candidate — mirrors `agents/verify.py::verify_research`'s "false negatives are acceptable, false
positives are not" posture. Killed candidates are always recorded with a `killReason` and emitted —
never silently dropped ("nothing silent").

### §46.4 — `verification_records` DispatchState field (NEW)

```python
class DispatchState(TypedDict):
    # ── Phase 46: verify_candidates records ────────────────────────────────────
    verification_records: Optional[list[VerificationRecord]]   # JSON-serializable list[dict] —
                                                                 # same checkpoint-safety precedent
                                                                 # as story_leads (SGE-04).
```

### §46.5 — Convex store: `story_leads` + `verification_records` tables (NEW)

Two **dedicated** Convex tables — NOT a new `deliberationEvents.eventType` literal. §37.3 declares
that union **FROZEN** ("no new literal may be added for it"), and the architectural fit is wrong
regardless: `deliberationEvents` rows are an immutable append-only event stream, but Phase 47
(BRF-02) must PATCH lead state (Require this lead / Remove), which an append-only stream cannot
support. This mirrors the `pitchLog` / `qaCorrections` / `charity_corrections` dedicated-table
pattern (§39.1).

```typescript
// convex/schema.ts
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

verification_records: defineTable({
  runId: v.string(),
  candidateId: v.string(),
  candidateName: v.string(),
  domainLive: v.boolean(),
  registrationId: v.optional(v.string()),
  registrationVerified: v.boolean(),
  // obscurity: {pressHits, verdict} is FLATTENED for the Convex column — the
  // pipeline VerificationRecord dict re-nests it into obscurity: {pressHits, verdict}.
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
```

`pipelineSecret: v.optional(v.string())` is NOT a stored column on either table — it is the Phase
29 D-1 pipeline-lane secret argument, stripped from `args` before the `ctx.db.insert(...)` call
(exactly like `pitchLog.ts::insert`), never persisted.

### §46.6 — `convex/storyLeads.ts` + `convex/verificationRecords.ts` functions (NEW)

Both files mirror `convex/pitchLog.ts` exactly:

```typescript
// convex/storyLeads.ts
export const insert = mutation({
  args: {
    runId: v.string(),
    premise: v.string(), datedPeg: v.string(), pegSourceUrl: v.string(),
    readerEnergy: v.string(), charitableAngle: v.string(), category: v.string(),
    confidence: v.string(), brandRiskFlag: v.boolean(),
    brandRiskReason: v.optional(v.string()), repetitionWarning: v.optional(v.string()),
    recommended: v.boolean(),
    pipelineSecret: v.optional(v.string()),   // Phase 29 D-1 — never persisted
  },
  handler: async (ctx, { pipelineSecret, ...args }) => {
    requirePipelineSecret(pipelineSecret)
    return await ctx.db.insert('story_leads', { ...args, timestamp: Date.now() })
  },
})

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) =>
    await ctx.db.query('story_leads').withIndex('by_runId', q => q.eq('runId', runId)).order('asc').collect(),
})
```

```typescript
// convex/verificationRecords.ts
export const insert = mutation({
  args: {
    runId: v.string(), candidateId: v.string(), candidateName: v.string(),
    domainLive: v.boolean(), registrationId: v.optional(v.string()),
    registrationVerified: v.boolean(), pressHits: v.number(), obscurityVerdict: v.string(),
    status: v.union(v.literal('pass'), v.literal('fail'), v.literal('unverified')),
    killed: v.boolean(), killReason: v.optional(v.string()), checkedAt: v.number(),
    pipelineSecret: v.optional(v.string()),   // Phase 29 D-1 — never persisted
  },
  handler: async (ctx, { pipelineSecret, ...args }) => {
    requirePipelineSecret(pipelineSecret)
    return await ctx.db.insert('verification_records', { ...args, timestamp: Date.now() })
  },
})

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) =>
    await ctx.db.query('verification_records').withIndex('by_runId', q => q.eq('runId', runId)).order('asc').collect(),
})
```

Both `insert` paths MUST be added to `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py`'s
`_PIPELINE_SECRET_GUARDED_PATHS` frozenset (`"storyLeads:insert"`, `"verificationRecords:insert"`) —
the Phase 42-03 lesson: an unregistered guarded path means every real call 500s Unauthorized despite
mocked unit tests passing.

### §46.7 — `signal` inspector-artifact row correction (amends §44.RECONCILIATION table in place)

The §44 `agentKey` resolution table's `signal` row previously read "no Signal Editor exists until
Phase 46." That is now stale. The row is corrected to:

| Type | `agentKey` resolution |
|---|---|
| `signal` | `signal_editor` — the story leads emitted by the `signal_editor` step (§46.1/§46.2). `degraded: true` only when a legacy run predates Phase 46 (no `signal_editor` `agent_runs` row exists for that `runId`) — never a crash. |

*All Phase 46 changes are additive: two new DispatchState fields (`story_leads`,
`verification_records`); two new TypedDicts (`StoryLead`, `VerificationRecord`); two new Convex
tables (`story_leads`, `verification_records`) with `insert`/`byRunId` functions each; two new
guarded pipeline-secret paths. No existing field is renamed or removed; §7/§26/§37/§39/§44 shapes
are unchanged except the single stale `signal` row correction in §46.7.*

---

## §47 — Story & Brief Stage (Phase 47)

Stage 1 of the Issue Workspace (the provisional Signal Desk Phase 41 mounted) is REPLACED by the
full v3 Story & Brief stage, built on Phase 46's `story_leads`/`verification_records`. Five of six
requirements (BRF-01..04, BRF-06) are additive UI composition over already-shipped patterns (the
never-truncated `CandidateSlate` card, the `adjudicateGate1`/`_resume_paused_run` resume bridge,
Phase 45's revision preview/apply engine). The one genuinely new artifact is the **Brief** (BRF-05):
six console-editable fields the section writers draft from. This contract is written BEFORE any
consuming code exists (CLAUDE.md contract-first hard rule, mirroring §39/§42/§46). Plan 47-01
implements the `briefs` table + `story_leads.status` verbatim — no field name, table name, or
endpoint shape may be invented later. All Phase 47 changes are additive; no existing field, table,
or endpoint documented in §1-§46 is renamed or removed.

### §47.1 — `briefs` Convex table (NEW) — single-row-per-run, patch-based

Unlike `story_leads`/`verification_records` (naturally multi-row per run), `briefs:byRunId` must
resolve to exactly ONE current Brief per run — generated once by `editor_gate_1` (§47.3), then
refined via console edits. The table is therefore **patch-based, not append-per-edit**:

```typescript
// convex/schema.ts
briefs: defineTable({
  runId: v.string(),
  premise: v.string(),
  currentPeg: v.string(),
  centralClaim: v.string(),
  readerEffect: v.string(),
  knownRisks: v.string(),
  voiceIntention: v.string(),
  updatedAt: v.number(),
})
  .index('by_runId', ['runId']),
```

`pipelineSecret: v.optional(v.string())` is NOT a stored column — stripped from `args` before the
write, exactly like `pitchLog.ts`/`storyLeads.ts` (Phase 29 D-1 convention).

### §47.2 — `story_leads.status` additive field (amends §46.5 in place)

`story_leads` gains ONE additive optional field. Phase 46's `storyLeads:insert` args shape is
UNCHANGED — this field is set only via the new `setStatus` mutation (§47.4), never at insert time:

```typescript
// convex/schema.ts — story_leads table, additive field
status: v.optional(v.union(v.literal('active'), v.literal('required'), v.literal('removed'))),
// absent or 'active' = default un-adjudicated state (BRF-02).
```

### §47.3 — Brief generation mechanism (BRF-05, D-11) — deterministic, zero-new-node

The Brief is assembled **inline inside `editor_gate_1`**, immediately after `winning_charity`
resolves — no new LangGraph node, no new LLM call. It is a deterministic re-projection of data
`editor_gate_1` already has in scope (the matched `StoryLead`, the matched `VerificationRecord`,
`decision.editorReasoning`, `style_brief`):

```python
# packages/pipeline/src/eisenbalm_pipeline/agents/editor.py — illustrative, planner finalizes exact assembly
winning_lead = _match_lead_for_winner(state.get("story_leads") or [], winning_charity)
verification = _match_verification_record(state.get("verification_records") or [], winning_charity)
brief: Brief = {
    "premise": winning_lead.get("premise", "") if winning_lead else winning_charity.get("scoutSummary", ""),
    "currentPeg": winning_lead.get("datedPeg", "") if winning_lead else "",
    "centralClaim": decision.editorReasoning,
    "readerEffect": winning_lead.get("readerEnergy", "") if winning_lead else "",
    "knownRisks": _assemble_known_risks(winning_lead, verification),
    "voiceIntention": (state.get("style_brief") or {}).get("visualDirection", ""),
}
await convex_mutation_safe("briefs:insert", {"runId": run_id, **brief})
# ... return {**state, ..., "brief": brief}
```

**Honest tradeoff (RESEARCH Open Question 1), stated plainly:** `graph/builder.py` has zero
`interrupt()` points between `editor_gate_1` and `publisher` — once Gate 1 resolves, the graph runs
autonomously to completion in one `ainvoke()`. There is no natural pause for a human to edit the
Brief before the writers' FIRST drafting pass. The section writers therefore draft from the
**auto-generated** Brief on that first pass; human edits (via §47.4/§47.5) refine the Brief for
LATER revision passes ("Match the brief," §45's `_fetch_brief_context`) and seed Phase 48's
"Start from my brief" hand-authored entry point, which has no such race (it authors a Brief before
any run starts). This satisfies BRF-05's literal text — "section writers draft from it" — without
inventing new pipeline pause machinery, per D-11's explicit preference.

### §47.4 — `convex/briefs.ts` + `convex/storyLeads.ts::setStatus` function signatures (NEW)

```typescript
// convex/briefs.ts — mirrors convex/pitchLog.ts / storyLeads.ts idioms
export const insert = mutation({
  // upsert-safe: by_runId lookup first — patches an existing row (e.g. a
  // restarted run re-resolving editor_gate_1) instead of creating a duplicate.
  args: {
    runId: v.string(),
    premise: v.string(), currentPeg: v.string(), centralClaim: v.string(),
    readerEffect: v.string(), knownRisks: v.string(), voiceIntention: v.string(),
    pipelineSecret: v.optional(v.string()),   // Phase 29 D-1 — never persisted
  },
  handler: async (ctx, { pipelineSecret, ...args }) => {
    requirePipelineSecret(pipelineSecret)
    const existing = await ctx.db.query('briefs').withIndex('by_runId', q => q.eq('runId', args.runId)).first()
    if (existing) return await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() })
    return await ctx.db.insert('briefs', { ...args, updatedAt: Date.now() })
  },
})

export const patch = mutation({
  // Single-field edit from the console's BriefFieldTable (BRF-05) or the
  // strengthen/apply endpoint (BRF-06, §47.5).
  args: {
    runId: v.string(),
    field: v.union(
      v.literal('premise'), v.literal('currentPeg'), v.literal('centralClaim'),
      v.literal('readerEffect'), v.literal('knownRisks'), v.literal('voiceIntention'),
    ),
    value: v.string(),
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { runId, field, value, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)
    const existing = await ctx.db.query('briefs').withIndex('by_runId', q => q.eq('runId', runId)).first()
    if (!existing) throw new Error(`No briefs row for runId=${runId}`)
    return await ctx.db.patch(existing._id, { [field]: value, updatedAt: Date.now() })
  },
})

export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) =>
    await ctx.db.query('briefs').withIndex('by_runId', q => q.eq('runId', runId)).first(),
})
```

```typescript
// convex/storyLeads.ts — additive mutation alongside the existing insert/byRunId
export const setStatus = mutation({
  args: {
    leadId: v.id('story_leads'),
    status: v.union(v.literal('active'), v.literal('required'), v.literal('removed')),
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { leadId, status, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)
    return await ctx.db.patch(leadId, { status })
  },
})
```

### §47.5 — FastAPI endpoints (implemented in Plans 47-02/47-04 — declared here first)

Two endpoint pairs, both Clerk-guarded (`_require_clerk_jwt_control`), both `_emit_audit`-logging
("nothing silent"), mirroring the exact precedents named below:

```
POST  /issues/{run_id}/leads/{lead_id}/require            body {}                       -> 200 {leadId, status:'required'}
POST  /issues/{run_id}/leads/{lead_id}/remove              body {reason}                 -> 200 {leadId, status:'removed'}   (422 if reason empty)
PATCH /issues/{run_id}/brief                                body {field, value}           -> 200 (guarded edit + audit_log + Decision log)
POST  /issues/{run_id}/brief/{field}/strengthen/preview     body {currentValue}            -> 200 {proposedText, whatChanged}  (read-only, NO audit)
POST  /issues/{run_id}/brief/{field}/strengthen/apply       body {newText}                 -> 200 {resolution:'brief_field_strengthened'}
```

**Require/Remove (BRF-02)** mirror `factcheck.py::keep_claim`/`delete_claim` exactly: `Require`
calls `storyLeads:setStatus` with no reason required; `Remove` requires a non-empty `reason` (422
otherwise), calls `storyLeads:setStatus`, then `_emit_audit(..., reason=..., run_id=...)` so the
removal surfaces in the shared Decision log — `claim_checks`' own module docstring argues this
content/decision-log-writing shape must stay pipeline-routed, not a bare dashboard Convex mutation.

**Brief field-strengthen (BRF-06)** generalizes `revision.py::preview_passage_revision`/
`apply_passage_revision` to a Brief-field scope, exactly as Phase 45 generalized FCT-06 (claim-scope
→ passage-scope) rather than forking a third revision engine: `preview` proposes a stronger field
value (read-only, no mutation, no audit — mirrors `revise/preview`); `apply` writes the field via
`briefs:patch` + `_emit_audit` + a Decision-log entry (mirrors `revise/apply`). The Brief has no
built-in optimistic-concurrency token (unlike Sanity passage revision's `ifRevisionID`) — low
collision risk (one operator per run) makes always-overwrite-and-log acceptable, matching
`story_leads`/`verification_records`'s own lack of a revision-token concept.

`PATCH /issues/{run_id}/brief` (direct field edits from `BriefFieldTable`, BRF-05) is
content-touching per the same EDT-05 guarded-write pattern (D-12) — routed through this pipeline
boundary, `briefs:patch` + `_emit_audit`, never a bare dashboard `useMutation`.

### §47.6 — `_PIPELINE_SECRET_GUARDED_PATHS` additions (D-1 lesson, Phase 42-03)

Three new guarded paths, registered in `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py`
alongside the Convex-side `requirePipelineSecret` guard — omitting either half means every real call
500s Unauthorized despite mocked unit tests passing:

```python
"briefs:insert",
"briefs:patch",
"storyLeads:setStatus",
```

*All Phase 47 changes are additive: one new Convex table (`briefs`) with `insert`/`patch`/`byRunId`;
one new additive optional field on `story_leads` (`status`) with a new `setStatus` mutation; one new
DispatchState field (`brief`) and one new TypedDict (`Brief`, §7); three new guarded pipeline-secret
paths; five new FastAPI endpoints (implemented in 47-02/47-04, declared here first per contract-first
discipline). No existing field, table, or endpoint is renamed or removed; §7/§26/§37/§39/§42/§44/§45/
§46 shapes are otherwise unchanged.*

---

## §48 — Brief Entry Point (Phase 48)

"Start from my brief" becomes a REAL second pipeline entry point — not the stub the prototype ships
(`DERIVED-STATE-CONTRACT.md` §10). A human supplies premise, peg, organization, and optional source
material; the run **skips Signal Editor, Scout, Advocate, and Gate 1** and **enters at the
Researcher**. `verify_candidates` still runs on the human-supplied organization so its verification
record is never absent (ENT-04). This contract is written BEFORE any consuming code exists
(CLAUDE.md contract-first hard rule, mirroring §39/§42/§46/§47). All Phase 48 changes are
**ADDITIVE** — no existing field, table, or endpoint documented in §1-§47 is renamed or removed. The
DispatchState fields this section governs (`entry_mode`, `source_material`) are declared in §7 (see
above) — this section documents the endpoint, the seed shape, and the `runs.entryMode` Convex field.

### §48.1 — Graph topology: two conditional edges keyed on `entry_mode` (NOT a literal edge at START)

Both discovery and brief runs begin identically — `START → calibrator` stays a single UNCONDITIONAL
edge (the calibrator sets `style_brief` + resolves the narrator in both modes, D-02). The fork
happens at the two points where the two chains diverge:

```python
# packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
builder.add_edge(START, "calibrator")   # unconditional — unchanged in both modes

def route_by_entry_mode(state: DispatchState) -> str:
    """Back-compat default: absent/None entry_mode -> 'discovery' (every
    pre-Phase-48 DispatchState fixture never sets this key)."""
    return state.get("entry_mode") or "discovery"

# REPLACES the existing static edge calibrator -> signal_editor:
builder.add_conditional_edges(
    "calibrator",
    route_by_entry_mode,
    {"discovery": "signal_editor", "brief": "verify_candidates"},
)

# REPLACES the existing static edge verify_candidates -> advocate:
builder.add_conditional_edges(
    "verify_candidates",
    route_by_entry_mode,
    {"discovery": "advocate", "brief": "researcher"},
)
```

Discovery chain (byte-unchanged execution order): `START → calibrator → signal_editor → scout →
verify_candidates → advocate → editor_gate_1 → chronicler → researcher → verify_research → 7
writers → validate_sections → qa → editor_final → publisher`.

Brief chain (skips Signal Editor, Scout, Advocate, Gate 1, Chronicler): `START → calibrator →
verify_candidates → researcher → verify_research → 7 writers → validate_sections → qa →
editor_final → publisher`.

One compiled graph, one checkpointer. Every other edge is untouched. `verify_candidates` runs on
the brief path exactly as it does today (D-03) — no logic change; it persists a `VerificationRecord`
for the human-supplied organization unconditionally, and (per D-11) a definitive-fail check does NOT
remove the organization or halt the run on a brief-mode run (there is exactly one candidate, no
slate to re-resolve from). The chronicler is never reached on the brief path (D-12) —
`deliberation_transcript`/`deliberation_conversation` stay `None`, which every downstream consumer
already handles as an absent/optional value.

### §48.2 — `POST /pipeline/run/brief` (NEW endpoint, `api/control.py`)

Clerk-guarded (`_require_clerk_jwt_control`), sibling of `POST /pipeline/run` / `POST
/pipeline/tick` (NOT added to `api/brief.py`, which is the run-scoped content-edit family operating
on an *existing* run's Brief row — this endpoint creates the run). Reuses `_start_run` (§48.3) so
every shared run-launch discipline is preserved: the one-at-a-time gate (409 if a run is already
running), the RUN-06 budget start-gate (409 if over budget), the config load+snapshot, and the
`agentRuns:queueForRun` pre-population.

```python
class OrganizationInput(BaseModel):
    name: str
    website: Optional[str] = None
    charityNavigatorUrl: Optional[str] = None
    guidestarUrl: Optional[str] = None

class BriefRunBody(BaseModel):
    issueNumber: Optional[int] = None
    premise: str
    peg: str
    organization: OrganizationInput
    sourceMaterial: Optional[str] = None

POST /pipeline/run/brief
  body: BriefRunBody
  -> 200 {"runId": str}
  -> 422 if organization.name is empty/whitespace-only
  -> 409 if a run is already running (one-at-a-time gate, reused from /pipeline/run)
  -> 409 if the month-to-date budget gate rejects a new run (RUN-06, reused from /pipeline/run)
```

On success, emits a `run.triggered` audit row (mirrors `control.py::pipeline_run`'s existing
`_emit_audit` idiom) carrying `{"entryMode": "brief", "organization": <organization.name>}` in its
`after` payload — "nothing silent."

### §48.3 — `_start_run` extension (brief-mode seed) — `api/runs.py`

`_start_run` (the single authoritative run-launch body, Phase 25) gains four new OPTIONAL
parameters. Every existing caller (`/run/weekly`, `/pipeline/run`, `/pipeline/tick`) is unaffected —
all four default to values that reproduce today's exact behavior:

```python
async def _start_run(
    app: Any,
    *,
    issue_number: Optional[int],
    trigger_source: str,
    triggered_by: Optional[str] = None,
    # ...existing params unchanged...
    # ── Phase 48 additions ──────────────────────────────────────────────
    entry_mode: str = "discovery",
    winning_charity: Optional[dict] = None,          # CharityCandidate shape (§7)
    brief: Optional[dict] = None,                     # Brief shape (§7)
    source_material: Optional[str] = None,
    agent_keys_override: Optional[list[str]] = None,
) -> str: ...
```

**The brief-run seed** (only applied when `entry_mode == "brief"`):
- `initial_state["entry_mode"] = "brief"` (always set, both modes — discovery runs get
  `"discovery"` explicitly rather than relying on the router's `or "discovery"` fallback alone).
- `initial_state["winning_charity"]` — a `CharityCandidate` built from the human-supplied
  `organization`, with every unscouted field defaulted `""`/`None`, mirroring the EXISTING
  `agents/editor.py` D-14 "all-candidates-killed" synthetic-winner precedent (a human-name-only
  `CharityCandidate` dict is not a new shape — it is the identical problem already solved once in
  this codebase):
  ```python
  {
      "name": organization.name, "location": "", "website": organization.website or "",
      "charityNavigatorUrl": organization.charityNavigatorUrl, "guidestarUrl": organization.guidestarUrl,
      "foundingYear": None, "assetRange": "", "focusArea": "", "missionStatement": "",
      "scoutSummary": "", "whyOverlooked": "", "advocateArgument": None, "advocateScore": None,
  }
  ```
- `initial_state["candidates"] = [winning_charity]` — so `verify_candidates` (which iterates
  `state["candidates"]`) has its input (D-05). `researcher` never reads `state["candidates"]`, only
  `state["winning_charity"]` — an emptied/killed single-candidate list has zero effect on run
  continuation (Pitfall 2).
- `initial_state["brief"]` — the 6-field `Brief` (§7), mapped directly from the human input, NOT an
  `_assemble_brief` re-projection (D-06/D-08): `premise → premise`, `peg → currentPeg`,
  `centralClaim`/`readerEffect`/`knownRisks`/`voiceIntention` start blank (the operator fills them
  via the shipped BRF-06 strengthen once Stage 1 loads — `style_brief` does not exist yet at request
  time, so `voiceIntention` cannot be defaulted from it without blocking the HTTP response on
  `calibrator`'s LLM call).
- `initial_state["source_material"] = source_material` when non-empty (D-10).

**`briefs:insert` is called INSIDE `_start_run`**, immediately after `runs:create`, whenever `brief
is not None` — never console-side, never a separate endpoint call. `_start_run` mints the `run_id`
internally, so this is the only place the write can happen without either duplicating the run-id
minting logic or leaving a partial-failure window (a run that starts but never gets its Brief row).
This mirrors §47.3's own `briefs:insert` write, just for a run that never reaches `editor_gate_1`.

**The reduced brief-run `agentRuns:queueForRun` set** (`agent_keys_override`, D-16) — reflects the
REAL brief path, not phantom skipped steps:

```python
BRIEF_AGENT_KEYS = [
    "calibrator", "verify_candidates", "researcher", "verify_research",
    *SECTION_WRITERS,
    "validate_sections", "qa", "editor_final", "publisher",
]
# NO signal_editor, scout, advocate, editor_gate_1, chronicler.
```

The full 20-step list remains the default (`agent_keys_override=None`) for every existing caller —
byte-unchanged behavior.

### §48.4 — `runs.entryMode` Convex field (additive)

```typescript
// convex/schema.ts — runs table, additive field
entryMode: v.optional(v.union(v.literal('discovery'), v.literal('brief'))),
// absent = 'discovery' (mirrors story_leads.status's "absent = default" precedent, §47.2).
// Set to 'brief' only by runs:create for a brief-started run (§48.3). Read by the Stage-1
// rendering variant (BriefOrgCard / the entryMode branch in StoryBriefScreen.tsx) to
// distinguish a brief-started run from a discovery-started run at the console layer —
// DispatchState['entry_mode'] (pipeline-internal) is invisible to the console; only
// Convex-persisted fields are (Pitfall 3).
```

`convex/runs.ts::create` gains a matching optional `entryMode` arg, destructured and passed through
to the `ctx.db.insert('runs', {...})` call. The existing idempotent `by_runId` guard and every other
arg (`workspace_id`, `runId`, `triggerSource`, `triggeredBy`, `pipelineSecret`) are byte-unchanged.

### §48.5 — Additive-only summary

*All Phase 48 changes are additive: two new DispatchState fields (`entry_mode`, `source_material`,
§7); one new FastAPI endpoint (`POST /pipeline/run/brief`, §48.2); four new optional `_start_run`
parameters (§48.3) with defaults that reproduce every existing caller's exact current behavior; one
new additive optional field on `runs` (`entryMode`, §48.4) with a matching `runs:create` arg. No
existing field, table, or endpoint documented in §1-§47 is renamed or removed. The graph topology
change is two `add_edge` → `add_conditional_edges` conversions (§48.1) — every other edge, and the
entire discovery-mode execution order, is byte-unchanged.*

---

## §49 — Roles & Permissions (Phase 49)

This contract is written BEFORE any enforcement code exists (CLAUDE.md contract-first hard rule,
mirroring §39/§48). It declares the `users.role` value-vocabulary change (D-02), the new `comments`
table (D-12), the `convex/comments.ts` function signatures, the six-action editor-gate inventory
(ROL-02), and the verbatim §6 locked labels (D-09). Plans 49-03/49-04/49-05 implement these shapes
verbatim — no field name, table shape, error envelope, or label string may be invented later.

### §49.1 — `users.role` value-vocabulary change (D-02)

The FIELD NAME `role` on the `users` table is UNCHANGED. Only the string VALUES change, from
`"admin" | "operator"` to `"Editor-in-chief" | "Collaborator"`. The source of truth is Clerk
`publicMetadata.role`, exposed as a JWT claim named `role` on BOTH the default/customized session
token AND the named `"convex"` JWT template (see §49.4's enforcement mechanisms — the FastAPI side
reads the claim off the default session token already passed to `_require_clerk_jwt_control`; the
Convex side reads it off `ctx.auth.getUserIdentity()` via the named `"convex"` template). `users.role`
remains an optional future mirror — the JIT upsert in `convex/users.ts` (`upsertCurrentUser`) is not
live-wired into any app code path today, so `users.role` is NOT the live read path for either
enforcement surface; it exists as a schema-level placeholder for a future DB-mirrored role.

### §49.2 — `comments` Convex table (NEW)

```typescript
// convex/schema.ts
comments: defineTable({
  workspace_id: v.string(),
  issueNumber: v.number(),           // PRIMARY target key (issue-keyed, §40)
  stage: v.optional(v.string()),     // 'story'|'draft'|'fact-check'|'voice'|'approval'|undefined
  anchorRef: v.optional(v.string()), // opaque free-form (claim index / section name) — screen-level granularity only, NOT re-anchored
  text: v.string(),
  authorId: v.string(),              // Clerk subject from ctx.auth.getUserIdentity() — NEVER client-supplied
  createdAt: v.number(),
})
  .index('by_workspace_issueNumber', ['workspace_id', 'issueNumber'])
  .index('by_workspace', ['workspace_id']),
```

**APPEND-ONLY invariant for this phase:** `add` only — no `update`/`patch`/`remove`/`delete`
function is ever defined against this table (mirrors §39.1's `charity_corrections` invariant). Flat
comments only — no threading, no @mentions, no notifications (D-13).

### §49.3 — `convex/comments.ts` functions (NEW)

```typescript
// Mutation — auth lane = ANY authenticated identity (inline ctx.auth.getUserIdentity(),
// NOT requireOperator, NOT requireEditor — commenting is the one write BOTH roles may perform):
add({ workspace_id, issueNumber, stage?, anchorRef?, text }): Promise<Id<'comments'>>
  // const identity = await ctx.auth.getUserIdentity()
  // if (!identity) throw new ConvexError({ code: 'unauthorized', message: 'Not authenticated' })
  // authorId = identity.subject; createdAt = Date.now()

// Query — UNGUARDED read (matches charity_corrections:listByCharityKey, §39.2):
listByIssueNumber({ workspace_id, issueNumber, stage? }): Promise<Doc<'comments'>[]>
  // by_workspace_issueNumber index, sorted createdAt ASC (chronological — oldest first);
  // when `stage` is supplied, return only rows with that stage.
```

### §49.4 — Six-action editor gate (D-06, D-07)

Exactly these six actions, no more, no fewer, are gated to Editor-in-chief:

| Action | Surface | Handler | Mechanism |
|---|---|---|---|
| Apply revision | FastAPI | revision.py:355 apply_passage_revision | `Depends(_require_editor)` swap |
| Confirm evidence replacement | FastAPI | factcheck.py:546 apply_claim_evidence | `Depends(_require_editor)` swap |
| Approve the Voice Pass | FastAPI | signoffs.py:55 record_sign_off (kind=="sounds-human" ONLY) | in-handler branch, NOT route Depends |
| Publish issue | FastAPI | review.py:67 publish_issue | `Depends(_require_editor)` swap |
| Make instruction active | Convex | promptVersions.ts:267 activate | `requireEditor(ctx)` swap |
| Mark Do not use | Convex | charities.ts:176 setStatus (status=='blocklisted') | `requireEditor(ctx)` swap |

**Rejection shapes:**
- FastAPI → `HTTPException(403, detail={"reason": "forbidden_role", "message": "Editor-in-chief only."})`
- Convex → `throw new ConvexError({ code: 'forbidden_role', message: 'Editor-in-chief only.' })`

The local-dev sentinel `{"sub":"local-dev-operator"}` (returned by `_require_clerk_jwt_control` when
`CLERK_JWT_ISSUER_DOMAIN` is unset) resolves to Editor-in-chief on the FastAPI side (D-04). Convex
has no equivalent sentinel and fails closed on an absent/undefined role.

### §49.5 — Verbatim locked labels (from DERIVED-STATE-CONTRACT §6, D-09)

Reproduced EXACTLY — do not paraphrase:

- Apply revision → `Apply revision 🔒 editor only`
- Confirm evidence replacement → (no distinct label; shares the Apply lock — server still gates per §49.4)
- Approve the Voice Pass → `Voice approval 🔒 Editor-in-chief only`
- Publish issue → `Collaborators can review and comment, not publish.`
- Make instruction active → `Make active 🔒 Editor-in-chief only`
- Mark Do not use → `🔒 editor only`

*All Phase 49 changes documented above are additive: no field is renamed or removed; the `users.role`
field name is untouched (only its string values are re-vocabularied, §49.1); `comments` is a wholly
new additive table (§49.2/§49.3); the six gates (§49.4) are additive authorization layered on top of
existing authentication — no existing auth dependency (`_require_clerk_jwt_control`, `requireOperator`)
is removed or altered. No new `deliberationEvents.eventType` literal is added — denials are not
audited per D-08, and comments are their own dedicated table, not a `deliberationEvents` concern.*
