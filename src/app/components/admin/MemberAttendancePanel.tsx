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
import { getAttendanceRate, getTotalStats, getWinRate, seasonCodeToLabel, type User as UserType } from '../../data/mockData.js';

interface MemberAttendancePanelProps {
  memberUsers: UserType[];
  allSeasons: string[];
  selectedAttendanceSeasonFilter: string;
  onChangeAttendanceSeasonFilter: (seasonCode: string) => void;
  isMobilePreview: boolean;
}

export function MemberAttendancePanel({
  memberUsers,
  allSeasons,
  selectedAttendanceSeasonFilter,
  onChangeAttendanceSeasonFilter,
  isMobilePreview,
}: MemberAttendancePanelProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
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
        </div>

        {isMobilePreview ? (
          <div className="space-y-2">
            {usersToShow.map((user: any, index: number) => {
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
        )}
      </CardContent>}
    </Card>
  );
}
