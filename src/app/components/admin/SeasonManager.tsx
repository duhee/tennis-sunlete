import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Button } from '../ui/button.js';
import { ChevronDown, ChevronRight, UserRoundPlus } from 'lucide-react';
import { toast } from 'sonner';
import { seasonCodeToLabel } from '../../data/mockData.js';
import { SEASON_OPTIONS } from './types.js';
import type { SeasonManagerProps } from './types.js';

export function SeasonManager({
  memberUsers,
  allSeasons,
  selectedSeason,
  seasonMemberDrafts,
  seasonTotalSessionsDraft,
  onSelectSeason,
  onAddSeason,
  onToggleMember,
  onSaveSeason,
  onCreateMember,
  onTotalSessionsChange,
  isMobilePreview,
}: SeasonManagerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllMembersForSeason, setShowAllMembersForSeason] = useState<boolean>(false);
  const [newSeasonSelect, setNewSeasonSelect] = useState<string>('');
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberPhoneLast4, setNewMemberPhoneLast4] = useState<string>('');

  const selectedSeasonMembers = selectedSeason
    ? (seasonMemberDrafts[selectedSeason] ?? [])
        .map(id => memberUsers.find(user => user.id === id))
        .filter(Boolean)
    : [];

  const handleAddSeason = () => {
    if (!newSeasonSelect) return;
    onAddSeason(newSeasonSelect);
    onSelectSeason(newSeasonSelect);
    setNewSeasonSelect('');
    // 기존 멤버 데이터에서 total_sessions 초기값 로드
    onTotalSessionsChange(newSeasonSelect, '0');
  };

  const handleCreateMember = () => {
    if (!selectedSeason) {
      toast.error('시즌을 먼저 선택해주세요');
      return;
    }

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

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>회원 활동 시즌 설정</CardTitle>
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
        {/* Season tabs + add */}
        <div className="flex flex-wrap gap-2 mb-4">
          {allSeasons.map((s: string) => (
            <button
              key={s}
              onClick={() => {
                onSelectSeason(s);
                // 시즌 선택 시 total_sessions 초기값 로드
                if (!seasonTotalSessionsDraft[s]) {
                  const existing = memberUsers.find((u: any) => (u.activeSeasons ?? []).includes(s));
                  const val = existing?.seasonStats?.find((st: any) => st.seasonCode === s)?.total_sessions ?? 0;
                  onTotalSessionsChange(s, String(val));
                }
              }}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                selectedSeason === s
                  ? 'bg-[#030213] text-white border-[#030213]'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
              }`}
            >
              {seasonCodeToLabel(s)}
            </button>
          ))}
          <div className="flex gap-1">
            <select
              id="newSeasonSelect"
              name="newSeasonSelect"
              value={newSeasonSelect}
              onChange={e => setNewSeasonSelect(e.target.value)}
              autoComplete="off"
              className="rounded-md border border-gray-200 px-2 py-1 text-sm"
            >
              <option value="">시즌 선택</option>
              {SEASON_OPTIONS.filter((s: string) => !allSeasons.includes(s)).map((s: string) => (
                <option key={s} value={s}>
                  {seasonCodeToLabel(s)}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={handleAddSeason} disabled={!newSeasonSelect}>
              추가
            </Button>
          </div>
        </div>

        {/* Members for selected season */}
        {selectedSeason ? (
          <div>
            {/* 시즌 총 회차 입력 */}
            <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
              <label htmlFor="season-total-sessions" className="text-sm font-medium whitespace-nowrap">
                시즌 총 회차
              </label>
              <input
                id="season-total-sessions"
                name="seasonTotalSessions"
                type="number"
                min="0"
                autoComplete="off"
                className="w-24 border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                value={seasonTotalSessionsDraft[selectedSeason] ?? '0'}
                onChange={e => onTotalSessionsChange(selectedSeason, e.target.value)}
              />
              <span className="text-xs text-gray-400">
                이 시즌에 진행된 전체 경기 횟수 (저장 시 전체 멤버에 반영)
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              <span className="font-semibold text-[#030213]">{seasonCodeToLabel(selectedSeason)}</span> 시즌에 활동한
              멤버를 선택하세요
            </p>

            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-2">현재 선택된 멤버 ({selectedSeasonMembers.length}명)</p>
              {selectedSeasonMembers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedSeasonMembers.map(member => (
                    <button
                      key={member.id}
                      onClick={() => onToggleMember(selectedSeason, member.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2 py-1 text-xs text-[#030213]"
                    >
                      {member.name}
                      <span className="text-gray-400">x</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">선택된 멤버가 없습니다.</p>
              )}
            </div>

            <div className="mb-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAllMembersForSeason(prev => !prev)}
              >
                {showAllMembersForSeason ? '전체 회원 목록 닫기' : '전체 회원 목록에서 선택'}
              </Button>
            </div>

            {showAllMembersForSeason && (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {memberUsers.map((member: any) => {
                  const checked = (seasonMemberDrafts[selectedSeason] ?? []).includes(member.id);
                  return (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        id={`season-member-${selectedSeason}-${member.id}`}
                        name={`season-member-${selectedSeason}`}
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleMember(selectedSeason, member.id)}
                        className="h-4 w-4 accent-[#030213]"
                      />
                      <span className="text-sm font-medium text-[#030213]">{member.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <Button onClick={() => onSaveSeason(selectedSeason)}>
                {seasonCodeToLabel(selectedSeason)} 저장
              </Button>
            </div>

            <div className="mt-6 border-t pt-4">
              <div className="mb-3 flex items-center gap-2">
                <UserRoundPlus className="w-4 h-4" style={{ color: '#030213' }} />
                <p className="text-sm font-semibold text-[#030213]">신규 회원 추가</p>
              </div>
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
                  className={`border rounded-md px-3 py-2 text-sm ${isMobilePreview ? 'w-full' : 'w-28'}`}
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
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">시즌을 선택하거나 새 시즌을 추가하세요</p>
        )}
      </CardContent>}
    </Card>
  );
}
