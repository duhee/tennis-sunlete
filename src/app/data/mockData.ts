// Shared data types and utility functions

export interface SeasonStats {
  seasonCode: string;
  total_sessions: number;
  attended_sessions: number;
  wins: number;
  losses: number;
}

export interface User {
  id: string;
  name: string;
  gender: 'M' | 'F' | 'W';
  phoneLast4?: string;
  activeSeasons?: string[];
  isWithdrawn?: boolean;
  seasonStats?: SeasonStats[]; // Per-season statistics
  avatar?: string;
  isGuest?: boolean;
}

export interface DoublesMatch {
  id: string;
  scheduleId: string;
  date: string;
  teamA: string[]; // user IDs
  teamB: string[]; // user IDs
  scoreA?: number | null;
  scoreB?: number | null;
  result?: 'teamA' | 'teamB' | 'draw' | null;
  isConfirmed: boolean;
}

export interface AttendanceRequest {
  userId: string;
  requestedAt: string; // ISO datetime
  status: 'attend' | 'absent'; // 참석 또는 불참
}

export type ScheduleStatus = 'open' | 'draw_waiting' | 'closed';

export interface WeeklyMatchSchedule {
  id: string;
  date: string; // Sunday match date
  seasonCode?: string; // Season code for stats tracking
  attendanceRequests: AttendanceRequest[];
  participants: string[]; // derived from attendanceRequests + policy
  waitlist: string[]; // derived from attendanceRequests + policy
  attendanceDeadline: string; // every Sunday 15:00 update 기준
  status: ScheduleStatus;
  maxParticipants: number;
}

export interface AttendanceRecordRow {
  userId: string;
  name: string;
  gender: 'M' | 'F' | 'W';
  isGuest: boolean;
  attendanceRate: number;
  requestedAt: string;
  placement: 'participant' | 'waitlist';
}

// Helper functions

export const seasonCodeToLabel = (code: string): string => {
  const m = code.match(/^(\d{2})S([1-4])$/);
  if (!m) return code;
  const yy = parseInt(m[1], 10);
  const s = parseInt(m[2], 10);
  const ranges: Record<number, string> = { 1: '2-4월', 2: '5-7월', 3: '8-10월', 4: '11월' };
  if (s === 4) {
    return `${yy}년 11월-${yy + 1}년 1월`;
  }
  return `${yy}년 ${ranges[s]}`;
};

// Get current season code based on today's date
export const getCurrentSeasonCode = (): string => {
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  const yy = (year % 100).toString().padStart(2, '0');

  if (month >= 2 && month <= 4) return `${yy}S1`;
  if (month >= 5 && month <= 7) return `${yy}S2`;
  if (month >= 8 && month <= 10) return `${yy}S3`;
  if (month >= 11) return `${yy}S4`;

  // January belongs to previous year's S4
  const prevYy = ((year - 1) % 100).toString().padStart(2, '0');
  return `${prevYy}S4`;
};

// Get season date range
export const getSeasonDateRange = (seasonCode: string): { start: Date; end: Date } | null => {
  const m = seasonCode.match(/^(\d{2})S([1-4])$/);
  if (!m) return null;
  
  const yy = parseInt(m[1], 10);
  const s = parseInt(m[2], 10);
  const year = 2000 + yy;
  
  let startMonth: number, startDay: number, endMonth: number, endDay: number;
  
  if (s === 1) {
    startMonth = 1; startDay = 1; // Feb 1
    endMonth = 3; endDay = 31;     // Apr 30
  } else if (s === 2) {
    startMonth = 4; startDay = 1;  // May 1
    endMonth = 6; endDay = 31;     // Jul 31
  } else if (s === 3) {
    startMonth = 7; startDay = 1;  // Aug 1
    endMonth = 9; endDay = 31;     // Oct 31
  } else {
    // S4: Nov 1 ~ Jan 31
    startMonth = 10; startDay = 1; // Nov 1
    endMonth = 0; endDay = 31;     // Jan 31 (next year)
  }
  
  const start = new Date(year, startMonth, startDay);
  const end = s === 4 ? new Date(year + 1, endMonth, endDay) : new Date(year, endMonth, endDay);
  
  return { start, end };
};

// Get Sundays in date range
export const getSundaysInRange = (startDate: Date, endDate: Date, maxCount: number): string[] => {
  const sundays: string[] = [];
  let current = new Date(startDate);
  
  // Move to the first Sunday on or after startDate
  const day = current.getDay();
  if (day !== 0) {
    current.setDate(current.getDate() + (7 - day));
  }
  
  while (current <= endDate && sundays.length < maxCount) {
    // Format as YYYY-MM-DD
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const date = String(current.getDate()).padStart(2, '0');
    sundays.push(`${year}-${month}-${date}`);
    
    current.setDate(current.getDate() + 7);
  }
  
  return sundays;
};

