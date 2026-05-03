// index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- [타입 정의] ---
interface Player {
  id: string;
  name: string;
  gender: 'M' | 'F' | 'W';
  winRate: number;
  isGuest: boolean;
}

interface Match {
  id: string;
  teamA: string[];
  teamB: string[];
  rest: string[];
}

interface GenerateRequest {
  players: Player[];
}

// --- [대진 검증 로직] ---
function evaluateBracketQuality(matches: Match[], players: Player[]): any {
  const participantIds = players.map(p => p.id);
  const totalMatches = matches.length;
  const appearanceCount: Record<string, number> = {};
  const restCount: Record<string, number> = {};
  const appearanceTimeline: Record<string, boolean[]> = {};
  const restTimeline: Record<string, boolean[]> = {};
  const partnerFrequency: Record<string, number> = {}; // 동일 파트너 횟수 추적

  participantIds.forEach(id => {
    appearanceCount[id] = 0;
    restCount[id] = 0;
    appearanceTimeline[id] = [];
    restTimeline[id] = [];
  });
  const matchSignatures: string[] = [];
  const restPairSignatures: string[] = [];
  const teamPairSignatures: string[] = [];
  const opponentPairs = new Set<string>();

  // [추가] 여성 기준 혼복 파트너 중복 검증을 위한 상태
  const femalePlayers = players.filter(p => p.gender !== 'M');
  const femaleMixedPartnerRecords: Record<string, string[]> = {};
  femalePlayers.forEach(f => femaleMixedPartnerRecords[f.id] = []);

  for (const match of matches) {
    const active = [...match.teamA, ...match.teamB].filter(id => participantIds.includes(id));
    const activeUnique = Array.from(new Set(active));
    matchSignatures.push(activeUnique.sort().join('|'));
    
    participantIds.forEach(id => {
      const appeared = activeUnique.includes(id);
      appearanceTimeline[id].push(appeared);
      restTimeline[id].push(!appeared);
      if (appeared) appearanceCount[id]++;
      else restCount[id]++;
    });
    
    const rests = participantIds.filter(id => !activeUnique.includes(id));
    restPairSignatures.push(rests.sort().join('|'));
    
    // [수정] 팀 구성 확인 시 혼복 파트너 기록
    [match.teamA, match.teamB].forEach(team => {
      if (team.length === 2) {
        const pair = [...team].sort().join('|');
        teamPairSignatures.push(pair);
        partnerFrequency[pair] = (partnerFrequency[pair] || 0) + 1;

        const p1 = players.find(p => p.id === team[0]);
        const p2 = players.find(p => p.id === team[1]);
        
        if (p1 && p2) {
          // 한 명은 여성, 한 명은 남성인 경우(혼복) 기록
          if (p1.gender !== 'M' && p2.gender === 'M') {
            femaleMixedPartnerRecords[p1.id].push(p2.id);
          } else if (p2.gender !== 'M' && p1.gender === 'M') {
            femaleMixedPartnerRecords[p2.id].push(p1.id);
          }
        }
      }
    });

    if (match.teamA.length === 2 && match.teamB.length === 2) {
      for (const a of match.teamA) for (const b of match.teamB) opponentPairs.add([a, b].sort().join('|'));
    }
  }

  const uniqueMatchSet = new Set(matchSignatures);
  const allMatchesHave4UniquePlayers = matches.every(match => {
    const active = [...match.teamA, ...match.teamB].filter(id => participantIds.includes(id));
    return new Set(active).size === 4;
  });
  
  const allUnique4PlayerCompositions = totalMatches === 6 && allMatchesHave4UniquePlayers && uniqueMatchSet.size === totalMatches;
  const uniqueRestPairs = new Set(restPairSignatures.filter(sig => sig.split('|').filter(Boolean).length === 2));
  const allRestPairsSizeTwo = restPairSignatures.every(sig => sig.split('|').filter(Boolean).length === 2);
  const allUniqueRestPairs = totalMatches === 6 && allRestPairsSizeTwo && uniqueRestPairs.size === totalMatches;
  const everyonePlayed4 = participantIds.length > 0 && participantIds.every(id => appearanceCount[id] === 4);
  const everyoneRested2 = participantIds.length > 0 && participantIds.every(id => restCount[id] === 2);
  
  const noConsecutive4Appearances = participantIds.every(id => {
    const timeline = appearanceTimeline[id] ?? [];
    for (let i = 0; i <= timeline.length - 4; i++) {
      if (timeline[i] && timeline[i + 1] && timeline[i + 2] && timeline[i + 3]) return false;
    }
    return true;
  });

  const noConsecutiveTwoRests = participantIds.every(id => {
    const timeline = restTimeline[id] ?? [];
    for (let i = 0; i <= timeline.length - 2; i++) {
      if (timeline[i] && timeline[i + 1]) return false;
    }
    return true;
  });

  const uniqueTeamPairs = new Set(teamPairSignatures);
  const noDuplicatePairs = uniqueTeamPairs.size === teamPairSignatures.length;
  
  // 파트너 겹침 최대 2회 검증
  const maxPartnerFrequency = Object.keys(partnerFrequency).length > 0 ? Math.max(...Object.values(partnerFrequency)) : 0;
  const partnerLimitPassed = maxPartnerFrequency <= 2;

  // [추가] 여성 기준 혼복 남성 파트너 중복 검증 로직 마무리
  let hasDuplicateMixedPartner = false;
  femalePlayers.forEach(f => {
    const partners = femaleMixedPartnerRecords[f.id];
    const uniquePartners = new Set(partners);
    if (uniquePartners.size !== partners.length) {
      hasDuplicateMixedPartner = true;
    }
  });
  const mixedPartnerUnique = !hasDuplicateMixedPartner;

  const allParticipantPairs: string[] = [];
  for (let i = 0; i < participantIds.length; i++) {
    for (let j = i + 1; j < participantIds.length; j++) {
      allParticipantPairs.push([participantIds[i], participantIds[j]].sort().join('|'));
    }
  }
  const allOpposedAtLeastOnce = allParticipantPairs.length > 0 && allParticipantPairs.every(pair => opponentPairs.has(pair));
  
  const baseAverageWinRate = (() => {
    const nonGuests = players.filter(p => !p.isGuest);
    return nonGuests.length > 0 ? Math.round(nonGuests.reduce((s, p) => s + p.winRate, 0) / nonGuests.length) : 50;
  })();
  
  const effectiveWinRate = (id: string) => {
    const player = players.find(p => p.id === id);
    if (!player) return baseAverageWinRate;
    return player.isGuest ? baseAverageWinRate : player.winRate;
  };
  
  const partnerRates: Record<string, number[]> = {};
  participantIds.forEach(id => partnerRates[id] = []);
  matches.forEach(match => {
    if (match.teamA.length === 2) {
      partnerRates[match.teamA[0]].push(effectiveWinRate(match.teamA[1]));
      partnerRates[match.teamA[1]].push(effectiveWinRate(match.teamA[0]));
    }
    if (match.teamB.length === 2) {
      partnerRates[match.teamB[0]].push(effectiveWinRate(match.teamB[1]));
      partnerRates[match.teamB[1]].push(effectiveWinRate(match.teamB[0]));
    }
  });
  
  const PARTNER_GAP_LIMIT = 20;
  const partnerSkillBiasLimited = participantIds.every(id => {
    const rates = partnerRates[id] ?? [];
    if (rates.length <= 1) return true;
    const max = Math.max(...rates);
    const min = Math.min(...rates);
    return max - min <= PARTNER_GAP_LIMIT;
  });

  const items = [
    {
      key: 'unique-4-combo',
      label: '경기 모두 고유 4인 조합',
      tier: '엄선',
      passed: allUnique4PlayerCompositions,
      detail: `고유 4인 조합 ${uniqueMatchSet.size}/${totalMatches}`,
    },
    {
      key: 'exactly-4-appearances',
      label: '1인당 4경기 출전',
      tier: '엄선',
      passed: everyonePlayed4,
      detail: `출전 횟수 범위 ${Math.min(...participantIds.map(id => appearanceCount[id]))}~${Math.max(...participantIds.map(id => appearanceCount[id]))}`,
    },
    {
      key: 'exactly-2-rests',
      label: '1인당 2회 휴식',
      tier: '엄선',
      passed: everyoneRested2,
      detail: `휴식 횟수 범위 ${Math.min(...participantIds.map(id => restCount[id]))}~${Math.max(...participantIds.map(id => restCount[id]))}`,
    },
    {
      key: 'max-partner-2',
      label: '동일 파트너 최대 2회 제한',
      tier: '엄선',
      passed: partnerLimitPassed,
      detail: `최대 같은 팀 ${maxPartnerFrequency}회 발생`,
    },
    {
      key: 'unique-mixed-partners', // [추가] 엄선 조건으로 추가
      label: '여성 기준 혼복 파트너 중복 없음',
      tier: '엄선', 
      passed: mixedPartnerUnique,
      detail: mixedPartnerUnique ? '모든 여성 혼복 파트너 다름' : '혼복 파트너 겹침 발생',
    },
    {
      key: 'no-4-consecutive-appearances',
      label: '연속 4경기 출전 없음',
      tier: '엄선',
      passed: noConsecutive4Appearances,
      detail: noConsecutive4Appearances ? '모든 선수 통과' : '연속 4경기 출전 선수 존재',
    },
    {
      key: 'no-2-consecutive-rests',
      label: '연속 2게임 휴식 없음',
      tier: '엄선',
      passed: noConsecutiveTwoRests,
      detail: noConsecutiveTwoRests ? '모든 선수 통과' : '연속 휴식 선수 존재',
    },
    {
      key: 'partner-skill-bias-limit',
      label: '파트너 실력 편중 제한',
      tier: '엄선',
      passed: partnerSkillBiasLimited,
      detail: `파트너 실력 격차 제한 ${PARTNER_GAP_LIMIT}%`,
    },
    {
      key: 'unique-rest-pairs',
      label: '6경기 모두 고유 휴식쌍',
      tier: '베스트',
      passed: allUniqueRestPairs,
      detail: `고유 휴식쌍 ${uniqueRestPairs.size}/${totalMatches}`,
    },
    {
      key: 'no-duplicate-pairs',
      label: '페어 중복 없음',
      tier: '베스트',
      passed: noDuplicatePairs,
      detail: `고유 페어 ${uniqueTeamPairs.size}/${teamPairSignatures.length}`,
    },
    {
      key: 'all-opposed-at-least-once',
      label: '모든 선수 서로 최소 1회 대전',
      tier: '베스트',
      passed: allOpposedAtLeastOnce,
      detail: `대전 충족 ${Array.from(allParticipantPairs).filter(pair => opponentPairs.has(pair)).length}/${allParticipantPairs.length}`,
    },
  ];

  const requiredItems = items.filter(item => item.tier === '엄선');
  const bestItems = items.filter(item => item.tier === '베스트');
  const requiredPassedCount = requiredItems.filter(item => item.passed).length;
  const bestPassedCount = bestItems.filter(item => item.passed).length;
  
  return {
    items,
    requiredPassed: requiredPassedCount === requiredItems.length,
    requiredPassedCount,
    requiredTotal: requiredItems.length,
    bestPassedCount,
    bestTotal: bestItems.length,
  };
}


