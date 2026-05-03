import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Button } from '../ui/button.js';
import { UserRoundPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { MemberManagementProps } from './types.js';

export function MemberManagement({
  selectedSeason,
  onCreateMember,
  isMobilePreview,
}: MemberManagementProps) {
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberPhoneLast4, setNewMemberPhoneLast4] = useState<string>('');

  const handleCreateMember = () => {
    const name = newMemberName.trim();
    const phoneLast4 = newMemberPhoneLast4.trim();

    if (!name) {
      toast.error('신규 회원 이름을 입력해주세요');
      return;
    }

    if (!/^\d{4}$/.test(phoneLast4)) {
      toast.error('전화번호 뒷번호 4자리를 입력해주세요');
      return;
    }

    onCreateMember(selectedSeason, name, phoneLast4);
    setNewMemberName('');
    setNewMemberPhoneLast4('');
  };

  if (!selectedSeason) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRoundPlus className="w-5 h-5" style={{ color: '#030213' }} />
          신규 회원 추가
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`flex flex-col gap-3 ${isMobilePreview ? '' : 'sm:flex-row sm:items-end'}`}>
          <input
            id="newMemberName"
            name="newMemberName"
            type="text"
            className={`border rounded-md px-3 py-2 text-sm ${isMobilePreview ? 'w-full' : 'flex-1'}`}
            placeholder="회원 이름"
            value={newMemberName}
            onChange={e => setNewMemberName(e.target.value)}
            autoComplete="name"
          />
          <input
            id="newMemberPhoneLast4"
            name="newMemberPhoneLast4"
            type="text"
            className={`border rounded-md px-3 py-2 text-sm ${isMobilePreview ? 'w-full' : 'w-24'}`}
            placeholder="휴대폰 뒷자리 4자리"
            value={newMemberPhoneLast4}
            onChange={e => setNewMemberPhoneLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
            maxLength={4}
            autoComplete="tel"
          />
          <Button
            onClick={handleCreateMember}
            style={{ backgroundColor: '#030213', color: '#fff' }}
            className={isMobilePreview ? 'w-full' : ''}
          >
            회원 추가
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
