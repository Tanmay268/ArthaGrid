import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorState } from '@/components/ui/state';
import { useAskCopilot } from '@/api/copilot';
import { ApiError } from '@/lib/api';

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
  const ask = useAskCopilot();

  const submit = (q: string) => {
    if (!q.trim()) return;
    ask.mutate(q, {
      onSuccess: (res) => setHistory((h) => [...h, { question: q, answer: res.data.answer }]),
    });
    setQuestion('');
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Ask ArthaGrid</CardTitle>
          <p className="text-xs text-muted-foreground">
            Answered from your account's pre-computed summary numbers only — never your raw transaction
            descriptions or merchant names.
          </p>
        </CardHeader>
        <CardContent>
          {history.length === 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Try asking:</p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="w-fit rounded-full border border-border px-3 py-1 text-left text-sm text-muted-foreground hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {history.length > 0 && (
            <ul className="flex flex-col gap-4">
              {history.map((exchange, i) => (
                <li key={i} className="flex flex-col gap-2">
                  <p className="self-end rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {exchange.question}
                  </p>
                  <p className="self-start rounded-lg bg-muted px-3 py-2 text-sm">{exchange.answer}</p>
                </li>
              ))}
            </ul>
          )}

          {ask.isError && (
            <div className="mt-3">
              <ErrorState
                message={
                  ask.error instanceof ApiError
                    ? ask.error.status === 503
                      ? 'The AI assistant is not configured on this server yet.'
                      : ask.error.message
                    : 'Something went wrong.'
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        className="flex gap-2"
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about your finances…"
          minLength={3}
          maxLength={300}
        />
        <Button type="submit" disabled={ask.isPending}>
          {ask.isPending ? 'Thinking…' : 'Ask'}
        </Button>
      </form>
    </div>
  );
}
