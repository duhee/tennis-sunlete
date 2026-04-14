import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getAttendanceRate,
  updateAttendanceRequest,
  applyReplacement,
  getAttendanceRecords,
  type User,
  type WeeklyMatchSchedule,
  type DoublesMatch,
  type SeasonStats,
} from '../data/mockData';
import { generateSchedulesForSeason } from '../data/mockData';
import {
  fetchAppData,
  saveAppData,
  type PersistedData,
} from '../api/appDataApi';

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
  addMember: (name: string, phoneLast4: string, options?: { gender?: 'M' | 'F' | 'W'; activeSeasons?: string[] }) => User | null;
  updateAttendanceChoice: (scheduleId: string, userId: string, choice: 'attend' | 'absent' | 'cancel') => void;
  applyReplacementByMaster: (scheduleId: string, absentUserId: string, replacementUserId: string) => void;
  addGuestAndReplace: (scheduleId: string, absentUserId: string, guestName: string, guestGender: 'M' | 'F') => void;
  updateUserActiveSeasons: (userId: string, seasons: string[]) => void;
  updateUserSeasonStats: (userId: string, seasonStats: SeasonStats[]) => void;
  getAttendanceRecordsForSchedule: (scheduleId: string) => ReturnType<typeof getAttendanceRecords>;
  confirmBracketForSchedule: (scheduleId: string, date: string, bracket: GeneratedMatchInput[]) => void;
  recordMatchScore: (matchId: string, scoreA: number, scoreB: number) => void;
  addSchedulesForSeason: (seasonCode: string, totalSessions: number) => void;
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

