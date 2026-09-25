import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner, ErrorState, EmptyState } from '@/components/ui/state';
import { useInsights } from '@/api/analytics';
import type { Insight } from '@/types/api';

const TYPE_LABEL: Record<Insight['type'], string> = {
  spending: 'Spending',
  category: 'Category',
  budget: 'Budget',
  forecast: 'Forecast',
  anomaly: 'Anomaly',
  recurring: 'Recurring',
};

export function InsightsPage() {
  const insights = useInsights();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insights ArthaGrid noticed</CardTitle>
        <p className="text-xs text-muted-foreground">
          Rule-based observations, computed fresh from your data every time you open this page.
        </p>
      </CardHeader>
      <CardContent>
        {insights.isLoading && <Spinner />}
        {insights.isError && <ErrorState message="Couldn't load insights." />}
        {insights.data && insights.data.length === 0 && (
          <EmptyState message="Nothing stands out yet — keep tracking, and insights will show up here." />
        )}
        {insights.data && insights.data.length > 0 && (
          <ul className="flex flex-col gap-3">
            {insights.data.map((insight, i) => (
              <li key={i} className="flex items-start gap-3 rounded-md border border-border p-3">
                <Badge variant="outline" className="mt-0.5 shrink-0">
                  {TYPE_LABEL[insight.type]}
                </Badge>
                <p className="text-sm">{insight.text}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
