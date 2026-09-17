export type ReadOperation =
  | 'stats' | 'featured-courses' | 'featured-professors' | 'catalog-v2'
  | 'share-identity' | 'search' | 'courses' | 'professors' | 'evaluations'
  | 'comments' | 'review-selections' | 'course-detail' | 'professor-detail'
  | 'paths' | 'course-professors' | 'evaluation-count' | 'search-evidence';

const TRANSIENT_CODES = new Set(['UND_ERR_SOCKET', 'ECONNRESET']);

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function transportCode(error: unknown): string | undefined {
  const root = record(error);
  // A SQL/server response must not become retryable because of a nested cause.
  if (root.name !== 'NeonDbError' || root.code != null) return undefined;
  const code = record(record(root.sourceError).cause).code;
  return typeof code === 'string' && TRANSIENT_CODES.has(code) ? code : undefined;
}

function diagnosticCode(error: unknown): string {
  const sqlCode = record(error).code;
  return transportCode(error) ??
    (typeof sqlCode === 'string' && /^[A-Z0-9]{5}$/.test(sqlCode) ? sqlCode : 'unknown');
}

// Only explicitly read-only operations belong here. Never wrap a submission.
export async function withReadRetry<T>(
  operation: ReadOperation,
  query: number,
  read: () => PromiseLike<T>,
): Promise<T> {
  const started = performance.now();
  let attempts = 1;
  let firstCode: string | undefined;
  const log = (outcome: 'recovered' | 'failed', code: string) => {
    // No error object/message, query text, parameters, credentials, or user data.
    const event = JSON.stringify({ event: 'database_read', operation, query, outcome,
      attempts, elapsedMs: Math.round(performance.now() - started), code, firstCode });
    if (outcome === 'recovered') console.warn(event);
    else console.error(event);
  };

  try {
    try {
      return await read();
    } catch (error) {
      firstCode = transportCode(error);
      if (!firstCode) throw error;
    }
    // Brief jitter keeps simultaneous failed reads from retrying in lockstep.
    await new Promise(resolve => setTimeout(resolve, 100 + Math.floor(Math.random() * 100)));
    attempts = 2;
    const result = await read();
    log('recovered', firstCode);
    return result;
  } catch (error) {
    log('failed', diagnosticCode(error));
    throw error;
  }
}
