import React from 'react';
import { Card, CardContent } from '../ui/card.js';
import { Badge } from '../ui/badge.js';
import { seasonCodeToLabel } from '../../data/mockData.js';
import type { ScheduleInfoProps } from './types.js';

export function ScheduleInfo({
  schedule,
  status,
  seasonCode,
  seasonMembers,
  maxParticipants,
  isMobilePreview,
}: ScheduleInfoProps) {
  const statusLabel =
    status === 'open'
      ? '참석 접수중'
      : status === 'draw_waiting'
        ? '대진표 생성 대기중'
        : '마감';

  if (!schedule) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">{statusLabel}</Badge>
          {seasonCode && (
            <Badge variant="outline">기준 시즌 {seasonCodeToLabel(seasonCode)}</Badge>
          )}
          <Badge variant="outline">대상 멤버 {seasonMembers.length}명</Badge>
          <span className="text-gray-400">
            참석 {schedule.participants.length ?? 0}/{maxParticipants ?? 0}명 · 대기 {schedule.waitlist.length ?? 0}명
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
