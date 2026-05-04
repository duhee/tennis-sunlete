import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Badge } from '../ui/badge.js';
import { getScheduleDateKey, toDateKey } from './scheduleUtils.js';
import { getScheduleStatus, seasonCodeToLabel } from '../../data/mockData.js';
import { useAppData } from '../../context/AppDataContext.js';
import { toast } from 'sonner';
import type { ScheduleSelectorProps } from './types.js';
import type { User } from '../../data/mockData.js';

export function ScheduleSelector({
  schedules,
  selectedScheduleId,
  onSelectSchedule,
  showClosedPastSchedules,
  onToggleShowClosed,
  isMobilePreview,
}: ScheduleSelectorProps) {
  const { users } = useAppData();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const todayKey = (() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  })();

  const sortedSchedules = [...schedules].sort((a, b) =>
    getScheduleDateKey(a).localeCompare(getScheduleDateKey(b))
  );

  const pastClosedSchedules = sortedSchedules.filter(
    s => getScheduleStatus(s) === 'closed' && getScheduleDateKey(s) < todayKey
  );

  const primarySchedules = sortedSchedules.filter(
    s => !(getScheduleStatus(s) === 'closed' && getScheduleDateKey(s) < todayKey)
  );

  const schedulesForPicker = showClosedPastSchedules
    ? [...primarySchedules, ...pastClosedSchedules]
    : primarySchedules;

  useEffect(() => {
    if (!selectedScheduleId) return;

    const container = scrollRef.current;
    const target = buttonRefs.current[selectedScheduleId];
    if (!container || !target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextLeft =
      container.scrollLeft +
      (targetRect.left - containerRect.left) -
      (containerRect.width - targetRect.width) / 2;

    container.scrollTo({ left: Math.max(0, nextLeft), behavior: 'smooth' });
  }, [selectedScheduleId, schedulesForPicker]);

  // 3주치만 '참석 접수중', 그 이전은 '접수 대기'
  const isAttendanceOpen = (schedule: any) => {
    if (!schedule.attendanceDeadline) return false;
    const now = new Date();
    const deadline = new Date(schedule.attendanceDeadline);
    return now >= deadline;
  };

  // 3주치만 '참석 접수중'으로 표시
  const isWithinNext3Weeks = (schedule: any) => {
    if (!schedule.date) return false;
    const now = new Date();
    const matchDate = new Date(schedule.date + 'T00:00:00+09:00');
    const diff = (matchDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7);
    return diff >= 0 && diff < 3;
  };

  const getStatusLabel = (status: string, schedule: any) => {
    if (status === 'open') {
      if (isAttendanceOpen(schedule)) {
        return '참석 접수중';
      } else if (isWithinNext3Weeks(schedule)) {
        return '참석 접수중';
      } else {
        return '접수 대기';
      }
    }
    switch (status) {
      case 'draw_waiting':
        return '대진표 생성 대기중';
      case 'closed':
        return '마감';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string, schedule: any) => {
    if (status === 'open') {
      if (isAttendanceOpen(schedule) || isWithinNext3Weeks(schedule)) {
        return { backgroundColor: '#E8F5E9', color: '#2E7D32' };
      } else {
        return { backgroundColor: '#F5F5F5', color: '#999' };
      }
    }
    switch (status) {
      case 'draw_waiting':
        return { backgroundColor: '#FFF3E0', color: '#E65100' };
      case 'closed':
        return { backgroundColor: '#F5F5F5', color: '#666' };
      default:
        return {};
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>
          <div className="flex items-center justify-between w-full">
            <span className="flex-1 flex items-center">경기 일정 선택</span>
            {pastClosedSchedules.length > 0 && (
              <button
                onClick={() => onToggleShowClosed(!showClosedPastSchedules)}
                className="text-xs text-gray-500 hover:underline flex items-center"
                style={{ minHeight: '2rem' }}
              >
                {showClosedPastSchedules ? '과거 일정 숨기기' : `과거 일정 보기 (${pastClosedSchedules.length})`}
              </button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          ref={scrollRef}
          className="overflow-x-auto pb-2 px-6 flex gap-4 snap-x snap-mandatory scrollbar-thin-light"
          style={{
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {schedulesForPicker.map(schedule => {
            const status = getScheduleStatus(schedule);
            const dateKey = getScheduleDateKey(schedule);
            const isPast = dateKey < todayKey;
            const dateStr = new Date(schedule.date || schedule.attendanceDeadline || '').toLocaleDateString(
              'ko-KR',
              {
                month: 'short',
                day: 'numeric',
                weekday: 'short',
              }
            );
            const seasonCode = (() => {
              if (schedule.seasonCode) return schedule.seasonCode;
              const idMatch = (schedule.id || '').match(/^(\d{2}S[1-4])-w\d+$/);
              if (idMatch) return idMatch[1];
              return undefined;
            })();

            // 참석 인원 집계
            const totalConfirmed = schedule.participants.length;
            let male = 0, female = 0, guest = 0;
            schedule.participants.forEach((uid: string) => {
              const user = users.find((u: User) => u.id === uid);
              if (!user) return;
              if (user.isGuest) guest++;
              else if (user.gender === 'F') female++;
              else male++;
            });

            return (
              <button
                key={schedule.id}
                ref={el => {
                  buttonRefs.current[schedule.id] = el;
                }}
                onClick={() => onSelectSchedule(schedule.id)}
                className={`flex-shrink-0 snap-start rounded-lg border-2 px-4 py-3 text-center transition-all ${
                  selectedScheduleId === schedule.id
                    ? 'border-[#030213] bg-[#030213] text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                }`}
                style={{ minWidth: 180 }}
              >
                {/* 일정(날짜) + 시즌 라벨: ? 버튼 클릭 시 토스트 */}
                <div className="flex items-center justify-center text-base font-bold mb-1">
                  {dateStr}
                </div>
                {/* 접수 상태 라벨 */}
                <div className="mb-1">
                  <Badge
                    variant="outline"
                    className="text-xs py-0"
                    style={
                      selectedScheduleId === schedule.id
                        ? { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }
                        : getStatusColor(status, schedule)
                    }
                  >
                    {getStatusLabel(status, schedule)}
                  </Badge>
                </div>
                {/* 참석 인원 요약 */}
                <div className="text-xs mt-1">
                  참석 여 {female}명 / 남 {male}명{guest > 0 ? ` / 게스트 ${guest}명` : ''} (총 {totalConfirmed}명)
                </div>
                {isPast && (
                  <div className="text-xs text-gray-400 mt-1">과거 일정</div>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
