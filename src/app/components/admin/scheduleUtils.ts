import type { User as UserType } from '../../data/mockData.js';
import { getWinRate } from '../../data/mockData.js';
import type { DrawQualityReport, GeneratedMatch } from './types.js';

function ensureUniquePlayersInMatch(match: GeneratedMatch, candidatePool: string[]): GeneratedMatch {
  const slots = [...match.teamA, ...match.teamB];
  const used = new Set<string>();

  for (let i = 0; i < slots.length; i++) {
    const current = slots[i];
    if (!used.has(current)) {
      used.add(current);
      continue;
    }

    const replacement = candidatePool.find(id => !used.has(id));
    if (replacement) {
      slots[i] = replacement;
      used.add(replacement);
      continue;
    }

    // Fallback: keep original when no replacement exists.
    used.add(current);
  }

  return {
    ...match,
    teamA: [slots[0], slots[1]],
    teamB: [slots[2], slots[3]],
  };
}

function normalizeBracketUniquePlayers(bracket: GeneratedMatch[], candidatePool: string[]): GeneratedMatch[] {
  return bracket.map(match => ensureUniquePlayersInMatch(match, candidatePool));
}

export function inferSeasonCodeFromDate(date: string): string | undefined {
  const ymd = date.match(/(\d{4})-(\d{2})-(\d{2})/);
  const d = ymd
    ? new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00+09:00`)
    : new Date(date);
  if (Number.isNaN(d.getTime())) return undefined;

  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const yy = (year % 100).toString().padStart(2, '0');

  if (month >= 2 && month <= 4) return `${yy}S1`;
  if (month >= 5 && month <= 7) return `${yy}S2`;
  if (month >= 8 && month <= 10) return `${yy}S3`;
  if (month >= 11) return `${yy}S4`;

  const prevYy = ((year - 1) % 100).toString().padStart(2, '0');
  return `${prevYy}S4`;
}

export function getScheduleSeasonCode(schedule: { date: string; seasonCode?: string; id?: string; attendanceDeadline?: string }): string | undefined {
  if (schedule.seasonCode) return schedule.seasonCode;

  const idMatch = (schedule.id || '').match(/^(\d{2}S[1-4])-w\d+$/);
  if (idMatch) return idMatch[1];

  return inferSeasonCodeFromDate(schedule.date) ?? inferSeasonCodeFromDate(schedule.attendanceDeadline || '');
}

export function toDateKey(dateLike: string): string {
  const ymd = dateLike.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

  const d = new Date(dateLike);
  if (!Number.isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return dateLike;
}

export function getTodayDateKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getScheduleDateKey(schedule: { date?: string; attendanceDeadline?: string }): string {
  return toDateKey(schedule.date || schedule.attendanceDeadline || '');
}

export function getDefaultScheduleId(schedules: Array<{ id: string; date?: string; attendanceDeadline?: string }>): string {
  if (schedules.length === 0) return '';
  const todayKey = getTodayDateKey();
  const sorted = [...schedules].sort((a, b) => getScheduleDateKey(a).localeCompare(getScheduleDateKey(b)));
  const nearestFuture = sorted.find(s => getScheduleDateKey(s) >= todayKey);
  return (nearestFuture || sorted[0]).id;
}

export function buildSixMatchBracket(participantIds: string[], type: 'random' | 'skill', getUserById: (id: string) => UserType | undefined): GeneratedMatch[] {
  let players = participantIds.map(id => getUserById(id)).filter(Boolean) as UserType[];

  if (type === 'random') {
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }
  } else {
    // Skill sort: guests have no stats → assign them the average win rate of non-guest players
    const nonGuests = players.filter(p => !p.isGuest);
    const avgWinRate = nonGuests.length > 0
      ? nonGuests.reduce((sum, p) => sum + getWinRate(p), 0) / nonGuests.length
      : 50;

    players = [...players].sort((a, b) => {
      const rA = a.isGuest ? avgWinRate : getWinRate(a);
      const rB = b.isGuest ? avgWinRate : getWinRate(b);
      return rB - rA;
    });
  }

  const slots = Array.from({ length: 8 }, (_, idx) => players[idx % players.length]);

  const bracket = [
    { id: 'g1', teamA: [slots[0].id, slots[1].id], teamB: [slots[2].id, slots[3].id] },
    { id: 'g2', teamA: [slots[4].id, slots[5].id], teamB: [slots[6].id, slots[7].id] },
    { id: 'g3', teamA: [slots[0].id, slots[2].id], teamB: [slots[4].id, slots[6].id] },
    { id: 'g4', teamA: [slots[1].id, slots[3].id], teamB: [slots[5].id, slots[7].id] },
    { id: 'g5', teamA: [slots[0].id, slots[3].id], teamB: [slots[5].id, slots[6].id] },
    { id: 'g6', teamA: [slots[1].id, slots[2].id], teamB: [slots[4].id, slots[7].id] },
  ];

  const candidatePool = [...new Set(players.map(player => player.id))];
  return normalizeBracketUniquePlayers(bracket, candidatePool);
}

export function buildMixedDoublesBracket(participantIds: string[], getUserById: (id: string) => UserType | undefined): GeneratedMatch[] {
  const players = participantIds.map(id => getUserById(id)).filter(Boolean) as UserType[];

  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const F = shuffle(players.filter(p => p.gender === 'F' || p.gender === 'W'));
  const M = shuffle(players.filter(p => p.gender === 'M'));
  const fLen = F.length;
  const mLen = M.length;

  // Helper: pick n items from arr cyclically
  const pick = (arr: UserType[], n: number): UserType[] =>
    Array.from({ length: n }, (_, i) => arr[i % arr.length]);

  // Build mixed pair [F, M] from circular indices
  const mixedPair = (fi: number, mi: number): [string, string] =>
    [F[fi % fLen].id, M[mi % mLen].id];

  // Build same-gender pair from circular index within gender array
  const ffPair = (i: number, j: number): [string, string] =>
    [F[i % fLen].id, F[j % fLen].id];
  const mmPair = (i: number, j: number): [string, string] =>
    [M[i % mLen].id, M[j % mLen].id];

  type Team = [string, string];
  const makeMatch = (id: string, a: Team, b: Team): GeneratedMatch =>
    ({ id, teamA: [a[0], a[1]], teamB: [b[0], b[1]] });

  // 3M 3F → 6 mixed
  if (mLen >= 3 && fLen >= 3) {
    // 6 mixed: pair each F with each M round-robin style
    // Teams: (F0,M0) vs (F1,M1), (F2,M2) vs (F0,M1), ...
    const mixed: Array<[Team, Team]> = [
      [mixedPair(0, 0), mixedPair(1, 1)],
      [mixedPair(2, 2), mixedPair(0, 1)],
      [mixedPair(1, 2), mixedPair(2, 0)],
      [mixedPair(0, 2), mixedPair(1, 0)],
      [mixedPair(2, 1), mixedPair(0, 0)],   // rotation continues
      [mixedPair(1, 1), mixedPair(2, 2)],
    ];
    const bracket = mixed.map(([a, b], i) => makeMatch(`g${i + 1}`, a, b));
    const candidatePool = [...new Set(players.map(player => player.id))];
    return normalizeBracketUniquePlayers(bracket, candidatePool);
  }

  // 4M 2F → 4 mixed + 2 men's doubles
  if (mLen >= 4 && fLen <= 2) {
    const mixedMatches: Array<[Team, Team]> = [
      [mixedPair(0, 0), mixedPair(1, 1)],
      [mixedPair(0, 1), mixedPair(1, 0)],
      [mixedPair(0, 0), mixedPair(1, 1)],   // re-paired to vary
      [mixedPair(0, 1), mixedPair(1, 0)],
    ];
    const menMatches: Array<[Team, Team]> = [
      [mmPair(0, 1), mmPair(2, 3)],
      [mmPair(0, 2), mmPair(1, 3)],
    ];
    const bracket = [
      ...mixedMatches.map(([a, b], i) => makeMatch(`g${i + 1}`, a, b)),
      ...menMatches.map(([a, b], i) => makeMatch(`g${5 + i}`, a, b)),
    ];
    const candidatePool = [...new Set(players.map(player => player.id))];
    return normalizeBracketUniquePlayers(bracket, candidatePool);
  }

  // 2M 4F → 4 mixed + 2 women's doubles
  if (fLen >= 4 && mLen <= 2) {
    const mixedMatches: Array<[Team, Team]> = [
      [mixedPair(0, 0), mixedPair(1, 1)],
      [mixedPair(2, 0), mixedPair(3, 1)],
      [mixedPair(0, 1), mixedPair(1, 0)],
      [mixedPair(2, 1), mixedPair(3, 0)],
    ];
    const womenMatches: Array<[Team, Team]> = [
      [ffPair(0, 1), ffPair(2, 3)],
      [ffPair(0, 2), ffPair(1, 3)],
    ];
    const bracket = [
      ...mixedMatches.map(([a, b], i) => makeMatch(`g${i + 1}`, a, b)),
      ...womenMatches.map(([a, b], i) => makeMatch(`g${5 + i}`, a, b)),
    ];
    const candidatePool = [...new Set(players.map(player => player.id))];
    return normalizeBracketUniquePlayers(bracket, candidatePool);
  }

  // Fallback: interleave and use slot rotation (handles other ratios)
  const ordered: UserType[] = [];
  const maxLen = Math.max(fLen, mLen);
  for (let i = 0; i < maxLen; i++) {
    if (i < fLen) ordered.push(F[i]);
    if (i < mLen) ordered.push(M[i]);
  }
  const sixPlayers = pick(ordered, 6);
  const slots = Array.from({ length: 8 }, (_, idx) => sixPlayers[idx % 6]);
  const bracket = [
    { id: 'g1', teamA: [slots[0].id, slots[1].id], teamB: [slots[2].id, slots[3].id] },
    { id: 'g2', teamA: [slots[4].id, slots[5].id], teamB: [slots[6].id, slots[7].id] },
    { id: 'g3', teamA: [slots[0].id, slots[2].id], teamB: [slots[4].id, slots[6].id] },
    { id: 'g4', teamA: [slots[1].id, slots[3].id], teamB: [slots[5].id, slots[7].id] },
    { id: 'g5', teamA: [slots[0].id, slots[3].id], teamB: [slots[5].id, slots[6].id] },
    { id: 'g6', teamA: [slots[1].id, slots[2].id], teamB: [slots[4].id, slots[7].id] },
  ];

  const candidatePool = [...new Set(players.map(player => player.id))];
  return normalizeBracketUniquePlayers(bracket, candidatePool);
}

export function evaluateDrawQuality(
  bracket: GeneratedMatch[],
  participantIds: string[],
  getUserById: (id: string) => UserType | undefined
): DrawQualityReport {
  const participants = [...new Set(participantIds)];
  const participantSet = new Set(participants);
  const matches = bracket;
  const totalMatches = matches.length;

  const appearanceCount = new Map<string, number>();
  const restCount = new Map<string, number>();
  const appearanceTimeline = new Map<string, boolean[]>();
  const restTimeline = new Map<string, boolean[]>();
  participants.forEach(id => {
    appearanceCount.set(id, 0);
    restCount.set(id, 0);
    appearanceTimeline.set(id, []);
    restTimeline.set(id, []);
  });

  const matchSignatures: string[] = [];
  const restPairSignatures: string[] = [];
  const teamPairSignatures: string[] = [];
  const opponentPairs = new Set<string>();

  for (const match of matches) {
    const active = [...match.teamA, ...match.teamB].filter(id => participantSet.has(id));
    const activeUnique = new Set(active);
    matchSignatures.push([...activeUnique].sort().join('|'));

    participants.forEach(id => {
      const appeared = activeUnique.has(id);
      appearanceTimeline.get(id)?.push(appeared);
      restTimeline.get(id)?.push(!appeared);
      if (appeared) {
        appearanceCount.set(id, (appearanceCount.get(id) ?? 0) + 1);
      } else {
        restCount.set(id, (restCount.get(id) ?? 0) + 1);
      }
    });

    const rests = participants.filter(id => !activeUnique.has(id));
    restPairSignatures.push(rests.sort().join('|'));

    const teamA = match.teamA.filter(id => participantSet.has(id));
    const teamB = match.teamB.filter(id => participantSet.has(id));
    if (teamA.length === 2) {
      teamPairSignatures.push([...teamA].sort().join('|'));
    }
    if (teamB.length === 2) {
      teamPairSignatures.push([...teamB].sort().join('|'));
    }

    if (teamA.length === 2 && teamB.length === 2) {
      for (const a of teamA) {
        for (const b of teamB) {
          opponentPairs.add([a, b].sort().join('|'));
        }
      }
    }
  }

  const uniqueMatchSet = new Set(matchSignatures);
  const allMatchesHave4UniquePlayers = matches.every(match => {
    const active = [...match.teamA, ...match.teamB].filter(id => participantSet.has(id));
    return new Set(active).size === 4;
  });
  const allUnique4PlayerCompositions =
    totalMatches === 6 &&
    allMatchesHave4UniquePlayers &&
    uniqueMatchSet.size === totalMatches;

  const uniqueRestPairs = new Set(restPairSignatures.filter(sig => sig.split('|').filter(Boolean).length === 2));
  const allRestPairsSizeTwo = restPairSignatures.every(sig => sig.split('|').filter(Boolean).length === 2);
  const allUniqueRestPairs =
    totalMatches === 6 &&
    allRestPairsSizeTwo &&
    uniqueRestPairs.size === totalMatches;

  const everyonePlayed4 = participants.length > 0 && participants.every(id => appearanceCount.get(id) === 4);
  const everyoneRested2 = participants.length > 0 && participants.every(id => restCount.get(id) === 2);

  const noConsecutive4Appearances = participants.every(id => {
    const timeline = appearanceTimeline.get(id) ?? [];
    for (let i = 0; i <= timeline.length - 4; i++) {
      if (timeline[i] && timeline[i + 1] && timeline[i + 2] && timeline[i + 3]) return false;
    }
    return true;
  });

  const uniqueTeamPairs = new Set(teamPairSignatures);
  const noDuplicatePairs = uniqueTeamPairs.size === teamPairSignatures.length;

  const allParticipantPairs: string[] = [];
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      allParticipantPairs.push([participants[i], participants[j]].sort().join('|'));
    }
  }
  const allOpposedAtLeastOnce =
    allParticipantPairs.length > 0 &&
    allParticipantPairs.every(pair => opponentPairs.has(pair));

  const noConsecutiveTwoRests = participants.every(id => {
    const timeline = restTimeline.get(id) ?? [];
    for (let i = 0; i <= timeline.length - 2; i++) {
      if (timeline[i] && timeline[i + 1]) return false;
    }
    return true;
  });

  const nonGuestParticipants = participants
    .map(id => getUserById(id))
    .filter((p): p is UserType => Boolean(p) && !p.isGuest);
  const baseAverageWinRate =
    nonGuestParticipants.length > 0
      ? nonGuestParticipants.reduce((sum, player) => sum + getWinRate(player), 0) / nonGuestParticipants.length
      : 50;

  const effectiveWinRate = (id: string) => {
    const player = getUserById(id);
    if (!player) return baseAverageWinRate;
    return player.isGuest ? baseAverageWinRate : getWinRate(player);
  };

  const partnerRates = new Map<string, number[]>();
  participants.forEach(id => partnerRates.set(id, []));
  matches.forEach(match => {
    const teamA = match.teamA.filter(id => participantSet.has(id));
    const teamB = match.teamB.filter(id => participantSet.has(id));
    if (teamA.length === 2) {
      partnerRates.get(teamA[0])?.push(effectiveWinRate(teamA[1]));
      partnerRates.get(teamA[1])?.push(effectiveWinRate(teamA[0]));
    }
    if (teamB.length === 2) {
      partnerRates.get(teamB[0])?.push(effectiveWinRate(teamB[1]));
      partnerRates.get(teamB[1])?.push(effectiveWinRate(teamB[0]));
    }
  });

  const PARTNER_GAP_LIMIT = 20;
  const partnerSkillBiasLimited = participants.every(id => {
    const rates = partnerRates.get(id) ?? [];
    if (rates.length <= 1) return true;
    const max = Math.max(...rates);
    const min = Math.min(...rates);
    return max - min <= PARTNER_GAP_LIMIT;
  });

  const items = [
    {
      key: 'unique-4-combo',
      label: '경기 모두 고유 4인 조합',
      tier: '엄선' as const,
      passed: allUnique4PlayerCompositions,
      detail: `고유 4인 조합 ${uniqueMatchSet.size}/${totalMatches}`,
    },
    {
      key: 'unique-rest-pairs',
      label: '6경기 모두 고유 휴식쌍',
      tier: '베스트' as const,
      passed: allUniqueRestPairs,
      detail: `고유 휴식쌍 ${uniqueRestPairs.size}/${totalMatches}`,
    },
    {
      key: 'exactly-4-appearances',
      label: '1인당 4경기 출전',
      tier: '엄선' as const,
      passed: everyonePlayed4,
      detail: participants.length > 0
        ? `출전 횟수 범위 ${Math.min(...participants.map(id => appearanceCount.get(id) ?? 0))}~${Math.max(...participants.map(id => appearanceCount.get(id) ?? 0))}`
        : '참가자 없음',
    },
    {
      key: 'exactly-2-rests',
      label: '1인당 2회 휴식',
      tier: '엄선' as const,
      passed: everyoneRested2,
      detail: participants.length > 0
        ? `휴식 횟수 범위 ${Math.min(...participants.map(id => restCount.get(id) ?? 0))}~${Math.max(...participants.map(id => restCount.get(id) ?? 0))}`
        : '참가자 없음',
    },
    {
      key: 'no-4-consecutive-appearances',
      label: '연속 4경기 출전 없음',
      tier: '엄선' as const,
      passed: noConsecutive4Appearances,
      detail: noConsecutive4Appearances ? '모든 선수 통과' : '연속 4경기 출전 선수 존재',
    },
    {
      key: 'no-duplicate-pairs',
      label: '페어 중복 없음',
      tier: '베스트' as const,
      passed: noDuplicatePairs,
      detail: `고유 페어 ${uniqueTeamPairs.size}/${teamPairSignatures.length}`,
    },
    {
      key: 'all-opposed-at-least-once',
      label: '모든 선수 서로 최소 1회 대전',
      tier: '베스트' as const,
      passed: allOpposedAtLeastOnce,
      detail: `대전 충족 ${allParticipantPairs.filter(pair => opponentPairs.has(pair)).length}/${allParticipantPairs.length}`,
    },
    {
      key: 'no-2-consecutive-rests',
      label: '연속 2게임 휴식 없음',
      tier: '엄선' as const,
      passed: noConsecutiveTwoRests,
      detail: noConsecutiveTwoRests ? '모든 선수 통과' : '연속 휴식 선수 존재',
    },
    {
      key: 'partner-skill-bias-limit',
      label: '파트너 실력 편중 제한',
      tier: '엄선' as const,
      passed: partnerSkillBiasLimited,
      detail: `파트너 실력 격차 제한 ${PARTNER_GAP_LIMIT}%`,
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
