import type { AppData } from '../data/mockData.js'; // (경로는 기존 설정에 맞게 유지하세요)
import { supabase } from './supabaseClient.js';

type UserRow = {
  id: string;
  name: string;
  gender: 'M' | 'F' | 'W';
  phone_last_4: string | null;
  is_guest: boolean;
  is_withdrawn: boolean;
  active_seasons: string[];
  season_stats: unknown[];
};

type ScheduleRow = {
  id: string;
  date: string;
  season_code: string | null;
  attendance_deadline: string;
  max_participants: number;
  status: 'open' | 'draw_waiting' | 'closed';
};

type AttendanceRequestRow = {
  id: string;
  schedule_id: string;
  user_id: string;
  requested_at: string;
  status: 'attend' | 'absent';
};

type DoublesMatchRow = {
  id: string;
  schedule_id: string;
  date: string;
  team_a: string[];
  team_b: string[];
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
    const users = (usersRes.data || []).map(user => ({
      id: user.id,
      name: user.name,
      gender: user.gender,
      phoneLast4: user.phone_last_4,
      isGuest: user.is_guest,
      isWithdrawn: user.is_withdrawn,
      activeSeasons: user.active_seasons,
      seasonStats: user.season_stats,
    }));

    // schedules 매핑 (attendanceRequests 포함)
    const schedules = (schedulesRes.data || []).map(schedule => {
      const scheduleRequests = (requestsRes.data || [])
        .filter(req => req.schedule_id === schedule.id)
        .map(req => ({
          userId: req.user_id,
          requestedAt: req.requested_at,
          status: req.status,
        }));

      return {
        ...schedule,
        maxParticipants: schedule.max_participants,
        attendanceDeadline: schedule.attendance_deadline,
        attendanceRequests: scheduleRequests,
      };
    });

    // matches 매핑 (필드명 변환)
    const doublesMatches = (matchesRes.data || []).map(match => ({
      ...match,
      scheduleId: match.schedule_id,
      teamA: match.team_a,
      teamB: match.team_b,
      scoreA: match.score_a,
      scoreB: match.score_b,
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
    attendance_deadline: schedule.attendanceDeadline,
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