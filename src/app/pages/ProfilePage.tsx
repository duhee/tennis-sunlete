import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { PageLayout } from '../components/PageLayout.js';
import { 
  getAttendanceRate, 
  getWinRate,
  getTotalStats,
  seasonCodeToLabel,
} from '../data/mockData.js';
import { useAppData } from '../context/AppDataContext.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.js';
import { Progress } from '../components/ui/progress.js';
import { Button } from '../components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.js';

type SeasonInfo = {
  key: string;
  label: string;
  sortDate: string;
};

function toSeasonInfo(dateString: string): SeasonInfo {
  const source = new Date(`${dateString}T00:00:00+09:00`);
  const month = source.getMonth() + 1;
  const year = source.getFullYear();

  let startYear = year;
  let startMonth = 2;

  if (month === 1) {
    startYear = year - 1;
    startMonth = 11;
  } else if (month >= 2 && month <= 4) {
    startYear = year;
    startMonth = 2;
  } else if (month >= 5 && month <= 7) {
    startYear = year;
    startMonth = 5;
  } else if (month >= 8 && month <= 10) {
    startYear = year;
    startMonth = 8;
  } else {
    startYear = year;
    startMonth = 11;
  }

  const endMonth = startMonth === 11 ? 1 : startMonth + 2;
  const endYear = startMonth === 11 ? startYear + 1 : startYear;
  const shortStartYear = String(startYear).slice(2);
  const shortEndYear = String(endYear).slice(2);

  const label = startYear === endYear
    ? `${shortStartYear}년 ${startMonth}-${endMonth}월`
    : `${shortStartYear}년 ${startMonth}월-${shortEndYear}년 ${endMonth}월`;

  return {
    key: `${startYear}-${String(startMonth).padStart(2, '0')}`,
    label,
    sortDate: `${startYear}-${String(startMonth).padStart(2, '0')}-01`,
  };
}



