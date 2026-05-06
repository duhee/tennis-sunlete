
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  getAttendanceRate,
  updateAttendanceRequest,
  updateAttendanceRequestByAdmin,
  applyReplacement,
  getAttendanceRecords,
  generateSchedulesForSeason,
} from '../data/mockData.js';
import type { User, WeeklyMatchSchedule, DoublesMatch, SeasonStats } from '../data/mockData.js';

import { fetchAppData, saveAppData } from '../api/appDataApi.js';

type AppData = {
  users: User[];
  schedules: WeeklyMatchSchedule[];
  doublesMatches: DoublesMatch[];
};
type PersistedData = AppData;

interface GeneratedMatchInput {
  teamA: string[];
  teamB: string[];
}

interface AppDataContextType {
  users: User[];
  schedules: WeeklyMatchSchedule[];
  doublesMatches: DoublesMatch[];
  getUserById: (id: string) => User | undefined;
  getUserByName: (name: string) => User | undefined;
  findUsersByName: (name: string) => User[];
  addMember: (name: string, phoneLast4: string, options?: { gender?: 'M' | 'F' | 'W'; activeSeasons?: string[] }) => User | null;
  updateAttendanceChoice: (scheduleId: string, userId: string, choice: 'attend' | 'absent' | 'cancel') => void;
  updateAttendanceChoiceByMaster: (scheduleId: string, userId: string, choice: 'attend' | 'absent' | 'cancel') => void;
  applyReplacementByMaster: (scheduleId: string, absentUserId: string, replacementUserId: string) => void;
  addGuestAndReplace: (scheduleId: string, absentUserId: string, guestName: string, guestGender: 'M' | 'F', existingGuestId?: string) => void;
  addGuestToScheduleByMaster: (scheduleId: string, guestName: string, guestGender: 'M' | 'F', existingGuestId?: string) => void;
  removeGuestUser: (guestUserId: string) => { ok: boolean; reason?: string };
  updateUserActiveSeasons: (userId: string, seasons: string[]) => void;
  updateUserSeasonStats: (userId: string, seasonStats: SeasonStats[]) => void;
  getAttendanceRecordsForSchedule: (scheduleId: string) => ReturnType<typeof getAttendanceRecords>;
  confirmBracketForSchedule: (scheduleId: string, date: string, bracket: GeneratedMatchInput[]) => void;
  recordMatchScore: (matchId: string, scoreA: number, scoreB: number) => void;
  addSchedulesForSeason: (seasonCode: string, totalSessions: number) => void;
  hydrated: boolean;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

function loadInitialData(): PersistedData {
  return {
    users: [],
    schedules: [],
    doublesMatches: [],
  };
}

function inferSeasonCodeFromDate(date: string): string | undefined {
  const d = new Date(`${date}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return undefined;

  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const yy = (year % 100).toString().padStart(2, '0');

  if (month >= 2 && month <= 4) return `${yy}S1`;
  if (month >= 5 && month <= 7) return `${yy}S2`;
  if (month >= 8 && month <= 10) return `${yy}S3`;
  if (month >= 11) return `${yy}S4`;

  // January belongs to previous year's S4
  const prevYy = ((year - 1) % 100).toString().padStart(2, '0');
  return `${prevYy}S4`;
}

function normalizeSeasonStats(stats: SeasonStats[] | undefined): SeasonStats[] {
  return (stats ?? []).map(stat => ({
    ...stat,
    draws: stat.draws ?? 0,
  }));
}

function recalculateUsersFromMatchResults(users: User[], doublesMatches: DoublesMatch[]): User[] {
  const statsByUserId = new Map<string, Map<string, { wins: number; losses: number; draws: number }>>();

  const ensureUserSeasonStats = (userId: string, seasonCode: string) => {
    let userStats = statsByUserId.get(userId);
    if (!userStats) {
      userStats = new Map<string, { wins: number; losses: number; draws: number }>();
      statsByUserId.set(userId, userStats);
    }

    let seasonStats = userStats.get(seasonCode);
    if (!seasonStats) {
      seasonStats = { wins: 0, losses: 0, draws: 0 };
      userStats.set(seasonCode, seasonStats);
    }

    return seasonStats;
  };

  doublesMatches.forEach(match => {
    if (typeof match.scoreA !== 'number' || typeof match.scoreB !== 'number') {
      return;
    }

    const seasonCode = inferSeasonCodeFromDate(match.date);
    if (!seasonCode) {
      return;
    }

    if (match.scoreA === match.scoreB) {
      [...match.teamA, ...match.teamB].forEach(userId => {
        ensureUserSeasonStats(userId, seasonCode).draws += 1;
      });
      return;
    }

    const winningTeam = match.scoreA > match.scoreB ? match.teamA : match.teamB;
    const losingTeam = match.scoreA > match.scoreB ? match.teamB : match.teamA;

    winningTeam.forEach(userId => {
      ensureUserSeasonStats(userId, seasonCode).wins += 1;
    });

    losingTeam.forEach(userId => {
      ensureUserSeasonStats(userId, seasonCode).losses += 1;
    });
  });

  return users.map(user => {
    const existingStats = normalizeSeasonStats(user.seasonStats);
    const existingBySeason = new Map(existingStats.map(stat => [stat.seasonCode, stat]));
    const computedBySeason = statsByUserId.get(user.id) ?? new Map<string, { wins: number; losses: number; draws: number }>();
    const seasonCodes = Array.from(new Set([...existingBySeason.keys(), ...computedBySeason.keys()]));

    const seasonStats = seasonCodes.map(seasonCode => {
      const existing = existingBySeason.get(seasonCode);
      const computed = computedBySeason.get(seasonCode);

      return {
        seasonCode,
        total_sessions: existing?.total_sessions ?? 0,
        attended_sessions: existing?.attended_sessions ?? 0,
        wins: computed?.wins ?? 0,
        losses: computed?.losses ?? 0,
        draws: computed?.draws ?? 0,
      };
    });

    return {
      ...user,
      seasonStats,
    };
  });
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PersistedData>(() => loadInitialData());
  const [hydrated, setHydrated] = useState(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const enqueueSave = (next: PersistedData) => {
    if (!hydrated) return;

    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await saveAppData(next);
      })
      .catch((error: any) => {
        console.error('Failed to sync app data to server:', error);
      });
  };

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      try {
        const serverData = await fetchAppData();

        if (!isMounted) return;

        if (serverData) {
          setData({
            ...serverData,
            users: recalculateUsersFromMatchResults(serverData.users, serverData.doublesMatches),
          });
        } else {
          await saveAppData(loadInitialData());
        }
      } catch (error) {
        console.error('Failed to hydrate app data from server:', error);
      } finally {
        if (isMounted) {
          setHydrated(true);
        }
      }
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  // attendance_requests 변경 시 attended_sessions 자동 재계산
  useEffect(() => {
    if (!hydrated) return;

    setData((prev: PersistedData) => {
      const attendanceMap: Record<string, Record<string, number>> = {};
      prev.schedules.forEach((schedule: WeeklyMatchSchedule) => {
        const seasonCode: string = schedule.seasonCode || inferSeasonCodeFromDate(schedule.date) || '';
        schedule.attendanceRequests.forEach((req: { userId: string; status: string }) => {
          if (req.status === 'attend') {
            if (!attendanceMap[req.userId]) attendanceMap[req.userId] = {};
            attendanceMap[req.userId][seasonCode] = (attendanceMap[req.userId][seasonCode] || 0) + 1;
          }
        });
      });
      const updatedUsers = prev.users.map((user: User) => {
        if (!user.seasonStats) return user;
        const updatedStats = user.seasonStats.map((stat: SeasonStats) => {
          const attended = attendanceMap[user.id]?.[stat.seasonCode ?? ''] || 0;
          return { ...stat, attended_sessions: attended };
        });
        return { ...user, seasonStats: updatedStats };
      });
      const next = { ...prev, users: updatedUsers };
      enqueueSave(next);
      return next;
    });
  }, [data.schedules, hydrated]);

  const commitData = (updater: (prev: PersistedData) => PersistedData) => {
    setData((prev: PersistedData) => {
      const next = updater(prev);
      enqueueSave(next);
      return next;
    });
  };

  const getUserById = (id: string) => data.users.find(user => user.id === id);
  const getUserByName = (name: string) => data.users.find((user: User) => user.name === name);
  const findUsersByName = (name: string) => data.users.filter((user: User) => user.name === name.trim());

  const addMember = (
    name: string,
    phoneLast4: string,
    options?: { gender?: 'M' | 'F' | 'W'; activeSeasons?: string[] }
  ) => {
    const normalizedName = name.trim();
    if (!normalizedName || !/^\d{4}$/.test(phoneLast4)) {
      return null;
    }

    const normalizedSeasons = [...new Set((options?.activeSeasons ?? []).map(item => item.trim()).filter(Boolean))];
    const created: User = {
      id: `member-${Date.now()}`,
      name: normalizedName,
      gender: options?.gender ?? 'F',
      phoneLast4,
      activeSeasons: normalizedSeasons,
      isGuest: false,
      isWithdrawn: false,
      seasonStats: [],
    };

    commitData((prev: PersistedData) => ({
      ...prev,
      users: [...prev.users, created],
    }));

    return created;
  };

  const updateAttendanceChoice = (scheduleId: string, userId: string, choice: 'attend' | 'absent' | 'cancel') => {
    commitData((prev: PersistedData) => ({
      ...prev,
      schedules: prev.schedules.map(schedule =>
        schedule.id === scheduleId ? updateAttendanceRequest(schedule, userId, choice, undefined, prev.users) : schedule
      ),
    }));
  };

  const updateAttendanceChoiceByMaster = (scheduleId: string, userId: string, choice: 'attend' | 'absent' | 'cancel') => {
    commitData((prev: PersistedData) => ({
      ...prev,
      schedules: prev.schedules.map(schedule =>
        schedule.id === scheduleId ? updateAttendanceRequestByAdmin(schedule, userId, choice, undefined, prev.users) : schedule
      ),
    }));
  };

  const applyReplacementByMaster = (scheduleId: string, absentUserId: string, replacementUserId: string) => {
    commitData((prev: PersistedData) => ({
      ...prev,
      schedules: prev.schedules.map(schedule =>
        schedule.id === scheduleId
          ? applyReplacement(schedule, absentUserId, replacementUserId, undefined, prev.users)
          : schedule
      ),
    }));
  };

  const addGuestAndReplace = (scheduleId: string, absentUserId: string, guestName: string, guestGender: 'M' | 'F', existingGuestId?: string) => {
    const guestId = existingGuestId || `guest-${Date.now()}`;
    const guestUser: User = {
      id: guestId,
      name: guestName,
      gender: guestGender,
      isGuest: true,
      seasonStats: [],
    };

    commitData((prev: PersistedData) => {
      const usersToCommit = existingGuestId ? prev.users : [...prev.users, guestUser];

      return {
        ...prev,
        users: usersToCommit,
        schedules: prev.schedules.map(schedule =>
          schedule.id === scheduleId
            ? applyReplacement(schedule, absentUserId, guestId, undefined, usersToCommit)
            : schedule
        ),
      };
    });
  };

  const addGuestToScheduleByMaster = (scheduleId: string, guestName: string, guestGender: 'M' | 'F', existingGuestId?: string) => {
    const guestId = existingGuestId || `guest-${Date.now()}`;
    const guestUser: User = {
      id: guestId,
      name: guestName,
      gender: guestGender,
      isGuest: true,
      seasonStats: [],
    };

    commitData((prev: PersistedData) => {
      const usersToCommit = existingGuestId ? prev.users : [...prev.users, guestUser];

      return {
        ...prev,
        users: usersToCommit,
        schedules: prev.schedules.map(schedule =>
          schedule.id === scheduleId
            ? updateAttendanceRequestByAdmin(schedule, guestId, 'attend', undefined, usersToCommit)
            : schedule
        ),
      };
    });
  };

  const removeGuestUser = (guestUserId: string): { ok: boolean; reason?: string } => {
    const guest = data.users.find(user => user.id === guestUserId);
    if (!guest || !guest.isGuest) {
      return { ok: false, reason: '게스트 정보를 찾을 수 없습니다.' };
    }

    const referencedInSchedule = data.schedules.some(schedule =>
      schedule.attendanceRequests.some(row => row.userId === guestUserId) ||
      schedule.participants.includes(guestUserId) ||
      schedule.waitlist.includes(guestUserId)
    );
    const referencedInMatch = data.doublesMatches.some(
      match => match.teamA.includes(guestUserId) || match.teamB.includes(guestUserId)
    );

    if (referencedInSchedule || referencedInMatch) {
      return { ok: false, reason: '이미 일정/경기 기록에 사용된 게스트는 삭제할 수 없습니다.' };
    }

    commitData((prev: PersistedData) => ({
      ...prev,
      users: prev.users.filter(user => user.id !== guestUserId),
    }));

    return { ok: true };
  };

  const updateUserActiveSeasons = (userId: string, seasons: string[]) => {
    const normalized = [...new Set(seasons.map(item => item.trim()).filter(Boolean))];

    commitData((prev: PersistedData) => ({
      ...prev,
      users: prev.users.map(user =>
        user.id === userId ? { ...user, activeSeasons: normalized } : user
      ),
    }));
  };

  const updateUserSeasonStats = (userId: string, seasonStats: SeasonStats[]) => {
    commitData((prev: PersistedData) => ({
      ...prev,
      users: prev.users.map(user =>
        user.id === userId ? { ...user, seasonStats } : user
      ),
    }));
  };

  const getAttendanceRecordsForSchedule = (scheduleId: string) => {
    const schedule = data.schedules.find((item: any) => item.id === scheduleId);
    if (!schedule) return [];
    return getAttendanceRecords(schedule, data.users);
  };

  const confirmBracketForSchedule = (scheduleId: string, date: string, bracket: GeneratedMatchInput[]) => {
    commitData((prev: PersistedData) => {
      const untouched = prev.doublesMatches.filter(match => match.scheduleId !== scheduleId);
      const created: DoublesMatch[] = bracket.map((match, idx) => ({
        id: `${scheduleId}-m${idx + 1}`,
        scheduleId,
        date,
        teamA: match.teamA,
        teamB: match.teamB,
        scoreA: null,
        scoreB: null,
        result: null,
        isConfirmed: true,
      }));

      return {
        ...prev,
        doublesMatches: [...untouched, ...created],
      };
    });
  };

  const recordMatchScore = (matchId: string, scoreA: number, scoreB: number) => {
    commitData((prev: PersistedData) => {
      const targetMatch = prev.doublesMatches.find(match => match.id === matchId);
      if (!targetMatch) return prev;

      const result: DoublesMatch['result'] = scoreA === scoreB ? 'draw' : scoreA > scoreB ? 'teamA' : 'teamB';
      const updatedMatches = prev.doublesMatches.map(match =>
        match.id === matchId
          ? {
              ...match,
              scoreA,
              scoreB,
              result,
            }
          : match
      );

      return {
        ...prev,
        doublesMatches: updatedMatches,
        users: recalculateUsersFromMatchResults(prev.users, updatedMatches),
      };
    });
  };

  const addSchedulesForSeason = (seasonCode: string, totalSessions: number) => {
    const newSchedules: WeeklyMatchSchedule[] = generateSchedulesForSeason(seasonCode, totalSessions);
    commitData((prev: PersistedData) => ({
      ...prev,
      schedules: [
        ...prev.schedules,
        ...newSchedules.filter((newSchedule: WeeklyMatchSchedule) =>
          !prev.schedules.some(existing => existing.id === newSchedule.id)
        ),
      ],
    }));
  };

  const recalculateAllAttendedSessions = React.useCallback((): void => {
    setData((prev: PersistedData) => {
      const attendanceMap: Record<string, Record<string, number>> = {};
      prev.schedules.forEach((schedule: WeeklyMatchSchedule) => {
        const seasonCode: string = schedule.seasonCode || inferSeasonCodeFromDate(schedule.date) || '';
        schedule.attendanceRequests.forEach((req: { userId: string; status: string }) => {
          if (req.status === 'attend') {
            if (!attendanceMap[req.userId]) attendanceMap[req.userId] = {};
            attendanceMap[req.userId][seasonCode] = (attendanceMap[req.userId][seasonCode] || 0) + 1;
          }
        });
      });
      const updatedUsers = prev.users.map((user: User) => {
        if (!user.seasonStats) return user;
        const updatedStats = user.seasonStats.map((stat: SeasonStats) => {
          const attended = attendanceMap[user.id]?.[stat.seasonCode ?? ''] || 0;
          return { ...stat, attended_sessions: attended };
        });
        return { ...user, seasonStats: updatedStats };
      });
      const next = { ...prev, users: updatedUsers };
      enqueueSave(next);
      return next;
    });
  }, [setData, enqueueSave]);

  const value = useMemo<AppDataContextType>(
    () => ({
      users: data.users,
      schedules: data.schedules,
      doublesMatches: data.doublesMatches,
      getUserById,
      getUserByName,
      findUsersByName,
      addMember,
      updateAttendanceChoice,
      updateAttendanceChoiceByMaster,
      applyReplacementByMaster,
      addGuestAndReplace,
      addGuestToScheduleByMaster,
      removeGuestUser,
      updateUserActiveSeasons,
      updateUserSeasonStats,
      recalculateAllAttendedSessions,
      getAttendanceRecordsForSchedule,
      confirmBracketForSchedule,
      recordMatchScore,
      addSchedulesForSeason,
      hydrated,
    }),
    [data, hydrated]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return context;
}

export function useUserAttendanceRate(userId: string) {
  const { getUserById } = useAppData();
  const user = getUserById(userId);
  return user ? getAttendanceRate(user) : 0;
}
