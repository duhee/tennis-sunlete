import {
  deriveParticipantState,
  getScheduleStatus,
  type AppData,
  type WeeklyMatchSchedule,
} from '../data/mockData.js'; // (경로는 기존 설정에 맞게 유지하세요)
import { supabase } from './supabaseClient.js';

type UserRow = {
  id: string;
  name: string;
  gender: 'M' | 'F' | 'W';
  phone_last_4: string | null;
  is_guest: boolean;
  is_withdrawn: boolean;
  active_seasons: string[] | null;
  season_stats: any[] | null;
};

type ScheduleRow = {
  id: string;
  date: string;
  season_code: string | null;
  attendance_deadline: string | null;
  max_participants: number | null;
  status: 'open' | 'draw_waiting' | 'closed' | null;
  participants?: string[] | null;
  waitlist?: string[] | null;
};

type AttendanceRequestRow = {
  id: string;
  schedule_id: string;
  user_id: string;
  requested_at: string;
  status: 'attend' | 'absent';
  date: string;
};

// schedule_id(26S1-w1) → date(2026-02-01) 변환
function scheduleIdToDate(scheduleId: string): string {
  // ex: 26S1-w1
  const m = scheduleId.match(/^(\d{2})S([1-4])-w(\d{1,2})$/);
  if (!m) return '';
  const yy = parseInt(m[1], 10);
  const s = parseInt(m[2], 10);
  const week = parseInt(m[3], 10);
  const year = 2000 + yy;
  // 시즌별 시작 월
  const startMonth = { 1: 2, 2: 5, 3: 8, 4: 11 }[s];
  if (!startMonth) return '';
  // 시즌별 시작일: 첫 번째 일요일 찾기
  let d = new Date(year, startMonth - 1, 1);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1); // 첫 일요일
  d.setDate(d.getDate() + 7 * (week - 1));
  // yyyy-mm-dd
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

type DoublesMatchRow = {
  id: string;
  schedule_id: string;
  date: string;
  team_a: string[] | null;
  team_b: string[] | null;
  score_a: number | null;
  score_b: number | null;
  result: 'teamA' | 'teamB' | 'draw' | null;
  is_confirmed: boolean;
};

function escapeInValue(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
}

function buildInFilter(ids: string[]): string {
  return `(${ids.map(escapeInValue).join(',')})`;
}

