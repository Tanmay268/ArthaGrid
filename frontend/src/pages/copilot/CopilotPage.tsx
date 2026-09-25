import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { ApiError } from '@/lib/api';
import { useAskCopilot } from '@/api/copilot';

const SUGGESTIONS = [
  'Why did my expenses increase this month?',
  'How is my savings rate looking?',
  'Are there any unusual transactions I should know about?',
];

interface Exchange {
  question: string;
  answer: string;
}

export function CopilotPage() {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<Exchange[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const ask = useAskCopilot();
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history, pendingQuestion]);

  const submit = (q: string) => {
    const text = q.trim();
    if (text.length < 3 || ask.isPending) return;
    setPendingQuestion(text);
    setQuestion('');
    ask.mutate(text, {
      onSuccess: (res) => setHistory((h) => [...h, { question: text, answer: res.data.answer }]),
      onSettled: () => setPendingQuestion(null),
    });
  };

  const errorText = ask.isError
    ? ask.error instanceof ApiError && ask.error.status === 503
      ? 'The AI assistant isn\'t available right now (it may not be configured on this server).'
      : ask.error instanceof ApiError && ask.error.status === 429
        ? "You've asked a lot of questions — please try again in a while."
        : 'Something went wrong. Please try again.'
    : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader
        title="Ask ArthaGrid"
        description="Plain-language answers from your summary numbers. Your transaction descriptions and merchants are never sent."
      />

      <Card>
        <CardContent className="flex min-h-[320px] flex-col gap-4 p-4">
          {history.length === 0 && !pendingQuestion && (
            <div className="flex flex-1 flex-col items-start justify-center gap-2">
              <span className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4" /> Try asking:
              </span>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {(history.length > 0 || pendingQuestion) && (
            <ul className="flex flex-col gap-4" aria-live="polite">
              {history.map((x, i) => (
                <li key={i} className="flex flex-col gap-2">
                  <p className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">{x.question}</p>
                  <p className="max-w-[92%] self-start whitespace-pre-line rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm">{x.answer}</p>
                </li>
              ))}
              {pendingQuestion && (
                <li className="flex flex-col gap-2">
                  <p className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">{pendingQuestion}</p>
                  <p className="self-start rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm text-muted-foreground" role="status">Thinking…</p>
                </li>
              )}
            </ul>
          )}

          {errorText && (
            <p role="alert" className="text-sm text-destructive">
              {errorText}
            </p>
          )}
          <div ref={endRef} />
        </CardContent>
      </Card>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        className="sticky bottom-3 flex gap-2 rounded-xl border border-border bg-card p-2 shadow-sm"
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about your spending…"
          minLength={3}
          maxLength={300}
          aria-label="Your question"
          className="border-0 shadow-none focus-visible:ring-0"
        />
        <Button type="submit" disabled={ask.isPending || question.trim().length < 3} aria-label="Send">
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Ask</span>
        </Button>
      </form>
    </div>
  );
}
