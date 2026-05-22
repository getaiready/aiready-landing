import { json, allowedCorsHeaders, LandingEvent as Event } from './utils';

export async function handler(event: Event) {
  const method = event.requestContext?.http?.method || 'POST';

  if (method === 'OPTIONS') {
    return json(200, {}, allowedCorsHeaders());
  }

  try {
    if (!event.body) return json(400, { error: 'Missing request body' });

    const payload = JSON.parse(event.body);
    // Accept `directory` relative to repo root, default '.'
    const directory = payload.directory || '.';
    const toolsArray = payload.tools
      ? payload.tools.split(',').map((t: string) => t.trim())
      : undefined;
    const include = payload.include ? payload.include.split(',') : undefined;
    const exclude = payload.exclude ? payload.exclude.split(',') : undefined;

    const options = {
      rootDir: directory,
      tools: toolsArray,
      include,
      exclude,
    };

    // Run programmatic analysis (dynamic import to avoid build-time type errors)
    const { analyzeUnified } = await import('@aiready/cli');
    const results = await analyzeUnified(options as unknown as any);

    // Normalize execution time to seconds (CLI displays seconds)
    const summary = {
      ...results.summary,
      executionTime: Number((results.summary.executionTime / 1000).toFixed(2)),
    };

    const responseBody: Record<string, unknown> = {
      ...results,
      summary,
    };

    // Optional scoring: replicate CLI behavior when `score` flag is set
    if (payload.score) {
      const toolScores: Map<string, number> = new Map();

      if (results.duplicates && options.tools?.includes('patterns')) {
        const { calculatePatternScore } =
          await import('@aiready/pattern-detect');
        const score = calculatePatternScore(
          results.duplicates as unknown as any[],
          results.patterns?.length || 0
        );
        toolScores.set('pattern-detect', score);
      }

      if (results.context && options.tools?.includes('context')) {
        const { calculateContextScore } =
          await import('@aiready/context-analyzer');
        const ctx = results.context as Array<{
          contextBudget?: number;
          importDepth?: number;
          fragmentationScore?: number;
          severity?: string;
        }>;
        const contextSummary = {
          avgContextBudget:
            ctx.reduce((sum: number, r) => sum + (r.contextBudget || 0), 0) /
            Math.max(1, ctx.length),
          maxContextBudget: Math.max(...ctx.map((r) => r.contextBudget || 0)),
          avgImportDepth:
            ctx.reduce((sum: number, r) => sum + (r.importDepth || 0), 0) /
            Math.max(1, ctx.length),
          maxImportDepth: Math.max(...ctx.map((r) => r.importDepth || 0)),
          avgFragmentation:
            ctx.reduce(
              (sum: number, r) => sum + (r.fragmentationScore || 0),
              0
            ) / Math.max(1, ctx.length),
          criticalIssues: ctx.filter((r) => r.severity === 'critical').length,
          majorIssues: ctx.filter((r) => r.severity === 'major').length,
        };
        const score = calculateContextScore(contextSummary as any);
        toolScores.set('context-analyzer', score);
      }

      if (results.consistency && options.tools?.includes('consistency')) {
        const { calculateConsistencyScore } =
          await import('@aiready/consistency');
        const consistency = results.consistency as {
          results?: Array<{ issues: any[] }>;
          summary: { filesAnalyzed: number };
        };
        const issues = consistency.results?.flatMap((r) => r.issues) || [];
        const score = calculateConsistencyScore(
          issues,
          consistency.summary.filesAnalyzed || 0
        );
        toolScores.set('consistency', score);
      }

      // Calculate overall score if we have tool outputs
      if (toolScores.size > 0) {
        const { calculateOverallScore, parseWeightString } =
          await import('@aiready/core');
        const cliWeights = parseWeightString(payload.weights);
        const scoring = calculateOverallScore(toolScores, options, cliWeights);
        responseBody.scoring = scoring;
      }
    }

    return json(200, { ok: true, results: responseBody });
  } catch (err: unknown) {
    console.error('scan handler error', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return json(500, { error: message });
  }
}
