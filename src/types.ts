export type User = {
  id: string;
  name: string;
  email: string;
  role: 'elder' | 'caregiver';
  timezone: string;
  language: string;
  is_demo: boolean;
};
export type Contact = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  relationship: string;
  priority: number;
  available: number;
  accepted: number;
  allow_requests: number;
  allow_notes: number;
  allow_reminders: number;
  allow_checkins: number;
  drill_opt_in: number;
  external_opt_in: number;
  version: number;
  scheduled_now: boolean;
};
export type Reminder = {
  id: string;
  title: string;
  trigger_type: 'fixed' | 'check_in';
  offset_minutes: number;
  due_at: number | null;
  repeat: 'once' | 'daily';
  status: string;
  completed_at: number | null;
};
export type Attempt = {
  id: string;
  name: string;
  user_id: string;
  status: string;
  expires_at: number;
};
export type Incident = {
  id: string;
  title: string;
  title_is_system?: boolean;
  outcome_is_system?: boolean;
  elder_id: string;
  private_note?: string;
  state: string;
  owner_id: string | null;
  owner_name: string | null;
  is_test: boolean;
  created_at: number;
  updated_at: number;
  next_due_at: number | null;
  outcome: string | null;
  attempts: Attempt[];
  timeline: { kind: string; text: string; created_at: number }[];
  deliveries?: { status: string; retries: number; last_error: string | null; name: string }[];
};
export type Audit = {
  id: string;
  action: string;
  detail: string;
  decision: string;
  created_at: number;
  policy_version: number | null;
};
export type DashboardData = {
  user: User;
  elder: { name: string; id: string; timezone: string };
  contacts: Contact[];
  coverage_now: { id: string; name: string }[];
  reminders: Reminder[];
  reminders_allowed: boolean;
  incidents: Incident[];
  last_check_in: number | null;
  audit: Audit[];
  stats: { open: number; completed: number };
};
export type Health = { status: string; demo: boolean; ai: string; notifications: string };
export type ReminderProposal = {
  intent: 'reminder';
  title: string;
  trigger_type: 'fixed' | 'check_in';
  offset_minutes: number;
  due_at: number | null;
  repeat: 'once' | 'daily';
};
export type Proposal =
  | ReminderProposal
  | {
      intent: 'consent';
      contact_id: string;
      field: 'allow_notes' | 'allow_reminders' | 'allow_requests';
      allowed: boolean;
    }
  | { intent: 'clarify'; message: string };
export type Interpretation = { proposal: Proposal; mode: 'local' | 'live'; notice: string };
export type Preview = {
  name: string;
  can_receive: boolean;
  notes: boolean;
  reminders: boolean;
  checkins: boolean;
  sample: Incident | null;
  example: { title: string; private_note?: string } | null;
};
export type Page =
  | 'overview'
  | 'summary'
  | 'reminders'
  | 'circle'
  | 'coverage'
  | 'requests'
  | 'drills'
  | 'history'
  | 'settings';

export type DailySummary = {
  date: string;
  generated_at: number;
  timezone: string;
  elder: { id: string; name: string };
  check_in: { allowed: boolean; received_at: number | null };
  reminders: {
    allowed: boolean;
    completed_today: number;
    due: number;
    upcoming: number;
    waiting: number;
    due_items: { id: string; title: string }[];
  };
  requests: {
    allowed: boolean;
    open: number;
    assigned_to_you: number;
    resolved_today: number;
    items: Pick<Incident, 'id' | 'title' | 'title_is_system' | 'state'>[];
  };
  coverage: {
    scope: 'personal' | 'household';
    remaining_gap_minutes: number;
    gaps: { start: number; end: number }[];
  };
};

export type CoverageWindow = { day: number; start: number; end: number };
export type CoverageContact = {
  id: string;
  user_id: string;
  name: string;
  relationship: string;
  priority: number;
  available: boolean;
  accepted: boolean;
  allow_requests: boolean;
  mode: 'anytime' | 'weekly';
  version: number;
  windows: CoverageWindow[];
};
export type CoverageResponder = { id: string; name: string; priority: number };
export type CoverageReport = {
  scope: 'household' | 'personal';
  timezone: string;
  generated_at: number;
  position: { day: number; minute: number };
  contacts: CoverageContact[];
  now: CoverageResponder[];
  next_gap: CoverageWindow | null;
  gap_minutes: number;
  backup_minutes: number;
  days: {
    day: number;
    name: string;
    gap_minutes: number;
    backup_minutes: number;
    segments: { start: number; end: number; responders: CoverageResponder[] }[];
  }[];
};