function incrementSeasonStats(
  stats: SeasonStats[] | undefined,
  seasonCode: string,
  outcome: 'win' | 'loss' | 'draw'
): SeasonStats[] {
  const next = [...(stats || [])];
  const idx = next.findIndex(item => item.seasonCode === seasonCode);

  if (idx === -1) {
    next.push({
      seasonCode,
      total_sessions: 1,
      attended_sessions: 1,
      wins: outcome === 'win' ? 1 : 0,
      losses: outcome === 'loss' ? 1 : 0,
    });
    return next;
  }

  const current = next[idx];
  next[idx] = {
    ...current,
    total_sessions: current.total_sessions + 1,
    attended_sessions: current.attended_sessions + 1,
    wins: current.wins + (outcome === 'win' ? 1 : 0),
    losses: current.losses + (outcome === 'loss' ? 1 : 0),
  };

  return next;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PersistedData>(() => loadInitialData());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      try {
        const serverData = await fetchAppData();

        if (!isMounted) return;

        if (serverData) {
          setData(serverData);
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

  const commitData = (updater: (prev: PersistedData) => PersistedData) => {
    setData(prev => {
      const next = updater(prev);
      if (hydrated) {
        void saveAppData(next).catch(error => {
          console.error('Failed to sync app data to server:', error);
        });
      }
      return next;
    });
  };

  const getUserById = (id: string) => data.users.find(user => user.id === id);
  const getUserByName = (name: string) => data.users.find(user => user.name === name);

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
      gender: options?.gender ?? 'W',
      phoneLast4,
      activeSeasons: normalizedSeasons,
      isGuest: false,
      isWithdrawn: false,
      seasonStats: [],
    };

    commitData(prev => ({
      ...prev,
      users: [...prev.users, created],
    }));

    return created;
  };

  const updateAttendanceChoice = (scheduleId: string, userId: string, choice: 'attend' | 'absent' | 'cancel') => {
    commitData(prev => ({
      ...prev,
      schedules: prev.schedules.map(schedule =>
        schedule.id === scheduleId ? updateAttendanceRequest(schedule, userId, choice, undefined, prev.users) : schedule
      ),
    }));
  };

  const applyReplacementByMaster = (scheduleId: string, absentUserId: string, replacementUserId: string) => {
    commitData(prev => ({
      ...prev,
      schedules: prev.schedules.map(schedule =>
        schedule.id === scheduleId
          ? applyReplacement(schedule, absentUserId, replacementUserId, undefined, prev.users)
          : schedule
      ),
    }));
  };

  const addGuestAndReplace = (scheduleId: string, absentUserId: string, guestName: string, guestGender: 'M' | 'F') => {
    const guestId = `guest-${Date.now()}`;
    const guestUser: User = {
      id: guestId,
      name: guestName,
      gender: guestGender,
      isGuest: true,
      seasonStats: [],
    };

    commitData(prev => ({
      ...prev,
      users: [...prev.users, guestUser],
      schedules: prev.schedules.map(schedule =>
        schedule.id === scheduleId
          ? applyReplacement(schedule, absentUserId, guestId, undefined, [...prev.users, guestUser])
          : schedule
      ),
    }));
  };

  const updateUserActiveSeasons = (userId: string, seasons: string[]) => {
    const normalized = [...new Set(seasons.map(item => item.trim()).filter(Boolean))];

    commitData(prev => ({
      ...prev,
      users: prev.users.map(user =>
        user.id === userId ? { ...user, activeSeasons: normalized } : user
      ),
    }));
  };

  const updateUserSeasonStats = (userId: string, seasonStats: SeasonStats[]) => {
    commitData(prev => ({
      ...prev,
      users: prev.users.map(user =>
        user.id === userId ? { ...user, seasonStats } : user
      ),
    }));
  };

  const getAttendanceRecordsForSchedule = (scheduleId: string) => {
    const schedule = data.schedules.find(item => item.id === scheduleId);
    if (!schedule) return [];
    return getAttendanceRecords(schedule, data.users);
  };

  const confirmBracketForSchedule = (scheduleId: string, date: string, bracket: GeneratedMatchInput[]) => {
    commitData(prev => {
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
    commitData(prev => {
      const targetMatch = prev.doublesMatches.find(match => match.id === matchId);
      if (!targetMatch) return prev;

      const result = scoreA === scoreB ? 'draw' : scoreA > scoreB ? 'teamA' : 'teamB';
      const seasonCode = inferSeasonCodeFromDate(targetMatch.date);

      return {
        ...prev,
        doublesMatches: prev.doublesMatches.map(match =>
          match.id === matchId
            ? {
                ...match,
                scoreA,
                scoreB,
                result,
              }
            : match
        ),
        users: prev.users.map(user => {
          const userOnTeamA = targetMatch.teamA.includes(user.id);
          const userOnTeamB = targetMatch.teamB.includes(user.id);
          const played = userOnTeamA || userOnTeamB;

          if (!played || !seasonCode) {
            return user;
          }

          const userWon = (result === 'teamA' && userOnTeamA) || (result === 'teamB' && userOnTeamB);
          const outcome: 'win' | 'loss' | 'draw' = result === 'draw' ? 'draw' : userWon ? 'win' : 'loss';
          return {
            ...user,
            seasonStats: incrementSeasonStats(user.seasonStats, seasonCode, outcome),
          };
        }),
      };
    });
  };

  const addSchedulesForSeason = (seasonCode: string, totalSessions: number) => {
    const newSchedules = generateSchedulesForSeason(seasonCode, totalSessions);
    commitData(prev => ({
      ...prev,
      schedules: [
        ...prev.schedules,
        ...newSchedules.filter(newSchedule =>
          !prev.schedules.some(existing => existing.id === newSchedule.id)
        ),
      ],
    }));
  };

  const value = useMemo<AppDataContextType>(
    () => ({
      users: data.users,
      schedules: data.schedules,
      doublesMatches: data.doublesMatches,
      getUserById,
      getUserByName,
      addMember,
      updateAttendanceChoice,
      applyReplacementByMaster,
      addGuestAndReplace,
      updateUserActiveSeasons,
      updateUserSeasonStats,
      getAttendanceRecordsForSchedule,
      confirmBracketForSchedule,
      recordMatchScore,
      addSchedulesForSeason,
    }),
    [data]
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