// Generate schedules for a season
export const generateSchedulesForSeason = (seasonCode: string, totalSessions: number): WeeklyMatchSchedule[] => {
  const range = getSeasonDateRange(seasonCode);
  if (!range) return [];
  
  const sundays = getSundaysInRange(range.start, range.end, totalSessions);
  
  return sundays.map((dateStr, index) => ({
    id: `${seasonCode}-w${index + 1}`,
    date: dateStr,
    seasonCode,
    attendanceRequests: [],
    participants: [],
    waitlist: [],
    attendanceDeadline: `${dateStr}T15:00:00+09:00`,
    status: 'open' as const,
    maxParticipants: 6,
  }));
};

// Calculate total stats across all seasons
export const getTotalStats = (user: User): { total_sessions: number; attended_sessions: number; wins: number; losses: number } => {
  const seasonStats = user.seasonStats || [];
  return {
    total_sessions: seasonStats.reduce((sum, s) => sum + s.total_sessions, 0),
    attended_sessions: seasonStats.reduce((sum, s) => sum + s.attended_sessions, 0),
    wins: seasonStats.reduce((sum, s) => sum + s.wins, 0),
    losses: seasonStats.reduce((sum, s) => sum + s.losses, 0),
  };
};

// Get stats for a specific season
export const getSeasonStats = (user: User, seasonCode: string): SeasonStats | undefined => {
  return (user.seasonStats || []).find(s => s.seasonCode === seasonCode);
};

// Calculate attendance rate for a user (all seasons or specific season)
export const getAttendanceRate = (user: User, seasonCode?: string): number => {
  let attended = 0;
  let total = 0;

  if (seasonCode) {
    const stat = getSeasonStats(user, seasonCode);
    if (!stat) return 0;
    attended = stat.attended_sessions;
    total = stat.total_sessions;
  } else {
    // Across all seasons
    const seasonStats = user.seasonStats || [];
    if (seasonStats.length === 0) return 0;
    attended = seasonStats.reduce((sum, s) => sum + s.attended_sessions, 0);
    total = seasonStats.reduce((sum, s) => sum + s.total_sessions, 0);
  }

  if (total === 0) return 0;
  return Math.round((attended / total) * 100);
};

// Calculate win rate for a user (all seasons or specific season)
export const getWinRate = (user: User, seasonCode?: string): number => {
  let wins = 0;
  let losses = 0;

  if (seasonCode) {
    const stat = getSeasonStats(user, seasonCode);
    if (!stat) return 0;
    wins = stat.wins;
    losses = stat.losses;
  } else {
    // Across all seasons
    const seasonStats = user.seasonStats || [];
    wins = seasonStats.reduce((sum, s) => sum + s.wins, 0);
    losses = seasonStats.reduce((sum, s) => sum + s.losses, 0);
  }

  const totalGames = wins + losses;
  if (totalGames === 0) return 0;
  return Math.round((wins / totalGames) * 100);
};

const getAttendanceRateByUserId = (userId: string, users: User[]): number => {
  const user = users.find(item => item.id === userId);
  // Unknown users (guests) get 0% so they still qualify in fairness sort
  return user ? getAttendanceRate(user) : 0;
};

const sortRequestsByPolicy = (requests: AttendanceRequest[], users: User[]): AttendanceRequest[] => {
  // Fairness policy: lower attendance rate first, then earlier click first.
  return [...requests].sort((a, b) => {
    const rateDiff = getAttendanceRateByUserId(a.userId, users) - getAttendanceRateByUserId(b.userId, users);
    if (rateDiff !== 0) {
      return rateDiff;
    }
    return new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime();
  });
};

export const deriveParticipantState = (schedule: WeeklyMatchSchedule, users: User[] = []) => {
  // Only count 'attend' status for participants/waitlist
  const attendRequests = schedule.attendanceRequests.filter(row => row.status === 'attend');
  const ranked = sortRequestsByPolicy(attendRequests, users);
  const participants = ranked.slice(0, schedule.maxParticipants).map(row => row.userId);
  const waitlist = ranked.slice(schedule.maxParticipants).map(row => row.userId);

  return { participants, waitlist, rankedRequests: ranked };
};

