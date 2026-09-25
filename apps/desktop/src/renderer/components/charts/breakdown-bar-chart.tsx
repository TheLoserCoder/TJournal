import type { ReactElement } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type {
  AnalyticsBreakdownMetric,
  AnalyticsBreakdownRowDto,
} from '../../../shared/desktop-api';
import { CHART_TOOLTIP_STYLES } from './chart-tooltip-styles';

interface BreakdownBarChartProps {
  readonly language: string;
  readonly label: string;
  readonly metric: AnalyticsBreakdownMetric;
  readonly rows: readonly AnalyticsBreakdownRowDto[];
}

/** Caps bar thickness so few rows do not render as oversized blocks. */
const MAX_BREAKDOWN_BAR_SIZE = 28;
const AXIS_TICK_FONT_SIZE = 11;

const metricValue = (row: AnalyticsBreakdownRowDto, metric: AnalyticsBreakdownMetric): number => {
  if (metric === 'trade-count') return row.totalTrades;
  if (metric === 'win-rate') return Number(row.winRatePercent ?? 0);
  return Number(row.netResultUsd);
};

/** Net result is toned by sign; count and win-rate series keep one chart colour. */
const barColor = (metric: AnalyticsBreakdownMetric, value: number): string => {
  if (metric !== 'net-result') return 'var(--color-chart-secondary)';
  return value < 0 ? 'var(--color-negative)' : 'var(--color-positive)';
};

export const BreakdownBarChart = ({
  language,
  label,
  metric,
  rows,
}: BreakdownBarChartProps): ReactElement => {
  const formatter = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });
  const data = rows
    .slice(0, 12)
    .map((row) => ({ label: row.label, value: metricValue(row, metric) }));
  return (
    <div aria-label={label} className="statistics-breakdown-chart-canvas" role="img">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 12 }}>
          <CartesianGrid horizontal={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            axisLine={{ stroke: 'var(--color-border)' }}
            tick={{ fill: 'var(--color-text-muted)', fontSize: AXIS_TICK_FONT_SIZE }}
            tickFormatter={(value: number) => formatter.format(value)}
            tickLine={false}
            type="number"
          />
          <YAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: AXIS_TICK_FONT_SIZE }}
            tickLine={false}
            type="category"
            width={96}
          />
          <Tooltip
            {...CHART_TOOLTIP_STYLES}
            cursor={{ fill: 'var(--table-row-hover)' }}
            formatter={(value) => formatter.format(Number(value))}
          />
          <Bar
            dataKey="value"
            fill="var(--color-chart-secondary)"
            isAnimationActive={false}
            maxBarSize={MAX_BREAKDOWN_BAR_SIZE}
            radius={[0, 3, 3, 0]}
          >
            {data.map((entry) => (
              <Cell fill={barColor(metric, entry.value)} key={entry.label} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
