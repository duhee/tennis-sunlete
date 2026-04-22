import type { AppData } from '../data/mockData.js'; // (경로는 기존 설정에 맞게 유지하세요)
import { supabase } from './supabaseClient.js';

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
  console.warn("전체 덮어쓰기 기능은 4개 테이블 정규화 구조에서 권장되지 않습니다.");
}

export function isAppsScriptMode() {
  return false;
}