export const getScheduleDrawCutoff = (scheduleDate: string): Date => {
  const date = new Date(`${scheduleDate}T00:00:00+09:00`);
  date.setDate(date.getDate() - 7);
  return date;
};

export const getScheduleStatus = (
  schedule: WeeklyMatchSchedule,
  now: Date = new Date()
): ScheduleStatus => {
  const matchDate = new Date(`${schedule.date}T00:00:00+09:00`);
  if (now >= matchDate) {
    return 'closed';
  }

  const cutoff = getScheduleDrawCutoff(schedule.date);
  if (now >= cutoff) {
    return 'draw_waiting';
  }

  return 'open';
};

export const refreshScheduleSnapshot = (schedule: WeeklyMatchSchedule, users: User[] = []): WeeklyMatchSchedule => {
  const { participants, waitlist } = deriveParticipantState(schedule, users);
  return {
    ...schedule,
    participants,
    waitlist,
    status: getScheduleStatus(schedule),
  };
};

export const updateAttendanceRequest = (
  schedule: WeeklyMatchSchedule,
  userId: string,
  action: 'attend' | 'absent' | 'cancel',
  requestedAt: string = new Date().toISOString(),
  users: User[] = []
): WeeklyMatchSchedule => {
  const cleaned = schedule.attendanceRequests.filter(row => row.userId !== userId);
  
  let nextRequests: AttendanceRequest[];
  if (action === 'cancel') {
    // Remove from requests (미응답 상태로)
    nextRequests = cleaned;
  } else {
    // Add/update with status
    nextRequests = [...cleaned, { userId, requestedAt, status: action }];
  }

  return refreshScheduleSnapshot({
    ...schedule,
    attendanceRequests: nextRequests,
  }, users);
};

export const applyReplacement = (
  schedule: WeeklyMatchSchedule,
  absentUserId: string,
  replacementUserId: string,
  requestedAt: string = new Date().toISOString(),
  users: User[] = []
): WeeklyMatchSchedule => {
  const withoutReplacement = schedule.attendanceRequests.filter(row => row.userId !== replacementUserId);

  const absentExisting = withoutReplacement.find(row => row.userId === absentUserId);
  const keptOthers = withoutReplacement.filter(row => row.userId !== absentUserId);

  const absentRow: AttendanceRequest = {
    userId: absentUserId,
    requestedAt: absentExisting?.requestedAt ?? requestedAt,
    status: 'absent',
  };

  return refreshScheduleSnapshot({
    ...schedule,
    attendanceRequests: [
      ...keptOthers,
      absentRow,
      { userId: replacementUserId, requestedAt, status: 'attend' },
    ],
  }, users);
};

export const getAttendanceRecords = (schedule: WeeklyMatchSchedule, users: User[]): AttendanceRecordRow[] => {
  const { rankedRequests, participants } = deriveParticipantState(schedule, users);

  return rankedRequests.map(row => {
    const user = users.find(item => item.id === row.userId);
    return {
      userId: row.userId,
      name: user?.name ?? row.userId,
      gender: user?.gender ?? 'M',
      isGuest: user?.isGuest ?? false,
      attendanceRate: user ? getAttendanceRate(user) : 0,
      requestedAt: row.requestedAt,
      placement: participants.includes(row.userId) ? 'participant' : 'waitlist',
    };
  });
};

export const shouldShowUrgentAlert = (schedule: WeeklyMatchSchedule): boolean => {
  const { participants } = deriveParticipantState(schedule);
  return participants.length < 4 && getScheduleStatus(schedule) === 'open';
};

// Update user's season stats based on match result
export const updateUserSeasonStats = (
  user: User,
  seasonCode: string,
  updates: { total_sessions?: number; attended_sessions?: number; wins?: number; losses?: number }
): User => {
  const stats = [...(user.seasonStats || [])];
  const existingIdx = stats.findIndex(s => s.seasonCode === seasonCode);

  if (existingIdx >= 0) {
    stats[existingIdx] = {
      ...stats[existingIdx],
      total_sessions: updates.total_sessions ?? stats[existingIdx].total_sessions,
      attended_sessions: updates.attended_sessions ?? stats[existingIdx].attended_sessions,
      wins: updates.wins ?? stats[existingIdx].wins,
      losses: updates.losses ?? stats[existingIdx].losses,
    };
  } else {
    stats.push({
      seasonCode,
      total_sessions: updates.total_sessions ?? 0,
      attended_sessions: updates.attended_sessions ?? 0,
      wins: updates.wins ?? 0,
      losses: updates.losses ?? 0,
    });
  }

  return {
    ...user,
    seasonStats: stats,
  };
};
