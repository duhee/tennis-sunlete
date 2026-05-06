import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useAppData } from '../context/AppDataContext.js';
import { PageLayout } from '../components/PageLayout.js';
import {
  Calendar,
  User,
  Users,
  Clock3,
  Share2,
  CircleHelp,
} from 'lucide-react';
import { getTotalStats, getWinRate, getMatchPointMetrics } from '../data/mockData.js';
import { getScheduleStatus, getScheduleDrawCutoff, isWithinNext3Weeks, isScheduleAttendanceOpen, type WeeklyMatchSchedule } from '../data/mockData.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.js';
import { Button } from '../components/ui/button.js';
import { Badge } from '../components/ui/badge.js';
import { Toaster } from '../components/ui/sonner.js';
import { toast, useSonner } from 'sonner';
import { useDebugNow } from '../context/useDebugNow.js';

interface ScoreInput {
  scoreA: string;
  scoreB: string;
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

export function UserDashboard() {
    // 시즌 전체 회원 출석 현황 모달 상태
    const [showSeasonAttendanceModal, setShowSeasonAttendanceModal] = useState(false);
  const { debugNow, effectiveNow } = useDebugNow();

  React.useEffect(() => {
    if (typeof window === 'undefined' || document.getElementById('priority-fade-keyframes')) return;

    const style = document.createElement('style');
    style.id = 'priority-fade-keyframes';
    style.innerHTML = `
      @keyframes priorityFadeBg {
        0% { background-color: #FFF8FA; }
        100% { background-color: #FFE4EC; }
      }
    `;
    document.head.appendChild(style);
  }, []);

    // 팝업 중복 방지용 고유 ID
    const TOAST_ID = 'attendance-info-toast';
    const { toasts } = useSonner();

    // 바깥 클릭시 토스트 닫기
    React.useEffect(() => {
      if (!toasts.some(t => t.id === TOAST_ID)) return;
      const handleClick = (e: MouseEvent) => {
        // 토스트 내부 클릭은 무시
        const toastEl = document.querySelector('[data-sonner-toast][data-id="' + TOAST_ID + '"]');
        if (toastEl && toastEl.contains(e.target as Node)) return;
        toast.dismiss(TOAST_ID);
      };
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }, [toasts]);

    // 토스트 안내 메시지
    const handleInfoToast = () => {
      // 이미 열려있으면 새로 띄우지 않음
      if (toasts.some(t => t.id === TOAST_ID)) return;
      toast(
        <div>
          <div className="font-bold mb-1">매주 월요일 11:00 출석 업데이트 안내</div>
          <div className="font-semibold mt-2 mb-1">새 일정 오픈</div>
          <div className="text-xs mb-2" style={{ color: '#D77B9A' }}>새 주차의 출석 카드가 열립니다.<br/>원활한 게스트 모집을 위해 일정 확정을 미리 해주세요.</div>
          <div className="font-semibold mt-2 mb-1">출석 마감 및 대진 대기</div>
          <div className="text-xs" style={{ color: '#D77B9A' }}>다가오는 주차의 출석이 마감되어 참/불 변경이 불가합니다.<br/>마감 후 일정 변경은 마스터(장두희)에게 문의해 주세요.</div>
          <div className="font-semibold mt-2 mb-1">출석 우선순위</div>
          <div className="text-xs" style={{ color: '#D77B9A' }}>
            출석률 50% 이하, 상대적 하위 30%는 '우선순위'로 분류됩니다.<br/>
            출석 동시 신청 시 우선순위 멤버에게 자리가 먼저 배정됩니다.<br/>
          </div>
        </div>,
        {
          id: TOAST_ID,
          duration: 12000,
          position: 'bottom-right',
          style: {
            background: '#FFF4F7', // 옅은 분홍색
            color: '#C2185B',      // 진한 분홍 텍스트
            border: '1px solid #FFD6E3', // 연분홍 테두리
            fontSize: '14px',
            minWidth: '320px',
            maxWidth: '90vw',
          },
          dismissible: true,
        }
      );
    };
  const { currentUser, isAdmin } = useAuth();
  const {
    users,
    schedules,
    doublesMatches,
    getUserById,
    getUserByName,
    updateAttendanceChoice,
    recordMatchScore,
  } = useAppData();

  const user = getUserByName(currentUser || '');
  const userId = user?.id;

  const [scoreInputs, setScoreInputs] = useState<Record<string, ScoreInput>>({});
  const [showShareModal, setShowShareModal] = useState(false);
  const [searchPlayerName, setSearchPlayerName] = useState('');
  const [searchParams] = useSearchParams();
  const activeTab: 'bracket' | 'attendance' =
    searchParams.get('tab') === 'attendance' ? 'attendance' : 'bracket';

  // 이번 시즌 코드 추출 (가장 최근 일정 기준)
  const latestSchedule = useMemo(() => schedules.slice().sort((a, b) => (b.date > a.date ? 1 : -1))[0], [schedules]);
  const currentSeasonCode = latestSchedule ? getScheduleSeasonCode(latestSchedule) : undefined;
  // 이번 시즌 멤버
  const seasonMembers = useMemo(
    () =>
      typeof currentSeasonCode === 'string'
        ? users.filter(
            u =>
              !u.isGuest &&
              !u.isWithdrawn &&
              Array.isArray(u.activeSeasons) &&
              u.activeSeasons.includes(currentSeasonCode)
          )
        : [],
    [users, currentSeasonCode]
  );
  // 이번 시즌 모든 일정
  const seasonSchedules = useMemo(() => schedules.filter(s => getScheduleSeasonCode(s) === currentSeasonCode), [schedules, currentSeasonCode]);
  // 진행된 회차(참석자 1명 이상)만 집계
  const progressedSchedules = useMemo(
    () => seasonSchedules.filter(s => Array.isArray(s.participants) && s.participants.length > 0),
    [seasonSchedules]
  );
  const totalProgressedSessions = progressedSchedules.length;
  // 멤버별 출석률/상태 집계 (회원 출석 관리와 동일)
  const getProgressedAttendanceRate = (userId: string): number => {
    const attended = progressedSchedules.filter(s => Array.isArray(s.participants) && s.participants.includes(userId)).length;
    return Math.round((attended / (totalProgressedSessions || 1)) * 100);
  };
  const progressedRates = seasonMembers.map(m => getProgressedAttendanceRate(m.id)).sort((a, b) => b - a);
  const top30Count = Math.max(1, Math.ceil(seasonMembers.length * 0.3));
  const top30Cutoff = progressedRates[top30Count - 1] ?? 0;
  const isNormalStatus = (userId: string): boolean => {
    const rate = getProgressedAttendanceRate(userId);
    return rate >= 50 || rate >= top30Cutoff;
  };
  // 멤버별 참석/불참/미응답 집계 (진행된 회차 기준)
  const memberAttendanceMap = useMemo(() => {
    const map: Record<string, { attended: number; absent: number; noResponse: number; total: number }> = {};
    seasonMembers.forEach(member => {
      let attended = 0, absent = 0, noResponse = 0, total = 0;
      progressedSchedules.forEach(sch => {
        const req = sch.attendanceRequests?.find((r: any) => r.userId === member.id);
        if (!req) {
          noResponse++;
        } else if (req.status === 'attend') {
          attended++;
        } else if (req.status === 'absent') {
          absent++;
        }
        total++;
      });
      map[member.id] = { attended, absent, noResponse, total };
    });
    return map;
  }, [seasonMembers, progressedSchedules]);

  const confirmedMatches = useMemo(() => {
    const now = effectiveNow;
    const allConfirmed = doublesMatches.filter((m: any) => m.isConfirmed && m.date);

    // 고유 날짜(오름차순)
    const uniqueDates = Array.from(
      new Set(allConfirmed.map((m: any) => {
        const d = new Date(m.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      }))
    ).sort((a, b) => (a as number) - (b as number)) as number[];

    // cutoff 기준으로 표시할 날짜 결정
    let activeDate: number | undefined;
    for (let i = 0; i < uniqueDates.length; i++) {
      const matchDate = new Date(uniqueDates[i]);
      const dateStr = `${matchDate.getFullYear()}-${String(matchDate.getMonth() + 1).padStart(2, '0')}-${String(matchDate.getDate()).padStart(2, '0')}`;
      const drawCutoff = getScheduleDrawCutoff(dateStr);
      drawCutoff.setDate(drawCutoff.getDate() + 7);
      if (now < drawCutoff) {
        activeDate = uniqueDates[i];
        break;
      } else {
        activeDate = uniqueDates[i + 1];
        break;
      }
    }

    if (!activeDate) return [];

    const activeDateStr = (() => {
      const d = new Date(activeDate);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    return allConfirmed.filter((m: any) => {
      const d = new Date(m.date);
      const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return s === activeDateStr;
    });
  }, [doublesMatches, effectiveNow]);
  const confirmedDate = confirmedMatches[0]?.date;
  const upcomingSchedules = useMemo(
    () => {
      const now = effectiveNow;

      return [...schedules]
        .filter(schedule => {
          const scheduleStatus = getScheduleStatus(schedule, now);
          const dateKey = toDateKey(schedule.date);
          const visibleUntil = getScheduleDrawCutoff(dateKey);
          visibleUntil.setDate(visibleUntil.getDate() + 7);

          // open 상태 → 3주 이내 일정만 노출 (그 이전은 접수 대기로 숨김)
          if (scheduleStatus === 'open') {
            return isWithinNext3Weeks(schedule, now);
          }
          // draw_waiting → 경기 후 다음 월요일 11시까지 유지
          return now < visibleUntil;
        })
        .sort((a, b) => toDateKey(a.date).localeCompare(toDateKey(b.date)))
        .slice(0, 3);
    },
      [effectiveNow, schedules]
  );

  const seasonWeekNumberBySeasonDate = useMemo(() => {
    const seasonDateList: Record<string, string[]> = {};
    const weekBySeasonDate: Record<string, number> = {};

    schedules.forEach(schedule => {
      const seasonCode = getScheduleSeasonCode(schedule) ?? 'unknown';
      const dateKey = toDateKey(schedule.date || schedule.attendanceDeadline || '');
      if (!seasonDateList[seasonCode]) seasonDateList[seasonCode] = [];
      if (!seasonDateList[seasonCode].includes(dateKey)) {
        seasonDateList[seasonCode].push(dateKey);
      }
    });

    Object.keys(seasonDateList).forEach(seasonCode => {
      seasonDateList[seasonCode].sort((a, b) => a.localeCompare(b));
    });

    Object.entries(seasonDateList).forEach(([seasonCode, dates]) => {
      dates.forEach((date, idx) => {
        weekBySeasonDate[`${seasonCode}|${date}`] = idx + 1;
      });
    });

    return weekBySeasonDate;
  }, [schedules]);

  const handleAttendanceChoice = (scheduleId: string, choice: 'attend' | 'absent' | 'cancel') => {
    if (!userId) return;
    updateAttendanceChoice(scheduleId, userId, choice, effectiveNow.toISOString());
  };

  const getMyAttendanceStatus = (schedule: WeeklyMatchSchedule) => {
    if (!userId) return 'none';
    
    const myRequest = schedule.attendanceRequests.find(req => req.userId === userId);
    if (!myRequest) return 'none';
    
    if (myRequest.status === 'absent') return 'absent';
    if (schedule.participants.includes(userId)) return 'attending';
    if (schedule.waitlist.includes(userId)) return 'waitlist';
    return 'none';
  };

  const handleScoreInputChange = (matchId: string, side: 'scoreA' | 'scoreB', value: string) => {
    if (!/^\d*$/.test(value)) return;

    setScoreInputs(prev => ({
      ...prev,
      [matchId]: {
        scoreA: prev[matchId]?.scoreA ?? '',
        scoreB: prev[matchId]?.scoreB ?? '',
        [side]: value,
      },
    }));
  };

  const handleSaveScore = (matchId: string) => {
    const current = scoreInputs[matchId];
    if (!current || current.scoreA === '' || current.scoreB === '') {
      return;
    }

    const scoreA = Number(current.scoreA);
    const scoreB = Number(current.scoreB);

    if (Number.isNaN(scoreA) || Number.isNaN(scoreB)) {
      return;
    }

    recordMatchScore(matchId, scoreA, scoreB);
  };

  const handleShareBracket = () => {
    setShowShareModal(true);
    setSearchPlayerName('');
  };

  const handleShareWithPlayer = () => {
    if (!confirmedDate) return;

    // YYYY-MM-DD 형식으로 변환
    const dateObj = new Date(confirmedDate);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const dateKey = `${yyyy}-${mm}-${dd}`;

    let shareUrl = `${window.location.origin}/shared/${dateKey}`;
    if (searchPlayerName.trim()) {
      shareUrl += `?player=${encodeURIComponent(searchPlayerName)}`;
    }

    navigator.clipboard.writeText(shareUrl);
    alert('공유 링크가 복사되었습니다!');
    setShowShareModal(false);
    setSearchPlayerName('');
  };

  const isUserInMatch = (match: (typeof confirmedMatches)[number]) => {
    return !!userId && (match.teamA.includes(userId) || match.teamB.includes(userId));
  };

  const isMe = (id: string) => !!userId && id === userId;

  return (
    <PageLayout>
      <Toaster />
      <div className="min-h-screen bg-white">
        <div className="max-w-md mx-auto p-6">
          <div className="mb-6">
            <div>
              <h1 className="text-2xl font-bold">안녕하세요, {currentUser}님!</h1>
            </div>
            {debugNow && (
              <div className="mt-2 inline-flex rounded-md border border-dashed border-[#FFD6E3] bg-[#FFF8FA] px-2.5 py-1 text-[11px] text-[#C2185B]">
                디버그 시간 적용 중: {effectiveNow.toLocaleString('ko-KR')}
              </div>
            )}
            {activeTab === 'attendance' && (
              <div className="mt-2 text-gray-400 font-normal text-left" style={{ fontSize: '9px' }}>
                <button
                  type="button"
                  onClick={handleInfoToast}
                  className="underline underline-offset-4 hover:text-[#FF6F91] transition-colors cursor-pointer bg-transparent p-0 border-0 text-left w-full"
                  style={{ fontWeight: 400, fontSize: '12px' }}
                  aria-label="출석 안내 자세히 보기"
                >
                  매주 월요일 11:00, 새 일정이 오픈되며 다가오는 경기의 출석이 마감됩니다.
                </button>
              </div>
            )}
          </div>

        {activeTab === 'bracket' && (
        <div className="mb-8">
          {confirmedDate && (
            <div className="mb-6 rounded-xl border bg-white p-4">
              <div className="mb-4">
                <p className="text-base font-bold text-[#030213] mb-1">
                  {confirmedDate
                    ? (() => {
                        const d = new Date(confirmedDate);
                        const days = ['일', '월', '화', '수', '목', '금', '토'];
                        return `${d.getFullYear().toString().slice(-2)}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]}) 10-13시`;
                      })()
                    : ''}
                </p>
                <p className="text-base font-bold text-[#030213]">필킨스 실내 2층</p>
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <p>• 10시 20분까지 모두 몸풀고 게임시작 합니다.</p>
                <p>• 6점 선취, 5:5시 게임종료 해주세요.</p>
                <p>• 마지막 게임 후 먼저 귀가하셔도 됩니다.</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {confirmedMatches.length === 0 && (
              <Card className="mb-6" style={{ backgroundColor: '#F8F9FA' }}>
                <CardContent className="py-8 text-center">
                  <p className="text-sm font-medium text-gray-700">아직 확정된 대진표가 없습니다</p>
                  <p className="text-xs text-gray-500 mt-2">관리 페이지에서 대진표가 확정되면 여기서 바로 확인할 수 있습니다.</p>
                </CardContent>
              </Card>
            )}

            {confirmedMatches.map((match, idx) => {
              const teamAUsers = match.teamA.map((id: string) => getUserById(id)).filter(Boolean);
              const teamBUsers = match.teamB.map((id: string) => getUserById(id)).filter(Boolean);
              const userInMatch = isUserInMatch(match);
              const hasSavedScore = typeof match.scoreA === 'number' && typeof match.scoreB === 'number';

              const isMixed = (team: any[]) =>
                team.some(p => p.gender === 'F' || p.gender === 'W') && team.some(p => p.gender === 'M');
              const isAllFemale = (team: any[]) => team.every(p => p.gender === 'F' || p.gender === 'W');
              const isAllMale = (team: any[]) => team.every(p => p.gender === 'M');
              const getMatchTypeLabel = () => {
                if (isMixed(teamAUsers) && isMixed(teamBUsers)) return '혼복';
                if (isAllFemale(teamAUsers) && isAllFemale(teamBUsers)) return '여복';
                if (isAllMale(teamAUsers) && isAllMale(teamBUsers)) return '남복';
                return '혼복';
              };
              const matchTypeLabel = getMatchTypeLabel();

              return (
                <Card
                  key={match.id}
                  className="border mb-6"
                  style={userInMatch ? { borderColor: '#FFC1CC', backgroundColor: '#FFF8FA' } : { borderColor: '#E5E7EB' }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-medium">{idx + 1}경기</Badge>
                        <Badge variant="outline" className="text-xs py-0">
                          {matchTypeLabel}
                        </Badge>
                        {userInMatch && (
                          <Badge style={{ backgroundColor: '#FFC1CC', color: '#030213' }}>
                            내 경기
                          </Badge>
                        )}
                      </div>
                      {hasSavedScore && (
                        <Badge style={{ backgroundColor: '#030213', color: '#FFFFFF' }}>
                          {match.result === 'draw' ? '무승부 기록' : '승패 기록완료'}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="rounded-xl border bg-white px-4 py-4">
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold tracking-widest text-gray-400 mb-2">TEAM A</p>
                            <div className="space-y-1">
                              {teamAUsers.map((player: any) => (
                                <p key={player!.id} className="text-sm font-semibold leading-relaxed text-gray-900 break-words">
                                  {player!.name}
                                </p>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-rows-[38px_1fr] px-2 min-w-[56px]">
                            <span aria-hidden="true" />
                            <div className="flex flex-col items-center justify-center min-h-full">
                              {hasSavedScore ? (
                                <>
                                  <div className="flex items-center gap-1 text-xl font-bold text-[#030213]">
                                    <span>{match.scoreA}</span>
                                    <span className="text-gray-300">:</span>
                                    <span>{match.scoreB}</span>
                                  </div>
                                  <span className="text-[11px] text-gray-400 mt-1">FINAL</span>
                                </>
                              ) : (
                                <span className="text-sm font-bold text-gray-400">VS</span>
                              )}
                            </div>
                          </div>

                          <div className="min-w-0 text-right">
                            <p className="text-[11px] font-semibold tracking-widest text-gray-400 mb-2">TEAM B</p>
                            <div className="space-y-1">
                              {teamBUsers.map((player: any) => (
                                <p key={player!.id} className="text-sm font-semibold leading-relaxed text-gray-900 break-words">
                                  {player!.name}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {userInMatch && (
                        <div className="pt-3 border-t">
                          <div className="rounded-xl border bg-white px-3 py-4">
                            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
                              <div>
                                <p className="text-[11px] font-semibold tracking-widest text-gray-400 mb-2">TEAM A</p>
                                <input
                                  id={`scoreA-${match.id}`}
                                  name={`scoreA-${match.id}`}
                                  value={scoreInputs[match.id]?.scoreA ?? (hasSavedScore ? String(match.scoreA) : '')}
                                  onChange={e => handleScoreInputChange(match.id, 'scoreA', e.target.value)}
                                  className="w-full px-2 py-3 border rounded-md text-center text-base bg-white"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  placeholder="0"
                                />
                              </div>

                              <div className="grid grid-rows-[38px_1fr] px-1 min-w-[52px]">
                                <span aria-hidden="true" />
                                <div className="flex items-center justify-center h-full">
                                  <span className="text-sm font-bold text-gray-400">VS</span>
                                </div>
                              </div>

                              <div>
                                <p className="text-[11px] font-semibold tracking-widest text-gray-400 mb-2 text-right">TEAM B</p>
                                <input
                                  id={`scoreB-${match.id}`}
                                  name={`scoreB-${match.id}`}
                                  value={scoreInputs[match.id]?.scoreB ?? (hasSavedScore ? String(match.scoreB) : '')}
                                  onChange={e => handleScoreInputChange(match.id, 'scoreB', e.target.value)}
                                  className="w-full px-2 py-3 border rounded-md text-center text-base bg-white"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  placeholder="0"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleSaveScore(match.id)}
                              style={{ backgroundColor: '#FFC1CC', color: '#030213' }}
                            >
                              저장
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
        )}

        {activeTab === 'attendance' && (
        <div className="mb-6">

          <div className="space-y-3">
            {upcomingSchedules.map((schedule, idx) => {
              const myStatus = getMyAttendanceStatus(schedule);
              const applicants = schedule.participants.map((id: string) => getUserById(id)).filter(Boolean);
              const memberApplicants = applicants.filter((player: any) => !player!.isGuest);
              const guestApplicants = applicants.filter((player: any) => player!.isGuest);
              const waiters = schedule.waitlist.map((id: string) => getUserById(id)).filter(Boolean);
              const absentUsers = schedule.attendanceRequests
                .filter((request: any) => request.status === 'absent')
                .map((request: any) => getUserById(request.userId))
                .filter(Boolean);
              const scheduleSeasonCode = getScheduleSeasonCode(schedule);
              const seasonMembers = users.filter(member => {
                if (member.isGuest || member.isWithdrawn || member.id.startsWith('guest-')) return false;
                if (!scheduleSeasonCode) return true;
                return (member.activeSeasons ?? []).includes(scheduleSeasonCode);
              });
              const noResponseUsers = seasonMembers.filter(
                (member: any) => !schedule.attendanceRequests.some((request: any) => request.userId === member.id)
              );
              const scheduleStatus = getScheduleStatus(schedule, effectiveNow);
              const isAttendanceOpen = isScheduleAttendanceOpen(schedule, effectiveNow);
              const isAttendancePending = scheduleStatus === 'open' && !isAttendanceOpen;
              const isDrawWaiting = scheduleStatus === 'draw_waiting';
              const isAttendSelected = myStatus === 'attending' || myStatus === 'waitlist';
              // 시즌 멤버 여부
              const isSeasonMember = !!userId && seasonMembers.some(m => m.id === userId);

              // 진행된 회차 기준 우선순위 판정
              const progressedSch = schedules.filter(s => {
                const sc = getScheduleSeasonCode(s);
                if (scheduleSeasonCode && sc !== scheduleSeasonCode) return false;
                return Array.isArray(s.participants) && s.participants.length > 0;
              });
              const totalProg = progressedSch.length;
              const getProgRate = (uid: string) => {
                const attended = progressedSch.filter(s => Array.isArray(s.participants) && s.participants.includes(uid)).length;
                return Math.round((attended / (totalProg || 1)) * 100);
              };
              const progRates = seasonMembers.map((m: any) => getProgRate(m.id)).sort((a: number, b: number) => b - a);
              const top30Cutoff = progRates[Math.max(1, Math.ceil(seasonMembers.length * 0.3)) - 1] ?? 0;
              const isPriorityMember = (uid: string) => {
                const rate = getProgRate(uid);
                return !(rate >= 50 || rate >= top30Cutoff);
              };
              const getAttendanceNameStyle = (id: string, options?: { isGuest?: boolean }) => {
                if (isPriorityMember(id)) {
                  return {
                    backgroundColor: '#FFF8FA',
                    color: '#030213',
                    outline: '0.5px solid #E5E7EB',
                    animation: 'priorityFadeBg 1.4s ease-in-out infinite alternate',
                  };
                }

                if (isMe(id)) {
                  return {
                    backgroundColor: '#030213',
                    color: '#FFC1CC',
                    outline: '0.5px solid #E5E7EB',
                  };
                }

                return {
                  backgroundColor: '#FFFFFF',
                  outline: '0.5px solid #E5E7EB',
                };
              };

              return (
                <Card
                  key={schedule.id}
                  className={(myStatus === 'none' && isSeasonMember && isAttendanceOpen ? 'border-[#FFC1CC] animate-[pulse_3s_ease-in-out_infinite] ' : '') + 'mb-6'}
                  style={
                    myStatus === 'none' && isSeasonMember && isAttendanceOpen
                      ? {
                          backgroundColor: '#F8F9FA',
                          boxShadow: '0 0 0 1px rgba(255,193,204,0.55), 0 0 18px rgba(255,193,204,0.25)',
                        }
                      : { backgroundColor: '#F8F9FA' }
                  }
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {(() => {
                            const d = new Date(schedule.date);
                            const days = ['일', '월', '화', '수', '목', '금', '토'];
                            return `${d.getFullYear().toString().slice(-2)}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]}) 10-13시`;
                          })()}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2">
                      {isDrawWaiting && (
                        <div className="flex items-center gap-1">
                          <Badge style={{ backgroundColor: '#E3F2FD', color: '#1565C0' }}>대진표 생성 대기중</Badge>
                          <button
                            type="button"
                            onClick={() => toast('대진표 생성을 기다리는 중입니다. 일정 변경이 필요하신 경우, 마스터에게 연락해 주세요.', {
                              duration: 4000,
                              style: {
                                background: '#E3F2FD',
                                color: '#1565C0',
                                border: '1px solid #BFDBFE',
                              },
                            })}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#1565C0] transition-colors hover:bg-[#E3F2FD]"
                            aria-label="대진표 생성 대기중 안내"
                          >
                            <CircleHelp className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {scheduleStatus === 'closed' && (
                        <Badge variant="outline">마감</Badge>
                      )}
                      {isAttendancePending && (
                        <Badge variant="outline">접수 대기</Badge>
                      )}
                    </div>

                    {!isDrawWaiting && isAttendanceOpen && (
                      <div className="mt-3 flex gap-2">
                        {isSeasonMember ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              style={{ 
                                backgroundColor: isAttendSelected ? '#030213' : '#FFFFFF',
                                color: isAttendSelected ? '#FFFFFF' : '#374151',
                                borderColor: isAttendSelected ? '#030213' : '#D1D5DB',
                              }}
                              onClick={() => handleAttendanceChoice(schedule.id, isAttendSelected ? 'cancel' : 'attend')}
                              disabled={!isAttendanceOpen && !isAttendSelected}
                            >
                              참석
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              style={{
                                backgroundColor: myStatus === 'absent' ? '#030213' : '#FFFFFF',
                                color: myStatus === 'absent' ? '#FFFFFF' : '#374151',
                                borderColor: myStatus === 'absent' ? '#030213' : '#D1D5DB',
                              }}
                              onClick={() => handleAttendanceChoice(schedule.id, myStatus === 'absent' ? 'cancel' : 'absent')}
                              disabled={!isAttendanceOpen && myStatus !== 'absent'}
                            >
                              불참
                            </Button>
                          </>
                        ) : (
                          <div className="flex-1 text-center text-xs text-gray-400 py-2 border border-dashed border-gray-300 rounded-md bg-gray-50">
                            시즌 멤버가 아닙니다. 호스트에게 문의하세요
                          </div>
                        )}
                      </div>
                    )}

                    {isAttendancePending && (
                      <div className="mt-3 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                        아직 출석 오픈 전인 일정입니다.
                      </div>
                    )}

                    <div className="mt-4 border-t border-gray-200" />

                    <div className="mt-4">
                      <p className="text-xs text-gray-500 mb-2">현재 참석자</p>
                      <div className="flex flex-wrap gap-2">
                        {memberApplicants.length > 0 ? (
                          memberApplicants.map((player: any) => (
                            <span
                              key={player!.id}
                              className="px-2 py-1 bg-white rounded-md text-xs font-medium text-[#030213]"
                              style={getAttendanceNameStyle(player!.id)}
                            >
                              {player!.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">회원 참석자 없음</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">게스트</p>
                      <div className="flex flex-wrap gap-2">
                        {guestApplicants.length > 0 ? (
                          guestApplicants.map((player: any) => (
                            <span
                              key={player!.id}
                              className="px-2 py-1 bg-white rounded-md text-xs font-medium text-[#030213]"
                              style={getAttendanceNameStyle(player!.id, { isGuest: true })}
                            >
                              {player!.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">게스트 없음</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 border-t border-gray-200" />

                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">참석 대기</p>
                      <div className="flex flex-wrap gap-2">
                        {waiters.length > 0 ? (
                          waiters.map((player: any) => (
                            <span
                              key={player!.id}
                              className="px-2 py-1 bg-white rounded-md text-xs text-gray-600"
                              style={getAttendanceNameStyle(player!.id)}
                            >
                              {player!.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">대기 없음</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">불참</p>
                      <div className="flex flex-wrap gap-2">
                        {absentUsers.length > 0 ? (
                          absentUsers.map((player: any) => (
                            <span
                              key={player!.id}
                              className="px-2 py-1 bg-white rounded-md text-xs text-gray-600"
                              style={getAttendanceNameStyle(player!.id)}
                            >
                              {player!.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">불참 없음</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">미응답</p>
                      <div className="flex flex-wrap gap-2">
                        {noResponseUsers.filter(member => !member.isGuest).length > 0 ? (
                          noResponseUsers
                            .filter(member => !member.isGuest)
                            .map(member => (
                              <span
                                key={member.id}
                                className="px-2 py-1 bg-white rounded-md text-xs text-gray-600"
                                style={getAttendanceNameStyle(member.id)}
                              >
                                {member.name}
                              </span>
                            ))
                        ) : (
                          <span className="text-xs text-gray-400">미응답 없음</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
        )}

        {confirmedMatches.length > 0 && activeTab === 'bracket' && (
          <div className="mb-8 flex gap-2">
            <Button
              onClick={handleShareBracket}
              style={{ backgroundColor: '#FFC1CC', color: '#030213' }}
              className="flex-1"
            >
              <Share2 className="w-4 h-4 mr-2" />
              공유하기
            </Button>
          </div>
        )}

        {/* 시즌 전체 회원 출석 현황 버튼 & 모달 */}
        {activeTab === 'attendance' && (
          <div className="flex flex-col items-center mt-8 mb-4">
            <Button
              type="button"
              style={{ backgroundColor: '#F8F9FA', color: '#9CA3AF', border: '1px solid #E5E7EB', fontWeight: 500 }}
              onClick={() => setShowSeasonAttendanceModal(true)}
            >
              이번 시즌 전체 회원 출석 현황 보기
            </Button>
          </div>
        )}

        {showSeasonAttendanceModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center overflow-auto">
              <div className="bg-white rounded-none md:rounded-xl shadow-lg p-0 md:p-6 w-full h-full md:max-w-3xl md:h-auto relative flex flex-col">
                <button
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl z-10"
                  onClick={() => setShowSeasonAttendanceModal(false)}
                  aria-label="닫기"
                >
                  ×
                </button>
                <div className="p-4 md:p-6 flex-1 flex flex-col">
                  <h2 className="text-lg font-bold mb-2 text-[#C2185B]">이번 시즌 전체 회원 출석 현황</h2>
                  <div className="mb-2 text-xs text-gray-500">진행된 회차: <span className="font-bold text-[#C2185B]">{totalProgressedSessions}</span></div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs border">
                      <thead>
                        <tr className="bg-[#FFF4F7] text-[#C2185B]">
                          <th className="px-2 py-1 border">순위</th>
                          <th className="px-2 py-1 border">이름</th>
                          <th className="px-2 py-1 border">출석</th>
                          <th className="px-2 py-1 border">출석률</th>
                          <th className="px-2 py-1 border">승률 (WR)</th>
                          <th className="px-2 py-1 border">상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seasonMembers
                          .map(member => ({
                            member,
                            rate: getProgressedAttendanceRate(member.id),
                            isNormal: isNormalStatus(member.id),
                            att: memberAttendanceMap[member.id] || { attended: 0, absent: 0, noResponse: 0, total: 0 },
                            winRate: getWinRate(member, currentSeasonCode),
                          }))
                          .sort((a, b) => {
                            if (b.rate !== a.rate) return b.rate - a.rate;
                            if (b.winRate !== a.winRate) return b.winRate - a.winRate;
                            return a.member.name.localeCompare(b.member.name, 'ko');
                          })
                          .map((row, idx) => {
                            const { member, rate, isNormal, att, winRate } = row;
                            return (
                              <tr key={member.id} className="text-center border-b hover:bg-[#FFF8FA]">
                                <td className="px-2 py-1 border">{idx + 1}</td>
                                <td className="px-2 py-1 border font-semibold text-[#030213]">{member.name}</td>
                                <td className="px-2 py-1 border text-green-700">{att.attended}</td>
                                <td className="px-2 py-1 border">{rate}%</td>
                                <td className="px-2 py-1 border">{winRate}%</td>
                                <td className="px-2 py-1 border">
                                  {isNormal ? (
                                    <Badge style={{ backgroundColor: '#FFC1CC', color: '#030213' }}>정상</Badge>
                                  ) : (
                                    <Badge style={{ backgroundColor: '#FF4D4D', color: 'white' }}>우선순위</Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 text-xs text-gray-500">
                    ※ 출석률 = (진행된 회차 중 참석) / (진행된 회차) × 100<br />
                    ※ 우선순위: 출석률 50% 미만 & 하위 30%<br />
                    ※ 정상: 출석률 50% 이상 또는 상위 30%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showShareModal && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm mx-auto shadow-lg">
              <h3 className="text-lg font-bold mb-4">대진표 공유</h3>
              <input
                id="sharePlayerName"
                name="sharePlayerName"
                type="text"
                value={searchPlayerName}
                onChange={(e) => setSearchPlayerName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleShareWithPlayer();
                  }
                }}
                placeholder="선수 이름 입력 (선택사항)"
                autoComplete="name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowShareModal(false);
                    setSearchPlayerName('');
                  }}
                  className="flex-1"
                  style={{ backgroundColor: '#F3F4F6', color: '#374151' }}
                >
                  취소
                </Button>
                <Button
                  onClick={handleShareWithPlayer}
                  style={{ backgroundColor: '#FFC1CC', color: '#030213' }}
                  className="flex-1"
                >
                  공유 링크 복사
                </Button>
              </div>
            </div>
          </div>
        )}

        </div>
      </div>
    </PageLayout>
  );
}
