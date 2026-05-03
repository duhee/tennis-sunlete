import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useAppData } from '../context/AppDataContext.js';
import { PageLayout } from '../components/PageLayout.js';
import {
  Smartphone,
  Monitor,
} from 'lucide-react';
import { getScheduleStatus, seasonCodeToLabel, type User as UserType } from '../data/mockData.js';
import { toast } from 'sonner';
import { Toaster } from '../components/ui/sonner.js';
import { useIsMobile } from '../components/ui/use-mobile.js';
import {
  ScheduleSelector,
  DrawGenerator,
  ReplacementManager,
  AttendanceRecordsView,
  MemberAttendancePanel,
  GuestListPanel,
  SeasonManager,
  getScheduleSeasonCode,
  getDefaultScheduleId,
  ADMIN_VIEW_MODE_STORAGE_KEY,
  type GeneratedMatch,
  type ReplacementParams,
} from '../components/admin/index.js';
import { getWinRate } from '../data/mockData.js';
import { supabase } from '../api/supabaseClient.js';

export function MasterPage() {
  const { isAdmin } = useAuth();
  const {
    users,
    schedules,
    doublesMatches,
    getUserById,
    addMember,
    applyReplacementByMaster,
    addGuestAndReplace,
    removeGuestUser,
    updateUserActiveSeasons,
    updateUserSeasonStats,
    getAttendanceRecordsForSchedule,
    confirmBracketForSchedule,
    addSchedulesForSeason,
  } = useAppData();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(() => getDefaultScheduleId(schedules));
  const [generatedBracket, setGeneratedBracket] = useState<GeneratedMatch[]>([]);
  const [drawQualityReport, setDrawQualityReport] = useState(null);
  const [bracketConfirmed, setBracketConfirmed] = useState(false);
  const [adminViewMode, setAdminViewMode] = useState<'mobile' | 'desktop'>('desktop');
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [seasonMemberDrafts, setSeasonMemberDrafts] = useState<Record<string, string[]>>({});
  // 시즌별 총 회차 임시 입력값 (season code → value string)
  const [seasonTotalSessionsDraft, setSeasonTotalSessionsDraft] = useState<Record<string, string>>({});
  const [selectedAttendanceSeasonFilter, setSelectedAttendanceSeasonFilter] = useState<string>('');
  const [showClosedPastSchedules, setShowClosedPastSchedules] = useState<boolean>(false);

  React.useEffect(() => {
    const savedViewMode = window.localStorage.getItem(ADMIN_VIEW_MODE_STORAGE_KEY);
    if (savedViewMode === 'mobile' || savedViewMode === 'desktop') {
      setAdminViewMode(savedViewMode);
    }
  }, []);

  React.useEffect(() => {
    if (isMobile) {
      setAdminViewMode('mobile');
    }
  }, [isMobile]);

  React.useEffect(() => {
    window.localStorage.setItem(ADMIN_VIEW_MODE_STORAGE_KEY, adminViewMode);
  }, [adminViewMode]);

  React.useEffect(() => {
    if (!isAdmin) {
      navigate('/');
    }
  }, [isAdmin, navigate]);

  const memberUsers = useMemo(
    () => users.filter(user => !user.isGuest && !user.isWithdrawn && !user.id.startsWith('guest-')),
    [users]
  );
  const guestUsers = useMemo(() => users.filter(user => user.isGuest), [users]);

  React.useEffect(() => {
    if (schedules.length === 0) {
      if (selectedScheduleId !== '') setSelectedScheduleId('');
      return;
    }

    const exists = schedules.some(s => s.id === selectedScheduleId);
    if (!exists) {
      setSelectedScheduleId(getDefaultScheduleId(schedules));
    }
  }, [schedules, selectedScheduleId]);

  const selectedSchedule = schedules.find(s => s.id === selectedScheduleId);
  const selectedScheduleStatus = selectedSchedule ? getScheduleStatus(selectedSchedule) : 'open';
  const selectedScheduleSeasonCode = useMemo(() => {
    if (!selectedSchedule) return undefined;
    return getScheduleSeasonCode(selectedSchedule);
  }, [selectedSchedule]);

  const selectedScheduleSeasonMembers = useMemo(() => {
    if (!selectedSchedule) return [] as UserType[];
    if (!selectedScheduleSeasonCode) return memberUsers;
    return memberUsers.filter(member => (member.activeSeasons ?? []).includes(selectedScheduleSeasonCode));
  }, [selectedSchedule, selectedScheduleSeasonCode, memberUsers]);

  const attendanceRecords = useMemo(() => {
    if (!selectedSchedule) return [];
    const records = getAttendanceRecordsForSchedule(selectedSchedule.id);
    
    // 해당 시즌 멤버만 정규 멤버로 취급, 나머지는 게스트
    const seasonMemberIds = new Set(selectedScheduleSeasonMembers.map(m => m.id));
    
    return records.map((record: any) => ({
      ...record,
      isGuest: !seasonMemberIds.has(record.userId)
    }));
  }, [selectedSchedule, schedules, selectedScheduleSeasonMembers]);

  const absentUsers = useMemo(() => {
    if (!selectedSchedule) return [];

    return selectedSchedule.attendanceRequests
      .filter((request: any) => request.status === 'absent')
      .map((request: any) => getUserById(request.userId))
      .filter(Boolean) as UserType[];
  }, [selectedSchedule, users]);

  const noResponseUsers = useMemo(() => {
    if (!selectedSchedule) return [];

    return selectedScheduleSeasonMembers.filter(
      member => !selectedSchedule.attendanceRequests.some((request: any) => request.userId === member.id)
    );
  }, [selectedSchedule, selectedScheduleSeasonMembers]);

  const replacementCandidates = useMemo(() => {
    if (!selectedSchedule) return [];
    const blocked = new Set(selectedSchedule.participants);
    return selectedScheduleSeasonMembers.filter(user => !blocked.has(user.id));
  }, [selectedSchedule, selectedScheduleSeasonMembers]);

  const allSeasons = useMemo(() => {
    const set = new Set<string>();
    memberUsers.forEach(u => (u.activeSeasons ?? []).forEach((s: string) => set.add(s)));
    return Array.from(set).sort();
  }, [memberUsers]);

  React.useEffect(() => {
    setSeasonMemberDrafts(prev => {
      const next = { ...prev };
      const allS = new Set<string>();
      memberUsers.forEach(u => (u.activeSeasons ?? []).forEach((s: string) => allS.add(s)));
      allS.forEach((season: string) => {
        if (next[season] === undefined) {
          next[season] = memberUsers
            .filter(u => (u.activeSeasons ?? []).includes(season))
            .map(u => u.id);
        }
      });
      return next;
    });
  }, [memberUsers]);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const scheduleDateKey = (selectedSchedule?.date || '').slice(0, 10);
  const isPastSchedule = Boolean(selectedSchedule && scheduleDateKey < todayKey);
  const hasRecordedScores = Boolean(
    selectedSchedule &&
      doublesMatches.some(
        match =>
          match.scheduleId === selectedSchedule.id &&
          (match.scoreA != null || match.scoreB != null || match.result != null)
      )
  );
  const statusCondition = Boolean(
    selectedSchedule &&
      (selectedScheduleStatus === 'draw_waiting' || (isPastSchedule && !hasRecordedScores))
  );

  const participantCountCondition =
    (selectedSchedule?.participants.length ?? 0) >= 6;

  const generationValidation = {
    scheduleSelected: Boolean(selectedSchedule),
    statusCondition,
    participantCount: participantCountCondition,
    generatedSixMatches: generatedBracket.length === 6,
    statusMessage: hasRecordedScores ? '스코어가 입력된 과거 일정은 대진을 재생성할 수 없습니다.' : undefined,
  };

  const handleGenerateDraw = async () => {
    if (!selectedSchedule) {
      toast.error('경기 일정을 선택해주세요');
      return;
    }

    if (!statusCondition) {
      toast.error('대진 생성은 대기중 일정 또는 스코어 미입력 과거 일정에서만 가능합니다');
      return;
    }

    if (isPastSchedule && hasRecordedScores) {
      toast.error('스코어가 입력된 과거 일정은 대진을 재생성할 수 없습니다');
      return;
    }


    if (selectedSchedule.participants.length < 6) {
      toast.error('대진 생성에는 참석자 최소 6명이 필요합니다');
      return;
    }

    const hasConfirmedMatches = doublesMatches.some(
      match => match.scheduleId === selectedSchedule.id && match.isConfirmed
    );

    if (hasConfirmedMatches) {
      const confirmed = window.confirm('⚠️ 이미 대진이 확정된 일정입니다. 기존 대진표를 무시하고 새로 생성하시겠습니까?');
      if (!confirmed) return;
    }

    const players = selectedSchedule.participants
      .map(participantId => {
        const user = getUserById(participantId);
        if (!user) return null;
        return {
          id: user.id,
          name: user.name,
          gender: user.gender,
          winRate: user.isGuest ? 0 : getWinRate(user),
          isGuest: Boolean(user.isGuest),
        };
      })
      .filter((player): player is { id: string; name: string; gender: 'M' | 'F' | 'W'; winRate: number; isGuest: boolean } => Boolean(player));

    if (players.length < 6) {
      toast.error('참가자 정보를 불러오지 못해 대진 생성이 중단되었습니다');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('generate-matchup', {
        body: {
          players,
        },
      });

      if (error) throw error;

      let bracket: GeneratedMatch[] | null = null;
      let quality: any = null;
      if (Array.isArray(data)) {
        bracket = data;
      } else if (data && Array.isArray(data.matches)) {
        bracket = data.matches;
        quality = data.quality ?? null;
      }
      if (!bracket || bracket.length === 0) {
        throw new Error('대진 생성 결과가 비어 있습니다');
      }
      setGeneratedBracket(bracket);
      setDrawQualityReport(quality);
      setBracketConfirmed(false);
      const labels = { random: '랜덤', skill: '실력', mixed: '혼복', ai: 'AI' };
      toast.success('대진표가 생성되었습니다');
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      toast.error(`대진 생성에 실패했습니다: ${message}`);
    }
  };

  const handleConfirmBracket = () => {
    if (!selectedSchedule) return;

    if (generatedBracket.length !== 6) {
      toast.error('대진표 6경기를 먼저 생성해주세요');
      return;
    }

    confirmBracketForSchedule(
      selectedSchedule.id,
      selectedSchedule.date,
      generatedBracket.map(match => ({ teamA: match.teamA, teamB: match.teamB }))
    );

    setBracketConfirmed(true);
    toast.success('대진표가 확정되었습니다', {
      description: '유저 홈 화면에서 스코어 입력을 포함해 확인할 수 있습니다',
    });
  };

  const handleApplyManualBracket = (matches: GeneratedMatch[]) => {
    setGeneratedBracket(matches);
    setDrawQualityReport(null);
    setBracketConfirmed(false);
    toast.success('직접 작성한 대진표를 적용했습니다');
  };

  const handleAddSeason = (s: string) => {
    if (!s) return;
    setSeasonMemberDrafts((prev: any) => (prev[s] !== undefined ? prev : { ...prev, [s]: [] }));
    setSelectedSeason(s);
    // 기존 멤버 데이터에서 total_sessions 초기값 로드
    setSeasonTotalSessionsDraft((prev: any) => {
      if (prev[s] !== undefined) return prev;
      const existing = memberUsers.find((u: any) => (u.activeSeasons ?? []).includes(s));
      const val = existing?.seasonStats?.find((st: any) => st.seasonCode === s)?.total_sessions ?? 0;
      return { ...prev, [s]: String(val) };
    });
  };

  const handleToggleMemberInSeason = (season: string, memberId: string) => {
    setSeasonMemberDrafts(prev => {
      const current = prev[season] ?? [];
      const updated = current.includes(memberId)
        ? current.filter(id => id !== memberId)
        : [...current, memberId];
      return { ...prev, [season]: updated };
    });
  };

  const handleSaveSeason = (season: string) => {
    const activeIds = new Set(seasonMemberDrafts[season] ?? []);
    const totalSessions = Math.max(0, parseInt(seasonTotalSessionsDraft[season] ?? '0', 10) || 0);

    memberUsers.forEach(member => {
      const current = member.activeSeasons ?? [];
      const isActive = activeIds.has(member.id);
      const updated = isActive
        ? current.includes(season) ? current : [...current, season]
        : current.filter((s: string) => s !== season);
      const changed =
        updated.length !== current.length ||
        updated.some((s: string) => !current.includes(s));
      if (changed) updateUserActiveSeasons(member.id, updated);

      // 해당 시즌에 속한 멤버의 total_sessions 업데이트
      if (isActive) {
        const existingStats = member.seasonStats ?? [];
        const hasEntry = existingStats.some((s: any) => s.seasonCode === season);
        const updatedStats = hasEntry
          ? existingStats.map((s: any) =>
              s.seasonCode === season ? { ...s, total_sessions: totalSessions } : s
            )
          : [...existingStats, { seasonCode: season, total_sessions: totalSessions, attended_sessions: 0, wins: 0, losses: 0 }];
        updateUserSeasonStats(member.id, updatedStats);
          // 시즌 총 회차가 설정되면 경기 일정 자동 생성
          if (totalSessions > 0) {
            addSchedulesForSeason(season, totalSessions);
          }
      }
    });
    toast.success(`${seasonCodeToLabel(season)} 시즌이 저장됐습니다`);
  };

  const handleSelectSchedule = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    setGeneratedBracket([]);
    setBracketConfirmed(false);
  };

  const handleApplyReplacementFromComponent = (params: ReplacementParams) => {
    if (!selectedSchedule) {
      toast.error('경기 일정을 선택해주세요');
      return;
    }

    if (!params.absentUserId) {
      toast.error('불참자를 선택해주세요');
      return;
    }

    if (params.mode === 'member') {
      if (!params.replacementUserId) {
        toast.error('대참할 멤버를 선택해주세요');
        return;
      }
      applyReplacementByMaster(selectedSchedule.id, params.absentUserId, params.replacementUserId);
      return;
    }

    if (!params.guestName?.trim()) {
      toast.error('게스트 이름을 입력해주세요');
      return;
    }

    addGuestAndReplace(selectedSchedule.id, params.absentUserId, params.guestName.trim(), params.guestGender ?? 'F');
  };

  const handleCreateMemberFromComponent = (season: string, name: string, phoneLast4: string) => {
    const created = addMember(name, phoneLast4, {
      gender: 'W',
      activeSeasons: [season],
    });

    if (!created) {
      toast.error('신규 회원 생성에 실패했습니다');
      return;
    }

    setSeasonMemberDrafts(prev => {
      const current = new Set(prev[season] ?? []);
      current.add(created.id);
      return { ...prev, [season]: Array.from(current) };
    });

    toast.success('신규 회원이 추가되었습니다');
  };

  const handleDeleteGuest = (guestId: string) => {
    const target = users.find(user => user.id === guestId && user.isGuest);
    if (!target) {
      toast.error('게스트 정보를 찾을 수 없습니다');
      return;
    }

    const confirmed = window.confirm(`${target.name} 게스트를 삭제하시겠습니까?`);
    if (!confirmed) return;

    const result = removeGuestUser(guestId);
    if (!result.ok) {
      toast.error(result.reason ?? '게스트 삭제에 실패했습니다');
      return;
    }

    toast.success('게스트를 삭제했습니다');
  };

  const statusLabel =
    selectedScheduleStatus === 'open'
      ? '참석 접수중'
      : selectedScheduleStatus === 'draw_waiting'
        ? '대진표 생성 대기중'
        : '마감';
  const isMobilePreview = adminViewMode === 'mobile';

  return (
    <PageLayout>
      <div className="min-h-screen bg-white">
        <Toaster />

      <div className={`${isMobilePreview ? 'max-w-md' : 'max-w-6xl'} mx-auto ${isMobilePreview ? 'px-4 py-5' : 'p-6'} transition-all duration-200`}>
        <div className="mb-8">
          <div className={`${isMobilePreview ? 'space-y-3' : 'flex items-center justify-between gap-4'}`}>
            <div>
            <h1 className={`${isMobilePreview ? 'text-2xl' : 'text-3xl'} font-bold mb-2`}>마스터 페이지</h1>
              <p className="text-sm text-gray-500">모웹 미리보기에서 운영 흐름을 확인할 수 있습니다.</p>
            </div>
            <div className="inline-flex rounded-xl border border-gray-200 p-1 bg-white self-start">
              <button
                type="button"
                onClick={() => setAdminViewMode('mobile')}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
                style={isMobilePreview ? { backgroundColor: '#FFC1CC', color: '#030213' } : { color: '#6B7280' }}
              >
                <Smartphone className="w-4 h-4" />
                모웹
              </button>
              <button
                type="button"
                onClick={() => setAdminViewMode('desktop')}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
                style={!isMobilePreview ? { backgroundColor: '#FFC1CC', color: '#030213' } : { color: '#6B7280' }}
              >
                <Monitor className="w-4 h-4" />
                데스크톱
              </button>
            </div>
          </div>
        </div>

        <div className={`grid ${isMobilePreview ? 'grid-cols-1' : 'md:grid-cols-3'} gap-4 mb-6`}>
          <div className={isMobilePreview ? '' : 'md:col-span-2'}>
            <ScheduleSelector
              schedules={schedules}
              selectedScheduleId={selectedScheduleId}
              onSelectSchedule={handleSelectSchedule}
              showClosedPastSchedules={showClosedPastSchedules}
              onToggleShowClosed={setShowClosedPastSchedules}
              isMobilePreview={isMobilePreview}
            />
            <DrawGenerator
              selectedSchedule={selectedSchedule ?? null}
              generatedBracket={generatedBracket}
              bracketConfirmed={bracketConfirmed}
              validation={generationValidation}
              qualityReport={drawQualityReport}
              onGenerateDraw={handleGenerateDraw}
              onApplyManualBracket={handleApplyManualBracket}
              onConfirmBracket={handleConfirmBracket}
              getUserById={getUserById}
              isMobilePreview={isMobilePreview}
            />
          </div>
          <div>
            <ReplacementManager
              selectedSchedule={selectedSchedule ?? null}
              absentUsers={absentUsers}
              replacementCandidates={replacementCandidates}
              getUserById={getUserById}
              onApplyReplacement={handleApplyReplacementFromComponent}
              isMobilePreview={isMobilePreview}
            />
          </div>
        </div>

        <AttendanceRecordsView
          selectedSchedule={selectedSchedule ?? null}
          attendanceRecords={attendanceRecords}
          absentUsers={absentUsers}
          noResponseUsers={noResponseUsers}
          statusLabel={statusLabel}
          isMobilePreview={isMobilePreview}
        />

        <MemberAttendancePanel
          memberUsers={memberUsers}
          allSeasons={allSeasons}
          selectedAttendanceSeasonFilter={selectedAttendanceSeasonFilter}
          onChangeAttendanceSeasonFilter={setSelectedAttendanceSeasonFilter}
          isMobilePreview={isMobilePreview}
        />

        <GuestListPanel
          guestUsers={guestUsers}
          schedules={schedules}
          onDeleteGuest={handleDeleteGuest}
          isMobilePreview={isMobilePreview}
        />

        <SeasonManager
          memberUsers={memberUsers}
          allSeasons={allSeasons}
          selectedSeason={selectedSeason}
          seasonMemberDrafts={seasonMemberDrafts}
          seasonTotalSessionsDraft={seasonTotalSessionsDraft}
          onSelectSeason={setSelectedSeason}
          onAddSeason={handleAddSeason}
          onToggleMember={handleToggleMemberInSeason}
          onSaveSeason={handleSaveSeason}
          onCreateMember={handleCreateMemberFromComponent}
          onTotalSessionsChange={(season, value) => {
            setSeasonTotalSessionsDraft(prev => ({ ...prev, [season]: value }));
          }}
          isMobilePreview={isMobilePreview}
        />
      </div>
    </div>
    </PageLayout>
  );
}
