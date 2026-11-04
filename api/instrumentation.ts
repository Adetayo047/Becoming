// Runs once when a new Next.js server instance starts (before it serves any
// request) — the one correct place in App Router to boot a long-lived
// in-process job like the Wake-Up Call scheduler, since route handlers only
// run per-request and have no "app startup" hook of their own.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('@/app/lib/scheduler');
    startScheduler();
  }
}
