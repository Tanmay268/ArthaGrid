// Shared Recharts styling driven by the same CSS variables as the rest of the
// UI, so charts follow the light/dark theme automatically.

export const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
];

export const tooltipStyle = {
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    color: 'hsl(var(--foreground))',
    fontSize: 12,
  },
  labelStyle: { color: 'hsl(var(--muted-foreground))' },
  itemStyle: { color: 'hsl(var(--foreground))' },
};

export const axisTick = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
export const gridStroke = 'hsl(var(--border))';

// Compact axis labels: 12000 -> 12k, 1500000 -> 15L (lakh), matching how INR is read.
export const compactInr = (n: number) =>
  new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
