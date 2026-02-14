import { PUBLIC_API_KEY } from '$env/static/public';

export interface ErrorReport {
  message: string;
  stack?: string;
  url?: string;
  context?: string;
  supportRef?: string;
}

const DEDUP_WINDOW_MS = 60_000;
const MAX_DEDUP_ENTRIES = 20;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

const dedupMap = new Map<string, number>();
let rateLimitCount = 0;
let rateLimitWindowStart = Date.now();

export function reportError(report: ErrorReport): void {
  if (isAbortError(report.message)) return;

  const url = report.url || window.location.pathname;
  const fingerprint = `${report.message}|${url}`;

  const now = Date.now();

  // Lazy cleanup: remove stale entries
  for (const [key, timestamp] of dedupMap.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      dedupMap.delete(key);
    }
  }

  if (dedupMap.has(fingerprint)) return;

  // Size-based eviction: Map iteration order = insertion order
  if (dedupMap.size >= MAX_DEDUP_ENTRIES) {
    const oldestKey = dedupMap.keys().next().value;
    if (oldestKey) dedupMap.delete(oldestKey);
  }

  dedupMap.set(fingerprint, now);

  // Rate limit with lazy reset
  if (now - rateLimitWindowStart > RATE_WINDOW_MS) {
    rateLimitCount = 0;
    rateLimitWindowStart = now;
  }
  if (rateLimitCount >= RATE_LIMIT) return;
  rateLimitCount++;

  const payload = {
    message: report.message,
    stack: report.stack,
    url,
    context: report.context,
    supportRef: report.supportRef
  };

  fetch('/resources/php/logError.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': PUBLIC_API_KEY,
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => {});
}

function isAbortError(message: string): boolean {
  return (
    message === 'AbortError' ||
    message === 'The user aborted a request.' ||
    message === 'The operation was aborted.' ||
    message === 'The operation was aborted' ||
    message.includes('signal is aborted without reason')
  );
}
