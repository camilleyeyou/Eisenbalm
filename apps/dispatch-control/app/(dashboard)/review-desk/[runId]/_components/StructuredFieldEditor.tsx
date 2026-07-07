'use client'
/**
 * Structured field editors (Phase 31 EDT-02, Plan 31-05 Task 2).
 *
 * Covers every non-prose editable surface from the Field Inventory
 * (31-RESEARCH.md): headline text inputs, theme (hex + whitelist font
 * dropdowns + visual direction), game embed (headline/description/embedCode
 * with a client-side byte-cap mirror of the server's 50000-byte HARD block),
 * PDF data points (3 FIXED {stat,source} rows, no add/remove per Sanity
 * `Rule.length(3)`), and the bonus editor which branches on the run's
 * `bonusType` (D-05): specAd -> BlockEditor; bigBudget -> per-storyboard
 * AssetUploadSlot images; jingle -> lyrics/sunoPrompt textareas +
 * a suno-audio AssetUploadSlot.
 *
 * All components here are presentational — they call `onChange` with the
 * next value and let the parent (SectionEditorPanel) own dirty state and
 * the actual save call. AssetUploadSlot is the one exception: asset uploads
 * save immediately (D-11/D-12), independent of the section's explicit-save
 * harness, per CONTEXT D-11/D-12/D-13.
 */
import type { ContentBlock, KeyDataPoint, UploadAssetResult } from '@/lib/contentPatchClient'
import BlockEditor from './BlockEditor'
import AssetUploadSlot from './AssetUploadSlot'

// ── Shared font whitelist (deliberately duplicated from apps/web/lib/theme.ts
// FONT_WHITELIST — cross-app import is not wired for this monorepo's Next
// build boundaries; matches the plan's <interfaces> canonical list). ────────
export const FONT_WHITELIST = [
  'Playfair Display',
  'Lora',
  'Inter',
  'Cormorant Garamond',
  'Merriweather',
  'DM Serif Display',
  'Fraunces',
  'Newsreader',
  'IBM Plex Mono',
] as const

/** Server-side hard cap mirrored client-side for immediate feedback (D-08). */
export const GAME_EMBED_BYTE_CAP = 50000

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/

const inputClass =
  'min-h-[44px] w-full rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-2 text-sm text-[color:var(--color-ink)]'
const labelClass = 'flex flex-col gap-1 text-xs font-medium text-[color:var(--color-ink-soft)]'
const fieldErrorClass = 'text-xs text-[color:var(--color-vermilion)]'

function hasError(fieldErrors: string[] | undefined, name: string): boolean {
  return Boolean(fieldErrors?.includes(name))
}

// ── HeadlineEditor ───────────────────────────────────────────────────────────

interface HeadlineEditorProps {
  headline: string
  onChange: (headline: string) => void
}

export function HeadlineEditor({ headline, onChange }: HeadlineEditorProps) {
  return (
    <label className={labelClass}>
      Headline
      <input
        type="text"
        value={headline}
        onChange={e => onChange(e.target.value)}
        className={inputClass}
      />
    </label>
  )
}

// ── ThemeEditor ───────────────────────────────────────────────────────────────

export interface ThemeFields {
  primaryColor: string
  accentColor: string
  backgroundColor: string
  textColor: string
  fontDisplay: string
  fontBody: string
  visualDirection: string
}

interface ThemeEditorProps {
  theme: ThemeFields
  onChange: (theme: ThemeFields) => void
  fieldErrors?: string[]
}

const THEME_COLOR_FIELDS: { key: keyof ThemeFields; label: string }[] = [
  { key: 'primaryColor', label: 'Primary color' },
  { key: 'accentColor', label: 'Accent color' },
  { key: 'backgroundColor', label: 'Background color' },
  { key: 'textColor', label: 'Text color' },
]

