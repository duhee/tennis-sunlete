// AppData type for global use
export type AppData = {
  users: User[];
  schedules: WeeklyMatchSchedule[];
  doublesMatches: DoublesMatch[];
};
// Shared data types and utility functions

export interface SeasonStats {
  seasonCode: string;
  total_sessions: number;
  attended_sessions: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface User {
  id: string;
  name: string;
  gender: 'M' | 'F' | 'W';
  phoneLast4?: string;
  password?: string; // 로그인용 비밀번호(plain, 예시)
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
  attendanceDeadline: string; // next schedule attendance opens at Monday 11:00 (KST)
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

export interface MatchPointMetrics {
  scoredPoints: number;
  concededPoints: number;
  gameDifference: number;
  gameWinRate: number;
}

// Helper functions

export const seasonCodeToLabel = (code: string): string => {
  const m = code.match(/^(\d{2})S([1-4])$/);
  if (!m) return '알 수 없음';
  const yy = parseInt(m[1], 10); // Extract the two-digit year
  const s = parseInt(m[2], 10);
  const ranges: Record<number, string> = { 1: '2-4월', 2: '5-7월', 3: '8-10월', 4: '11월' };
  const fullYear = 2000 + yy; // Convert to four-digit year
  if (s === 4) {
    return `${fullYear}년 11월-${fullYear + 1}년 1월`;
  }
  return `${fullYear}년 ${ranges[s]}`;
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

const inferSeasonCodeFromDate = (date: string): string | undefined => {
  const d = new Date(`${date}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return undefined;

  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const yy = (year % 100).toString().padStart(2, '0');

  if (month >= 2 && month <= 4) return `${yy}S1`;
  if (month >= 5 && month <= 7) return `${yy}S2`;
  if (month >= 8 && month <= 10) return `${yy}S3`;
  if (month >= 11) return `${yy}S4`;

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
    attendanceDeadline: formatAsKstOffset(getScheduleOpenAt(dateStr)),
    status: 'open' as const,
    maxParticipants: 6,
  }));
};

export const formatAsKstOffset = (date: Date): string => {
  const kstMs = date.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const min = String(kst.getUTCMinutes()).padStart(2, '0');
  const ss = String(kst.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+09:00`;
};

// Calculate total stats across all seasons
export const getTotalStats = (user: User): { total_sessions: number; attended_sessions: number; wins: number; losses: number; draws: number } => {
  const seasonStats = user.seasonStats || [];
  return {
    total_sessions: seasonStats.reduce((sum, s) => sum + s.total_sessions, 0),
    attended_sessions: seasonStats.reduce((sum, s) => sum + s.attended_sessions, 0),
    wins: seasonStats.reduce((sum, s) => sum + s.wins, 0),
    losses: seasonStats.reduce((sum, s) => sum + s.losses, 0),
    draws: seasonStats.reduce((sum, s) => sum + (s.draws ?? 0), 0),
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
  let draws = 0;

  if (seasonCode) {
    const stat = getSeasonStats(user, seasonCode);
    if (!stat) return 0;
    wins = stat.wins;
    losses = stat.losses;
    draws = stat.draws ?? 0;
  } else {
    // Across all seasons
    const seasonStats = user.seasonStats || [];
    wins = seasonStats.reduce((sum, s) => sum + s.wins, 0);
    losses = seasonStats.reduce((sum, s) => sum + s.losses, 0);
    draws = seasonStats.reduce((sum, s) => sum + (s.draws ?? 0), 0);
  }

  const totalGames = wins + losses + draws;
  if (totalGames === 0) return 0;
  return Math.round(((wins + draws * 0.5) / totalGames) * 100);
};

export const getMatchPointMetrics = (
  userId: string,
  doublesMatches: DoublesMatch[],
  seasonCode?: string
): MatchPointMetrics => {
  let scoredPoints = 0;
  let concededPoints = 0;

  doublesMatches.forEach(match => {
    if (typeof match.scoreA !== 'number' || typeof match.scoreB !== 'number') {
      return;
    }

    if (seasonCode && inferSeasonCodeFromDate(match.date) !== seasonCode) {
      return;
    }

    const onTeamA = match.teamA.includes(userId);
    const onTeamB = match.teamB.includes(userId);

    if (!onTeamA && !onTeamB) {
      return;
    }

    scoredPoints += onTeamA ? match.scoreA : match.scoreB;
    concededPoints += onTeamA ? match.scoreB : match.scoreA;
  });

  const totalPoints = scoredPoints + concededPoints;

  return {
    scoredPoints,
    concededPoints,
    gameDifference: scoredPoints - concededPoints,
    gameWinRate: totalPoints > 0 ? Math.round((scoredPoints / totalPoints) * 1000) / 10 : 0,
  };
};

const sortRequestsByPolicy = (requests: AttendanceRequest[]): AttendanceRequest[] => {
  // 선착순 정책: 요청 시각이 빠른 순으로만 정렬
  return [...requests].sort((a, b) => {
    const timeDiff = new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }

    // 동일 시각 요청 시 안정적인 순서를 위해 userId를 보조 키로 사용
    return a.userId.localeCompare(b.userId, 'ko');
  });
};

export const deriveParticipantState = (schedule: WeeklyMatchSchedule, _users: User[] = [], _seasonCode?: string) => {
  // Only count 'attend' status for participants/waitlist
  const attendRequests = schedule.attendanceRequests.filter(row => row.status === 'attend');
  const ranked = sortRequestsByPolicy(attendRequests);
  const participants = ranked.slice(0, schedule.maxParticipants).map(row => row.userId);
  const waitlist = ranked.slice(schedule.maxParticipants).map(row => row.userId);

  return { participants, waitlist, rankedRequests: ranked };
};

export const getScheduleDrawCutoff = (scheduleDate: string): Date => {
  const date = new Date(`${scheduleDate}T00:00:00+09:00`);
  // Sunday match date -> draw waiting starts on Monday 11:00 (6 days before)
  date.setDate(date.getDate() - 6);
  date.setHours(11, 0, 0, 0);
  return date;
};

export const getScheduleOpenAt = (scheduleDate: string): Date => {
  const date = new Date(`${scheduleDate}T00:00:00+09:00`);
  // Next Sunday schedule opens on previous week's Monday 11:00 (13 days before)
  date.setDate(date.getDate() - 13);
  date.setHours(11, 0, 0, 0);
  return date;
};

export const getScheduleAttendanceOpenAt = (scheduleDate: string): Date => {
  const date = new Date(`${scheduleDate}T00:00:00+09:00`);
  // Attendance page shows and opens voting from Monday 11:00, 20 days before the match.
  date.setDate(date.getDate() - 20);
  date.setHours(11, 0, 0, 0);
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

export const isWithinNext3Weeks = (
  schedule: Pick<WeeklyMatchSchedule, 'date'>,
  now: Date = new Date()
): boolean => {
  const matchDate = new Date(`${schedule.date}T00:00:00+09:00`);
  const diffWeeks = (matchDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7);
  return diffWeeks >= 0 && diffWeeks < 3;
};

export const isScheduleAttendanceOpen = (
  schedule: WeeklyMatchSchedule,
  now: Date = new Date()
): boolean => {
  if (getScheduleStatus(schedule, now) !== 'open') {
    return false;
  }

  // 3주 이내 일정은 모두 참/불 투표 가능
  return isWithinNext3Weeks(schedule, now);
};

export const refreshScheduleSnapshot = (schedule: WeeklyMatchSchedule, users: User[] = []): WeeklyMatchSchedule => {
  const seasonCode = schedule.seasonCode;
  const { participants, waitlist } = deriveParticipantState(schedule, users, seasonCode);
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
  const requestAt = new Date(requestedAt);
  const drawCutoff = getScheduleDrawCutoff(schedule.date);

  // Attendance can be changed only while the schedule is open for requests.
  if (!isScheduleAttendanceOpen(schedule, requestAt) || requestAt >= drawCutoff) {
    return refreshScheduleSnapshot(schedule, users);
  }

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

export const updateAttendanceRequestByAdmin = (
  schedule: WeeklyMatchSchedule,
  userId: string,
  action: 'attend' | 'absent' | 'cancel',
  requestedAt: string = new Date().toISOString(),
  users: User[] = []
): WeeklyMatchSchedule => {
  const cleaned = schedule.attendanceRequests.filter(row => row.userId !== userId);

  const nextRequests = action === 'cancel'
    ? cleaned
    : [...cleaned, { userId, requestedAt, status: action }];

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
  const absentUser = users.find(u => u.id === absentUserId);
  
  // 게스트가 제거/대체되는 경우: attendanceRequests에서 완전히 제거 (불참 표시 안함)
  if (absentUser?.isGuest) {
    const withoutGuest = schedule.attendanceRequests.filter(row => row.userId !== absentUserId);
    
    if (replacementUserId === 'empty-slot') {
      // 게스트를 빈자리로 제거
      return refreshScheduleSnapshot({
        ...schedule,
        attendanceRequests: withoutGuest,
      }, users);
    } else {
      // 게스트를 다른 멤버로 대체 (기존 대체자 제거 후 새로운 대체자 추가)
      const withoutBoth = withoutGuest.filter(row => row.userId !== replacementUserId);
      return refreshScheduleSnapshot({
        ...schedule,
        attendanceRequests: [
          ...withoutBoth,
          { userId: replacementUserId, requestedAt, status: 'attend' },
        ],
      }, users);
    }
  }

  // 정기 멤버의 경우: 기존 로직 (불참 표시)
  const withoutReplacement = schedule.attendanceRequests.filter(row => row.userId !== replacementUserId);

  const absentExisting = withoutReplacement.find(row => row.userId === absentUserId);
  const keptOthers = withoutReplacement.filter(row => row.userId !== absentUserId);

  if (replacementUserId === 'empty-slot') {
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
      ],
    }, users);
  }

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
  const seasonCode = schedule.seasonCode;
  const { rankedRequests, participants } = deriveParticipantState(schedule, users, seasonCode);

  return rankedRequests.map(row => {
    const user = users.find(item => item.id === row.userId);
    return {
      userId: row.userId,
      name: user?.name ?? row.userId,
      gender: user?.gender ?? 'M',
      isGuest: user?.isGuest ?? false,
      attendanceRate: user ? getAttendanceRate(user, seasonCode) : 0,
      requestedAt: row.requestedAt,
      placement: participants.includes(row.userId) ? 'participant' : 'waitlist',
    };
  });
};

export const shouldShowUrgentAlert = (schedule: WeeklyMatchSchedule): boolean => {
  const seasonCode = schedule.seasonCode;
  const { participants } = deriveParticipantState(schedule, [], seasonCode);
  return participants.length < 4 && getScheduleStatus(schedule) === 'open';
};

// Update user's season stats based on match result
export const updateUserSeasonStats = (
  user: User,
  seasonCode: string,
  updates: { total_sessions?: number; attended_sessions?: number; wins?: number; losses?: number; draws?: number }
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
      draws: updates.draws ?? stats[existingIdx].draws ?? 0,
    };
  } else {
    stats.push({
      seasonCode,
      total_sessions: updates.total_sessions ?? 0,
      attended_sessions: updates.attended_sessions ?? 0,
      wins: updates.wins ?? 0,
      losses: updates.losses ?? 0,
      draws: updates.draws ?? 0,
    });
  }

  return {
    ...user,
    seasonStats: stats,
  };
};
