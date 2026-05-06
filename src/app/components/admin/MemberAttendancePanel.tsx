import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table.js';
import {
  getAttendanceRate,
  getMatchPointMetrics,
  getTotalStats,
  getWinRate,
  seasonCodeToLabel,
  type DoublesMatch,
  type User as UserType,
  type WeeklyMatchSchedule,
} from '../../data/mockData.js';
import { getScheduleSeasonCode } from './scheduleUtils.js';

interface MemberAttendancePanelProps {
  memberUsers: UserType[];
  allSeasons: string[];
  schedules: WeeklyMatchSchedule[];
  doublesMatches: DoublesMatch[];
  selectedAttendanceSeasonFilter: string;
  onChangeAttendanceSeasonFilter: (seasonCode: string) => void;
  isMobilePreview: boolean;
}

export function MemberAttendancePanel({
  memberUsers,
  allSeasons,
  schedules,
  doublesMatches,
  selectedAttendanceSeasonFilter,
  onChangeAttendanceSeasonFilter,
  isMobilePreview,
}: MemberAttendancePanelProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const formatSigned = (value: number) => (value > 0 ? `+${value}` : `${value}`);

  const computeAttended = (userId: string, seasonCode?: string): number =>
    schedules.filter(s => {
      if (seasonCode && getScheduleSeasonCode(s) !== seasonCode) return false;
      return Array.isArray(s.participants) && s.participants.includes(userId);
    }).length;

  // 진행된 회차: 참석자 1명 이상 일정만 카운트
  const progressedSchedules = React.useMemo(
    () =>
      schedules.filter(s => {
        if (selectedAttendanceSeasonFilter && getScheduleSeasonCode(s) !== selectedAttendanceSeasonFilter) {
          return false;
        }
        return Array.isArray(s.participants) && s.participants.length > 0;
      }),
    [schedules, selectedAttendanceSeasonFilter]
  );

  const totalProgressedSessions = progressedSchedules.length;

  const sortedUsers = [...memberUsers].sort((a, b) => {
    const attA = getAttendanceRate(a, selectedAttendanceSeasonFilter || undefined);
    const attB = getAttendanceRate(b, selectedAttendanceSeasonFilter || undefined);
    if (attA !== attB) return attB - attA;
    const winA = getWinRate(a, selectedAttendanceSeasonFilter || undefined);
    const winB = getWinRate(b, selectedAttendanceSeasonFilter || undefined);
    return winB - winA;
  });

  let usersToShow = sortedUsers;
  if (selectedAttendanceSeasonFilter) {
    usersToShow = sortedUsers.filter(user => (user.activeSeasons ?? []).includes(selectedAttendanceSeasonFilter));
  }

  const getProgressedAttendanceRate = (userId: string): number => {
    const attended = progressedSchedules.filter(
      s => Array.isArray(s.participants) && s.participants.includes(userId)
    ).length;
    return Math.round((attended / (totalProgressedSessions || 1)) * 100);
  };

  const sortedProgressedRates = [...usersToShow]
    .map(user => getProgressedAttendanceRate(user.id))
    .sort((a, b) => b - a);

  const top30Count = Math.max(1, Math.ceil(usersToShow.length * 0.3));
  const top30CutoffRate = sortedProgressedRates[top30Count - 1] ?? 0;

  const isNormalStatus = (userId: string): boolean => {
    const rate = getProgressedAttendanceRate(userId);
    return rate >= 50 || rate >= top30CutoffRate;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>회원 출석 관리</CardTitle>
            <button
              type="button"
              onClick={() =>
                toast('출석 우선순위 안내', {
                  description:
                    '진행된 회차(참석자 1명 이상 일정) 기준 출석률이 50% 미만이면서 상위 30%에도 들지 않으면 우선순위로 분류됩니다.',
                  duration: 4500,
                })
              }
              className="mt-1 text-xs text-gray-500 underline underline-offset-2 hover:text-gray-700"
            >
              출석 우선순위 기준 보기
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(prev => !prev)}>
            {isExpanded ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          <div className="mb-4 flex gap-2 flex-wrap">
            {allSeasons.map(season => (
              <button
                key={season}
                onClick={() => onChangeAttendanceSeasonFilter(season)}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  selectedAttendanceSeasonFilter === season
                    ? 'bg-[#030213] text-white border-[#030213]'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                }`}
              >
                {seasonCodeToLabel(season)}
              </button>
            ))}
            <button
              onClick={() => onChangeAttendanceSeasonFilter('')}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                selectedAttendanceSeasonFilter === ''
                  ? 'bg-[#030213] text-white border-[#030213]'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
              }`}
            >
              전체
            </button>
          </div>

          {isMobilePreview ? (
            <div className="space-y-2">
              {usersToShow.map((user, index) => {
                let totals = getTotalStats(user);
                let winRate = getWinRate(user);

                if (selectedAttendanceSeasonFilter) {
                  const stat = (user.seasonStats ?? []).find((s: any) => s.seasonCode === selectedAttendanceSeasonFilter);
                  if (stat) {
                    totals = {
                      ...totals,
                      ...stat,
                      draws: stat.draws ?? 0,
                    };
                  }
                  winRate = stat
                    ? Math.round((((stat.wins ?? 0) + (stat.draws ?? 0) * 0.5) / (((stat.wins ?? 0) + (stat.losses ?? 0) + (stat.draws ?? 0)) || 1)) * 100)
                    : winRate;
                }

                const dynamicAttended = computeAttended(user.id, selectedAttendanceSeasonFilter || undefined);
                const pointMetrics = getMatchPointMetrics(user.id, doublesMatches, selectedAttendanceSeasonFilter || undefined);
                totals = { ...totals, attended_sessions: dynamicAttended, draws: totals.draws ?? 0 };

                const attendanceRateProgressed = getProgressedAttendanceRate(user.id);
                const isNormal = isNormalStatus(user.id);
                const totalGames = (totals.wins ?? 0) + (totals.losses ?? 0) + (totals.draws ?? 0);

                return (
                  <div
                    key={user.id}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-3 space-y-2"
                    style={!isNormal ? { backgroundColor: '#FFF5F7' } : {}}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#030213]">
                          {index + 1}. <Link to={`/profile/${user.id}`} className="hover:underline">{user.name}</Link>
                        </p>
                        <p className="text-xs text-gray-500">출석 {totals.attended_sessions}</p>
                      </div>
                      {isNormal ? (
                        <Badge style={{ backgroundColor: '#FFC1CC', color: '#030213' }}>정상</Badge>
                      ) : (
                        <Badge style={{ backgroundColor: '#FF4D4D', color: 'white' }}>우선순위</Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">출석률</span>
                      <span className="font-medium">{attendanceRateProgressed}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">전적</span>
                      <span className="font-medium">
                        {totalGames}전 {totals.wins}승 {totals.losses}패 {totals.draws ?? 0}무 · 승률 (WR) {winRate}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">점수지표</span>
                      <span className="font-medium">득실차 (GD) {formatSigned(pointMetrics.gameDifference)} · 게임 승률 (GWP) {pointMetrics.gameWinRate.toFixed(1)}%</span>
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
                    <TableHead>출석</TableHead>
                    <TableHead>출석률</TableHead>
                    <TableHead>전적</TableHead>
                    <TableHead>승률 (WR)</TableHead>
                    <TableHead>점수지표</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersToShow.map((user, index) => {
                    let totals = getTotalStats(user);
                    let winRate = getWinRate(user);

                    if (selectedAttendanceSeasonFilter) {
                      const stat = (user.seasonStats ?? []).find((s: any) => s.seasonCode === selectedAttendanceSeasonFilter);
                      if (stat) {
                        totals = {
                          ...totals,
                          ...stat,
                          draws: stat.draws ?? 0,
                        };
                      }
                      winRate = stat
                        ? Math.round((((stat.wins ?? 0) + (stat.draws ?? 0) * 0.5) / (((stat.wins ?? 0) + (stat.losses ?? 0) + (stat.draws ?? 0)) || 1)) * 100)
                        : winRate;
                    }

                    const dynamicAttended = computeAttended(user.id, selectedAttendanceSeasonFilter || undefined);
                    const pointMetrics = getMatchPointMetrics(user.id, doublesMatches, selectedAttendanceSeasonFilter || undefined);
                    totals = { ...totals, attended_sessions: dynamicAttended, draws: totals.draws ?? 0 };

                    const attendanceRateProgressed = getProgressedAttendanceRate(user.id);
                    const isNormal = isNormalStatus(user.id);
                    const totalGames = (totals.wins ?? 0) + (totals.losses ?? 0) + (totals.draws ?? 0);

                    return (
                      <TableRow key={user.id} style={!isNormal ? { backgroundColor: '#FFF5F7' } : {}}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">
                          <Link to={`/profile/${user.id}`} className="hover:underline">
                            {user.name}
                          </Link>
                        </TableCell>
                        <TableCell>{totals.attended_sessions}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={!isNormal ? 'font-bold' : ''}>{attendanceRateProgressed}%</span>
                            {!isNormal && <TrendingDown className="w-4 h-4" style={{ color: '#FF4D4D' }} />}
                          </div>
                        </TableCell>
                        <TableCell>
                          {totalGames}전 {totals.wins}승 {totals.losses}패 {totals.draws ?? 0}무
                        </TableCell>
                        <TableCell>{winRate}%</TableCell>
                        <TableCell>
                          <div className="text-xs leading-5">
                            <div>득실차 (GD) {formatSigned(pointMetrics.gameDifference)}</div>
                            <div>게임 승률 (GWP) {pointMetrics.gameWinRate.toFixed(1)}%</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isNormal ? (
                            <Badge style={{ backgroundColor: '#FFC1CC', color: '#030213' }}>정상</Badge>
                          ) : (
                            <Badge style={{ backgroundColor: '#FF4D4D', color: 'white' }}>우선순위</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
