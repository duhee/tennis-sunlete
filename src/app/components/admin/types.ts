import type { User as UserType, Schedule } from '../../data/mockData.js';

export interface GeneratedMatch {
  id: string;
  teamA: string[];
  teamB: string[];
}

export interface AttendanceRecord {
  userId: string;
  name: string;
  gender: string;
  attendanceRate: number;
  requestedAt: string;
  status: 'attend' | 'absent';
  isGuest: boolean;
  placement?: 'participant' | 'waitlist';
}

export interface DrawGenerationValidation {
  scheduleSelected: boolean;
  statusCondition: boolean;
  participantCount: boolean;
  generatedSixMatches: boolean;
  statusMessage?: string;
}

// ScheduleSelector Props
export interface ScheduleSelectorProps {
  schedules: Schedule[];
  selectedScheduleId: string;
  onSelectSchedule: (scheduleId: string) => void;
  showClosedPastSchedules: boolean;
  onToggleShowClosed: (show: boolean) => void;
  isMobilePreview: boolean;
}

// ScheduleInfo Props
export interface ScheduleInfoProps {
  schedule: Schedule | null;
  status: 'open' | 'draw_waiting' | 'closed';
  seasonCode: string | undefined;
  seasonMembers: UserType[];
  maxParticipants: number;
  isMobilePreview: boolean;
}

// DrawGenerator Props
export interface DrawConstraintResult {
  key: string;
  label: string;
  tier: string;
  passed: boolean;
  detail: string;
}
export interface DrawQualityReport {
  items: DrawConstraintResult[];
  requiredPassed: boolean;
  requiredPassedCount: number;
  requiredTotal: number;
  bestPassedCount: number;
  bestTotal: number;
}
export interface DrawGeneratorProps {
  selectedSchedule: Schedule | null;
  generatedBracket: GeneratedMatch[];
  bracketConfirmed: boolean;
  validation: DrawGenerationValidation;
  qualityReport: DrawQualityReport | null;
  onGenerateDraw: () => void;
  onApplyManualBracket: (matches: GeneratedMatch[]) => void;
  onConfirmBracket: () => void;
  getUserById: (id: string) => UserType | undefined;
  isMobilePreview: boolean;
}

// ReplacementManager Props
export interface ReplacementManagerProps {
  selectedSchedule: Schedule | null;
  absentUsers: UserType[];
  replacementCandidates: UserType[];
  getUserById: (id: string) => UserType | undefined;
  onApplyReplacement: (params: ReplacementParams) => void;
  isMobilePreview: boolean;
}

export interface ReplacementParams {
  absentUserId: string;
  replacementUserId: string | null;
  guestName?: string;
  guestGender?: 'M' | 'F';
  mode: 'member' | 'guest';
}

// AttendanceRecordsView Props
export interface AttendanceRecordsViewProps {
  selectedSchedule: Schedule | null;
  attendanceRecords: AttendanceRecord[];
  absentUsers: UserType[];
  noResponseUsers: UserType[];
  statusLabel: string;
  isMobilePreview: boolean;
}

// SeasonManager Props
export interface SeasonManagerProps {
  memberUsers: UserType[];
  allSeasons: string[];
  selectedSeason: string;
  seasonMemberDrafts: Record<string, string[]>;
  seasonTotalSessionsDraft: Record<string, string>;
  onSelectSeason: (season: string) => void;
  onAddSeason: (season: string) => void;
  onToggleMember: (season: string, memberId: string) => void;
  onSaveSeason: (season: string) => void;
  onCreateMember: (season: string, name: string, phoneLast4: string) => void;
  onTotalSessionsChange: (season: string, value: string) => void;
  isMobilePreview: boolean;
}

// MemberManagement Props
export interface MemberManagementProps {
  selectedSeason: string;
  onCreateMember: (season: string, name: string, phoneLast4: string) => void;
  isMobilePreview: boolean;
}

export const ADMIN_VIEW_MODE_STORAGE_KEY = 'tennis-app-admin-view-mode';

export const SEASON_OPTIONS: string[] = (() => {
  const list: string[] = [];
  for (let yy = 26; yy <= 30; yy++) {
    for (let s = 1; s <= 4; s++) list.push(`${yy}S${s}`);
  }
  return list;
})();
