import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppData } from '../context/AppDataContext.js';
import { Card, CardContent, CardHeader } from '../components/ui/card.js';
import { Badge } from '../components/ui/badge.js';

export function SharedBracket() {
  const { doublesMatches, getUserById } = useAppData();
  const [searchParams] = useSearchParams();

  const shareDate = searchParams.get('date');
  const highlightPlayer = searchParams.get('player');

  // 다양한 date 포맷을 지원하는 날짜 비교 함수
  const isSameDay = (dateStr1: string, dateStr2: string) => {
    if (!dateStr1 || !dateStr2) return false;
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // 데이터 필터링 시 안정성 확보 (날짜 비교 개선)
  const confirmedMatches = doublesMatches.filter(
    (match: any) => match.isConfirmed && shareDate && isSameDay(match.date, shareDate)
  );

  // 날짜 포맷팅 함수 (예시: 2026-04-12 -> 26년 4월 12일)
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '날짜 정보 없음';
    const date = new Date(dateStr);
    
    // 요일 구하기
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = days[date.getDay()];

    return `${date.getFullYear().toString().slice(-2)}년 ${date.getMonth() + 1}월 ${date.getDate()}일(${dayName})`;
  };

  // 안전하게 사용자 데이터 매핑하는 헬퍼 함수
  const renderPlayerName = (id: string) => {
    const player = getUserById(id);
    const isHighlighted = highlightPlayer && player?.name === highlightPlayer;

    return (
      <p
        key={id}
        className="text-sm font-semibold leading-relaxed text-gray-900 break-words px-2 py-1 rounded w-max"
        style={isHighlighted ? { backgroundColor: '#FFC1CC' } : {}}
      >
        {player?.name || '알 수 없음'}
      </p>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">선레테 대진표</h1>
        </div>

        <div className="mb-8">
          {/* shareDate가 있을 때만 공지/날짜 영역 렌더링 */}
          {shareDate && confirmedMatches.length > 0 && (
            <div className="mb-6 rounded-xl border bg-white p-4">
              <div className="mb-4">
                <p className="text-base font-bold text-[#030213] mb-1">
                  {formatDate(shareDate)} 10-13시
                </p>
                <p className="text-base font-bold text-[#030213]">필킨스 실내 2층</p>
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <p>• 10시 20분까지 모두 몸풀고 게임시작 합니다.</p>
                <p>• 6점 선취, 5:5시 게임종료 해주세요.</p>
                <p>• 마지막 게임 후 먼저 귀가하셔도 됩니다.</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {confirmedMatches.length === 0 ? (
              <Card className="bg-[#F8F9FA] border-none shadow-none">
                <CardContent className="py-8 text-center">
                  <p className="text-sm font-medium text-gray-700">진행 중인 대진표가 없습니다</p>
                </CardContent>
              </Card>
            ) : (
              confirmedMatches.map((match: any, idx: number) => {
                const hasSavedScore = typeof match.scoreA === 'number' && typeof match.scoreB === 'number';

                return (
                  <Card key={match.id} className="border border-[#E5E7EB] shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-medium">
                            {idx + 1}경기
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-xl border bg-[#F8F9FA] px-4 py-4">
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
                          
                          {/* TEAM A */}
                          <div className="min-w-0 flex flex-col items-start">
                            <p className="text-[11px] font-semibold tracking-widest text-gray-400 mb-2">
                              TEAM A
                            </p>
                            <div className="space-y-1">
                              {match.teamA.map((id: string) => renderPlayerName(id))}
                            </div>
                          </div>

                          {/* VS or SCORE */}
                          <div className="grid grid-rows-[38px_1fr] px-2 min-w-[56px]">
                            <span aria-hidden="true" />
                            <div className="flex flex-col items-center justify-center min-h-full">
                              {hasSavedScore ? (
                                <>
                                  <div className="flex items-center gap-1 text-xl font-bold text-[#030213]">
                                    <span>{match.scoreA}</span>
                                    <span className="text-gray-300">:</span>
                                    <span>{match.scoreB}</span>
                                  </div>
                                  <span className="text-[11px] text-gray-400 mt-1">FINAL</span>
                                </>
                              ) : (
                                <span className="text-sm font-bold text-gray-400">VS</span>
                              )}
                            </div>
                          </div>

                          {/* TEAM B */}
                          <div className="min-w-0 flex flex-col items-end text-right">
                            <p className="text-[11px] font-semibold tracking-widest text-gray-400 mb-2">
                              TEAM B
                            </p>
                            <div className="space-y-1">
                              {match.teamB.map((id: string) => renderPlayerName(id))}
                            </div>
                          </div>

                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}