// --- [백트래킹 (Backtracking) 알고리즘 도구] ---

function getAverageWinRate(team: Player[], defaultAvg: number): number {
  if (team.length === 0) return 0;
  const total = team.reduce((sum, p) => sum + (p.isGuest ? defaultAvg : p.winRate), 0);
  return Math.round(total / team.length);
}

function getAllMatchCombinations(players: Player[]): { teamA: Player[], teamB: Player[], rest: Player[] }[] {
  const combos: { teamA: Player[], teamB: Player[], rest: Player[] }[] = [];
  for (let a1 = 0; a1 < 6; a1++) {
    for (let a2 = a1 + 1; a2 < 6; a2++) {
      for (let b1 = 0; b1 < 6; b1++) {
        if (b1 === a1 || b1 === a2) continue;
        for (let b2 = b1 + 1; b2 < 6; b2++) {
          if (b2 === a1 || b2 === a2) continue;
          
          const teamA = [players[a1], players[a2]];
          const teamB = [players[b1], players[b2]];
          const rest = players.filter(p => !teamA.includes(p) && !teamB.includes(p));
          
          if (teamA[0].id < teamB[0].id) {
             combos.push({ teamA, teamB, rest });
          }
        }
      }
    }
  }
  return combos.sort(() => Math.random() - 0.5);
}

