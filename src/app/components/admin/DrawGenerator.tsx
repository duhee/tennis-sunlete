import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Button } from '../ui/button.js';
import { Badge } from '../ui/badge.js';
import { Trophy, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { getWinRate } from '../../data/mockData.js';
import type { DrawGeneratorProps } from './types.js';
import type { User as UserType } from '../../data/mockData.js';

type ManualMatchDraft = {
  id: string;
  teamA: [string, string];
  teamB: [string, string];
};

const createManualDraft = (): ManualMatchDraft[] =>
  Array.from({ length: 6 }, (_, idx) => ({
    id: `g${idx + 1}`,
    teamA: ['', ''],
    teamB: ['', ''],
  }));

export function DrawGenerator({
  selectedSchedule,
  generatedBracket,
  bracketConfirmed,
  validation,
  qualityReport,
  onGenerateDraw,
  onApplyManualBracket,
  onConfirmBracket,
  getUserById,
  isMobilePreview,
}: DrawGeneratorProps) {
  const [isManualMode, setIsManualMode] = React.useState(false);
  const [manualDraft, setManualDraft] = React.useState<ManualMatchDraft[]>(() => createManualDraft());

  React.useEffect(() => {
    setManualDraft(createManualDraft());
    setIsManualMode(false);
  }, [selectedSchedule?.id]);

  const validationItems = [
    { label: '일정 선택', passed: validation.scheduleSelected },
    { label: '일정 상태 확인 (대기중 또는 과거 일정)', passed: validation.statusCondition },
    { label: '참석자 수 6명 이상', passed: validation.participantCount },
  ];

  const participantUsers = (selectedSchedule?.participants ?? [])
    .map(id => getUserById(id))
    .filter(Boolean) as UserType[];

  const updateManualSlot = (
    matchIdx: number,
    team: 'teamA' | 'teamB',
    slotIdx: 0 | 1,
    value: string
  ) => {
    setManualDraft(prev =>
      prev.map((match, idx) => {
        if (idx !== matchIdx) return match;
        const updatedTeam: [string, string] = [...match[team]] as [string, string];
        updatedTeam[slotIdx] = value;
        return { ...match, [team]: updatedTeam };
      })
    );
  };

  const applyManualDraft = () => {
    if (!selectedSchedule) {
      toast.error('경기 일정을 먼저 선택해주세요');
      return;
    }

    const participantSet = new Set(selectedSchedule.participants);
    for (const match of manualDraft) {
      const members = [...match.teamA, ...match.teamB];
      if (members.some(id => !id)) {
        toast.error(`${match.id.toUpperCase()} 경기의 선수를 모두 선택해주세요`);
        return;
      }

      if (new Set(members).size !== 4) {
        toast.error(`${match.id.toUpperCase()} 경기에서 중복 선수가 있습니다`);
        return;
      }

      if (!members.every(id => participantSet.has(id))) {
        toast.error(`${match.id.toUpperCase()} 경기의 선수가 현재 참가자가 아닙니다`);
        return;
      }
    }

    onApplyManualBracket(
      manualDraft.map(match => ({
        id: match.id,
        teamA: [...match.teamA],
        teamB: [...match.teamB],
      }))
    );
    setIsManualMode(false);
  };

  if (generatedBracket.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" style={{ color: '#030213' }} />
            대진표 생성
          </CardTitle>
        </CardHeader>
        <CardContent>
          {qualityReport && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs font-semibold text-gray-600">대진 품질 검증 결과</p>
                <div className="flex items-center gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className={qualityReport.requiredPassed ? 'border-green-500 text-green-700' : 'border-red-400 text-red-600'}
                  >
                    엄선 {qualityReport.requiredPassedCount}/{qualityReport.requiredTotal}
                  </Badge>
                  <Badge variant="outline" className="border-sky-400 text-sky-700">
                    베스트 {qualityReport.bestPassedCount}/{qualityReport.bestTotal}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1.5">
                {qualityReport.items.map(item => (
                  <div key={item.key} className="flex items-start justify-between gap-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-700">{item.label}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {item.tier}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{item.detail}</p>
                    </div>
                    <span className={item.passed ? 'text-green-600 font-semibold text-xs' : 'text-red-500 font-semibold text-xs'}>
                      {item.passed ? '통과' : '미통과'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-xs font-semibold text-gray-600">대진 생성 조건 검증</p>
            <div className="space-y-1.5">
              {validationItems.map(item => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{item.label}</span>
                  <span className={item.passed ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                    {item.passed ? '통과' : '미충족'}
                  </span>
                </div>
              ))}
            </div>
            {validation.statusMessage && (
              <p className="mt-2 text-xs text-red-500">{validation.statusMessage}</p>
            )}
          </div>

          {selectedSchedule ? (
            <div className="space-y-3">
              <div className={`flex ${isMobilePreview ? 'flex-col' : 'flex-row'} gap-2`}>
                <Button
                  variant={isManualMode ? 'default' : 'outline'}
                  className={isMobilePreview ? 'w-full' : ''}
                  onClick={() => setIsManualMode(prev => !prev)}
                >
                  {isManualMode ? '직접 작성 닫기' : '대진 직접 작성'}
                </Button>
                {isManualMode && (
                  <Button
                    variant="outline"
                    className={isMobilePreview ? 'w-full' : ''}
                    onClick={() => setManualDraft(createManualDraft())}
                  >
                    입력 초기화
                  </Button>
                )}
              </div>

              {isManualMode && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
                  <p className="text-xs font-semibold text-gray-600">직접 대진 작성 (6경기)</p>
                  {manualDraft.map((match, matchIdx) => (
                    <div key={match.id} className="rounded-md border bg-white p-2">
                      <p className="mb-2 text-xs font-medium text-gray-600">{matchIdx + 1}경기</p>
                      <div className={`grid ${isMobilePreview ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">Team A</p>
                          <select
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                            value={match.teamA[0]}
                            onChange={e => updateManualSlot(matchIdx, 'teamA', 0, e.target.value)}
                          >
                            <option value="">선수 선택</option>
                            {participantUsers.map(user => (
                              <option key={`${match.id}-a0-${user.id}`} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                          </select>
                          <select
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                            value={match.teamA[1]}
                            onChange={e => updateManualSlot(matchIdx, 'teamA', 1, e.target.value)}
                          >
                            <option value="">선수 선택</option>
                            {participantUsers.map(user => (
                              <option key={`${match.id}-a1-${user.id}`} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">Team B</p>
                          <select
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                            value={match.teamB[0]}
                            onChange={e => updateManualSlot(matchIdx, 'teamB', 0, e.target.value)}
                          >
                            <option value="">선수 선택</option>
                            {participantUsers.map(user => (
                              <option key={`${match.id}-b0-${user.id}`} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                          </select>
                          <select
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                            value={match.teamB[1]}
                            onChange={e => updateManualSlot(matchIdx, 'teamB', 1, e.target.value)}
                          >
                            <option value="">선수 선택</option>
                            {participantUsers.map(user => (
                              <option key={`${match.id}-b1-${user.id}`} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    className={isMobilePreview ? 'w-full' : ''}
                    style={{ backgroundColor: '#030213', color: '#fff' }}
                    onClick={applyManualDraft}
                  >
                    직접 작성 대진 적용
                  </Button>
                </div>
              )}

              <Button
                onClick={onGenerateDraw}
                style={{ backgroundColor: '#030213', color: '#fff' }}
                className={isMobilePreview ? 'w-full' : ''}
                disabled={!validation.scheduleSelected || !validation.statusCondition || !validation.participantCount}
              >
                대진 생성
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">경기 일정을 선택하면 대진표를 생성할 수 있습니다.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-2 transition-colors" style={{ borderColor: bracketConfirmed ? '#4CAF50' : '#FFC1CC' }}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            {bracketConfirmed ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <Trophy className="w-5 h-5" style={{ color: '#030213' }} />
            )}
            {selectedSchedule && new Date(selectedSchedule.date).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })}
            {/* 대진 타입 뱃지 제거 */}
            {bracketConfirmed && (
              <Badge className="ml-1 text-xs" style={{ backgroundColor: '#4CAF50', color: 'white' }}>
                확정됨
              </Badge>
            )}
          </CardTitle>

          {!bracketConfirmed && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onGenerateDraw}
                className="flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                다시 생성
              </Button>
              <Button
                size="sm"
                onClick={onConfirmBracket}
                style={{ backgroundColor: '#FFC1CC', color: '#030213' }}
                className="flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3" />
                대진 확정
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {qualityReport && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-semibold text-gray-600">대진 품질 검증 결과</p>
              <div className="flex items-center gap-2 text-xs">
                <Badge
                  variant="outline"
                  className={qualityReport.requiredPassed ? 'border-green-500 text-green-700' : 'border-red-400 text-red-600'}
                >
                  엄선 {qualityReport.requiredPassedCount}/{qualityReport.requiredTotal}
                </Badge>
                <Badge variant="outline" className="border-sky-400 text-sky-700">
                  베스트 {qualityReport.bestPassedCount}/{qualityReport.bestTotal}
                </Badge>
              </div>
            </div>
            <div className="space-y-1.5">
              {qualityReport.items.map(item => (
                <div key={item.key} className="flex items-start justify-between gap-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-700">{item.label}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {item.tier}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{item.detail}</p>
                  </div>
                  <span className={item.passed ? 'text-green-600 font-semibold text-xs' : 'text-red-500 font-semibold text-xs'}>
                    {item.passed ? '통과' : '미통과'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-4">
          {generatedBracket.map((match, idx) => {
            const teamA = match.teamA.map(id => getUserById(id)).filter(Boolean) as UserType[];
            const teamB = match.teamB.map(id => getUserById(id)).filter(Boolean) as UserType[];

            const allPlayers = [...teamA, ...teamB];
            const nonGuestAvgRate = (() => {
              const ng = allPlayers.filter(p => !p.isGuest);
              return ng.length > 0 ? ng.reduce((s, p) => s + getWinRate(p), 0) / ng.length : 50;
            })();
            const effectiveRate = (p: UserType) => (p.isGuest ? nonGuestAvgRate : getWinRate(p));

            const avgA = Math.round(teamA.reduce((sum, p) => sum + effectiveRate(p), 0) / teamA.length);
            const avgB = Math.round(teamB.reduce((sum, p) => sum + effectiveRate(p), 0) / teamB.length);
            const isBalanced = Math.abs(avgA - avgB) <= 10;
            const isMixed = (team: UserType[]) =>
              team.some(p => p.gender === 'F' || p.gender === 'W') && team.some(p => p.gender === 'M');
            const isAllFemale = (team: UserType[]) => team.every(p => p.gender === 'F' || p.gender === 'W');
            const isAllMale = (team: UserType[]) => team.every(p => p.gender === 'M');
            const getMatchTypeLabel = () => {
              if (isMixed(teamA) && isMixed(teamB)) return '혼복';
              if (isAllFemale(teamA) && isAllFemale(teamB)) return '여복';
              if (isAllMale(teamA) && isAllMale(teamB)) return '남복';
              return '혼복';
            };

            return (
              <div key={match.id} className="p-4 rounded-xl border bg-gray-50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-gray-700">{idx + 1}경기</span>
                  <Badge
                    className="text-xs py-0"
                    style={
                      isBalanced
                        ? { backgroundColor: '#E8F5E9', color: '#2E7D32' }
                        : { backgroundColor: '#FFF3E0', color: '#E65100' }
                    }
                  >
                    {isBalanced ? '균형' : '불균형'}
                  </Badge>
                  <Badge className="text-xs py-0" variant="outline">
                      {getMatchTypeLabel()}
                    </Badge>
                </div>

                <div className={`flex ${isMobilePreview ? 'flex-col' : 'flex-row items-stretch'} gap-3`}>
                  <div className="flex-1 p-3 bg-white rounded-lg border">
                    <div className="text-xs text-gray-400 text-center mb-2">
                      Team A · 평균 <span className="font-semibold">{avgA}%</span>
                    </div>
                    {teamA.map(player => (
                      <div key={player.id} className="flex items-center justify-between px-1 py-1">
                        <span className="text-sm font-medium">
                          {player.name}
                          {player.isGuest && <span className="ml-1 text-xs text-gray-400">(게스트)</span>}
                        </span>
                        {player.isGuest ? (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
                          >
                            경력미상
                          </span>
                        ) : (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{
                              backgroundColor: getWinRate(player) >= 70 ? '#FFE0E6' : '#F5F5F5',
                              color: getWinRate(player) >= 70 ? '#C62828' : '#666',
                            }}
                          >
                            {getWinRate(player)}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-400">VS</span>
                  </div>

                  <div className="flex-1 p-3 bg-white rounded-lg border">
                    <div className="text-xs text-gray-400 text-center mb-2">
                      Team B · 평균 <span className="font-semibold">{avgB}%</span>
                    </div>
                    {teamB.map(player => (
                      <div key={player.id} className="flex items-center justify-between px-1 py-1">
                        <span className="text-sm font-medium">
                          {player.name}
                          {player.isGuest && <span className="ml-1 text-xs text-gray-400">(게스트)</span>}
                        </span>
                        {player.isGuest ? (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
                          >
                            경력미상
                          </span>
                        ) : (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{
                              backgroundColor: getWinRate(player) >= 70 ? '#FFE0E6' : '#F5F5F5',
                              color: getWinRate(player) >= 70 ? '#C62828' : '#666',
                            }}
                          >
                            {getWinRate(player)}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
