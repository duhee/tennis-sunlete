import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, TrendingDown } from 'lucide-react';
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
import { getAttendanceRate, getMatchPointMetrics, getTotalStats, getWinRate, seasonCodeToLabel, type DoublesMatch, type User as UserType, type WeeklyMatchSchedule } from '../../data/mockData.js';
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

  const sortedUsers = [...memberUsers].sort((a, b) => getAttendanceRate(a) - getAttendanceRate(b));

  let usersToShow = sortedUsers;
  if (selectedAttendanceSeasonFilter) {
    usersToShow = sortedUsers.filter(user => (user.activeSeasons ?? []).includes(selectedAttendanceSeasonFilter));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>회원 출석 관리</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(prev => !prev)}>
            {isExpanded ? (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
              </>
            ) : (
              <>
                <ChevronRight className="w-4 h-4 mr-1" />
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && <CardContent>
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
            {usersToShow.map((user: any, index: number) => {
              let totals = getTotalStats(user);
              let attendanceRate = getAttendanceRate(user);
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
                winRate = stat ? Math.round((((stat.wins ?? 0) + (stat.draws ?? 0) * 0.5) / (((stat.wins ?? 0) + (stat.losses ?? 0) + (stat.draws ?? 0)) || 1)) * 100) : winRate;
              }
              const dynamicAttended = computeAttended(user.id, selectedAttendanceSeasonFilter || undefined);
              const pointMetrics = getMatchPointMetrics(user.id, doublesMatches, selectedAttendanceSeasonFilter || undefined);
              totals = { ...totals, attended_sessions: dynamicAttended, draws: totals.draws ?? 0 };
              attendanceRate = Math.round((dynamicAttended / (totals.total_sessions || 1)) * 100);
              const isLowAttendance = attendanceRate < 60;
              const totalGames = (totals.wins ?? 0) + (totals.losses ?? 0) + (totals.draws ?? 0);
              return (
                <div
                  key={user.id}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-3 space-y-2"
                  style={isLowAttendance ? { backgroundColor: '#FFF5F7' } : {}}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#030213]">
                        {index + 1}. <Link to={`/profile/${user.id}`} className="hover:underline">{user.name}</Link>
                      </p>
                      <p className="text-xs text-gray-500">출석 {totals.attended_sessions}</p>
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
                    <span className="font-medium">{totalGames}전 {totals.wins}승 {totals.losses}패 {totals.draws ?? 0}무 · 승률 {winRate}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">점수지표</span>
                    <span className="font-medium">GD {formatSigned(pointMetrics.gameDifference)} · GWP {pointMetrics.gameWinRate.toFixed(1)}%</span>
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
                  <TableHead>승률</TableHead>
                  <TableHead>점수지표</TableHead>
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
                    if (stat) {
                      totals = {
                        ...totals,
                        ...stat,
                        draws: stat.draws ?? 0,
                      };
                    }
                    winRate = stat ? Math.round((((stat.wins ?? 0) + (stat.draws ?? 0) * 0.5) / (((stat.wins ?? 0) + (stat.losses ?? 0) + (stat.draws ?? 0)) || 1)) * 100) : winRate;
                  }
                  const dynamicAttended = computeAttended(user.id, selectedAttendanceSeasonFilter || undefined);
                  const pointMetrics = getMatchPointMetrics(user.id, doublesMatches, selectedAttendanceSeasonFilter || undefined);
                  totals = { ...totals, attended_sessions: dynamicAttended, draws: totals.draws ?? 0 };
                  attendanceRate = Math.round((dynamicAttended / (totals.total_sessions || 1)) * 100);
                  const isLowAttendance = attendanceRate < 60;
                  const totalGames = (totals.wins ?? 0) + (totals.losses ?? 0) + (totals.draws ?? 0);
                  return (
                    <TableRow key={user.id} style={isLowAttendance ? { backgroundColor: '#FFF5F7' } : {}}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        <Link to={`/profile/${user.id}`} className="hover:underline">
                          {user.name}
                        </Link>
                      </TableCell>
                      {/* <TableCell>{totals.total_sessions}</TableCell> */}
                      <TableCell>{totals.attended_sessions}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={isLowAttendance ? 'font-bold' : ''}>{attendanceRate}%</span>
                          {isLowAttendance && <TrendingDown className="w-4 h-4" style={{ color: '#FF4D4D' }} />}
                        </div>
                      </TableCell>
                      <TableCell>
                        {totalGames}전 {totals.wins}승 {totals.losses}패 {totals.draws ?? 0}무
                      </TableCell>
                      <TableCell>{winRate}%</TableCell>
                      <TableCell>
                        <div className="text-xs leading-5">
                          <div>GD {formatSigned(pointMetrics.gameDifference)}</div>
                          <div>GWP {pointMetrics.gameWinRate.toFixed(1)}%</div>
                        </div>
                      </TableCell>
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
        )}
      </CardContent>}
    </Card>
  );
}