export function ThemeEditor({ theme, onChange, fieldErrors }: ThemeEditorProps) {
  function set<K extends keyof ThemeFields>(key: K, value: ThemeFields[K]) {
    onChange({ ...theme, [key]: value })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {THEME_COLOR_FIELDS.map(({ key, label }) => {
          const value = theme[key]
          const valid = HEX_REGEX.test(value)
          const invalid = hasError(fieldErrors, key)
          return (
            <label key={key} className={labelClass}>
              {label}
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-9 w-9 shrink-0 rounded-[2px] border border-[color:var(--color-faint)]"
                  style={{ backgroundColor: valid ? value : 'transparent' }}
                />
                <input
                  type="text"
                  aria-label={label}
                  value={value}
                  placeholder="#RRGGBB"
                  onChange={e => set(key, e.target.value)}
                  className={inputClass}
                />
              </div>
              {(invalid || (value && !valid)) && (
                <span className={fieldErrorClass}>
                  Must be a 6-digit hex color, e.g. #253AD4.
                </span>
              )}
            </label>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Display font
          <select
            value={theme.fontDisplay}
            onChange={e => set('fontDisplay', e.target.value)}
            className={inputClass}
          >
            {FONT_WHITELIST.map(font => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
          {hasError(fieldErrors, 'fontDisplay') && (
            <span className={fieldErrorClass}>Must be one of the approved fonts.</span>
          )}
        </label>

        <label className={labelClass}>
          Body font
          <select
            value={theme.fontBody}
            onChange={e => set('fontBody', e.target.value)}
            className={inputClass}
          >
            {FONT_WHITELIST.map(font => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
          {hasError(fieldErrors, 'fontBody') && (
            <span className={fieldErrorClass}>Must be one of the approved fonts.</span>
          )}
        </label>
      </div>

      <label className={labelClass}>
        Visual direction
        <textarea
          value={theme.visualDirection}
          rows={3}
          onChange={e => set('visualDirection', e.target.value)}
          className={inputClass}
        />
      </label>
    </div>
  )
}

// ── GameEditor ────────────────────────────────────────────────────────────────

export interface GameFields {
  headline: string
  description: string
  embedCode: string
}

interface GameEditorProps {
  game: GameFields
  onChange: (game: GameFields) => void
}

export function GameEditor({ game, onChange }: GameEditorProps) {
  function set<K extends keyof GameFields>(key: K, value: GameFields[K]) {
    onChange({ ...game, [key]: value })
  }

  const byteLength = new TextEncoder().encode(game.embedCode).length
  const overCap = byteLength > GAME_EMBED_BYTE_CAP

  return (
    <div className="flex flex-col gap-3">
      <label className={labelClass}>
        Headline
        <input
          type="text"
          value={game.headline}
          onChange={e => set('headline', e.target.value)}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Description
        <input
          type="text"
          value={game.description}
          onChange={e => set('description', e.target.value)}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Embed code
        <textarea
          value={game.embedCode}
          rows={8}
          onChange={e => set('embedCode', e.target.value)}
          className={`${inputClass} font-[family-name:var(--font-mono)]`}
        />
        <span
          className={
            overCap
              ? fieldErrorClass
              : 'text-xs text-[color:var(--color-ink-soft)]'
          }
        >
          {byteLength.toLocaleString()} / {GAME_EMBED_BYTE_CAP.toLocaleString()} bytes
          {overCap ? ' — over the 50000-byte cap, save will be rejected.' : ''}
        </span>
      </label>
    </div>
  )
}

// ── PdfDataPointsEditor (exactly 3 fixed rows) ────────────────────────────────

export interface PdfFields {
  problemStatement: string
  keyDataPoints: KeyDataPoint[]
  interventionMechanism: string
}

interface PdfDataPointsEditorProps {
  pdf: PdfFields
  onChange: (pdf: PdfFields) => void
}

/** Pads/truncates to exactly 3 rows — the schema is `Rule.length(3)`. */
function normalizeKeyDataPoints(points: KeyDataPoint[]): KeyDataPoint[] {
  const rows = [...points]
  while (rows.length < 3) rows.push({ stat: '', source: '' })
  return rows.slice(0, 3)
}

export function PdfDataPointsEditor({ pdf, onChange }: PdfDataPointsEditorProps) {
  const rows = normalizeKeyDataPoints(pdf.keyDataPoints)

  function setRow(index: number, patch: Partial<KeyDataPoint>) {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r))
    onChange({ ...pdf, keyDataPoints: next })
  }

  return (
    <div className="flex flex-col gap-3">
      <label className={labelClass}>
        Problem statement (PDF)
        <textarea
          value={pdf.problemStatement}
          rows={4}
          onChange={e => onChange({ ...pdf, problemStatement: e.target.value })}
          className={inputClass}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-[color:var(--color-ink-soft)]">
          Key data points (fixed at 3)
        </span>
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid grid-cols-1 gap-2 border border-[color:var(--color-faint)] bg-white p-3 sm:grid-cols-2"
          >
            <label className={labelClass}>
              Stat #{index + 1}
              <input
                type="text"
                aria-label={`Key data point ${index + 1} stat`}
                value={row.stat}
                onChange={e => setRow(index, { stat: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Source #{index + 1}
              <input
                type="text"
                aria-label={`Key data point ${index + 1} source`}
                value={row.source}
                onChange={e => setRow(index, { source: e.target.value })}
                className={inputClass}
              />
            </label>
          </div>
        ))}
      </div>

      <label className={labelClass}>
        Intervention mechanism (PDF)
        <textarea
          value={pdf.interventionMechanism}
          rows={3}
          onChange={e => onChange({ ...pdf, interventionMechanism: e.target.value })}
          className={inputClass}
        />
      </label>
    </div>
  )
}

// ── BonusEditor (variant-driven per bonusType, D-05) ──────────────────────────

export interface BonusFields {
  headline: string
  body: ContentBlock[]
  lossy?: boolean
  lyrics: string
  sunoPrompt: string
  sunoAudioUrl?: string
  storyboards: { url?: string }[]
}

interface BonusEditorProps {
  runId: string
  ifRevisionID: string
  bonusType: 'specAd' | 'bigBudget' | 'jingle'
  bonus: BonusFields
  onChange: (bonus: BonusFields) => void
  onAssetUploaded: (result: UploadAssetResult) => void
}

export function BonusEditor({
  runId,
  ifRevisionID,
  bonusType,
  bonus,
  onChange,
  onAssetUploaded,
}: BonusEditorProps) {
  return (
    <div className="flex flex-col gap-3">
      <label className={labelClass}>
        Headline
        <input
          type="text"
          value={bonus.headline}
          onChange={e => onChange({ ...bonus, headline: e.target.value })}
          className={inputClass}
        />
      </label>

      {bonusType === 'specAd' && (
        <BlockEditor
          blocks={bonus.body}
          lossy={bonus.lossy}
          onChange={body => onChange({ ...bonus, body })}
        />
      )}

      {bonusType === 'bigBudget' && (
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium text-[color:var(--color-ink-soft)]">
            Storyboard frames
          </span>
          {[...bonus.storyboards, { url: undefined }].map((frame, index) => (
            <AssetUploadSlot
              key={index}
              runId={runId}
              slot={`storyboard-${index}`}
              kind="image"
              currentAssetUrl={frame.url}
              ifRevisionID={ifRevisionID}
              onUploaded={onAssetUploaded}
            />
          ))}
        </div>
      )}

      {bonusType === 'jingle' && (
        <>
          <label className={labelClass}>
            Lyrics
            <textarea
              value={bonus.lyrics}
              rows={6}
              onChange={e => onChange({ ...bonus, lyrics: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Suno style prompt
            <textarea
              value={bonus.sunoPrompt}
              rows={3}
              onChange={e => onChange({ ...bonus, sunoPrompt: e.target.value })}
              className={inputClass}
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[color:var(--color-ink-soft)]">
              Suno audio
            </span>
            <AssetUploadSlot
              runId={runId}
              slot="suno-audio"
              kind="audio"
              currentAssetUrl={bonus.sunoAudioUrl}
              ifRevisionID={ifRevisionID}
              onUploaded={onAssetUploaded}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default function StructuredFieldEditor() {
  // Thin marker export — SectionEditorPanel imports the named sub-editors
  // above directly (HeadlineEditor/ThemeEditor/GameEditor/
  // PdfDataPointsEditor/BonusEditor); this default export exists only so the
  // file has a conventional default for any future generic dispatch use.
  return null
}
