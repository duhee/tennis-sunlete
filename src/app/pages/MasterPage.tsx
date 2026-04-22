import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useAppData } from '../context/AppDataContext.js';
import { PageLayout } from '../components/PageLayout.js';
import {
  User,
  TrendingDown,
  Shuffle,
  Settings,
  Trophy,
  RefreshCw,
  CheckCircle2,
  ClipboardList,
  UserRoundCog,
  Smartphone,
  Monitor,
} from 'lucide-react';
import { getAttendanceRate, getWinRate, getScheduleStatus, getTotalStats, seasonCodeToLabel, type User as UserType } from '../data/mockData.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.js';
import { Button } from '../components/ui/button.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table.js';
import { Badge } from '../components/ui/badge.js';
import { toast } from 'sonner';
import { Toaster } from '../components/ui/sonner.js';
import { useIsMobile } from '../components/ui/use-mobile.js';

interface GeneratedMatch {
  id: string;
  teamA: string[];
  teamB: string[];
}

const ADMIN_VIEW_MODE_STORAGE_KEY = 'tennis-app-admin-view-mode';

const SEASON_OPTIONS: string[] = (() => {
  const list: string[] = [];
  for (let yy = 26; yy <= 30; yy++) {
    for (let s = 1; s <= 4; s++) list.push(`${yy}S${s}`);
  }
  return list;
})();

