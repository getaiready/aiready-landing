/**
 * All blog post metadata - aggregated from categorized hubs.
 * This file acts as the central registry for the landing app.
 */
import { strategyMeta } from './strategy-meta';
import { technicalMeta } from './technical-meta';
import { seriesMeta } from './series-meta';
import { type BlogPostMeta } from './types';

export const allPostMeta: BlogPostMeta[] = [
  ...strategyMeta,
  ...technicalMeta,
  ...seriesMeta,
];
