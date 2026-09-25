import type { ReactElement } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type {
  AnalyticsEffectiveTimeGrain,
  AnalyticsSeriesPointDto,
  StatisticsChartMetric,
  StatisticsChartType,
} from '../../../shared/desktop-api';
import { CHART_TOOLTIP_STYLES } from './chart-tooltip-styles';

interface TimeSeriesChartProps {
  readonly chartType: StatisticsChartType;
  readonly grain: AnalyticsEffectiveTimeGrain;
  readonly label: string;
  readonly language: string;
  readonly metric: StatisticsChartMetric;
  readonly points: readonly AnalyticsSeriesPointDto[];
}

/** Caps bar thickness so a short series does not stretch into full-width blocks. */
const MAX_TIME_SERIES_BAR_SIZE = 48;
const AXIS_TICK_FONT_SIZE = 11;

const metricValue = (point: AnalyticsSeriesPointDto, metric: StatisticsChartMetric): string => {
  if (metric === 'drawdown') return point.drawdownUsd;
  if (metric === 'period-net-result') return point.netResultUsd;
  return point.cumulativeNetResultUsd;
};

export const TimeSeriesChart = ({
  chartType,
  grain,
  label,
  language,
  metric,
  points,
}: TimeSeriesChartProps): ReactElement => {
  const dateFormatter = new Intl.DateTimeFormat(
    language,
    grain === 'hour'
      ? { day: '2-digit', hour: '2-digit', month: 'short' }
      : { day: '2-digit', month: 'short', year: '2-digit' },
  );
  const numberFormatter = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });
  const data = points.map((point) => ({
    date: dateFormatter.format(new Date(point.bucketStart)),
    value: Number(metricValue(point, metric)),
  }));
  const shared = (
    <>
      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
      <XAxis
        axisLine={{ stroke: 'var(--color-border)' }}
        dataKey="date"
        minTickGap={28}
        tick={{ fill: 'var(--color-text-muted)', fontSize: AXIS_TICK_FONT_SIZE }}
        tickLine={false}
      />
      <YAxis
        axisLine={false}
        tick={{ fill: 'var(--color-text-muted)', fontSize: AXIS_TICK_FONT_SIZE }}
        tickFormatter={(value: number) => numberFormatter.format(value)}
        tickLine={false}
        width={76}
      />
      <Tooltip
        {...CHART_TOOLTIP_STYLES}
        cursor={{ stroke: 'var(--color-border-strong)' }}
        formatter={(value) => numberFormatter.format(Number(value))}
      />
    </>
  );
  return (
    <div aria-label={label} className="statistics-chart-canvas" role="img">
      <ResponsiveContainer height="100%" width="100%">
        {chartType === 'bar' ? (
          <BarChart accessibilityLayer data={data}>
            {shared}
            <Bar
              dataKey="value"
              fill="var(--color-chart-primary)"
              isAnimationActive={false}
              maxBarSize={MAX_TIME_SERIES_BAR_SIZE}
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        ) : (
          <LineChart accessibilityLayer data={data}>
            {shared}
            <Line
              activeDot={{ r: 3.5, strokeWidth: 0 }}
              dataKey="value"
              dot={false}
              isAnimationActive={false}
              stroke="var(--color-chart-primary)"
              strokeWidth={2.5}
              type="monotone"
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};