function inferSeasonCodeFromDate(date: string): string | undefined {
  const ymd = date.match(/(\d{4})-(\d{2})-(\d{2})/);
  const d = ymd
    ? new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00+09:00`)
    : new Date(date);
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
}

function getScheduleSeasonCode(schedule: { date: string; seasonCode?: string; id?: string; attendanceDeadline?: string }): string | undefined {
  if (schedule.seasonCode) return schedule.seasonCode;

  const idMatch = (schedule.id || '').match(/^(\d{2}S[1-4])-w\d+$/);
  if (idMatch) return idMatch[1];

  return inferSeasonCodeFromDate(schedule.date) ?? inferSeasonCodeFromDate(schedule.attendanceDeadline || '');
}

function toDateKey(dateLike: string): string {
  const ymd = dateLike.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

  const d = new Date(dateLike);
  if (!Number.isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return dateLike;
}

function getTodayDateKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getScheduleDateKey(schedule: { date?: string; attendanceDeadline?: string }): string {
  return toDateKey(schedule.date || schedule.attendanceDeadline || '');
}

function getDefaultScheduleId(schedules: Array<{ id: string; date?: string; attendanceDeadline?: string }>): string {
  if (schedules.length === 0) return '';
  const todayKey = getTodayDateKey();
  const sorted = [...schedules].sort((a, b) => getScheduleDateKey(a).localeCompare(getScheduleDateKey(b)));
  const nearestFuture = sorted.find(s => getScheduleDateKey(s) >= todayKey);
  return (nearestFuture || sorted[0]).id;
}

function buildSixMatchBracket(participantIds: string[], type: 'random' | 'skill', getUserById: (id: string) => UserType | undefined): GeneratedMatch[] {
  let players = participantIds.map(id => getUserById(id)).filter(Boolean) as UserType[];

  if (type === 'random') {
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }
  } else {
    // Skill sort: guests have no stats → assign them the average win rate of non-guest players
    const nonGuests = players.filter(p => !p.isGuest);
    const avgWinRate = nonGuests.length > 0
      ? nonGuests.reduce((sum, p) => sum + getWinRate(p), 0) / nonGuests.length
      : 50;

    players = [...players].sort((a, b) => {
      const rA = a.isGuest ? avgWinRate : getWinRate(a);
      const rB = b.isGuest ? avgWinRate : getWinRate(b);
      return rB - rA;
    });
  }

  const slots = Array.from({ length: 8 }, (_, idx) => players[idx % players.length]);

  return [
    { id: 'g1', teamA: [slots[0].id, slots[1].id], teamB: [slots[2].id, slots[3].id] },
    { id: 'g2', teamA: [slots[4].id, slots[5].id], teamB: [slots[6].id, slots[7].id] },
    { id: 'g3', teamA: [slots[0].id, slots[2].id], teamB: [slots[4].id, slots[6].id] },
    { id: 'g4', teamA: [slots[1].id, slots[3].id], teamB: [slots[5].id, slots[7].id] },
    { id: 'g5', teamA: [slots[0].id, slots[3].id], teamB: [slots[5].id, slots[6].id] },
    { id: 'g6', teamA: [slots[1].id, slots[2].id], teamB: [slots[4].id, slots[7].id] },
  ];
}

function buildMixedDoublesBracket(participantIds: string[], getUserById: (id: string) => UserType | undefined): GeneratedMatch[] {
  const players = participantIds.map(id => getUserById(id)).filter(Boolean) as UserType[];

  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const F = shuffle(players.filter(p => p.gender === 'F' || p.gender === 'W'));
  const M = shuffle(players.filter(p => p.gender === 'M'));
  const fLen = F.length;
  const mLen = M.length;

  // Helper: pick n items from arr cyclically
  const pick = (arr: UserType[], n: number): UserType[] =>
    Array.from({ length: n }, (_, i) => arr[i % arr.length]);

  // Build mixed pair [F, M] from circular indices
  const mixedPair = (fi: number, mi: number): [string, string] =>
    [F[fi % fLen].id, M[mi % mLen].id];

  // Build same-gender pair from circular index within gender array
  const ffPair = (i: number, j: number): [string, string] =>
    [F[i % fLen].id, F[j % fLen].id];
  const mmPair = (i: number, j: number): [string, string] =>
    [M[i % mLen].id, M[j % mLen].id];

  type Team = [string, string];
  const makeMatch = (id: string, a: Team, b: Team): GeneratedMatch =>
    ({ id, teamA: [a[0], a[1]], teamB: [b[0], b[1]] });

  // 3M 3F → 6 mixed
  if (mLen >= 3 && fLen >= 3) {
    // 6 mixed: pair each F with each M round-robin style
    // Teams: (F0,M0) vs (F1,M1), (F2,M2) vs (F0,M1), ...
    const mixed: Array<[Team, Team]> = [
      [mixedPair(0, 0), mixedPair(1, 1)],
      [mixedPair(2, 2), mixedPair(0, 1)],
      [mixedPair(1, 2), mixedPair(2, 0)],
      [mixedPair(0, 2), mixedPair(1, 0)],
      [mixedPair(2, 1), mixedPair(0, 0)],   // rotation continues
      [mixedPair(1, 1), mixedPair(2, 2)],
    ];
    return mixed.map(([a, b], i) => makeMatch(`g${i + 1}`, a, b));
  }

  // 4M 2F → 4 mixed + 2 men's doubles
  if (mLen >= 4 && fLen <= 2) {
    const mixedMatches: Array<[Team, Team]> = [
      [mixedPair(0, 0), mixedPair(1, 1)],
      [mixedPair(0, 1), mixedPair(1, 0)],
      [mixedPair(0, 0), mixedPair(1, 1)],   // re-paired to vary
      [mixedPair(0, 1), mixedPair(1, 0)],
    ];
    const menMatches: Array<[Team, Team]> = [
      [mmPair(0, 1), mmPair(2, 3)],
      [mmPair(0, 2), mmPair(1, 3)],
    ];
    return [
      ...mixedMatches.map(([a, b], i) => makeMatch(`g${i + 1}`, a, b)),
      ...menMatches.map(([a, b], i) => makeMatch(`g${5 + i}`, a, b)),
    ];
  }

  // 2M 4F → 4 mixed + 2 women's doubles
  if (fLen >= 4 && mLen <= 2) {
    const mixedMatches: Array<[Team, Team]> = [
      [mixedPair(0, 0), mixedPair(1, 1)],
      [mixedPair(2, 0), mixedPair(3, 1)],
      [mixedPair(0, 1), mixedPair(1, 0)],
      [mixedPair(2, 1), mixedPair(3, 0)],
    ];
    const womenMatches: Array<[Team, Team]> = [
      [ffPair(0, 1), ffPair(2, 3)],
      [ffPair(0, 2), ffPair(1, 3)],
    ];
    return [
      ...mixedMatches.map(([a, b], i) => makeMatch(`g${i + 1}`, a, b)),
      ...womenMatches.map(([a, b], i) => makeMatch(`g${5 + i}`, a, b)),
    ];
  }

  // Fallback: interleave and use slot rotation (handles other ratios)
  const ordered: UserType[] = [];
  const maxLen = Math.max(fLen, mLen);
  for (let i = 0; i < maxLen; i++) {
    if (i < fLen) ordered.push(F[i]);
    if (i < mLen) ordered.push(M[i]);
  }
  const sixPlayers = pick(ordered, 6);
  const slots = Array.from({ length: 8 }, (_, idx) => sixPlayers[idx % 6]);
  return [
    { id: 'g1', teamA: [slots[0].id, slots[1].id], teamB: [slots[2].id, slots[3].id] },
    { id: 'g2', teamA: [slots[4].id, slots[5].id], teamB: [slots[6].id, slots[7].id] },
    { id: 'g3', teamA: [slots[0].id, slots[2].id], teamB: [slots[4].id, slots[6].id] },
    { id: 'g4', teamA: [slots[1].id, slots[3].id], teamB: [slots[5].id, slots[7].id] },
    { id: 'g5', teamA: [slots[0].id, slots[3].id], teamB: [slots[5].id, slots[6].id] },
    { id: 'g6', teamA: [slots[1].id, slots[2].id], teamB: [slots[4].id, slots[7].id] },
  ];
}

export function MasterPage() {
  const { currentUser, isAdmin } = useAuth();
  const {
    users,
    schedules,
    getUserById,
    getUserByName,
    addMember,
    applyReplacementByMaster,
    addGuestAndReplace,
    updateUserActiveSeasons,
    updateUserSeasonStats,
    getAttendanceRecordsForSchedule,
    confirmBracketForSchedule,
    addSchedulesForSeason,
  } = useAppData();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(() => getDefaultScheduleId(schedules));
  const [generatedBracket, setGeneratedBracket] = useState<GeneratedMatch[]>([]);
  const [bracketMode, setBracketMode] = useState<'random' | 'skill' | 'mixed'>('random');
  const [bracketConfirmed, setBracketConfirmed] = useState(false);
  const [absentUserId, setAbsentUserId] = useState<string>('');
  const [replacementMode, setReplacementMode] = useState<'member' | 'guest'>('member');
  const [replacementUserId, setReplacementUserId] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [guestGender, setGuestGender] = useState<'M' | 'F'>('F');
  const [adminViewMode, setAdminViewMode] = useState<'mobile' | 'desktop'>('desktop');
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [seasonMemberDrafts, setSeasonMemberDrafts] = useState<Record<string, string[]>>({});
  const [newSeasonSelect, setNewSeasonSelect] = useState<string>('');
  const [newMemberName, setNewMemberName] = useState<string>('');
  // 시즌별 총 회차 임시 입력값 (season code → value string)
  const [seasonTotalSessionsDraft, setSeasonTotalSessionsDraft] = useState<Record<string, string>>({});
  const [newMemberPhoneLast4, setNewMemberPhoneLast4] = useState<string>('');
  const [showAllMembersForSeason, setShowAllMembersForSeason] = useState<boolean>(false);
  const [selectedAttendanceSeasonFilter, setSelectedAttendanceSeasonFilter] = useState<string>('');
  const [showClosedPastSchedules, setShowClosedPastSchedules] = useState<boolean>(false);
  const scheduleScrollRef = React.useRef<HTMLDivElement | null>(null);
  const scheduleButtonRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  React.useEffect(() => {
    const savedViewMode = window.localStorage.getItem(ADMIN_VIEW_MODE_STORAGE_KEY);
    if (savedViewMode === 'mobile' || savedViewMode === 'desktop') {
      setAdminViewMode(savedViewMode);
    }
  }, []);

  React.useEffect(() => {
    if (isMobile) {
      setAdminViewMode('mobile');
    }
  }, [isMobile]);

  React.useEffect(() => {
    window.localStorage.setItem(ADMIN_VIEW_MODE_STORAGE_KEY, adminViewMode);
  }, [adminViewMode]);

  React.useEffect(() => {
    if (!isAdmin) {
      navigate('/');
    }
  }, [isAdmin, navigate]);

  const memberUsers = useMemo(
    () => users.filter(user => !user.isGuest && !user.isWithdrawn && !user.id.startsWith('guest-')),
    [users]
  );
  const guestUsers = useMemo(() => users.filter(user => user.isGuest), [users]);
  const sortedUsers = [...memberUsers].sort((a, b) => getAttendanceRate(a) - getAttendanceRate(b));
  const currentProfileId = getUserByName(currentUser || '')?.id ?? users[0]?.id ?? '1';

  const todayDateKey = useMemo(() => getTodayDateKey(), []);
  const sortedSchedules = useMemo(
    () => [...schedules].sort((a, b) => getScheduleDateKey(a).localeCompare(getScheduleDateKey(b))),
    [schedules]
  );
  const pastClosedSchedules = useMemo(
    () => sortedSchedules.filter(s => getScheduleStatus(s) === 'closed' && getScheduleDateKey(s) < todayDateKey),
    [sortedSchedules, todayDateKey]
  );
  const primarySchedules = useMemo(
    () => sortedSchedules.filter(s => !(getScheduleStatus(s) === 'closed' && getScheduleDateKey(s) < todayDateKey)),
    [sortedSchedules, todayDateKey]
  );
  const schedulesForPicker = useMemo(
    () => (showClosedPastSchedules ? [...primarySchedules, ...pastClosedSchedules] : primarySchedules),
    [showClosedPastSchedules, primarySchedules, pastClosedSchedules]
  );

  React.useEffect(() => {
    if (!selectedScheduleId) return;

    const container = scheduleScrollRef.current;
    const target = scheduleButtonRefs.current[selectedScheduleId];
    if (!container || !target) return;

    // Keep selected round visible and near center of horizontal scroll area.
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextLeft =
      container.scrollLeft +
      (targetRect.left - containerRect.left) -
      (containerRect.width - targetRect.width) / 2;

    container.scrollTo({ left: Math.max(0, nextLeft), behavior: 'smooth' });
  }, [selectedScheduleId, schedulesForPicker]);

  React.useEffect(() => {
    if (schedulesForPicker.length === 0) {
      if (selectedScheduleId !== '') setSelectedScheduleId('');
      return;
    }

    const exists = schedulesForPicker.some(s => s.id === selectedScheduleId);
    if (!exists) {
      setSelectedScheduleId(schedulesForPicker[0].id);
    }
  }, [schedulesForPicker, selectedScheduleId]);

  const selectedSchedule = schedules.find(s => s.id === selectedScheduleId);
  const selectedScheduleStatus = selectedSchedule ? getScheduleStatus(selectedSchedule) : 'open';
  const selectedScheduleSeasonCode = useMemo(() => {
    if (!selectedSchedule) return undefined;
    return getScheduleSeasonCode(selectedSchedule);
  }, [selectedSchedule]);

  const selectedScheduleSeasonMembers = useMemo(() => {
    if (!selectedSchedule) return [] as UserType[];
    if (!selectedScheduleSeasonCode) return memberUsers;
    return memberUsers.filter(member => (member.activeSeasons ?? []).includes(selectedScheduleSeasonCode));
  }, [selectedSchedule, selectedScheduleSeasonCode, memberUsers]);

  const attendanceRecords = useMemo(() => {
    if (!selectedSchedule) return [];
    const records = getAttendanceRecordsForSchedule(selectedSchedule.id);
    
    // 해당 시즌 멤버만 정규 멤버로 취급, 나머지는 게스트
    const seasonMemberIds = new Set(selectedScheduleSeasonMembers.map(m => m.id));
    
    return records.map((record: any) => ({
      ...record,
      isGuest: !seasonMemberIds.has(record.userId)
    }));
  }, [selectedSchedule, schedules, selectedScheduleSeasonMembers]);

  const absentUsers = useMemo(() => {
    if (!selectedSchedule) return [];

    return selectedSchedule.attendanceRequests
      .filter((request: any) => request.status === 'absent')
      .map((request: any) => getUserById(request.userId))
      .filter(Boolean) as UserType[];
  }, [selectedSchedule, users]);

  const noResponseUsers = useMemo(() => {
    if (!selectedSchedule) return [];

    return selectedScheduleSeasonMembers.filter(
      member => !selectedSchedule.attendanceRequests.some((request: any) => request.userId === member.id)
    );
  }, [selectedSchedule, selectedScheduleSeasonMembers]);

  const replacementCandidates = useMemo(() => {
    if (!selectedSchedule) return [];
    const blocked = new Set(selectedSchedule.participants);
    if (absentUserId) {
      blocked.delete(absentUserId);
    }
    return selectedScheduleSeasonMembers.filter(user => !blocked.has(user.id));
  }, [selectedSchedule, absentUserId, selectedScheduleSeasonMembers]);

  const allSeasons = useMemo(() => {
    const set = new Set<string>();
    memberUsers.forEach(u => (u.activeSeasons ?? []).forEach((s: string) => set.add(s)));
    return Array.from(set).sort();
  }, [memberUsers]);

  const selectedSeasonMembers = useMemo(() => {
    if (!selectedSeason) return [] as UserType[];
    const selectedIds = seasonMemberDrafts[selectedSeason] ?? [];
    return selectedIds
      .map(id => memberUsers.find(user => user.id === id))
      .filter(Boolean) as UserType[];
  }, [selectedSeason, seasonMemberDrafts, memberUsers]);

  const seasonWeekNumberBySeasonDate = useMemo(() => {
    const seasonDateList: Record<string, string[]> = {};
    const weekBySeasonDate: Record<string, number> = {};

    // 1) Build unique date list per season (sorted)
    schedules.forEach((st: any) => {
      const seasonCode = getScheduleSeasonCode(st) ?? 'unknown';
      const dateKey = toDateKey(st.date || st.attendanceDeadline || '');
      if (!seasonDateList[seasonCode]) seasonDateList[seasonCode] = [];
      if (!seasonDateList[seasonCode].includes(dateKey)) {
        seasonDateList[seasonCode].push(dateKey);
      }
    });

    Object.keys(seasonDateList).forEach(seasonCode => {
      seasonDateList[seasonCode].sort((a, b) => a.localeCompare(b));
    });

    // 2) Map each season+date to week number.
    Object.entries(seasonDateList).forEach(([seasonCode, dates]) => {
      dates.forEach((date, idx) => {
        weekBySeasonDate[`${seasonCode}|${date}`] = idx + 1;
      });
    });

    return weekBySeasonDate;
  }, [schedules]);

  // 시즌별 필터링된 경기들
  const schedulesForAttendanceFilter = useMemo(() => {
    if (!selectedAttendanceSeasonFilter) return [];
    return schedules.filter(schedule => {
      const seasonCode = getScheduleSeasonCode(schedule);
      return seasonCode === selectedAttendanceSeasonFilter;
    });
  }, [schedules, selectedAttendanceSeasonFilter]);

  // 필터링된 경기들의 모든 참석 기록
  const attendanceRecordsForSeason = useMemo(() => {
    if (!selectedAttendanceSeasonFilter || schedulesForAttendanceFilter.length === 0) return [];
    
    // 모든 필터링된 경기의 참석 요청을 수집
    const allRequests: Array<{
      userId: string;
      requestedAt: string;
      status: 'attend' | 'absent';
    }> = [];
    
    schedulesForAttendanceFilter.forEach(schedule => {
      allRequests.push(...schedule.attendanceRequests);
    });

    // 중복 제거: 각 사용자의 최신 요청만 유지
    const userLatestRequest: Record<string, typeof allRequests[0]> = {};
    allRequests.forEach(req => {
      if (!userLatestRequest[req.userId] || new Date(req.requestedAt) > new Date(userLatestRequest[req.userId].requestedAt)) {
        userLatestRequest[req.userId] = req;
      }
    });

    // 시즌 멤버 정보
    const seasonMembers = memberUsers.filter(m => (m.activeSeasons ?? []).includes(selectedAttendanceSeasonFilter));
    const seasonMemberIds = new Set(seasonMembers.map(m => m.id));

    // 참석 기록 생성
    const records = Object.values(userLatestRequest).map(req => {
      const user = users.find(u => u.id === req.userId);
      return {
        userId: req.userId,
        name: user?.name ?? req.userId,
        gender: user?.gender ?? 'M',
        attendanceRate: user ? getAttendanceRate(user) : 0,
        requestedAt: req.requestedAt,
        status: req.status,
        isGuest: !seasonMemberIds.has(req.userId),
      };
    });

    // 미응답 멤버 추가
    const respondedIds = new Set(Object.keys(userLatestRequest));
    seasonMembers.forEach(member => {
      if (!respondedIds.has(member.id)) {
        records.push({
          userId: member.id,
          name: member.name,
          gender: member.gender,
          attendanceRate: getAttendanceRate(member),
          requestedAt: '',
          status: 'absent' as const,
          isGuest: false,
        });
      }
    });

    return records.sort((a, b) => {
      if (a.status === 'attend' && b.status !== 'attend') return -1;
      if (a.status !== 'attend' && b.status === 'attend') return 1;
      const userA = users.find(u => u.id === a.userId);
      const userB = users.find(u => u.id === b.userId);
      return getAttendanceRate(userB || { id: '', name: '', gender: 'M' }) - getAttendanceRate(userA || { id: '', name: '', gender: 'M' });
    });
  }, [selectedAttendanceSeasonFilter, schedulesForAttendanceFilter, users, memberUsers, getAttendanceRate]);

  React.useEffect(() => {
    setSeasonMemberDrafts(prev => {
      const next = { ...prev };
      const allS = new Set<string>();
      memberUsers.forEach(u => (u.activeSeasons ?? []).forEach((s: string) => allS.add(s)));
      allS.forEach((season: string) => {
        if (next[season] === undefined) {
          next[season] = memberUsers
            .filter(u => (u.activeSeasons ?? []).includes(season))
            .map(u => u.id);
        }
      });
      return next;
    });
  }, [memberUsers]);

  const handleGenerateDraw = (type: 'random' | 'skill' | 'mixed') => {
    if (!selectedSchedule) {
      toast.error('경기 일정을 선택해주세요');
      return;
    }

    if (selectedScheduleStatus !== 'draw_waiting') {
      toast.error('일정 마감 후 대진표 생성 대기중 상태에서만 생성할 수 있습니다');
      return;
    }

    if (selectedSchedule.participants.length < 6) {
      toast.error('6경기 생성을 위해 최소 6명의 참석자가 필요합니다');
      return;
    }

    let bracket: GeneratedMatch[];
    if (type === 'mixed') {
      bracket = buildMixedDoublesBracket(selectedSchedule.participants, getUserById);
    } else {
      bracket = buildSixMatchBracket(selectedSchedule.participants, type, getUserById);
    }

    setGeneratedBracket(bracket);
    setBracketMode(type);
    setBracketConfirmed(false);

    const labels = { random: '랜덤', skill: '실력별', mixed: '혼복' };
    toast.success(`${labels[type]} 대진표 6경기가 생성되었습니다`);
  };

  const handleConfirmBracket = () => {
    if (!selectedSchedule) return;

    if (generatedBracket.length !== 6) {
      toast.error('대진표 6경기를 먼저 생성해주세요');
      return;
    }

    confirmBracketForSchedule(
      selectedSchedule.id,
      selectedSchedule.date,
      generatedBracket.map(match => ({ teamA: match.teamA, teamB: match.teamB }))
    );

    setBracketConfirmed(true);
    toast.success('대진표가 확정되었습니다', {
      description: '유저 홈 화면에서 스코어 입력을 포함해 확인할 수 있습니다',
    });
  };

  const handleApplyReplacement = () => {
    if (!selectedSchedule || !absentUserId) {
      toast.error('불참자를 선택해주세요');
      return;
    }

    if (replacementMode === 'member') {
      if (!replacementUserId) {
        toast.error('대참할 멤버를 선택해주세요');
        return;
      }
      applyReplacementByMaster(selectedSchedule.id, absentUserId, replacementUserId);
    } else {
      if (!guestName.trim()) {
        toast.error('게스트 이름을 입력해주세요');
        return;
      }
      addGuestAndReplace(selectedSchedule.id, absentUserId, guestName.trim(), guestGender);
    }

    setAbsentUserId('');
    setReplacementUserId('');
    setGuestName('');
    toast.success('참석자 편집이 반영되었습니다');
  };

  const handleAddSeason = () => {
    const s = newSeasonSelect;
    if (!s) return;
    setSeasonMemberDrafts((prev: any) => (prev[s] !== undefined ? prev : { ...prev, [s]: [] }));
    setSelectedSeason(s);
    setNewSeasonSelect('');
    // 기존 멤버 데이터에서 total_sessions 초기값 로드
    setSeasonTotalSessionsDraft((prev: any) => {
      if (prev[s] !== undefined) return prev;
      const existing = memberUsers.find((u: any) => (u.activeSeasons ?? []).includes(s));
      const val = existing?.seasonStats?.find((st: any) => st.seasonCode === s)?.total_sessions ?? 0;
      return { ...prev, [s]: String(val) };
    });
  };

  const handleToggleMemberInSeason = (season: string, memberId: string) => {
    setSeasonMemberDrafts(prev => {
      const current = prev[season] ?? [];
      const updated = current.includes(memberId)
        ? current.filter(id => id !== memberId)
        : [...current, memberId];
      return { ...prev, [season]: updated };
    });
  };

  const handleCreateMemberForSeason = (season: string) => {
    const name = newMemberName.trim();
    const phoneLast4 = newMemberPhoneLast4.trim();

    if (!name) {
      toast.error('신규 회원 이름을 입력해주세요');
      return;
    }

    if (!/^\d{4}$/.test(phoneLast4)) {
      toast.error('전화번호 뒷번호 4자리를 입력해주세요');
      return;
    }

    const created = addMember(name, phoneLast4, {
      gender: 'W',
      activeSeasons: [season],
    });

    if (!created) {
      toast.error('신규 회원 생성에 실패했습니다');
      return;
    }

    setSeasonMemberDrafts(prev => {
      const current = new Set(prev[season] ?? []);
      current.add(created.id);
      return { ...prev, [season]: Array.from(current) };
    });

    setNewMemberName('');
    setNewMemberPhoneLast4('');
    toast.success('신규 회원이 추가되었습니다');
  };

  const handleSaveSeason = (season: string) => {
    const activeIds = new Set(seasonMemberDrafts[season] ?? []);
    const totalSessions = Math.max(0, parseInt(seasonTotalSessionsDraft[season] ?? '0', 10) || 0);

    memberUsers.forEach(member => {
      const current = member.activeSeasons ?? [];
      const isActive = activeIds.has(member.id);
      const updated = isActive
        ? current.includes(season) ? current : [...current, season]
        : current.filter((s: string) => s !== season);
      const changed =
        updated.length !== current.length ||
        updated.some((s: string) => !current.includes(s));
      if (changed) updateUserActiveSeasons(member.id, updated);

      // 해당 시즌에 속한 멤버의 total_sessions 업데이트
      if (isActive) {
        const existingStats = member.seasonStats ?? [];
        const hasEntry = existingStats.some((s: any) => s.seasonCode === season);
        const updatedStats = hasEntry
          ? existingStats.map((s: any) =>
              s.seasonCode === season ? { ...s, total_sessions: totalSessions } : s
            )
          : [...existingStats, { seasonCode: season, total_sessions: totalSessions, attended_sessions: 0, wins: 0, losses: 0 }];
        updateUserSeasonStats(member.id, updatedStats);
          // 시즌 총 회차가 설정되면 경기 일정 자동 생성
          if (totalSessions > 0) {
            addSchedulesForSeason(season, totalSessions);
          }
      }
    });
    toast.success(`${seasonCodeToLabel(season)} 시즌이 저장됐습니다`);
  };

  const statusLabel =
    selectedScheduleStatus === 'open'
      ? '참석 접수중'
      : selectedScheduleStatus === 'draw_waiting'
        ? '대진표 생성 대기중'
        : '마감';
  const isMobilePreview = adminViewMode === 'mobile';

  return (
    <PageLayout>
      <div className="min-h-screen bg-white">
        <Toaster />

      <div className={`${isMobilePreview ? 'max-w-md' : 'max-w-6xl'} mx-auto ${isMobilePreview ? 'px-4 py-5' : 'p-6'} transition-all duration-200`}>
        <div className="mb-8">
          <div className={`${isMobilePreview ? 'space-y-3' : 'flex items-center justify-between gap-4'}`}>
            <div>
            <h1 className={`${isMobilePreview ? 'text-2xl' : 'text-3xl'} font-bold mb-2`}>마스터 페이지</h1>
              <p className="text-sm text-gray-500">모웹 미리보기에서 운영 흐름을 확인할 수 있습니다.</p>
            </div>
            <div className="inline-flex rounded-xl border border-gray-200 p-1 bg-white self-start">
              <button
                type="button"
                onClick={() => setAdminViewMode('mobile')}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
                style={isMobilePreview ? { backgroundColor: '#FFC1CC', color: '#030213' } : { color: '#6B7280' }}
              >
                <Smartphone className="w-4 h-4" />
                모웹
              </button>
              <button
                type="button"
                onClick={() => setAdminViewMode('desktop')}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
                style={!isMobilePreview ? { backgroundColor: '#FFC1CC', color: '#030213' } : { color: '#6B7280' }}
              >
                <Monitor className="w-4 h-4" />
                데스크톱
              </button>
            </div>
          </div>
        </div>

        <div className={`grid ${isMobilePreview ? 'grid-cols-1' : 'md:grid-cols-3'} gap-4 mb-6`}>
          <Card className={isMobilePreview ? '' : 'md:col-span-2'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shuffle className="w-5 h-5" style={{ color: '#030213' }} />
                경기 일정 및 대진 생성
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">경기 일정 선택</p>
                <div ref={scheduleScrollRef} className="overflow-x-auto pb-1">
                <div className="grid grid-flow-col auto-cols-[minmax(150px,1fr)] gap-2 min-w-max">
                  {schedulesForPicker.map(schedule => {
                    const scheduleStatus = getScheduleStatus(schedule);
                    const seasonCode = getScheduleSeasonCode(schedule) ?? 'unknown';
                    const dateKey = toDateKey(schedule.date || schedule.attendanceDeadline || '');
                    const seasonWeek = seasonWeekNumberBySeasonDate[`${seasonCode}|${dateKey}`] ?? 1;
                    return (
                      <button
                        key={schedule.id}
                        ref={el => {
                          scheduleButtonRefs.current[schedule.id] = el;
                        }}
                        onClick={() => {
                          setSelectedScheduleId(schedule.id);
                          setGeneratedBracket([]);
                          setBracketConfirmed(false);
                          setAbsentUserId('');
                          setReplacementUserId('');
                        }}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          selectedScheduleId === schedule.id
                            ? 'border-transparent text-[#030213]'
                            : scheduleStatus === 'closed'
                              ? 'border-gray-300 text-gray-600 hover:border-gray-400'
                              : 'border-gray-200 text-gray-700 hover:border-gray-400'
                        }`}
                        style={
                          selectedScheduleId === schedule.id
                            ? { backgroundColor: '#FFC1CC' }
                            : scheduleStatus === 'closed'
                              ? { backgroundColor: '#F3F4F6' }
                              : {}
                        }
                      >
                        {/* 주차만 표기 (시즌 제거) */}
                        <p className="text-xs text-gray-00 font-medium mb-1">
                          {seasonWeek}주차
                        </p>
                        <p className="text-lg font-bold text-[#030213] leading-tight">
                          {new Date(schedule.date).toLocaleDateString('ko-KR', {
                            month: 'short', day: 'numeric', weekday: 'short',
                          })}
                        </p>
                        <p className="text-[11px] mt-1">
                          {(() => {
                            // 실제 오픈된 일정만 '접수중', 나머지는 '접수 예정'
                            if (scheduleStatus === 'open') {
                              // 오늘 날짜 기준으로 이미 지난 일정은 제외
                              const todayKey = getTodayDateKey();
                              const scheduleKey = toDateKey(schedule.date || schedule.attendanceDeadline || '');
                              // 오픈된 일정: 오늘 또는 과거 날짜이면서 상태가 open
                              if (scheduleKey <= todayKey) {
                                return '접수중';
                              }
                              return '접수 예정';
                            }
                            return scheduleStatus === 'draw_waiting' ? '대진 대기' : '마감';
                          })()}
                        </p>
                      </button>
                    );
                  })}
                </div>
                </div>
                {pastClosedSchedules.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setShowClosedPastSchedules(prev => !prev)}
                      className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
                    >
                      {showClosedPastSchedules
                        ? `이전 마감 일정 접기 (${pastClosedSchedules.length})`
                        : `이전 마감 일정 더보기 (${pastClosedSchedules.length})`}
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">일정 확정(접수 마감): 경기 1주 전 자동 전환</p>
              </div>

              <div className={`flex ${isMobilePreview ? 'flex-col' : 'flex-row'} gap-2`}>
                <Button
                  className="flex-1"
                  style={{ backgroundColor: '#FFC1CC', color: '#030213' }}
                  onClick={() => handleGenerateDraw('random')}
                  disabled={!selectedSchedule}
                >
                  <Shuffle className="w-4 h-4 mr-2" />
                  랜덤 6경기 생성
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleGenerateDraw('skill')}
                  disabled={!selectedSchedule}
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  실력별 6경기 생성
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleGenerateDraw('mixed')}
                  disabled={!selectedSchedule}
                >
                  혼복 6경기 생성
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRoundCog className="w-5 h-5" style={{ color: '#030213' }} />
                대참자 관리
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedSchedule ? (
                <>
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">불참자</p>
                    <select
                      id="absentUserId"
                      name="absentUserId"
                      className="border rounded-md px-3 py-2 text-sm w-full"
                      value={absentUserId}
                      onChange={e => setAbsentUserId(e.target.value)}
                      autoComplete="off"
                    >
                      <option value="">불참자 선택</option>
                      <option value="empty-slot">빈자리(미응답/미정)</option>
                      {selectedSchedule.participants.map((id: string) => {
                        const user = getUserById(id);
                        return user ? (
                          <option key={id} value={id}>{user.name}{user.isGuest ? ' (게스트)' : ''}</option>
                        ) : null;
                      })}
                    </select>
                  </div>

                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">대참 유형</p>
                    <div className="flex gap-2">
                      <button
                        className="px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors"
                        style={replacementMode === 'member' ? { backgroundColor: '#030213', color: '#fff', borderColor: '#030213' } : { backgroundColor: '#fff', color: '#374151', borderColor: '#D1D5DB' }}
                        onClick={() => setReplacementMode('member')}
                      >
                        멤버
                      </button>
                      <button
                        className="px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors"
                        style={replacementMode === 'guest' ? { backgroundColor: '#030213', color: '#fff', borderColor: '#030213' } : { backgroundColor: '#fff', color: '#374151', borderColor: '#D1D5DB' }}
                        onClick={() => setReplacementMode('guest')}
                      >
                        게스트
                      </button>
                    </div>
                  </div>

                  <div className={`flex flex-wrap gap-2 items-end ${isMobilePreview ? 'flex-col items-stretch' : ''}`}>
                    {replacementMode === 'member' ? (
                      <select
                        id="replacementUserId"
                        name="replacementUserId"
                        className={`border rounded-md px-3 py-2 text-sm ${isMobilePreview ? 'w-full' : ''}`}
                        value={replacementUserId}
                        onChange={e => setReplacementUserId(e.target.value)}
                        autoComplete="off"
                      >
                        <option value="">대참 멤버 선택</option>
                        {replacementCandidates.map(user => (
                          <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                      </select>
                    ) : (
                      <>
                        <input
                          id="guestName"
                          name="guestName"
                          type="text"
                          className={`border rounded-md px-3 py-2 text-sm ${isMobilePreview ? 'w-full' : 'w-40'}`}
                          placeholder="게스트 이름"
                          value={guestName}
                          onChange={e => setGuestName(e.target.value)}
                          autoComplete="name"
                        />
                        <select
                          id="guestGender"
                          name="guestGender"
                          className={`border rounded-md px-3 py-2 text-sm ${isMobilePreview ? 'w-full' : ''}`}
                          value={guestGender}
                          onChange={e => setGuestGender(e.target.value as 'M' | 'F')}
                          autoComplete="sex"
                        >
                          <option value="F">여성</option>
                          <option value="M">남성</option>
                        </select>
                      </>
                    )}
                    <Button
                      onClick={handleApplyReplacement}
                      style={{ backgroundColor: '#FFC1CC', color: '#030213' }}
                    >
                      대참 반영
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">경기 일정을 선택하면 대참자 관리를 사용할 수 있습니다.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {selectedSchedule && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="w-5 h-5" style={{ color: '#030213' }} />
                참석 기록 조회
                <button
                  type="button"
                  aria-label="우선순위 설명"
                  onClick={() =>
                    toast.info('우선순위 기준', {
                      description: '출석률 + 버튼 누른 시간',
                    })
                  }
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-xs text-gray-600 hover:bg-gray-100"
                >
                  ?
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* 시즌 필터 제거됨 */}

              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{statusLabel}</Badge>
                {selectedScheduleSeasonCode && (
                  <Badge variant="outline">기준 시즌 {seasonCodeToLabel(selectedScheduleSeasonCode)}</Badge>
                )}
                <Badge variant="outline">대상 멤버 {selectedScheduleSeasonMembers.length}명</Badge>
                <span className="text-gray-400">
                  참석 {selectedSchedule?.participants.length ?? 0}/{selectedSchedule?.maxParticipants ?? 0}명 · 대기 {selectedSchedule?.waitlist.length ?? 0}명
                </span>
              </div>

              {selectedSchedule ? (
                isMobilePreview ? (
                  <div className="space-y-2">
                    {attendanceRecords.map((row: any, index: number) => (
                      <div key={row.userId} className="rounded-lg border border-gray-200 px-3 py-3 space-y-2"
                        style={{
                          backgroundColor: row.userId.startsWith('guest-') ? '#F8FCFF' : row.placement === 'waitlist' ? '#FFFEF0' : '#FFFFFF',
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#030213] truncate">
                              {index + 1}. {row.name}
                              <span className="ml-1 text-s font-normal text-gray-500">{row.gender === 'M' ? '남' : '여'}</span>
                            </p>
                            {!row.userId.startsWith('guest-') && (
                              <p className="mt-1 text-xs text-gray-400">
                                출석률 {row.attendanceRate}% · 요청 {new Date(row.requestedAt).toLocaleString('ko-KR', {
                                  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
                                })}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {row.userId.startsWith('guest-') && <Badge variant="outline">게스트</Badge>}
                            {row.placement === 'participant' ? (
                              <Badge style={{ backgroundColor: '#E8F5E9', color: '#2E7D32' }}>참석자</Badge>
                            ) : (
                              <Badge style={{ backgroundColor: '#FFF3E0', color: '#E65100' }}>대기자</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-center">우선순위</TableHead>
                          <TableHead className="text-center">이름</TableHead>
                          <TableHead className="text-center">성별</TableHead>
                          <TableHead className="text-center">출석률</TableHead>
                          <TableHead className="text-center">요청 시각</TableHead>
                          <TableHead className="text-center">배정</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendanceRecords.map((row: any, index: number) => (
                          <TableRow key={row.userId}
                            style={{
                              backgroundColor: row.userId.startsWith('guest-') ? '#F8FCFF' : row.placement === 'waitlist' ? '#FFFEF0' : undefined,
                            }}
                          >
                            <TableCell className="text-center">{index + 1}</TableCell>
                            <TableCell className="text-center">{row.name}</TableCell>
                            <TableCell className="text-center text-s">{row.gender === 'M' ? '남' : '여'}</TableCell>
                            <TableCell className="text-center">
                              {row.userId.startsWith('guest-') ? '-' : `${row.attendanceRate}%`}
                            </TableCell>
                            <TableCell className="text-center">
                              {row.userId.startsWith('guest-') ? '-' : new Date(row.requestedAt).toLocaleString('ko-KR', {
                                month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
                              })}
                            </TableCell>
                            <TableCell className="text-center">
                              {row.placement === 'participant' ? (
                                <Badge style={{ backgroundColor: '#E8F5E9', color: '#2E7D32' }}>참석자</Badge>
                              ) : (
                                <Badge style={{ backgroundColor: '#FFF3E0', color: '#E65100' }}>대기자</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              ) : (
                <p className="text-sm text-gray-500">경기 일정을 선택해주세요.</p>
              )}

              {!selectedAttendanceSeasonFilter && selectedSchedule && (
              <div className={`grid ${isMobilePreview ? 'grid-cols-1' : 'md:grid-cols-2'} gap-4 mt-4`}>
                <div>
                  <p className="text-xs text-gray-500 mb-2">불참 멤버</p>
                  <div className="flex flex-wrap gap-2">
                    {absentUsers.length > 0 ? (
                      absentUsers.map(member => (
                        <span key={member.id} className="px-2 py-1 bg-white border border-gray-200 rounded-md text-xs text-red-700">
                          {member.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">불참 없음</span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-2">미응답 멤버</p>
                  <div className="flex flex-wrap gap-2">
                    {noResponseUsers.length > 0 ? (
                      noResponseUsers.map(member => (
                        <span key={member.id} className="px-2 py-1 bg-white border border-gray-200 rounded-md text-xs text-gray-600">
                          {member.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">미응답 없음</span>
                    )}
                  </div>
                </div>
              </div>
              )}
            </CardContent>
          </Card>
        )}

        {generatedBracket.length > 0 && (
          <Card className="mb-6 border-2 transition-colors" style={{ borderColor: bracketConfirmed ? '#4CAF50' : '#FFC1CC' }}>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2">
                  {bracketConfirmed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Trophy className="w-5 h-5" style={{ color: '#030213' }} />
                  )}
                  {selectedSchedule && new Date(selectedSchedule.date).toLocaleDateString('ko-KR', {
                    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
                  })}
                  <Badge variant="outline" className="ml-1 text-xs">
                    {bracketMode === 'random' ? '랜덤' : bracketMode === 'skill' ? '실력별' : '혼복'}
                  </Badge>
                  {bracketConfirmed && (
                    <Badge className="ml-1 text-xs" style={{ backgroundColor: '#4CAF50', color: 'white' }}>
                      확정됨
                    </Badge>
                  )}
                </CardTitle>

                {!bracketConfirmed && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleGenerateDraw(bracketMode)} className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />
                      다시 생성
                    </Button>
                    <Button size="sm" onClick={handleConfirmBracket} style={{ backgroundColor: '#FFC1CC', color: '#030213' }} className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      대진 확정
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {generatedBracket.map((match, idx) => {
                  const teamA = match.teamA.map(id => getUserById(id)).filter(Boolean) as UserType[];
                  const teamB = match.teamB.map(id => getUserById(id)).filter(Boolean) as UserType[];

                  const allPlayers = [...teamA, ...teamB];
                  const nonGuestAvgRate = (() => {
                    const ng = allPlayers.filter(p => !p.isGuest);
                    return ng.length > 0 ? ng.reduce((s, p) => s + getWinRate(p), 0) / ng.length : 50;
                  })();
                  const effectiveRate = (p: UserType) => p.isGuest ? nonGuestAvgRate : getWinRate(p);

                  const avgA = Math.round(teamA.reduce((sum, p) => sum + effectiveRate(p), 0) / teamA.length);
                  const avgB = Math.round(teamB.reduce((sum, p) => sum + effectiveRate(p), 0) / teamB.length);
                  const isBalanced = Math.abs(avgA - avgB) <= 10;
                  const isMixed = (team: UserType[]) => team.some(p => p.gender === 'F' || p.gender === 'W') && team.some(p => p.gender === 'M');
                  const isAllFemale = (team: UserType[]) => team.every(p => p.gender === 'F' || p.gender === 'W');
                  const isAllMale = (team: UserType[]) => team.every(p => p.gender === 'M');
                  const getMatchTypeLabel = () => {
                    if (isMixed(teamA) && isMixed(teamB)) return '혼복';
                    if (isAllFemale(teamA) && isAllFemale(teamB)) return '여복';
                    if (isAllMale(teamA) && isAllMale(teamB)) return '남복';
                    return '혼복';
                  };

                  return (
                    <div key={match.id} className="p-4 rounded-xl border bg-gray-50">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-semibold text-gray-700">{idx + 1}경기</span>
                        <Badge
                          className="text-xs py-0"
                          style={isBalanced ? { backgroundColor: '#E8F5E9', color: '#2E7D32' } : { backgroundColor: '#FFF3E0', color: '#E65100' }}
                        >
                          {isBalanced ? '균형' : '불균형'}
                        </Badge>
                        {bracketMode === 'mixed' && (
                          <Badge className="text-xs py-0" variant="outline">
                            {getMatchTypeLabel()}
                          </Badge>
                        )}
                      </div>

                      <div className={`flex ${isMobilePreview ? 'flex-col' : 'flex-row items-stretch'} gap-3`}>
                        <div className="flex-1 p-3 bg-white rounded-lg border">
                          <div className="text-xs text-gray-400 text-center mb-2">
                            Team A · 평균 <span className="font-semibold">{avgA}%</span>
                          </div>
                          {teamA.map(player => (
                            <div key={player.id} className="flex items-center justify-between px-1 py-1">
                              <span className="text-sm font-medium">
                                {player.name}
                                {player.isGuest && <span className="ml-1 text-xs text-gray-400">(게스트)</span>}
                              </span>
                              {player.isGuest ? (
                                <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>경력미상</span>
                              ) : (
                                <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: getWinRate(player) >= 70 ? '#FFE0E6' : '#F5F5F5', color: getWinRate(player) >= 70 ? '#C62828' : '#666' }}>
                                  {getWinRate(player)}%
                                </span>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-center">
                          <span className="text-xs font-bold text-gray-400">VS</span>
                        </div>

                        <div className="flex-1 p-3 bg-white rounded-lg border">
                          <div className="text-xs text-gray-400 text-center mb-2">
                            Team B · 평균 <span className="font-semibold">{avgB}%</span>
                          </div>
                          {teamB.map(player => (
                            <div key={player.id} className="flex items-center justify-between px-1 py-1">
                              <span className="text-sm font-medium">
                                {player.name}
                                {player.isGuest && <span className="ml-1 text-xs text-gray-400">(게스트)</span>}
                              </span>
                              {player.isGuest ? (
                                <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>경력미상</span>
                              ) : (
                                <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: getWinRate(player) >= 70 ? '#FFE0E6' : '#F5F5F5', color: getWinRate(player) >= 70 ? '#C62828' : '#666' }}>
                                  {getWinRate(player)}%
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>회원 출석 관리</CardTitle>
          </CardHeader>
          <CardContent>
            {/* 시즌별 필터 추가 */}
            <div className="mb-4 flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedAttendanceSeasonFilter('')}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  selectedAttendanceSeasonFilter === ''
                    ? 'bg-[#030213] text-white border-[#030213]'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                }`}
              >
                전체
              </button>
              {allSeasons.map(season => (
                <button
                  key={season}
                  onClick={() => setSelectedAttendanceSeasonFilter(season)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    selectedAttendanceSeasonFilter === season
                      ? 'bg-[#030213] text-white border-[#030213]'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                  }`}
                >
                  {seasonCodeToLabel(season)}
                </button>
              ))}
            </div>
            {(() => {
              // 시즌별 멤버 필터링
              let usersToShow = sortedUsers;
              if (selectedAttendanceSeasonFilter) {
                usersToShow = sortedUsers.filter(user => (user.activeSeasons ?? []).includes(selectedAttendanceSeasonFilter));
              }
              return isMobilePreview ? (
                <div className="space-y-2">
                  {usersToShow.map((user: any, index: number) => {
                    // 시즌별 통계 추출
                    let totals = getTotalStats(user);
                    let attendanceRate = getAttendanceRate(user);
                    let winRate = getWinRate(user);
                    if (selectedAttendanceSeasonFilter) {
                      const stat = (user.seasonStats ?? []).find((s: any) => s.seasonCode === selectedAttendanceSeasonFilter);
                      totals = stat ? { ...totals, ...stat } : totals;
                      attendanceRate = stat ? Math.round((stat.attended_sessions / (stat.total_sessions || 1)) * 100) : attendanceRate;
                      winRate = stat ? Math.round((stat.wins / ((stat.wins + stat.losses) || 1)) * 100) : winRate;
                    }
                    const isLowAttendance = attendanceRate < 60;
                    return (
                      <div key={user.id} className="rounded-lg border border-gray-200 bg-white px-3 py-3 space-y-2" style={isLowAttendance ? { backgroundColor: '#FFF5F7' } : {}}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-[#030213]">{index + 1}. <Link to={`/profile/${user.id}`} className="hover:underline">{user.name}</Link></p>
                            <p className="text-xs text-gray-500">총 경기 {totals.total_sessions} · 출석 {totals.attended_sessions}</p>
                          </div>
                          {isLowAttendance ? (
                            <Badge style={{ backgroundColor: '#FF4D4D', color: 'white' }}>우선순위</Badge>
                          ) : (
                            <Badge style={{ backgroundColor: '#FFC1CC', color: '#030213' }}>정상</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">출석률</span>
                          <span className="font-medium">{attendanceRate}%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">전적</span>
                          <span className="font-medium">{totals.wins}승 {totals.losses}패 · 승률 {winRate}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>순위</TableHead>
                        <TableHead>이름</TableHead>
                        <TableHead>총 경기</TableHead>
                        <TableHead>출석</TableHead>
                        <TableHead>출석률</TableHead>
                        <TableHead>전적</TableHead>
                        <TableHead>승률</TableHead>
                        <TableHead>상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersToShow.map((user, index) => {
                        let totals = getTotalStats(user);
                        let attendanceRate = getAttendanceRate(user);
                        let winRate = getWinRate(user);
                        if (selectedAttendanceSeasonFilter) {
                          const stat = (user.seasonStats ?? []).find((s: any) => s.seasonCode === selectedAttendanceSeasonFilter);
                          totals = stat ? { ...totals, ...stat } : totals;
                          attendanceRate = stat ? Math.round((stat.attended_sessions / (stat.total_sessions || 1)) * 100) : attendanceRate;
                          winRate = stat ? Math.round((stat.wins / ((stat.wins + stat.losses) || 1)) * 100) : winRate;
                        }
                        const isLowAttendance = attendanceRate < 60;
                        return (
                          <TableRow key={user.id} style={isLowAttendance ? { backgroundColor: '#FFF5F7' } : {}}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="font-medium">
                              <Link to={`/profile/${user.id}`} className="hover:underline">
                                {user.name}
                              </Link>
                            </TableCell>
                            <TableCell>{totals.total_sessions}</TableCell>
                            <TableCell>{totals.attended_sessions}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className={isLowAttendance ? 'font-bold' : ''}>{attendanceRate}%</span>
                                {isLowAttendance && <TrendingDown className="w-4 h-4" style={{ color: '#FF4D4D' }} />}
                              </div>
                            </TableCell>
                            <TableCell>
                              {totals.wins}승 {totals.losses}패
                            </TableCell>
                            <TableCell>{winRate}%</TableCell>
                            <TableCell>
                              {isLowAttendance ? (
                                <Badge style={{ backgroundColor: '#FF4D4D', color: 'white' }}>우선순위</Badge>
                              ) : (
                                <Badge style={{ backgroundColor: '#FFC1CC', color: '#030213' }}>정상</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <Card className="mt-6 mb-6">
          <CardHeader>
            <CardTitle>게스트 목록</CardTitle>
          </CardHeader>
          <CardContent>
            {guestUsers.length === 0 ? (
              <p className="text-sm text-gray-500">등록된 게스트가 없습니다</p>
            ) : isMobilePreview ? (
              <div className="space-y-2">
                {guestUsers.map(guest => {
                  const guestTotals = getTotalStats(guest);
                  return (
                  <div key={guest.id} className="rounded-lg border border-gray-200 bg-white px-3 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#030213]">{guest.name}</p>
                        <p className="text-xs text-gray-500">{guest.gender === 'F' ? '여성' : '남성'}</p>
                      </div>
                      <Badge variant="outline">게스트</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">전적</span>
                      <span className="font-medium">{guestTotals.wins}승 {guestTotals.losses}패</span>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>성별</TableHead>
                      <TableHead>표시</TableHead>
                      <TableHead>전적</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {guestUsers.map(guest => {
                      const guestTotals = getTotalStats(guest);
                      return (
                      <TableRow key={guest.id}>
                        <TableCell className="font-medium">{guest.name}</TableCell>
                        <TableCell>{guest.gender === 'F' ? '여성' : '남성'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">게스트</Badge>
                        </TableCell>
                        <TableCell>{guestTotals.wins}승 {guestTotals.losses}패</TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              회원 활동 시즌 설정
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Season tabs + add */}
            <div className="flex flex-wrap gap-2 mb-4">
              {allSeasons.map((s: string) => (
                <button
                  key={s}
                  onClick={() => {
                    setSelectedSeason(s);
                    // 시즌 선택 시 total_sessions 초기값 로드
                    setSeasonTotalSessionsDraft((prev: any) => {
                      if (prev[s] !== undefined) return prev;
                      const existing = memberUsers.find((u: any) => (u.activeSeasons ?? []).includes(s));
                      const val = existing?.seasonStats?.find((st: any) => st.seasonCode === s)?.total_sessions ?? 0;
                      return { ...prev, [s]: String(val) };
                    });
                  }}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    selectedSeason === s
                      ? 'bg-[#030213] text-white border-[#030213]'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                  }`}
                >
                  {seasonCodeToLabel(s)}
                </button>
              ))}
              <div className="flex gap-1">
                <select
                  id="newSeasonSelect"
                  name="newSeasonSelect"
                  value={newSeasonSelect}
                  onChange={e => setNewSeasonSelect(e.target.value)}
                  autoComplete="off"
                  className="rounded-md border border-gray-200 px-2 py-1 text-sm"
                >
                  <option value="">시즌 선택</option>
                  {SEASON_OPTIONS.filter((s: string) => !allSeasons.includes(s)).map((s: string) => (
                    <option key={s} value={s}>{seasonCodeToLabel(s)}</option>
                  ))}
                </select>
                <Button size="sm" variant="outline" onClick={handleAddSeason} disabled={!newSeasonSelect}>추가</Button>
              </div>
            </div>

            {/* Members for selected season */}
            {selectedSeason ? (
              <div>
                {/* 시즌 총 회차 입력 */}
                <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                  <label htmlFor="season-total-sessions" className="text-sm font-medium whitespace-nowrap">
                    시즌 총 회차
                  </label>
                  <input
                    id="season-total-sessions"
                    name="seasonTotalSessions"
                    type="number"
                    min="0"
                    autoComplete="off"
                    className="w-24 border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                    value={seasonTotalSessionsDraft[selectedSeason] ?? '0'}
                    onChange={e =>
                      setSeasonTotalSessionsDraft(prev => ({ ...prev, [selectedSeason]: e.target.value }))
                    }
                  />
                  <span className="text-xs text-gray-400">이 시즌에 진행된 전체 경기 횟수 (저장 시 전체 멤버에 반영)</span>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  <span className="font-semibold text-[#030213]">{seasonCodeToLabel(selectedSeason)}</span> 시즌에 활동한 멤버를 선택하세요
                </p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 mb-3">
                  <p className="text-xs text-gray-500 mb-2">신규회원 추가하기</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                      id="newMemberName"
                      name="newMemberName"
                      type="text"
                      value={newMemberName}
                      onChange={e => setNewMemberName(e.target.value)}
                      placeholder="이름"
                      autoComplete="name"
                      className="rounded-md border border-gray-200 px-3 py-2 text-sm"
                    />
                    <input
                      id="newMemberPhoneLast4"
                      name="newMemberPhoneLast4"
                      type="password"
                      value={newMemberPhoneLast4}
                      onChange={e => setNewMemberPhoneLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="전화번호 뒷4자리"
                      autoComplete="tel"
                      className="rounded-md border border-gray-200 px-3 py-2 text-sm"
                    />
                    <Button variant="outline" onClick={() => handleCreateMemberForSeason(selectedSeason)}>
                      신규회원 추가
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">추가된 신규회원은 성별 코드 W로 저장되며, 입력한 전화번호 뒷4자리가 로그인 비밀번호가 됩니다.</p>
                </div>

                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-2">현재 선택된 멤버 ({selectedSeasonMembers.length}명)</p>
                  {selectedSeasonMembers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedSeasonMembers.map(member => (
                        <button
                          key={member.id}
                          onClick={() => handleToggleMemberInSeason(selectedSeason, member.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2 py-1 text-xs text-[#030213]"
                        >
                          {member.name}
                          <span className="text-gray-400">x</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">선택된 멤버가 없습니다.</p>
                  )}
                </div>

                <div className="mb-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAllMembersForSeason(prev => !prev)}
                  >
                    {showAllMembersForSeason ? '전체 회원 목록 닫기' : '전체 회원 목록에서 선택'}
                  </Button>
                </div>

                {showAllMembersForSeason && (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {memberUsers.map((member: any) => {
                      const checked = (seasonMemberDrafts[selectedSeason] ?? []).includes(member.id);
                      return (
                        <label
                          key={member.id}
                          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 cursor-pointer hover:bg-gray-50"
                        >
                          <input
                            id={`season-member-${selectedSeason}-${member.id}`}
                            name={`season-member-${selectedSeason}`}
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleMemberInSeason(selectedSeason, member.id)}
                            className="h-4 w-4 accent-[#030213]"
                          />
                          <span className="text-sm font-medium text-[#030213]">{member.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <Button onClick={() => handleSaveSeason(selectedSeason)}>
                    {seasonCodeToLabel(selectedSeason)} 저장
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">시즌을 선택하거나 새 시즌을 추가하세요</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </PageLayout>
  );
}