// --- [핵심: 백트래킹 알고리즘] ---
function solveBracket(
  players: Player[],
  mode: 'skill' | 'mixed',
  currentMatches: Match[] = [],
  playCounts: Record<string, number>,
  restCounts: Record<string, number>,
  streakCounts: Record<string, number>,
  restStreakCounts: Record<string, number>,
  partnerCounts: Record<string, number>,
  mixedPartnerHistory: Record<string, string[]>, // [추가] 혼복 파트너 이력 상태
  defaultAvgRate: number
): Match[] | null {

  if (currentMatches.length === 6) {
    const allValid = players.every(p => playCounts[p.id] === 4 && restCounts[p.id] === 2);
    if (allValid) return currentMatches;
    return null; 
  }

  const allCombos = getAllMatchCombinations(players);

  for (const combo of allCombos) {
    // [조건 1]: 동일 파트너 최대 2회 제한
    const pairA = [...combo.teamA].map(p => p.id).sort().join('|');
    const pairB = [...combo.teamB].map(p => p.id).sort().join('|');
    
    if ((partnerCounts[pairA] || 0) >= 2) continue; 
    if ((partnerCounts[pairB] || 0) >= 2) continue; 

    // [조건 1-1]: 여성 기준 혼복 남성 파트너 중복 차단 [추가]
    let hasMixedDuplicate = false;
    [combo.teamA, combo.teamB].forEach(team => {
      if (team.length === 2) {
        const isMixed = team.some(p => p.gender === 'M') && team.some(p => p.gender !== 'M');
        if (isMixed) {
          const f = team.find(p => p.gender !== 'M');
          const m = team.find(p => p.gender === 'M');
          // 이미 이 여성 참가자가 해당 남성 참가자와 혼복을 뛴 이력이 있다면
          if (f && m && mixedPartnerHistory[f.id]?.includes(m.id)) {
            hasMixedDuplicate = true;
          }
        }
      }
    });
    if (hasMixedDuplicate) continue; // 파트너가 겹치면 이 대진은 폐기

    // [조건 2]: 실력 밸런스 체크
    const avgA = getAverageWinRate(combo.teamA, defaultAvgRate);
    const avgB = getAverageWinRate(combo.teamB, defaultAvgRate);
    if (Math.abs(avgA - avgB) > 30) continue;

    // [조건 3]: 혼복 모드일 경우 성별 제약 체크 (잡복 금지 로직)
    if (mode === 'mixed') {
      const activeM = [...combo.teamA, ...combo.teamB].filter(p => p.gender === 'M').length;
      const activeF = [...combo.teamA, ...combo.teamB].filter(p => p.gender !== 'M').length;

      if (activeM % 2 !== 0 || activeF % 2 !== 0) {
        continue;
      }

      if (activeM === 2 && activeF === 2) {
        const isMixedA = combo.teamA.some(p => p.gender !== 'M') && combo.teamA.some(p => p.gender === 'M');
        const isMixedB = combo.teamB.some(p => p.gender !== 'M') && combo.teamB.some(p => p.gender === 'M');
        if (!isMixedA || !isMixedB) continue; 
      }
    }

    // [조건 4]: 연속 휴식 금지 & 출전 횟수 제한 체크
    let isValidCombo = true;
    for (const p of combo.rest) {
      if (restStreakCounts[p.id] >= 1) isValidCombo = false; 
      if (restCounts[p.id] >= 2) isValidCombo = false; 
    }
    for (const p of [...combo.teamA, ...combo.teamB]) {
      if (streakCounts[p.id] >= 3) isValidCombo = false; 
      if (playCounts[p.id] >= 4) isValidCombo = false; 
    }

    if (!isValidCombo) continue; 

    // --- [적용 (Apply)] ---
    const nextMatches = [...currentMatches, {
      id: `g${currentMatches.length + 1}`,
      teamA: combo.teamA.map(p => p.id),
      teamB: combo.teamB.map(p => p.id),
      rest: combo.rest.map(p => p.id)
    }];

    const nextPlayCounts = { ...playCounts };
    const nextRestCounts = { ...restCounts };
    const nextStreakCounts = { ...streakCounts };
    const nextRestStreakCounts = { ...restStreakCounts };
    const nextPartnerCounts = { ...partnerCounts }; 
    
    // [추가] 다음 상태로 넘길 혼복 파트너 이력 깊은 복사
    const nextMixedPartnerHistory: Record<string, string[]> = {};
    for (const key in mixedPartnerHistory) {
      nextMixedPartnerHistory[key] = [...mixedPartnerHistory[key]];
    }

    nextPartnerCounts[pairA] = (nextPartnerCounts[pairA] || 0) + 1;
    nextPartnerCounts[pairB] = (nextPartnerCounts[pairB] || 0) + 1;

    // [추가] 새로 매칭된 혼복 이력 저장
    [combo.teamA, combo.teamB].forEach(team => {
      if (team.length === 2) {
         const isMixed = team.some(p => p.gender === 'M') && team.some(p => p.gender !== 'M');
         if (isMixed) {
           const f = team.find(p => p.gender !== 'M');
           const m = team.find(p => p.gender === 'M');
           if (f && m) {
             nextMixedPartnerHistory[f.id].push(m.id);
           }
         }
      }
    });

    combo.rest.forEach(p => {
      nextRestCounts[p.id]++;
      nextRestStreakCounts[p.id]++;
      nextStreakCounts[p.id] = 0; 
    });
    [...combo.teamA, ...combo.teamB].forEach(p => {
      nextPlayCounts[p.id]++;
      nextStreakCounts[p.id]++;
      nextRestStreakCounts[p.id] = 0; 
    });

    const result = solveBracket(players, mode, nextMatches, nextPlayCounts, nextRestCounts, nextStreakCounts, nextRestStreakCounts, nextPartnerCounts, nextMixedPartnerHistory, defaultAvgRate);
    
    if (result) return result;
  }

  return null;
}

