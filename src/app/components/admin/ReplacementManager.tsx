import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Button } from '../ui/button.js';
import { toast } from 'sonner';
import type { ReplacementManagerProps } from './types.js';

export function ReplacementManager({
  selectedSchedule,
  absentUsers,
  replacementCandidates,
  getUserById,
  onApplyReplacement,
  isMobilePreview,
}: ReplacementManagerProps) {
  const [absentUserId, setAbsentUserId] = useState<string>('');
  const [replacementMode, setReplacementMode] = useState<'member' | 'guest'>('member');
  const [replacementUserId, setReplacementUserId] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [guestGender, setGuestGender] = useState<'M' | 'F'>('F');

  const handleApplyReplacement = () => {
    if (!selectedSchedule || !absentUserId) {
      toast.error('불참자를 선택해주세요');
      return;
    }

    if (replacementMode === 'member') {
      if (!replacementUserId) {
        toast.error('대참할 멤버를 선택해주세요');
        return;
      }
      onApplyReplacement({
        absentUserId,
        replacementUserId,
        mode: 'member',
      });
    } else {
      if (!guestName.trim()) {
        toast.error('게스트 이름을 입력해주세요');
        return;
      }
      onApplyReplacement({
        absentUserId,
        replacementUserId: null,
        guestName: guestName.trim(),
        guestGender,
        mode: 'guest',
      });
    }

    setAbsentUserId('');
    setReplacementUserId('');
    setGuestName('');
    toast.success('참석자 편집이 반영되었습니다');
  };

  if (!selectedSchedule) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            대참자 관리
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">경기 일정을 선택하면 대참자 관리를 사용할 수 있습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          대참자 관리
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">불참자</p>
          <select
            id="absentUserId"
            name="absentUserId"
            className="border rounded-md px-3 py-2 text-sm w-full"
            value={absentUserId}
            onChange={e => setAbsentUserId(e.target.value)}
            autoComplete="off"
          >
            <option value="">불참자 선택</option>
            <option value="empty-slot">빈자리(미응답/미정)</option>
            {selectedSchedule.participants.map((id: string) => {
              const user = getUserById(id);
              return user ? (
                <option key={id} value={id}>{user.name}{user.isGuest ? ' (게스트)' : ''}</option>
              ) : null;
            })}
          </select>
        </div>

        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">대참 유형</p>
          <div className="flex gap-2">
            <button
              className="px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors"
              style={replacementMode === 'member' ? { backgroundColor: '#030213', color: '#fff', borderColor: '#030213' } : { backgroundColor: '#fff', color: '#374151', borderColor: '#D1D5DB' }}
              onClick={() => setReplacementMode('member')}
            >
              멤버
            </button>
            <button
              className="px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors"
              style={replacementMode === 'guest' ? { backgroundColor: '#030213', color: '#fff', borderColor: '#030213' } : { backgroundColor: '#fff', color: '#374151', borderColor: '#D1D5DB' }}
              onClick={() => setReplacementMode('guest')}
            >
              게스트
            </button>
          </div>
        </div>

        <div className={`flex flex-wrap gap-2 items-end ${isMobilePreview ? 'flex-col items-stretch' : ''}`}>
          {replacementMode === 'member' ? (
            <select
              id="replacementUserId"
              name="replacementUserId"
              className={`border rounded-md px-3 py-2 text-sm ${isMobilePreview ? 'w-full' : ''}`}
              value={replacementUserId}
              onChange={e => setReplacementUserId(e.target.value)}
              autoComplete="off"
            >
              <option value="">대참 멤버 선택</option>
              {replacementCandidates.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          ) : (
            <>
              <input
                id="guestName"
                name="guestName"
                type="text"
                className={`border rounded-md px-3 py-2 text-sm ${isMobilePreview ? 'w-full' : 'w-40'}`}
                placeholder="게스트 이름"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                autoComplete="name"
              />
              <select
                id="guestGender"
                name="guestGender"
                className={`border rounded-md px-3 py-2 text-sm ${isMobilePreview ? 'w-full' : ''}`}
                value={guestGender}
                onChange={e => setGuestGender(e.target.value as 'M' | 'F')}
                autoComplete="sex"
              >
                <option value="F">여성</option>
                <option value="M">남성</option>
              </select>
            </>
          )}
          <Button
            onClick={handleApplyReplacement}
            style={{ backgroundColor: '#FFC1CC', color: '#030213' }}
            className={isMobilePreview ? 'w-full' : ''}
          >
            대참 반영
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
