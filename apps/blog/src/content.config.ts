import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { snapshotLoader } from './lib/snapshot-loader';

const schema = z.object({
  publish: z.literal(true),
  title: z.string().min(1),
  slug: z.string().min(1),
  date: z.union([z.string(), z.date()]).transform(value => new Date(value).toISOString()),
  updated: z.union([z.string(), z.date()]).optional().transform(value => value ? new Date(value).toISOString() : undefined),
  section: z.enum(['기술', '일상']).optional(),
  tags: z.array(z.string()).default([]),
  summary: z.string().default(''),
  series: z.string().optional(),
  seriesOrder: z.number().optional(),
});

const collection = (folder: 'posts' | 'notes') => defineCollection({
  loader: snapshotLoader(folder),
  schema,
});
export const collections = { posts: collection('posts'), notes: collection('notes') };
