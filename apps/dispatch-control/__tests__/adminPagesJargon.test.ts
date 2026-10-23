/**
 * Plan 56-11b tripwire: no engineering jargon in the UI strings of the dial
 * sub-pages (Quality tests, Schedule and limits, Money, Settings, Charities).
 * Fix flagged strings in the source rather than allow-listing them.
 */
import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { jargonInSource } from './helpers/jargonScan'

const ROOT = resolve(__dirname, '..')
const FILES = [
  'app/admin/tests/page.tsx',
  'app/admin/tests/_components/DriftScoreboard.tsx',
  'app/admin/tests/_components/ScenarioCard.tsx',
  'app/admin/tests/_components/ShadowRunPanel.tsx',
  'app/admin/automation/page.tsx',
  'app/admin/automation/_components/AutomationPanel.tsx',
  'app/admin/automation/_components/AutoPublishBanner.tsx',
  'app/admin/automation/_components/AutoPublishToggle.tsx',
  'app/admin/automation/_components/BudgetCapsPanel.tsx',
  'app/admin/automation/_components/NextRunDisplay.tsx',
  'app/admin/finance/page.tsx',
  'app/admin/settings/page.tsx',
  'app/admin/settings/_components/AuditLogViewer.tsx',
  'app/admin/settings/_components/NotificationSettings.tsx',
  'app/admin/charities/page.tsx',
  'components/help/helpCopy.ts',
]

describe('dial sub-pages have no jargon in UI strings', () => {
  for (const f of FILES) {
    it(f, () => {
      expect(jargonInSource(resolve(ROOT, f))).toEqual([])
    })
  }
})