function toKstOffsetString(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return input;
  }

  const kstMs = parsed.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const min = String(kst.getUTCMinutes()).padStart(2, '0');
  const ss = String(kst.getUTCSeconds()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+09:00`;
}

async function pruneTable(tableName: 'users' | 'schedules' | 'attendance_requests' | 'doubles_matches', ids: string[]) {
  const query = supabase.from(tableName).delete();

  if (ids.length === 0) {
    const { error } = await query.not('id', 'is', null);
    if (error) throw error;
    return;
  }

  const { error } = await query.not('id', 'in', buildInFilter(ids));
  if (error) throw error;
}

export async function fetchAppData(): Promise<AppData> {
  try {
    // 🚀 복잡한 엣지 함수(invoke) 대신, 4개의 테이블을 직통으로 한 번에 가져옵니다! (CORS 에러 없음)
    const [usersRes, schedulesRes, requestsRes, matchesRes] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('schedules').select('*'),
      supabase.from('attendance_requests').select('*'),
      supabase.from('doubles_matches').select('*')
    ]);

    // users 매핑 (필드명 변환)
    const users = ((usersRes.data || []) as UserRow[]).map(user => ({
      id: user.id,
      name: user.name,
      gender: user.gender,
      phoneLast4: user.phone_last_4 ?? undefined,
      isGuest: user.is_guest,
      isWithdrawn: user.is_withdrawn,
      activeSeasons: Array.isArray(user.active_seasons) ? user.active_seasons : [],
      seasonStats: Array.isArray(user.season_stats)
        ? user.season_stats.map(stat => ({
            ...stat,
            draws: stat.draws ?? 0,
          }))
        : [],
    }));

    // schedules 매핑 (attendanceRequests 포함)
    const scheduleRows = (schedulesRes.data || []) as ScheduleRow[];
    const requestRows = (requestsRes.data || []) as AttendanceRequestRow[];

    const schedules = scheduleRows.map(schedule => {
      const scheduleRequests = requestRows
        .filter(req => req.schedule_id === schedule.id)
        .map(req => ({
          userId: req.user_id,
          requestedAt: req.requested_at,
          status: req.status,
        }));

      const attendanceDeadline = schedule.attendance_deadline ?? `${schedule.date}T11:00:00+09:00`;
      const maxParticipants = typeof schedule.max_participants === 'number' ? schedule.max_participants : 6;

      const baseSchedule: WeeklyMatchSchedule = {
        id: schedule.id,
        date: schedule.date,
        seasonCode: schedule.season_code ?? undefined,
        attendanceDeadline,
        maxParticipants,
        status: 'open',
        attendanceRequests: scheduleRequests,
        participants: [],
        waitlist: [],
      };

      const derived = deriveParticipantState(baseSchedule, users);
      const participants = Array.isArray(schedule.participants)
        ? schedule.participants
        : derived.participants;
      const waitlist = Array.isArray(schedule.waitlist)
        ? schedule.waitlist
        : derived.waitlist;

      const normalized: WeeklyMatchSchedule = {
        ...baseSchedule,
        participants,
        waitlist,
      };

      return {
        ...normalized,
        status: getScheduleStatus(normalized),
      };
    });

    // matches 매핑 (필드명 변환)
    const doublesMatches = ((matchesRes.data || []) as DoublesMatchRow[]).map(match => ({
      id: match.id,
      scheduleId: match.schedule_id,
      date: match.date,
      teamA: Array.isArray(match.team_a) ? match.team_a : [],
      teamB: Array.isArray(match.team_b) ? match.team_b : [],
      scoreA: match.score_a,
      scoreB: match.score_b,
      result: match.result ?? null,
      isConfirmed: match.is_confirmed,
    }));

    // console.log('✅ Supabase 데이터 로드 성공!', { users, schedules, doublesMatches });
    return { users, schedules, doublesMatches };
    
  } catch (error) {
    console.error('데이터 로드 중 오류:', error);
    return { users: [], schedules: [], doublesMatches: [] };
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  const userRows: UserRow[] = data.users.map(user => ({
    id: user.id,
    name: user.name,
    gender: user.gender,
    phone_last_4: user.phoneLast4 ?? null,
    is_guest: Boolean(user.isGuest),
    is_withdrawn: Boolean(user.isWithdrawn),
    active_seasons: user.activeSeasons ?? [],
    season_stats: user.seasonStats ?? [],
  }));

  const scheduleRows: ScheduleRow[] = data.schedules.map(schedule => ({
    id: schedule.id,
    date: schedule.date,
    season_code: schedule.seasonCode ?? null,
    attendance_deadline: toKstOffsetString(schedule.attendanceDeadline),
    max_participants: schedule.maxParticipants,
    status: schedule.status,
  }));

  const attendanceRequestRows: AttendanceRequestRow[] = data.schedules.flatMap(schedule =>
    schedule.attendanceRequests.map(request => ({
      id: `${schedule.id}:${request.userId}`,
      schedule_id: schedule.id,
      user_id: request.userId,
      requested_at: request.requestedAt,
      status: request.status,
      date: scheduleIdToDate(schedule.id),
    }))
  );

  const doublesMatchRows: DoublesMatchRow[] = data.doublesMatches.map(match => ({
    id: match.id,
    schedule_id: match.scheduleId,
    date: match.date,
    team_a: match.teamA,
    team_b: match.teamB,
    score_a: match.scoreA ?? null,
    score_b: match.scoreB ?? null,
    result: match.result ?? null,
    is_confirmed: match.isConfirmed,
  }));

  if (import.meta.env.DEV) {
    // console.log('[saveAppData] doubles_matches upsert payload', doublesMatchRows);
  }

  const { error: usersError } = await supabase.from('users').upsert(userRows);
  if (usersError) throw usersError;

  const { error: schedulesError } = await supabase.from('schedules').upsert(scheduleRows);
  if (schedulesError) throw schedulesError;

  const { error: requestsError } = await supabase.from('attendance_requests').upsert(attendanceRequestRows);
  if (requestsError) throw requestsError;

  const { error: matchesError } = await supabase.from('doubles_matches').upsert(doublesMatchRows);
  if (matchesError) throw matchesError;

  await pruneTable('attendance_requests', attendanceRequestRows.map(row => row.id));
  await pruneTable('doubles_matches', doublesMatchRows.map(row => row.id));
  await pruneTable('schedules', scheduleRows.map(row => row.id));
  await pruneTable('users', userRows.map(row => row.id));
}

export function isAppsScriptMode() {
  return false;
}

export async function reportLoginAttempt(details: {
  inputName: string;
  inputPhoneLast4: string;
  reason: string;
  foundInDb: boolean;
  isGuest?: boolean;
  isWithdrawn?: boolean;
  userAgent?: string;
  timestamp?: string;
}): Promise<void> {
  try {
    const payload = {
      input_name: details.inputName,
      input_phone_last_4: details.inputPhoneLast4,
      reason: details.reason,
      found_in_db: details.foundInDb,
      is_guest: details.isGuest ?? false,
      is_withdrawn: details.isWithdrawn ?? false,
      user_agent: details.userAgent ?? navigator.userAgent,
      attempted_at: details.timestamp ?? new Date().toISOString(),
    };

    const { error } = await supabase.from('login_attempts').insert([payload]);
    
    if (error) {
      // console.warn('[reportFailedLogin] 로그인 시도 기록 실패 (테이블 없을 수 있음):', error.message);
      return;
    }

    // console.log('[reportFailedLogin] 로그인 시도 기록 완료');
  } catch (err) {
    // console.error('[reportFailedLogin] 예외 발생:', err);
  }
}

export async function reportFailedLogin(details: {
  inputName: string;
  inputPhoneLast4: string;
  reason: string;
  foundInDb: boolean;
  isGuest?: boolean;
  isWithdrawn?: boolean;
  userAgent?: string;
  timestamp?: string;
}): Promise<void> {
  await reportLoginAttempt(details);
}

export async function reportSharedBracketView(details: {
  bracketId?: string;
  shareDate?: string;
  highlightPlayer?: string;
  referrer?: string;
  userAgent?: string;
  viewedAt?: string;
}): Promise<void> {
  try {
    const payload = {
      bracket_id: details.bracketId ?? null,
      share_date: details.shareDate ?? null,
      highlight_player: details.highlightPlayer ?? null,
      referrer: details.referrer ?? (typeof document !== 'undefined' ? document.referrer : null),
      user_agent: details.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : null),
      viewed_at: details.viewedAt ?? new Date().toISOString(),
    };

    const { error } = await supabase.from('shared_bracket_views').insert([payload]);
    if (error) {
      return;
    }
  } catch (_err) {
    return;
  }
}