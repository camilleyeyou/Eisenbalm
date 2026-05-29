import { defineField, defineType } from 'sanity'

// Phase 16 (NRR-01): Per-issue editorial voice variation. Andrew picks a narrator
// from these documents on weeklyIssue.narrator; the Calibrator merges the
// voiceConstraints into the StyleBrief and the QA judge layers in voiceRubric +
// exampleSamples at call time.
// Mirrors the agentProfile.ts pattern verbatim — same defineType/defineField
// builder, same preview shape.

export default defineType({
  name: 'narratorProfile',
  title: 'Narrator Profile',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'Display name shown on the masthead chip and in the Studio narrator picker, e.g. "Werner Herzog" or "Jesse Eisenbalm"',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      description: 'Used in seed _id (narrator-{slug}) and future /narrators/[slug] route. Auto-generated from name.',
      options: { source: 'name', maxLength: 96 },
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'voiceConstraints',
      title: 'Voice Constraints (PERSONA_BLOCK)',
      type: 'text',
      rows: 8,
      description: 'The narrator-controlled persona register. Merged with UNIVERSAL_CORE in lib/voice.assemble_voice() and pushed into style_brief["voice"] by the Calibrator. Replaces the JESSE_PERSONA_BLOCK portion when set. Universal rules (no exclamation marks, Fortune-500 gravity, no AI references, forbidden sentimentality words) are NOT here — they live in UNIVERSAL_CORE and apply to every narrator including Jesse.',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'voiceRubric',
      title: 'Voice Rubric (QA persona register)',
      type: 'text',
      rows: 8,
      description: 'Narrator-specific QA scoring rubric. Appended at call time to rubric.md universal axes (gravity, sentiment, irony-signaling, precision, cross-section-consistency). When unset, QA falls back to the existing Jesse rubric.',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'exampleSamples',
      title: 'Example Samples',
      type: 'array',
      of: [{ type: 'text' }],
      description: 'Short prose samples proving the voice. Used as few-shot anchors in the QA system prompt and as preview affordance in Studio. PLAIN strings, NOT Portable Text (consistent with chronicler turn shape).',
      validation: Rule => Rule.min(1).max(5),
    }),
    defineField({
      name: 'active',
      title: 'Active',
      type: 'boolean',
      description: 'When false, the pipeline silently falls back to Jesse and emits a non-blocking warning on the deliberation event log. Lets Andrew park a narrator without deleting it.',
      initialValue: true,
    }),
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'voiceConstraints',
    },
    prepare({ title, subtitle }) {
      // Truncate the persona block in the Studio card preview so the list view stays readable.
      const short = typeof subtitle === 'string' && subtitle.length > 80
        ? subtitle.slice(0, 80) + '…'
        : subtitle || ''
      return { title: title || 'Untitled narrator', subtitle: short }
    },
  },
})
