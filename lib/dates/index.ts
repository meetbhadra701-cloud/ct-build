export const DEFAULT_EXPIRING_SOON_WINDOW_DAYS = 30;
export const DEFAULT_REMINDER_LEAD_DAYS = [30, 14, 7, 1] as const;

export type ComplianceDateStatus = "compliant" | "expiring-soon" | "expired";

export type DateInput = Date | string;

export type ExpiryStatusOptions = {
  asOf?: DateInput;
  expiringSoonWindowDays?: number;
};

export type ReminderScheduleOptions = {
  leadDaysBeforeExpiry?: readonly number[];
  includePast?: boolean;
  asOf?: DateInput;
};

export type ReminderScheduleEntry = {
  scheduledFor: Date;
  scheduledForDate: string;
  leadDaysBeforeExpiry: number;
  escalationLevel: number;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function toUtcDateOnly(input: DateInput): Date {
  if (typeof input === "string") {
    if (ISO_DATE_PATTERN.test(input)) {
      const [year, month, day] = input.split("-").map(Number);
      return buildUtcDate(year, month, day);
    }

    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
      throw new RangeError(`Invalid date input: ${input}`);
    }

    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  }

  if (Number.isNaN(input.getTime())) {
    throw new RangeError("Invalid Date input");
  }

  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

export function toIsoDate(input: DateInput): string {
  return toUtcDateOnly(input).toISOString().slice(0, 10);
}

export function daysUntilExpiry(expiryDate: DateInput, asOf: DateInput = new Date()): number {
  const expiry = toUtcDateOnly(expiryDate);
  const current = toUtcDateOnly(asOf);

  return Math.round((expiry.getTime() - current.getTime()) / MS_PER_DAY);
}

export function getExpiryDateStatus(
  expiryDate: DateInput,
  options: ExpiryStatusOptions = {}
): ComplianceDateStatus {
  const expiringSoonWindowDays = normalizePositiveInteger(
    options.expiringSoonWindowDays ?? DEFAULT_EXPIRING_SOON_WINDOW_DAYS,
    "expiringSoonWindowDays"
  );
  const daysRemaining = daysUntilExpiry(expiryDate, options.asOf);

  if (daysRemaining <= 0) {
    return "expired";
  }

  if (daysRemaining <= expiringSoonWindowDays) {
    return "expiring-soon";
  }

  return "compliant";
}

export function isExpiringSoon(
  expiryDate: DateInput,
  options: ExpiryStatusOptions = {}
): boolean {
  return getExpiryDateStatus(expiryDate, options) === "expiring-soon";
}

export function addUtcDays(date: DateInput, days: number): Date {
  const normalizedDays = normalizeInteger(days, "days");
  const base = toUtcDateOnly(date);

  return new Date(base.getTime() + normalizedDays * MS_PER_DAY);
}

export function buildReminderSchedule(
  expiryDate: DateInput,
  options: ReminderScheduleOptions = {}
): ReminderScheduleEntry[] {
  const leadDays = normalizeLeadDays(
    options.leadDaysBeforeExpiry ?? DEFAULT_REMINDER_LEAD_DAYS
  );
  const asOf = options.asOf === undefined ? undefined : toUtcDateOnly(options.asOf);
  const expiry = toUtcDateOnly(expiryDate);

  return leadDays
    .map((leadDaysBeforeExpiry, index) => {
      const scheduledFor = addUtcDays(expiry, -leadDaysBeforeExpiry);

      return {
        scheduledFor,
        scheduledForDate: toIsoDate(scheduledFor),
        leadDaysBeforeExpiry,
        escalationLevel: index + 1
      };
    })
    .filter((entry) => options.includePast || asOf === undefined || entry.scheduledFor >= asOf);
}

export function getNextReminderDate(
  expiryDate: DateInput,
  options: Omit<ReminderScheduleOptions, "includePast"> = {}
): ReminderScheduleEntry | null {
  return buildReminderSchedule(expiryDate, {
    ...options,
    includePast: false,
    asOf: options.asOf ?? new Date()
  })[0] ?? null;
}

function buildUtcDate(year: number, month: number, day: number): Date {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid date input: ${year}-${month}-${day}`);
  }

  return date;
}

function normalizeLeadDays(leadDays: readonly number[]): number[] {
  if (leadDays.length === 0) {
    throw new RangeError("leadDaysBeforeExpiry must include at least one value");
  }

  return [...new Set(leadDays.map((leadDay) => normalizeNonNegativeInteger(leadDay, "leadDay")))]
    .sort((a, b) => b - a);
}

function normalizeInteger(value: number, name: string): number {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${name} must be an integer`);
  }

  return value;
}

function normalizePositiveInteger(value: number, name: string): number {
  const normalized = normalizeInteger(value, name);

  if (normalized <= 0) {
    throw new RangeError(`${name} must be greater than 0`);
  }

  return normalized;
}

function normalizeNonNegativeInteger(value: number, name: string): number {
  const normalized = normalizeInteger(value, name);

  if (normalized < 0) {
    throw new RangeError(`${name} must be greater than or equal to 0`);
  }

  return normalized;
}
