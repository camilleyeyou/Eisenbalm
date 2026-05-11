import { defineField, defineType } from 'sanity'

// Seeded once. These are the characters, not the models.
// agentId values must match the IDs used in the pipeline and in Convex.

export default defineType({
  name: 'agentProfile',
  title: 'Agent Profile',
  type: 'document',
  fields: [
    defineField({
      name: 'agentId',
      title: 'Agent ID',
      type: 'slug',
      description: 'Must match pipeline agent ID exactly: calibrator | scout | advocate | editor | researcher | origin-story | problem-statement | founder-bio | case-study | game | bonus | design | qa | publisher',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'displayName',
      title: 'Display Name',
      type: 'string',
      description: 'The name shown on the deliberation layer, e.g. "The Scout"',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'role',
      title: 'Role',
      type: 'string',
      description: 'One-line function, e.g. "Finds the charities nobody else bothers looking for"',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'personality',
      title: 'Personality',
      type: 'text',
      rows: 4,
      description: 'Character description shown on the agent profile card in the deliberation layer',
    }),
    defineField({
      name: 'avatar',
      title: 'Avatar',
      type: 'image',
      description: 'Optional. If absent, the frontend renders a generated placeholder.',
    }),
  ],
  preview: {
    select: {
      title: 'displayName',
      subtitle: 'role',
    },
  },
})