export function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { schedules, doublesMatches, getUserById: getUserFromStore, hydrated } = useAppData();
  const user = getUserFromStore(userId || '');
  const userIdSafe = user?.id ?? '';
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  // 시즌 상세 모달 상태
  const [selectedSeasonKey, setSelectedSeasonKey] = useState<string|null>(null);

  // 모든 훅은 항상 실행 (user가 없을 때도 userIdSafe로 안전하게 처리)

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ...이하 기존 훅에서 user.id → userIdSafe로 변경...

  // getAttendanceRate 등은 user가 undefined가 아닌 경우에만 호출
  let attendanceRate = 0;
  let winRate = 0;
  let totals: { total: number; win: number; loss: number; draw: number } = { total: 0, win: 0, loss: 0, draw: 0 };
  if (user) {
    attendanceRate = getAttendanceRate(user);
    winRate = getWinRate(user);
    // getTotalStats가 반환하는 타입이 다를 경우 변환
    const rawTotals = getTotalStats(user) as any;
    if ('total_sessions' in rawTotals) {
      totals = {
        total: rawTotals.total_sessions ?? 0,
        win: rawTotals.wins ?? 0,
        loss: rawTotals.losses ?? 0,
        draw: rawTotals.draws ?? 0,
      };
    } else {
      totals = rawTotals;
    }
  }

  const sampleAttendanceDates = [
    '2026-04-12',
    '2026-03-29',
    '2026-03-15',
  ];

  const sampleMatchRecords = [
    {
      id: 'sample-1',
      date: '2026-04-12',
      teammateName: '변주혜',
      opponentNames: '박정민, 홍미애',
      scoreText: '6 : 4',
      resultText: '승',
    },
    {
      id: 'sample-2',
      date: '2026-03-29',
      teammateName: '남지현',
      opponentNames: '이은영, 한채아',
      scoreText: '5 : 6',
      resultText: '패',
    },
    {
      id: 'sample-3',
      date: '2026-03-15',
      teammateName: '박세진',
      opponentNames: '이예원, 최혜인',
      scoreText: '5 : 5',
      resultText: '무승부',
    },
  ];


  const seasonStats = useMemo(() => {
    if (!userIdSafe) return [];
    const statsMap = new Map<string, {
      label: string;
      sortDate: string;
      totalSessions: number;
      attendedSessions: number;
      wins: number;
      losses: number;
      draws: number;
    }>();

    schedules.forEach((schedule: any) => {
      const season = toSeasonInfo(schedule.date);
      const prev = statsMap.get(season.key) ?? {
        label: season.label,
        sortDate: season.sortDate,
        totalSessions: 0,
        attendedSessions: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      };

      prev.totalSessions += 1;
      if (schedule.participants.includes(userIdSafe)) {
        prev.attendedSessions += 1;
      }

      statsMap.set(season.key, prev);
    });

    doublesMatches
      .filter((match: any) => match.teamA.includes(userIdSafe) || match.teamB.includes(userIdSafe))
      .forEach((match: any) => {
        const season = toSeasonInfo(match.date);
        const prev = statsMap.get(season.key) ?? {
          label: season.label,
          sortDate: season.sortDate,
          totalSessions: 0,
          attendedSessions: 0,
          wins: 0,
          losses: 0,
          draws: 0,
        };

        const userOnTeamA = match.teamA.includes(userIdSafe);
        if (match.result === 'draw') {
          prev.draws += 1;
        } else if (match.result === 'teamA' || match.result === 'teamB') {
          const won = (match.result === 'teamA' && userOnTeamA) || (match.result === 'teamB' && !userOnTeamA);
          if (won) {
            prev.wins += 1;
          } else {
            prev.losses += 1;
          }
        }

        statsMap.set(season.key, prev);
      });

    return [...statsMap.entries()]
      .map(([key, value]) => {
        const attendanceRateBySeason = value.totalSessions > 0
          ? Math.round((value.attendedSessions / value.totalSessions) * 100)
          : 0;
        const decisiveGames = value.wins + value.losses;
        const winRateBySeason = decisiveGames > 0
          ? Math.round((value.wins / decisiveGames) * 100)
          : 0;

        return {
          key,
          ...value,
          attendanceRateBySeason,
          winRateBySeason,
        };
      })
      .sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  }, [schedules, doublesMatches, userIdSafe]);

  const today = new Date();
  const todayKey = toSeasonInfo(today.toISOString().slice(0, 10)).key;
  // 이번 시즌 통계만 추출
  const currentSeasonStat = seasonStats.find(item => item.key === todayKey);
  // 지난 시즌: 시즌 시작일이 오늘보다 과거인 시즌만 포함
  const pastSeasonStats = seasonStats.filter(item => {
    return new Date(item.sortDate) < today && item.key !== todayKey;
  });

  // 이번 시즌 출석/경기/승/패/무/승률/출석률
  const seasonTotalSessions = currentSeasonStat?.totalSessions ?? 0;
  const seasonAttendedSessions = currentSeasonStat?.attendedSessions ?? 0;
  const seasonWins = currentSeasonStat?.wins ?? 0;
  const seasonLosses = currentSeasonStat?.losses ?? 0;
  const seasonDraws = currentSeasonStat?.draws ?? 0;
  const seasonAttendanceRate = seasonTotalSessions > 0 ? Math.round((seasonAttendedSessions / seasonTotalSessions) * 100) : 0;
  const seasonDecisiveGames = seasonWins + seasonLosses;
  const seasonWinRate = seasonDecisiveGames > 0 ? Math.round((seasonWins / seasonDecisiveGames) * 100) : 0;

  // 이번 시즌 출석 일정/경기 기록만 추출
  const attendedSchedules = useMemo(
    () =>
      schedules
        .filter(schedule => {
          const season = toSeasonInfo(schedule.date);
          return userIdSafe && schedule.participants.includes(userIdSafe) && season.key === todayKey;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [schedules, userIdSafe, todayKey]
  );

  const myMatchRecords = useMemo(
    () =>
      doublesMatches
        .filter(match => {
          const season = toSeasonInfo(match.date);
          return userIdSafe && (match.teamA.includes(userIdSafe) || match.teamB.includes(userIdSafe)) && season.key === todayKey;
        })
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(match => {
          const userOnTeamA = match.teamA.includes(userIdSafe);
          const teammateId = userOnTeamA
            ? match.teamA.find((id: string) => id !== userIdSafe)
            : match.teamB.find((id: string) => id !== userIdSafe);
          const opponentIds = userOnTeamA ? match.teamB : match.teamA;

          const teammateName = teammateId ? getUserFromStore(teammateId as string)?.name ?? '알 수 없음' : '단식';
          const opponentNames = opponentIds
            .map((id: string) => getUserFromStore(id)?.name ?? '알 수 없음')
            .join(', ');

          const hasScore = typeof match.scoreA === 'number' && typeof match.scoreB === 'number';
          const myScore = hasScore ? (userOnTeamA ? match.scoreA : match.scoreB) : null;
          const oppScore = hasScore ? (userOnTeamA ? match.scoreB : match.scoreA) : null;

          let resultText = '기록 없음';
          if (match.result === 'draw') {
            resultText = '무승부';
          } else if (match.result === 'teamA' || match.result === 'teamB') {
            const won = (match.result === 'teamA' && userOnTeamA) || (match.result === 'teamB' && !userOnTeamA);
            resultText = won ? '승' : '패';
          }

          return {
            id: match.id,
            date: match.date,
            teammateName,
            opponentNames,
            scoreText: hasScore ? `${myScore} : ${oppScore}` : '스코어 미기록',
            resultText,
          };
        }),
    [doublesMatches, getUserFromStore, userIdSafe, todayKey]
  );

  const attendanceDatesToShow = attendedSchedules.length > 0 ? attendedSchedules.map(schedule => schedule.date) : [];
  const matchRecordsToShow = myMatchRecords.length > 0 ? myMatchRecords : [];

  const matchRecordsByDate = useMemo(() => {
    const grouped = new Map<string, typeof matchRecordsToShow>();

    matchRecordsToShow.forEach((record) => {
      const prev = grouped.get(record.date) ?? [];
      grouped.set(record.date, [...prev, record]);
    });

    return [...grouped.entries()].map(([date, records]) => ({ date, records }));
  }, [matchRecordsToShow]);

  const partnerStats = useMemo(() => {
    const statsMap = new Map<string, { wins: number; losses: number; draws: number; total: number }>();

    matchRecordsToShow.forEach((record) => {
      if (record.resultText === '기록 없음') return;

      const prev = statsMap.get(record.teammateName) ?? { wins: 0, losses: 0, draws: 0, total: 0 };
      const next = { ...prev, total: prev.total + 1 };

      if (record.resultText === '승') next.wins += 1;
      if (record.resultText === '패') next.losses += 1;
      if (record.resultText === '무승부') next.draws += 1;

      statsMap.set(record.teammateName, next);
    });

    return [...statsMap.entries()]
      .map(([name, stat]) => {
        const decisiveGames = stat.wins + stat.losses;
        const winRateByPair = decisiveGames > 0 ? Math.round((stat.wins / decisiveGames) * 100) : 0;
        return { name, ...stat, winRateByPair };
      })
      .sort((a, b) => b.winRateByPair - a.winRateByPair || b.total - a.total);
  }, [matchRecordsToShow]);

  return (
    <PageLayout>
      <div className="min-h-screen bg-white">
        <div className="max-w-md mx-auto p-6">
        {/* Profile Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">안녕하세요, {currentUser}님!</h1>
        </div>


        {/* 로그아웃 버튼 위로 시즌 통계 이동 */}

        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle>시즌 통계</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">활동 시즌</p>
                {(user?.activeSeasons ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(user?.activeSeasons ?? []).map((season: string) => (
                      <button
                        key={season}
                        className="rounded-full px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#FFC1CC]"
                        style={{ backgroundColor: '#FFE8EE', color: '#030213' }}
                        onClick={() => setSelectedSeasonKey(season)}
                        type="button"
                      >
                        {seasonCodeToLabel(season)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">설정된 활동 시즌이 없습니다.</p>
                )}
              </div>

              {/* 시즌 상세 모달 */}
              <Dialog open={!!selectedSeasonKey} onOpenChange={open => !open && setSelectedSeasonKey(null)}>
                <DialogContent 
                  className="top-0 left-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none rounded-none border-0 p-0 gap-0 overflow-hidden data-[state=open]:animate-none data-[state=closed]:animate-none data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 duration-0"
                  aria-describedby="season-detail-desc"
                >
                  <div className="h-full flex flex-col bg-white px-6 pt-8 pb-6">
                    <DialogHeader>
                      <DialogTitle className="text-2xl">시즌 상세</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-6 mt-6">
                      {(() => {
                        let content = null;
                        if (selectedSeasonKey) {
                          const stat = seasonStats.find((s) => s.key === selectedSeasonKey);
                          let statData = stat;
                          let label = stat?.label || '';
                          if (!statData) {
                            statData = {
                              key: '',
                              label: '',
                              sortDate: '',
                              totalSessions: 0,
                              attendedSessions: 0,
                              wins: 0,
                              losses: 0,
                              draws: 0,
                              attendanceRateBySeason: 0,
                              winRateBySeason: 0,
                            };
                          }
                          // statData가 undefined일 가능성 방어
                          const seasonAttendance = statData?.attendedSessions ?? 0;
                          const seasonTotal = statData?.totalSessions ?? 0;
                          const seasonAttendanceRate = seasonTotal > 0 ? Math.round((seasonAttendance / seasonTotal) * 100) : 0;
                          const seasonWins = statData?.wins ?? 0;
                          const seasonLosses = statData?.losses ?? 0;
                          const seasonDraws = statData?.draws ?? 0;
                          const seasonDecisiveGames = seasonWins + seasonLosses;
                          const seasonWinRate = seasonDecisiveGames > 0 ? Math.round((seasonWins / seasonDecisiveGames) * 100) : 0;
                          const seasonAttendanceDates = stat
                            ? schedules
                                .filter((sch) => {
                                  const s = toSeasonInfo(sch.date);
                                  return user && sch.participants.includes(user.id) && s.key === selectedSeasonKey;
                                })
                                .map((sch) => sch.date)
                                .sort((a, b) => b.localeCompare(a))
                            : [];
                          const seasonMatchRecords = stat
                            ? doublesMatches
                                .filter((match) => {
                                  const s = toSeasonInfo(match.date);
                                  return user && (match.teamA.includes(user.id) || match.teamB.includes(user.id)) && s.key === selectedSeasonKey;
                                })
                                .sort((a, b) => b.date.localeCompare(a.date))
                                .map((match) => {
                                  const userOnTeamA = user ? match.teamA.includes(user.id) : false;
                                  const teammateId = userOnTeamA && user
                                    ? match.teamA.find((id: string) => id !== user.id)
                                    : user
                                    ? match.teamB.find((id: string) => id !== user.id)
                                    : undefined;
                                  const opponentIds = userOnTeamA && user ? match.teamB : match.teamA;
                                  const teammateName = teammateId ? getUserFromStore(teammateId as string)?.name ?? '알 수 없음' : '단식';
                                  const opponentNames = opponentIds
                                    .map((id: string) => getUserFromStore(id)?.name ?? '알 수 없음')
                                    .join(', ');
                                  const hasScore = typeof match.scoreA === 'number' && typeof match.scoreB === 'number';
                                  const myScore = hasScore ? (userOnTeamA ? match.scoreA : match.scoreB) : null;
                                  const oppScore = hasScore ? (userOnTeamA ? match.scoreB : match.scoreA) : null;
                                  let resultText = '기록 없음';
                                  if (match.result === 'draw') {
                                    resultText = '무승부';
                                  } else if (match.result === 'teamA' || match.result === 'teamB') {
                                    const won = (match.result === 'teamA' && userOnTeamA) || (match.result === 'teamB' && !userOnTeamA);
                                    resultText = won ? '승' : '패';
                                  }
                                  return {
                                    id: match.id,
                                    date: match.date,
                                    teammateName,
                                    opponentNames,
                                    scoreText: hasScore ? `${myScore} : ${oppScore}` : '스코어 미기록',
                                    resultText,
                                  };
                                })
                            : [];
                          content = (
                            <>
                              <div className="mb-6">
                                <h3 className="text-lg font-bold mb-2" id="season-detail-desc">{label}</h3>
                                <div className="flex flex-wrap gap-4 mb-2">
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1">출석률</div>
                                    <div className="text-lg font-bold">{seasonAttendanceRate}%</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1">승률</div>
                                    <div className="text-lg font-bold">{seasonWinRate}%</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1">출석</div>
                                    <div className="text-lg font-bold">{seasonAttendance}/{seasonTotal}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1">승/패/무</div>
                                    <div className="text-lg font-bold">{seasonWins}승 {seasonLosses}패 {seasonDraws}무</div>
                                  </div>
                                </div>
                              </div>
                              <div className="mb-6">
                                <h4 className="font-semibold mb-2">출석 내역</h4>
                                {seasonAttendanceDates.length > 0 ? (
                                  <div className="space-y-1">
                                    {seasonAttendanceDates.map(date => (
                                      <div key={date} className="rounded border border-gray-200 bg-white px-3 py-1 text-sm">
                                        {new Date(date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-gray-400 text-sm">출석 내역이 없습니다.</p>
                                )}
                              </div>
                              <div>
                                <h4 className="font-semibold mb-2">경기 기록</h4>
                                {seasonMatchRecords.length > 0 ? (
                                  <div className="space-y-2">
                                    {seasonMatchRecords.map(record => (
                                      <div key={record.id} className="rounded border border-gray-200 bg-white px-3 py-2">
                                        <div className="flex justify-between mb-1">
                                          <span className="text-xs text-gray-500">{new Date(record.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</span>
                                          <span className="text-xs font-semibold text-gray-700">{record.resultText}</span>
                                        </div>
                                        <div className="text-xs text-gray-600">파트너: {record.teammateName}</div>
                                        <div className="text-xs text-gray-600">상대: {record.opponentNames}</div>
                                        <div className="text-xs text-gray-600">스코어: {record.scoreText}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-gray-400 text-sm">경기 기록이 없습니다.</p>
                                )}
                              </div>
                            </>
                          );
                        }
                        return content;
                      })()}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* 지난 시즌 통계 UI 완전 제거 */}
            </CardContent>
          </Card>
        </div>

        {/* Detailed Stats */}

        {/* 이번 시즌 출석 통계 (불필요한 UI 제거, 이번 시즌만) */}
        <Card
          className="mb-6 cursor-pointer transition-colors hover:bg-gray-50"
          role="button"
          tabIndex={0}
          onClick={() => setAttendanceDialogOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setAttendanceDialogOpen(true);
            }
          }}
        >
          <CardHeader>
            <CardTitle>이번 시즌 출석</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">총 출석</span>
              <span className="text-lg font-bold">
                {seasonAttendedSessions} / {seasonTotalSessions} 회
              </span>
            </div>
            <Progress value={seasonAttendanceRate} className="h-3 bg-[#FFE8EE] [&>[data-slot=progress-indicator]]:bg-[#FFC1CC]" />
            <p 
              className="text-right text-sm mt-1 font-medium"
              style={{ color: '#030213' }}
            >
              {seasonAttendanceRate}%
            </p>
          </CardContent>
        </Card>

        {/* Match Record */}

        {/* 이번 시즌 경기 기록 (이번 시즌만) */}
        <Card
          className="mb-6 cursor-pointer transition-colors hover:bg-gray-50"
          role="button"
          tabIndex={0}
          onClick={() => setMatchDialogOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setMatchDialogOpen(true);
            }
          }}
        >
          <CardHeader>
            <CardTitle>이번 시즌 경기 기록</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold" style={{ color: '#030213' }}>
                    {seasonWins}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">승</p>
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: '#030213' }}>
                    {seasonLosses}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">패</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {seasonWins + seasonLosses}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">총 경기</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">승률</span>
                  <span className="text-lg font-bold">{seasonWinRate}%</span>
                </div>
                <Progress value={seasonWinRate} className="h-3 bg-[#FFE8EE] [&>[data-slot=progress-indicator]]:bg-[#FFC1CC]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 mb-24">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleLogout}
          >
            로그아웃
          </Button>
        </div>

        <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
          <DialogContent className="top-0 left-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none rounded-none border-0 p-0 gap-0 overflow-hidden data-[state=open]:animate-none data-[state=closed]:animate-none data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 duration-0">
            <div className="h-full flex flex-col bg-white px-6 pt-8 pb-6">
              <DialogHeader>
                <DialogTitle className="text-2xl">출석 상세 내역</DialogTitle>
              </DialogHeader>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 mt-6">
                {attendanceDatesToShow.length > 0 ? (
                  attendanceDatesToShow.map(date => (
                    <div key={date} className="rounded-md border border-gray-200 bg-white px-3 py-2">
                      <p className="text-sm font-medium text-[#030213]">
                        {new Date(date).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          weekday: 'short',
                        })}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">참석 내역이 없습니다.</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
          <DialogContent className="top-0 left-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none rounded-none border-0 p-0 gap-0 overflow-hidden data-[state=open]:animate-none data-[state=closed]:animate-none data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 duration-0">
            <div className="h-full flex flex-col bg-white px-6 pt-8 pb-6">
              <DialogHeader>
                <DialogTitle className="text-2xl">경기 상세 기록</DialogTitle>
              </DialogHeader>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 mt-6">
                <div className="text-sm text-gray-700">
                  {partnerStats.length > 0 ? (
                    <p>
                      최고의 파트너: <span className="font-semibold text-[#030213]">{partnerStats[0].name}</span> ({partnerStats[0].winRateByPair}% · {partnerStats[0].wins}승 {partnerStats[0].losses}패)
                    </p>
                  ) : (
                    <p className="text-gray-500">최고의 파트너 통계 데이터가 없습니다.</p>
                  )}
                </div>

                {matchRecordsByDate.length > 0 ? (
                  matchRecordsByDate.map(group => (
                    <div key={group.date} className="rounded-md border border-gray-200 bg-white overflow-hidden">
                      <div className="px-3 py-2 border-b border-gray-200 bg-[#F8F9FA]">
                        <p className="text-sm font-semibold text-[#030213]">
                          {new Date(group.date).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'short',
                          })}
                        </p>
                      </div>
                      <div className="divide-y divide-gray-200">
                        {group.records.map(record => (
                          <div key={record.id} className="px-3 py-3 space-y-1.5">
                            <p className="text-xs text-gray-600">파트너: {record.teammateName}</p>
                            <p className="text-xs text-gray-600">상대: {record.opponentNames}</p>
                            <div className="flex items-center justify-between pt-1">
                              <p className="text-sm font-medium text-[#030213]">스코어 {record.scoreText}</p>
                              <span className="text-xs font-semibold text-gray-700">{record.resultText}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">경기 기록이 없습니다.</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </PageLayout>
  );
}