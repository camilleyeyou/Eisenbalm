import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'charity',
  title: 'Charity',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Charity Name',
      type: 'string',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'name', maxLength: 96 },
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'string',
      description: 'City and country, e.g. "Chicago, IL" or "Nairobi, Kenya"',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'website',
      title: 'Website URL',
      type: 'url',
    }),
    defineField({
      name: 'charityNavigatorUrl',
      title: 'Charity Navigator URL',
      type: 'url',
    }),
    defineField({
      name: 'guidestarUrl',
      title: 'GuideStar / Candid URL',
      type: 'url',
    }),
    defineField({
      name: 'foundingYear',
      title: 'Founding Year',
      type: 'number',
      validation: Rule => Rule.integer().min(1800).max(new Date().getFullYear()),
    }),
    defineField({
      name: 'assetRange',
      title: 'Asset Range',
      type: 'string',
      description: 'Approximate asset size, e.g. "$100K–$500K"',
    }),
    defineField({
      name: 'focusArea',
      title: 'Focus Area',
      type: 'string',
      description: 'e.g. "Animal welfare", "Environmental justice", "Housing"',
    }),
    defineField({
      name: 'missionStatement',
      title: 'Mission Statement',
      type: 'text',
      rows: 3,
      description: 'Short mission statement, sourced directly from the charity',
    }),
    defineField({
      name: 'scoutNotes',
      title: 'Scout Notes',
      type: 'text',
      rows: 4,
      description: 'Scout agent\'s assessment of why this charity is overlooked and worth featuring',
    }),
    defineField({
      name: 'firstFeaturedIn',
      title: 'First Featured In',
      type: 'reference',
      to: [{ type: 'weeklyIssue' }],
      description: 'Populated automatically when the issue is published',
    }),
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'location',
    },
  },
})
