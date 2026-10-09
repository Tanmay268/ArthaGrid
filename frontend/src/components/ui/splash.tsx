import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

// Shown while the session check is in flight. On a free-tier host the first
// request can take up to a minute, so the message softens and then explains
// the wait instead of leaving a bare spinner.
const MESSAGES = [
  'Warming things up for you…',
  'Counting your coins, one by one…',
  'Almost there — good things take a moment ☕',
  'Our server was napping; it’s stretching and waking up…',
  'Thanks for your patience — it’s worth the wait 💚',
];

export function Splash() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => Math.min(n + 1, MESSAGES.length - 1)), 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center" role="status" aria-live="polite">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-lg font-semibold">ArthaGrid</p>
      <p className="max-w-xs text-sm text-muted-foreground transition-opacity">{MESSAGES[i]}</p>
      <p className="max-w-xs text-xs text-muted-foreground/70">The first visit after a quiet spell can take up to a minute.</p>
    </div>
  );
}
