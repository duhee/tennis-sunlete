import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Badge } from '../ui/badge.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table.js';
import { toast } from 'sonner';
import type { AttendanceRecordsViewProps } from './types.js';

export function AttendanceRecordsView({
  selectedSchedule,
  attendanceRecords,
  absentUsers,
  noResponseUsers,
  statusLabel,
  isMobilePreview,
}: AttendanceRecordsViewProps) {
  if (!selectedSchedule) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            참석 기록 조회
            <button
              type="button"
              aria-label="우선순위 설명"
              onClick={() =>
                toast.info('우선순위 기준', {
                  description: '출석률 + 버튼 누른 시간',
                })
              }
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-xs text-gray-600 hover:bg-gray-100"
            >
              ?
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">경기 일정을 선택해주세요.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          참석 기록 조회
          <button
            type="button"
            aria-label="우선순위 설명"
            onClick={() =>
              toast.info('우선순위 기준', {
                description: '출석률 + 버튼 누른 시간',
              })
            }
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-xs text-gray-600 hover:bg-gray-100"
          >
            ?
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">{statusLabel}</Badge>
          <span className="text-gray-400">
            참석 {selectedSchedule.participants.length ?? 0}명 · 대기 {selectedSchedule.waitlist.length ?? 0}명
          </span>
        </div>

        {isMobilePreview ? (
          <div className="space-y-2">
            {attendanceRecords.map((row: any, index: number) => (
              <div
                key={row.userId}
                className="rounded-lg border border-gray-200 px-3 py-3 space-y-2"
                style={{
                  backgroundColor: row.userId.startsWith('guest-') ? '#F8FCFF' : row.placement === 'waitlist' ? '#FFFEF0' : '#FFFFFF',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#030213] truncate">
                      {index + 1}. {row.name}
                      <span className="ml-1 text-s font-normal text-gray-500">{row.gender === 'M' ? '남' : '여'}</span>
                    </p>
                    {!row.userId.startsWith('guest-') && (
                      <p className="mt-1 text-xs text-gray-400">
                        출석률 {row.attendanceRate}% · 요청 {new Date(row.requestedAt).toLocaleString('ko-KR', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {row.userId.startsWith('guest-') && <Badge variant="outline">게스트</Badge>}
                    {row.placement === 'participant' ? (
                      <Badge style={{ backgroundColor: '#E8F5E9', color: '#2E7D32' }}>참석자</Badge>
                    ) : (
                      <Badge style={{ backgroundColor: '#FFF3E0', color: '#E65100' }}>대기자</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">우선순위</TableHead>
                  <TableHead className="text-center">이름</TableHead>
                  <TableHead className="text-center">성별</TableHead>
                  <TableHead className="text-center">출석률</TableHead>
                  <TableHead className="text-center">요청 시각</TableHead>
                  <TableHead className="text-center">배정</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRecords.map((row: any, index: number) => (
                  <TableRow
                    key={row.userId}
                    style={{
                      backgroundColor: row.userId.startsWith('guest-') ? '#F8FCFF' : row.placement === 'waitlist' ? '#FFFEF0' : undefined,
                    }}
                  >
                    <TableCell className="text-center">{index + 1}</TableCell>
                    <TableCell className="text-center">{row.name}</TableCell>
                    <TableCell className="text-center text-s">{row.gender === 'M' ? '남' : '여'}</TableCell>
                    <TableCell className="text-center">
                      {row.userId.startsWith('guest-') ? '-' : `${row.attendanceRate}%`}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.userId.startsWith('guest-') ? '-' : new Date(row.requestedAt).toLocaleString('ko-KR', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.placement === 'participant' ? (
                        <Badge style={{ backgroundColor: '#E8F5E9', color: '#2E7D32' }}>참석자</Badge>
                      ) : (
                        <Badge style={{ backgroundColor: '#FFF3E0', color: '#E65100' }}>대기자</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {selectedSchedule && (
          <div className={`grid ${isMobilePreview ? 'grid-cols-1' : 'md:grid-cols-2'} gap-4 mt-4`}>
            <div>
              <p className="text-xs text-gray-500 mb-2">불참 멤버</p>
              <div className="flex flex-wrap gap-2">
                {absentUsers.length > 0 ? (
                  absentUsers.map(member => (
                    <span
                      key={member.id}
                      className="px-2 py-1 bg-white border border-gray-200 rounded-md text-xs text-red-700"
                    >
                      {member.name}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">불참 없음</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">미응답 멤버</p>
              <div className="flex flex-wrap gap-2">
                {noResponseUsers.length > 0 ? (
                  noResponseUsers.map(member => (
                    <span
                      key={member.id}
                      className="px-2 py-1 bg-white border border-gray-200 rounded-md text-xs text-gray-600"
                    >
                      {member.name}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">미응답 없음</span>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
