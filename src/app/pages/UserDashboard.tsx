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
import { getScheduleStatus, type WeeklyMatchSchedule } from '../data/mockData.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.js';
import { Button } from '../components/ui/button.js';
import { Badge } from '../components/ui/badge.js';
import { Toaster } from '../components/ui/sonner.js';
import { toast } from 'sonner';

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

function getTodayDateKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

  const confirmedMatches = doublesMatches.filter(match => match.isConfirmed);
  const confirmedDate = confirmedMatches[0]?.date;
  const todayDateKey = useMemo(() => getTodayDateKey(), []);

  const upcomingSchedules = useMemo(
    () =>
      [...schedules]
        .filter(schedule => {
          const scheduleStatus = getScheduleStatus(schedule);
          const dateKey = toDateKey(schedule.date);
          return dateKey >= todayDateKey && (scheduleStatus === 'open' || scheduleStatus === 'draw_waiting');
        })
        .sort((a, b) => toDateKey(a.date).localeCompare(toDateKey(b.date)))
        .slice(0, 3),
    [schedules, todayDateKey]
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
    updateAttendanceChoice(scheduleId, userId, choice);
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

    let shareUrl = `${window.location.origin}/bracket/share?date=${dateKey}`;
    if (searchPlayerName.trim()) {
      shareUrl += `&player=${encodeURIComponent(searchPlayerName)}`;
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
      <div className="min-h-screen bg-white">
        <div className="max-w-md mx-auto p-6">
          <div className="mb-6">
            <div>
              <h1 className="text-2xl font-bold">안녕하세요, {currentUser}님!</h1>
            </div>
          </div>

        {activeTab === 'bracket' && (
        <div className="mb-8">
          {confirmedDate && (
            <div className="mb-6 rounded-xl border bg-white p-4">
              <div className="mb-4">
                <p className="text-base font-bold text-[#030213] mb-1">26년 4월 12일(일) 10-13시</p>
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
              <Card style={{ backgroundColor: '#F8F9FA' }}>
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

              return (
                <Card
                  key={match.id}
                  className="border"
                  style={userInMatch ? { borderColor: '#FFC1CC', backgroundColor: '#FFF8FA' } : { borderColor: '#E5E7EB' }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-medium">{idx + 1}경기</Badge>
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
              const scheduleStatus = getScheduleStatus(schedule);
              const isOpen = scheduleStatus === 'open';
              const isDrawWaiting = scheduleStatus === 'draw_waiting';
              const isAttendSelected = myStatus === 'attending' || myStatus === 'waitlist';
              // 시즌 멤버 여부
              const isSeasonMember = !!userId && seasonMembers.some(m => m.id === userId);

              return (
                <Card
                  key={schedule.id}
                  className={myStatus === 'none' && isSeasonMember && !isDrawWaiting ? 'border-[#FFC1CC] animate-[pulse_3s_ease-in-out_infinite]' : ''}
                  style={
                    myStatus === 'none' && isSeasonMember && !isDrawWaiting
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
                          {new Date(schedule.date).toLocaleDateString('ko-KR', {
                            month: 'long', day: 'numeric', weekday: 'short',
                          })}
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
                    </div>

                    {!isDrawWaiting && (
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
                              disabled={!isOpen && !isAttendSelected}
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
                              disabled={!isOpen && myStatus !== 'absent'}
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

                    <div className="mt-4 border-t border-gray-200" />

                    <div className="mt-4">
                      <p className="text-xs text-gray-500 mb-2">현재 참석자</p>
                      <div className="flex flex-wrap gap-2">
                        {memberApplicants.length > 0 ? (
                          memberApplicants.map((player: any) => (
                            <span
                              key={player!.id}
                              className="px-2 py-1 bg-[#FFC1CC] rounded-md text-xs font-medium text-[#030213]"
                              style={isMe(player!.id) ? { backgroundColor: '#030213', color: '#FFC1CC' } : undefined}
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
                              className="px-2 py-1 bg-[#FFC1CC] rounded-md text-xs font-medium text-[#030213]"
                              style={isMe(player!.id) ? { backgroundColor: '#030213', color: '#FFC1CC' } : undefined}
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
                              className="px-2 py-1 bg-white border border-gray-200 rounded-md text-xs text-gray-600"
                              style={isMe(player!.id) ? { backgroundColor: '#030213', color: '#FFC1CC', borderColor: '#030213' } : undefined}
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
                              className="px-2 py-1 bg-white border border-gray-200 rounded-md text-xs text-gray-600"
                              style={isMe(player!.id) ? { backgroundColor: '#030213', color: '#FFC1CC', borderColor: '#030213' } : undefined}
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
                                className="px-2 py-1 bg-white border border-gray-200 rounded-md text-xs text-gray-600"
                                style={isMe(member.id) ? { backgroundColor: '#030213', color: '#FFC1CC', borderColor: '#030213' } : undefined}
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
      <Toaster />
    </PageLayout>
  );
}
