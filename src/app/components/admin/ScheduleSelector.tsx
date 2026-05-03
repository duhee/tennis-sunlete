import React, { useEffect, useRef } from 'react';
import { Card, CardContent } from '../ui/card.js';
import { Badge } from '../ui/badge.js';
import { getScheduleDateKey, toDateKey } from './scheduleUtils.js';
import { getScheduleStatus, seasonCodeToLabel } from '../../data/mockData.js';
import type { ScheduleSelectorProps } from './types.js';

export function ScheduleSelector({
  schedules,
  selectedScheduleId,
  onSelectSchedule,
  showClosedPastSchedules,
  onToggleShowClosed,
  isMobilePreview,
}: ScheduleSelectorProps) {
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return '참석 접수중';
      case 'draw_waiting':
        return '대진표 생성 대기중';
      case 'closed':
        return '마감';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return { backgroundColor: '#E8F5E9', color: '#2E7D32' };
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
      <CardContent className="pt-6">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">경기 일정 선택</p>
          {pastClosedSchedules.length > 0 && (
            <button
              onClick={() => onToggleShowClosed(!showClosedPastSchedules)}
              className="text-xs text-gray-500 hover:underline"
            >
              {showClosedPastSchedules ? '과거 일정 숨기기' : `과거 일정 보기 (${pastClosedSchedules.length})`}
            </button>
          )}
        </div>
        <div
          ref={scrollRef}
          className="overflow-x-auto pb-2 -mx-6 px-6 flex gap-2 snap-x snap-mandatory scrollbar-hide"
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
              >
                <div className="text-sm font-semibold">{dateStr}</div>
                <div className="text-xs mt-1">
                  {seasonCode && <span>{seasonCodeToLabel(seasonCode)} </span>}
                  <Badge
                    variant="outline"
                    className="text-xs py-0"
                    style={
                      selectedScheduleId === schedule.id
                        ? { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }
                        : getStatusColor(status)
                    }
                  >
                    {getStatusLabel(status)}
                  </Badge>
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
