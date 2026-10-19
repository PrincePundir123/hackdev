import { formatDate, t } from './i18n';
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
): Promise<T> {
  const response = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', 'X-Saathi-Client': 'web' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response
    .json()
    .catch(() => ({ error: 'The server returned an unexpected response.' }));
  if (!response.ok) throw new ApiError(data.error || 'Request failed.', response.status);
  return data;
}
export const key = () => crypto.randomUUID();
export function time(timestamp: number | null, timezone?: string) {
  if (!timestamp) return t('Not yet');
  return formatDate(timestamp, {
    hour: 'numeric',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  });
}
export function dateTime(timestamp: number, timezone?: string) {
  return formatDate(timestamp, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  });
}
export const stateLabel: Record<string, string> = {
  CREATED: 'Created',
  AWAITING_RESPONSE: 'Awaiting response',
  ASSIGNED: 'Caregiver assigned',
  FOLLOW_UP_OVERDUE: 'Follow-up overdue',
  RESOLVED: 'Resolved',
  NO_RESPONDER: 'No responder confirmed',
  CANCELLED: 'Cancelled',
  DELIVERY_BLOCKED: 'Delivery blocked',
};
