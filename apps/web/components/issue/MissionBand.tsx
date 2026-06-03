/**
 * MissionBand — sitewide purpose statement band (Phase 19).
 * UI-SPEC §Section 5 Mission Band.
 *
 * RSC. Full-width dark band with CONSTANT sitewide copy.
 * background #1A1714, text #E8E3D6.
 *
 * NAMED PROTOTYPE EXCEPTION: padding 22px 32px — verbatim from prototype.
 * Do NOT change to 24px. This is the exact prototype spacing value.
 *
 * CONSTANT sitewide copy (UI-SPEC §Copywriting Contract — do not alter):
 *   "Every week, Jesse A. Eisenbalm spotlights one overlooked charity
 *   and donates 100% of lip balm proceeds to fund it.
 *   No pledge, no percentage — every dollar."
 */

export function MissionBand() {
  return (
    <div className="mission-band">
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '16px',
          fontStyle: 'italic',
          maxWidth: '760px',
          margin: '0 auto',
          lineHeight: 1.5,
          color: '#E8E3D6',
        }}
      >
        Every week, Jesse A. Eisenbalm spotlights one overlooked charity and donates{' '}
        <b style={{ color: '#fff', fontStyle: 'normal', fontWeight: 500 }}>
          100% of lip balm proceeds
        </b>{' '}
        to fund it. No pledge, no percentage — every dollar.
      </p>
    </div>
  )
}
