export interface ParsedSseFrame {
  id?: string;
  event?: string;
  data?: string;
  retryMs?: number;
}

export function parseSseFrame(frame: string): ParsedSseFrame | null {
  const parsed: ParsedSseFrame = {};
  const data: string[] = [];

  for (const rawLine of frame.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (!line || line.startsWith(':')) continue;
    const separator = line.indexOf(':');
    const field = separator === -1 ? line : line.slice(0, separator);
    const rawValue = separator === -1 ? '' : line.slice(separator + 1);
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;

    if (field === 'id' && !value.includes('\0')) parsed.id = value;
    if (field === 'event') parsed.event = value;
    if (field === 'data') data.push(value);
    if (field === 'retry') {
      const retryMs = Number(value);
      if (Number.isInteger(retryMs) && retryMs >= 0) parsed.retryMs = retryMs;
    }
  }

  if (data.length > 0) parsed.data = data.join('\n');
  return Object.keys(parsed).length > 0 ? parsed : null;
}
