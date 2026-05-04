import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { PageLayout } from '../components/PageLayout.js';
import { 
  getAttendanceRate, 
  getCurrentSeasonCode,
  getMatchPointMetrics,
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.js';

function inferSeasonCodeFromDate(dateString: string): string | undefined {
  const source = new Date(`${dateString}T00:00:00+09:00`);
  if (Number.isNaN(source.getTime())) return undefined;

  const month = source.getMonth() + 1;
  const year = source.getFullYear();
  const yy = String(year % 100).padStart(2, '0');

  if (month >= 2 && month <= 4) return `${yy}S1`;
  if (month >= 5 && month <= 7) return `${yy}S2`;
  if (month >= 8 && month <= 10) return `${yy}S3`;
  if (month >= 11) return `${yy}S4`;

  return `${String((year - 1) % 100).padStart(2, '0')}S4`;
}

function seasonCodeToSortDate(seasonCode: string): string {
  const match = seasonCode.match(/^(\d{2})S([1-4])$/);
  if (!match) return '0000-00-01';

  const year = 2000 + Number(match[1]);
  const seasonIndex = Number(match[2]);
  const startMonthMap: Record<number, string> = {
    1: '02',
    2: '05',
    3: '08',
    4: '11',
  };

  return `${year}-${startMonthMap[seasonIndex] ?? '01'}-01`;
}



export function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { schedules, doublesMatches, getUserById: getUserFromStore, hydrated } = useAppData();
  const user = getUserFromStore(userId || '');
  const userIdSafe = user?.id ?? '';
  const includesUserId = (list: unknown, id: string): boolean => Array.isArray(list) && list.includes(id);
  const safeIdList = (list: unknown): string[] =>
    Array.isArray(list) ? (list as unknown[]).filter((v): v is string => typeof v === 'string') : [];
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
    if (!user) return [];

    const seasonKeys = new Set<string>();
    (user.activeSeasons ?? []).forEach(seasonCode => seasonKeys.add(seasonCode));
    (user.seasonStats ?? []).forEach(stat => seasonKeys.add(stat.seasonCode));

    schedules.forEach(schedule => {
      const seasonCode = schedule.seasonCode || inferSeasonCodeFromDate(schedule.date);
      if (seasonCode && includesUserId(schedule.participants, userIdSafe)) {
        seasonKeys.add(seasonCode);
      }
    });

    doublesMatches.forEach(match => {
      const seasonCode = inferSeasonCodeFromDate(match.date);
      if (seasonCode && (includesUserId(match.teamA, userIdSafe) || includesUserId(match.teamB, userIdSafe))) {
        seasonKeys.add(seasonCode);
      }
    });

    return [...seasonKeys]
      .map((seasonCode) => {
        const stat = (user.seasonStats ?? []).find(item => item.seasonCode === seasonCode);
        const totalSessions = stat?.total_sessions ?? 0;
        const attendedSessions = stat?.attended_sessions ?? 0;
        const wins = stat?.wins ?? 0;
        const losses = stat?.losses ?? 0;
        const draws = stat?.draws ?? 0;
        const attendanceRateBySeason = totalSessions > 0
          ? Math.round((attendedSessions / totalSessions) * 100)
          : 0;
        const totalGames = wins + losses + draws;
        const winRateBySeason = totalGames > 0
          ? Math.round(((wins + draws * 0.5) / totalGames) * 100)
          : 0;

        return {
          key: seasonCode,
          label: seasonCodeToLabel(seasonCode),
          sortDate: seasonCodeToSortDate(seasonCode),
          totalSessions,
          attendedSessions,
          wins,
          losses,
          draws,
          attendanceRateBySeason,
          winRateBySeason,
        };
      })
      .sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  }, [doublesMatches, schedules, user, userIdSafe]);

  const currentSeasonKey = getCurrentSeasonCode();
  // 이번 시즌 통계만 추출
  const currentSeasonStat = seasonStats.find(item => item.key === currentSeasonKey);
  // 지난 시즌: 시즌 시작일이 오늘보다 과거인 시즌만 포함
  const pastSeasonStats = seasonStats.filter(item => {
    return item.sortDate < seasonCodeToSortDate(currentSeasonKey) && item.key !== currentSeasonKey;
  });

  // 이번 시즌 출석/경기/승/패/무/승률/출석률
  const seasonTotalSessions = currentSeasonStat?.totalSessions ?? 0;
  const seasonAttendedSessions = currentSeasonStat?.attendedSessions ?? 0;
  const seasonWins = currentSeasonStat?.wins ?? 0;
  const seasonLosses = currentSeasonStat?.losses ?? 0;
  const seasonDraws = currentSeasonStat?.draws ?? 0;
  const seasonAttendanceRate = seasonTotalSessions > 0 ? Math.round((seasonAttendedSessions / seasonTotalSessions) * 100) : 0;
  const seasonTotalGames = seasonWins + seasonLosses + seasonDraws;
  const seasonWinRate = seasonTotalGames > 0 ? Math.round(((seasonWins + seasonDraws * 0.5) / seasonTotalGames) * 100) : 0;
  const seasonPointMetrics = getMatchPointMetrics(userIdSafe, doublesMatches, currentSeasonKey);

  // 이번 시즌 출석 일정/경기 기록만 추출
  const attendedSchedules = useMemo(
    () =>
      schedules
        .filter(schedule => {
          const seasonCode = schedule.seasonCode || inferSeasonCodeFromDate(schedule.date);
          return userIdSafe && includesUserId(schedule.participants, userIdSafe) && seasonCode === currentSeasonKey;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [schedules, userIdSafe, currentSeasonKey]
  );

  const myMatchRecords = useMemo(
    () =>
      doublesMatches
        .filter(match => {
          const seasonCode = inferSeasonCodeFromDate(match.date);
          return userIdSafe && (includesUserId(match.teamA, userIdSafe) || includesUserId(match.teamB, userIdSafe)) && seasonCode === currentSeasonKey;
        })
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(match => {
          const teamAIds = safeIdList(match.teamA);
          const teamBIds = safeIdList(match.teamB);
          const userOnTeamA = teamAIds.includes(userIdSafe);
          const teammateId = userOnTeamA
            ? teamAIds.find((id: string) => id !== userIdSafe)
            : teamBIds.find((id: string) => id !== userIdSafe);
          const opponentIds = userOnTeamA ? teamBIds : teamAIds;

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
    [doublesMatches, getUserFromStore, userIdSafe, currentSeasonKey]
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
        const totalGames = stat.wins + stat.losses + stat.draws;
        const winRateByPair = totalGames > 0 ? Math.round(((stat.wins + stat.draws * 0.5) / totalGames) * 100) : 0;
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
                >
                  <div className="h-full flex flex-col bg-white px-6 pt-8 pb-6">
                    <DialogHeader>
                      <DialogTitle className="text-2xl">시즌 상세</DialogTitle>
                      <DialogDescription className="sr-only">
                        선택한 시즌의 출석률, 승률, 득실차, 게임 승률, 출석 내역, 경기 기록을 확인하는 상세 팝업입니다.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-6 mt-6">
                      {(() => {
                        let content = null;
                        if (selectedSeasonKey) {
                          const stat = seasonStats.find((s) => s.key === selectedSeasonKey);
                          let statData = stat;
                          let label = stat?.label || seasonCodeToLabel(selectedSeasonKey);
                          if (!statData) {
                            statData = {
                              key: selectedSeasonKey,
                              label,
                              sortDate: seasonCodeToSortDate(selectedSeasonKey),
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
                          const seasonTotalGames = seasonWins + seasonLosses + seasonDraws;
                          const seasonWinRate = seasonTotalGames > 0 ? Math.round(((seasonWins + seasonDraws * 0.5) / seasonTotalGames) * 100) : 0;
                          const seasonPointMetrics = getMatchPointMetrics(userIdSafe, doublesMatches, selectedSeasonKey);
                          const seasonAttendanceDates = schedules
                            .filter((sch) => {
                              const seasonCode = sch.seasonCode || inferSeasonCodeFromDate(sch.date);
                              return !!user && includesUserId(sch.participants, user.id) && seasonCode === selectedSeasonKey;
                            })
                            .map((sch) => sch.date)
                            .sort((a, b) => b.localeCompare(a));
                          const seasonMatchRecords = doublesMatches
                            .filter((match) => {
                              const seasonCode = inferSeasonCodeFromDate(match.date);
                              return !!user && (includesUserId(match.teamA, user.id) || includesUserId(match.teamB, user.id)) && seasonCode === selectedSeasonKey;
                            })
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map((match) => {
                              const teamAIds = safeIdList(match.teamA);
                              const teamBIds = safeIdList(match.teamB);
                              const userOnTeamA = user ? teamAIds.includes(user.id) : false;
                              const teammateId = userOnTeamA && user
                                ? teamAIds.find((id: string) => id !== user.id)
                                : user
                                ? teamBIds.find((id: string) => id !== user.id)
                                : undefined;
                              const opponentIds = userOnTeamA && user ? teamBIds : teamAIds;
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
                            });
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
                                    <div className="text-xs text-gray-500 mb-1">득실차 (GD)</div>
                                    <div className="text-lg font-bold">{seasonPointMetrics.gameDifference > 0 ? `+${seasonPointMetrics.gameDifference}` : seasonPointMetrics.gameDifference}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 mb-1">게임 승률 (GWP)</div>
                                    <div className="text-lg font-bold">{seasonPointMetrics.gameWinRate.toFixed(1)}%</div>
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
              <div className="grid grid-cols-4 gap-4 text-center">
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
                  <p className="text-2xl font-bold" style={{ color: '#030213' }}>
                    {seasonDraws}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">무</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {seasonWins + seasonLosses + seasonDraws}
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
                <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                  <div className="rounded-lg border border-gray-200 px-3 py-3">
                    <div className="text-gray-500 mb-1">득실차 (GD)</div>
                    <div className="text-lg font-bold">{seasonPointMetrics.gameDifference > 0 ? `+${seasonPointMetrics.gameDifference}` : seasonPointMetrics.gameDifference}</div>
                  </div>
                  <div className="rounded-lg border border-gray-200 px-3 py-3">
                    <div className="text-gray-500 mb-1">게임 승률 (GWP)</div>
                    <div className="text-lg font-bold">{seasonPointMetrics.gameWinRate.toFixed(1)}%</div>
                  </div>
                </div>
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
                <DialogDescription className="sr-only">
                  이번 시즌 출석 날짜 목록을 확인하는 상세 팝업입니다.
                </DialogDescription>
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
                <DialogDescription className="sr-only">
                  이번 시즌 경기 기록과 파트너 통계, 승률 및 점수 지표 설명을 확인하는 상세 팝업입니다.
                </DialogDescription>
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

                <div className="rounded-md border border-gray-200 bg-[#FAFAFA] px-4 py-4 text-sm text-gray-500 space-y-2">
                  <p>일반 승률: 승 + 무의 절반을 반영한 승률입니다. 현재는 `(승 + 0.5 x 무) / 총 경기` 기준으로 계산합니다.</p>
                  <p>득실차 (GD): 내가 딴 총 점수에서 상대에게 내준 총 점수를 뺀 값입니다. 높을수록 경기 내용이 좋았다는 뜻입니다.</p>
                  <p>게임 승률 (GWP): 전체 플레이 점수 중 내가 딴 점수의 비율입니다. 경기 수가 다른 멤버끼리 비교할 때 보정 지표로 보기 좋습니다.</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </PageLayout>
  );
}