const pad = (value: number): string => String(value).padStart(2, '0');

export const tradeLocalDateTime = (closedAt: string): { date: string; time: string } => {
  const instant = new Date(closedAt);
  return {
    date: `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`,
    time: `${pad(instant.getHours())}:${pad(instant.getMinutes())}`,
  };
};

export const updateTradeLocalTime = (closedAt: string, localDateTime: string): string | null => {
  const previous = new Date(closedAt);
  const next = new Date(localDateTime);
  if (Number.isNaN(next.getTime())) return null;

  // Changing a minute-level control must not silently discard stored seconds.
  next.setSeconds(previous.getSeconds(), previous.getMilliseconds());
  const { date, time } = tradeLocalDateTime(next.toISOString());
  if (`${date}T${time}` !== localDateTime) return null;
  return next.toISOString();
};