function detectBracketMode(players: Player[]): 'skill' | 'mixed' {
  const maleCount = players.filter(p => p.gender === 'M').length;
  const femaleCount = players.filter(p => p.gender !== 'M').length;
  if (maleCount >= 2 && femaleCount >= 2) return 'mixed';
  return 'skill';
}

// --- [메인 실행 함수] ---
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { players } = await req.json() as GenerateRequest;

    if (!players || players.length !== 6) {
      return new Response(JSON.stringify({ error: "참가자는 정확히 6명이어야 합니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const mode = detectBracketMode(players);

    const regularPlayers = players.filter(p => !p.isGuest);
    const defaultAvgRate = regularPlayers.length > 0 ? Math.round(regularPlayers.reduce((s, p) => s + p.winRate, 0) / regularPlayers.length) : 50;

    const initialPlayCounts: Record<string, number> = {};
    const initialRestCounts: Record<string, number> = {};
    const initialStreakCounts: Record<string, number> = {};
    const initialRestStreakCounts: Record<string, number> = {};
    const initialPartnerCounts: Record<string, number> = {};
    const initialMixedPartnerHistory: Record<string, string[]> = {}; // [추가] 상태 초기화

    players.forEach(p => {
      initialPlayCounts[p.id] = 0;
      initialRestCounts[p.id] = 0;
      initialStreakCounts[p.id] = 0;
      initialRestStreakCounts[p.id] = 0;
      if (p.gender !== 'M') initialMixedPartnerHistory[p.id] = [];
    });

    let resultBracket = solveBracket(players, mode, [], initialPlayCounts, initialRestCounts, initialStreakCounts, initialRestStreakCounts, initialPartnerCounts, initialMixedPartnerHistory, defaultAvgRate);

    if (!resultBracket && mode === 'mixed') {
      resultBracket = solveBracket(players, 'skill', [], initialPlayCounts, initialRestCounts, initialStreakCounts, initialRestStreakCounts, initialPartnerCounts, initialMixedPartnerHistory, defaultAvgRate);
    }

    if (!resultBracket) {
      return new Response(JSON.stringify({ error: "이 인원 구성으로는 모든 조건을 만족하는 대진표를 만들 수 없습니다." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const quality = evaluateBracketQuality(resultBracket, players);
    return new Response(JSON.stringify({ matches: resultBracket, quality }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "서버 오류", details: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});