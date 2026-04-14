import React from 'react';
import { useSearchParams } from 'react-router';
import { useAppData } from '../context/AppDataContext';
import { PageLayout } from '../components/PageLayout';
import {
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

export function SharedBracket() {
  const {
    doublesMatches,
    getUserById,
  } = useAppData();

  const [searchParams] = useSearchParams();
  const shareDate = searchParams.get('date');
  const highlightPlayer = searchParams.get('player');

  const confirmedMatches = doublesMatches.filter(match => match.isConfirmed && match.date === shareDate);
  const confirmedDate = confirmedMatches[0]?.date;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto p-6">
        <div className="mb-6">
          <div>
            <h1 className="text-2xl font-bold">선레테 대진표</h1>
          </div>
        </div>

        <div className="mb-8">
          {confirmedDate && (
            <div className="mb-6 rounded-xl border bg-white p-4">
              <div className="mb-4">
                <p className="text-base font-bold text-[#030213] mb-1">26년 4월 12일(일) 10-13시</p>
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
            {confirmedMatches.length === 0 && (
              <Card style={{ backgroundColor: '#F8F9FA' }}>
                <CardContent className="py-8 text-center">
                  <p className="text-sm font-medium text-gray-700">대진표가 없습니다</p>
                </CardContent>
              </Card>
            )}

            {confirmedMatches.map((match, idx) => {
              const teamAUsers = match.teamA.map(id => getUserById(id)).filter(Boolean);
              const teamBUsers = match.teamB.map(id => getUserById(id)).filter(Boolean);
              const hasSavedScore = typeof match.scoreA === 'number' && typeof match.scoreB === 'number';

              return (
                <Card
                  key={match.id}
                  className="border"
                  style={{ borderColor: '#E5E7EB' }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-medium">{idx + 1}경기</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-xl border bg-white px-4 py-4">
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold tracking-widest text-gray-400 mb-2">TEAM A</p>
                          <div className="space-y-1">
                            {teamAUsers.map(player => (
                              <p 
                                key={player!.id} 
                                className="text-sm font-semibold leading-relaxed text-gray-900 break-words px-2 py-1 rounded"
                                style={highlightPlayer && player!.name === highlightPlayer ? { backgroundColor: '#FFC1CC' } : {}}
                              >
                                {player!.name}
                              </p>
                            ))}
                          </div>
                        </div>

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

                        <div className="min-w-0 text-right">
                          <p className="text-[11px] font-semibold tracking-widest text-gray-400 mb-2">TEAM B</p>
                          <div className="space-y-1">
                            {teamBUsers.map(player => (
                              <p 
                                key={player!.id} 
                                className="text-sm font-semibold leading-relaxed text-gray-900 break-words px-2 py-1 rounded"
                                style={highlightPlayer && player!.name === highlightPlayer ? { backgroundColor: '#FFC1CC' } : {}}
                              >
                                {player!.name}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
