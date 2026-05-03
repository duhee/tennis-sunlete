import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table.js';
import { getTotalStats, seasonCodeToLabel, type User as UserType, type WeeklyMatchSchedule } from '../../data/mockData.js';

interface GuestListPanelProps {
  guestUsers: UserType[];
  schedules: WeeklyMatchSchedule[];
  onDeleteGuest: (guestId: string) => void;
  isMobilePreview: boolean;
}

function inferSeasonCodeFromDate(date: string): string {
  const d = new Date(`${date}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return '시즌 미지정';

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

function getGuestVisitSummary(guestId: string, schedules: WeeklyMatchSchedule[]) {
  const seasonVisitMap = new Map<string, number>();
  let totalVisits = 0;

  schedules.forEach(schedule => {
    const attended = schedule.attendanceRequests.some(
      row => row.userId === guestId && row.status === 'attend'
    );
    if (!attended) return;

    totalVisits += 1;
    const seasonCode = schedule.seasonCode ?? inferSeasonCodeFromDate(schedule.date);
    seasonVisitMap.set(seasonCode, (seasonVisitMap.get(seasonCode) ?? 0) + 1);
  });

  return {
    totalVisits,
    seasons: Array.from(seasonVisitMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([seasonCode, count]) => ({ seasonCode, count })),
  };
}

function getSeasonDisplayLabel(seasonCode: string): string {
  if (seasonCode === '시즌 미지정') return seasonCode;
  const label = seasonCodeToLabel(seasonCode);
  return label === '알 수 없음' ? seasonCode : label;
}

export function GuestListPanel({ guestUsers, schedules, onDeleteGuest, isMobilePreview }: GuestListPanelProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <Card className="mt-6 mb-6">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>게스트 목록</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setIsExpanded(prev => !prev)}>
            {isExpanded ? (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                접기
              </>
            ) : (
              <>
                <ChevronRight className="w-4 h-4 mr-1" />
                펼치기
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && <CardContent>
        {guestUsers.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 게스트가 없습니다</p>
        ) : isMobilePreview ? (
          <div className="space-y-2">
            {guestUsers.map(guest => {
              const guestTotals = getTotalStats(guest);
              const visitSummary = getGuestVisitSummary(guest.id, schedules);
              return (
                <div key={guest.id} className="rounded-lg border border-gray-200 bg-white px-3 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#030213]">{guest.name}</p>
                      <p className="text-xs text-gray-500">{guest.gender === 'F' ? '여성' : '남성'}</p>
                    </div>
                    <Badge variant="outline">게스트</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">참석</span>
                    <span className="font-medium">총 {visitSummary.totalVisits}회</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {visitSummary.seasons.length === 0 ? (
                      <span className="text-xs text-gray-500">시즌 참석 기록 없음</span>
                    ) : (
                      visitSummary.seasons.map(item => (
                        <Badge key={`${guest.id}-${item.seasonCode}`} variant="outline" className="text-[10px]">
                          {getSeasonDisplayLabel(item.seasonCode)} {item.count}회
                        </Badge>
                      ))
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">전적</span>
                    <span className="font-medium">{guestTotals.wins}승 {guestTotals.losses}패</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => onDeleteGuest(guest.id)}
                  >
                    게스트 삭제
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>성별</TableHead>
                  <TableHead>표시</TableHead>
                  <TableHead>시즌 참석</TableHead>
                  <TableHead>전적</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guestUsers.map(guest => {
                  const guestTotals = getTotalStats(guest);
                  const visitSummary = getGuestVisitSummary(guest.id, schedules);
                  return (
                    <TableRow key={guest.id}>
                      <TableCell className="font-medium">{guest.name}</TableCell>
                      <TableCell>{guest.gender === 'F' ? '여성' : '남성'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">게스트</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">총 {visitSummary.totalVisits}회</p>
                          <div className="flex flex-wrap gap-1">
                            {visitSummary.seasons.length === 0 ? (
                              <span className="text-xs text-gray-500">기록 없음</span>
                            ) : (
                              visitSummary.seasons.map(item => (
                                <Badge key={`${guest.id}-${item.seasonCode}`} variant="outline" className="text-[10px]">
                                  {getSeasonDisplayLabel(item.seasonCode)} {item.count}회
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{guestTotals.wins}승 {guestTotals.losses}패</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => onDeleteGuest(guest.id)}>
                          삭제
                        </Button>
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
