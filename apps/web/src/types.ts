export type Role = "ANALYST" | "CISO" | "DPO" | "ADMIN";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IncidentStatus = "NEW" | "IN_PROGRESS" | "CONTAINED" | "RESOLVED" | "CLOSED";
export type ObligationKind = "GDPR_NOTIFICATION" | "NIS2_EARLY_WARNING" | "NIS2_NOTIFICATION" | "NIS2_FINAL_REPORT";
export type ObligationStatus = "PENDING" | "OVERDUE" | "SUBMITTED" | "SUBMITTED_LATE" | "NOT_REQUIRED";

export interface Me {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

export interface Incident {
  id: string;
  ref: string;
  title: string;
  description: string | null;
  severity: Severity;
  status: IncidentStatus;
  personalData: boolean;
  nis2Significant: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  detectedAt: string;
  createdAt: string;
  closedAt: string | null;
}

export interface Alert {
  id: string;
  source: string;
  ruleId: string | null;
  title: string;
  severity: Severity;
  host: string | null;
  occurredAt: string;
}

export interface Control {
  id: string;
  framework: string;
  code: string;
  title: string;
  description?: string | null;
}

export interface TimelineEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
  actorName: string;
}

export interface IncidentDetail extends Incident {
  allowedTransitions: IncidentStatus[];
  alerts: Alert[];
  timeline: TimelineEvent[];
  controls: Control[];
}

export interface Obligation {
  id: string;
  kind: ObligationKind;
  label: string;
  authority: string;
  legalBasis: string;
  awareAt: string;
  dueAt: string;
  status: ObligationStatus;
  decision: "PENDING" | "NOTIFY" | "NOT_REQUIRED";
  justification: string | null;
  submittedAt: string | null;
  reference: string | null;
  remainingSeconds: number | null;
  canHandle: boolean;
  incident?: { id: string; ref: string; title: string; severity: Severity };
}

export interface Metrics {
  periodDays: number;
  openIncidents: { total: number; bySeverity: Record<Severity, number>; byStatus: Record<string, number> };
  mtta: { averageSeconds: number | null; sample: number };
  mttr: { averageSeconds: number | null; sample: number };
  incidentsPerDay: { day: string; count: number }[];
  untriagedAlerts: number;
  obligations: { pending: number; overdue: number; submittedOnTime: number; submittedLate: number; onTimeRate: number | null };
  topControls: { code: string; title: string; incidents: number }[];
}
