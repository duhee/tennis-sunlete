# MasterPage 컴포넌트 분리 리팩토링 스펙

## 1. 개요

`MasterPage.tsx`는 현재 **1,665라인**으로, 마스터 계정의 모든 관리 기능을 단일 컴포넌트에서 처리하고 있다. 복잡도 증가, 유지보수 어려움, 재사용성 낮음 등의 문제가 있어 기능별로 자식 컴포넌트로 분리할 필요가 있다.

## 2. 현재 상태

### 2.1 파일 크기 및 구조

- **전체 라인**: 1,665라인
- **주요 구성**:
  - 유틸리티 함수: 50-250라인 (시즌, 날짜, 대진 생성 로직)
  - MasterPage 컴포넌트: 254-1,665라인
  - 상태 변수: 20개 이상의 useState
  - 계산된 값: 10개 이상의 useMemo
  - 핸들러 함수: 8개 이상의 핸들러
  - JSX 렌더링: 거대한 중첩 Card/div 구조

### 2.2 주요 문제점

1. **단일 책임 원칙 위배**: 스케줄 선택, 대진 생성, 참석 기록, 멤버 관리, 시즌 관리 등 6가지 이상의 책임
2. **상태 관리 복잡성**: 20개 이상의 로컬 상태 변수로 인한 추적 어려움
3. **테스트 불가능성**: 거대한 컴포넌트는 단위 테스트 불가능
4. **재사용성 부족**: 개별 기능(예: 대진표 생성)을 다른 페이지에서 재사용 불가
5. **성능 저하**: 단일 상태 변경으로 전체 컴포넌트 리렌더링

## 3. 분리 목표

### 3.1 최종 구조

```
MasterPage.tsx (메인 페이지 - 레이아웃, 라우팅, 전역 상태 관리)
├── ScheduleSelector (스케줄 선택)
├── ScheduleInfo (스케줄 상세 정보)
├── DrawGenerator (대진 생성 및 표시)
├── ReplacementManager (대참자 관리)
├── AttendanceRecordsView (참석 기록 조회)
├── SeasonManager (시즌 관리 및 멤버 편집)
└── MemberManagement (신규 멤버 추가)
```

### 3.2 분리 기준

- **기능 단위**: 명확한 용도와 책임을 가진 기능별 분리
- **상태 관리**: 각 컴포넌트는 자신의 로컬 상태만 관리; 공유 상태는 Context 또는 Props
- **독립성**: 다른 컴포넌트 없이도 동작 가능한 수준으로 독립적
- **재사용성**: 개별 컴포넌트를 다른 페이지에서 import 가능

## 4. 컴포넌트 분리 계획

### 4.1 ScheduleSelector (스케줄 선택)

**목적**: 시즌별 스케줄 목록 표시 및 선택

**Props**:
```typescript
interface ScheduleSelectorProps {
  schedules: Schedule[];
  selectedScheduleId: string;
  onSelectSchedule: (scheduleId: string) => void;
  showClosedPastSchedules: boolean;
  onToggleShowClosed: (show: boolean) => void;
}
```

**내부 상태**:
- 스케줄 필터링 로직 (과거 일정 표시/숨김)
- 스크롤 위치 관리

**포함 로직**:
- 시즌별 스케줄 그룹화 표시
- 스케줄 버튼 상태 표시 (open/draw_waiting/closed)
- 현재 선택된 스케줄 하이라이트

**현재 코드 위치**: MasterPage.tsx 내 스케줄 버튼 렌더링 영역 (~250-400라인 추정)

### 4.2 ScheduleInfo (스케줄 상세 정보)

**목적**: 선택된 스케줄의 기본 정보 표시

**Props**:
```typescript
interface ScheduleInfoProps {
  schedule: Schedule | null;
  status: 'open' | 'draw_waiting' | 'closed';
  seasonCode: string | undefined;
  seasonMembers: User[];
  maxParticipants: number;
}
```

**내부 상태**: 없음 (Props만 사용)

**포함 로직**:
- 상태 라벨 표시 (참석 접수중 / 대진표 생성 대기중 / 마감)
- 시즌, 참석자/대기자 수 표시
- 배지 컴포넌트 사용

**현재 코드 위치**: MasterPage.tsx 내 상태 표시 영역 (~800-850라인 추정)

### 4.3 DrawGenerator (대진 생성 및 표시)

**목적**: 대진 생성, 재생성, 확정 관리

**Props**:
```typescript
interface DrawGeneratorProps {
  selectedSchedule: Schedule | null;
  generatedBracket: GeneratedMatch[];
  bracketMode: 'random' | 'skill' | 'mixed';
  bracketConfirmed: boolean;
  onGenerateDraw: (type: 'random' | 'skill' | 'mixed') => void;
  onConfirmBracket: () => void;
  getUserById: (id: string) => User | undefined;
  isMobilePreview: boolean;
}
```

**내부 상태**: 없음 (부모에서 관리)

**포함 로직**:
- 대진 생성 버튼 3개 (랜덤 / 실력별 / 혼복)
- 생성된 대진표 카드 표시 (6경기)
- 경기당 참가자 정보 표시
- 다시 생성 / 대진 확정 버튼

**현재 코드 위치**: MasterPage.tsx 내 generatedBracket 렌더링 영역 (~1,100-1,400라인 추정)

### 4.4 ReplacementManager (대참자 관리)

**목적**: 불참자 대체 및 게스트 추가 관리

**Props**:
```typescript
interface ReplacementManagerProps {
  selectedSchedule: Schedule | null;
  absentUsers: User[];
  replacementCandidates: User[];
  onApplyReplacement: (absentUserId: string, replacementUserId: string | null, guestName?: string, guestGender?: 'M' | 'F') => void;
  isMobilePreview: boolean;
}
```

**내부 상태**:
```typescript
const [absentUserId, setAbsentUserId] = useState<string>('');
const [replacementMode, setReplacementMode] = useState<'member' | 'guest'>('member');
const [replacementUserId, setReplacementUserId] = useState<string>('');
const [guestName, setGuestName] = useState<string>('');
const [guestGender, setGuestGender] = useState<'M' | 'F'>('F');
```

**포함 로직**:
- 불참자 선택 드롭다운
- 대참 유형 선택 (멤버 / 게스트)
- 멤버 선택 또는 게스트 정보 입력
- 대참 반영 버튼

**현재 코드 위치**: MasterPage.tsx 내 대참자 관리 카드 (~1,000-1,100라인 추정)

### 4.5 AttendanceRecordsView (참석 기록 조회)

**목적**: 현재 스케줄의 참석/불참/미응답 현황 표시

**Props**:
```typescript
interface AttendanceRecordsViewProps {
  selectedSchedule: Schedule | null;
  attendanceRecords: AttendanceRecord[];
  absentUsers: User[];
  noResponseUsers: User[];
  statusLabel: string;
  isMobilePreview: boolean;
}
```

**내부 상태**: 없음 (부모에서 관리)

**포함 로직**:
- 모바일/데스크톱 뷰 전환 (리스트 / 테이블)
- 참석 기록 테이블 또는 카드 표시
- 불참 멤버, 미응답 멤버 요약 정보

**현재 코드 위치**: MasterPage.tsx 내 참석 기록 조회 카드 (~900-1,100라인 추정)

### 4.6 SeasonManager (시즌 관리)

**목적**: 시즌별 멤버 관리 및 총 회차 설정

**Props**:
```typescript
interface SeasonManagerProps {
  memberUsers: User[];
  allSeasons: string[];
  selectedSeason: string;
  seasonMemberDrafts: Record<string, string[]>;
  seasonTotalSessionsDraft: Record<string, string>;
  onSelectSeason: (season: string) => void;
  onToggleMember: (season: string, memberId: string) => void;
  onSaveSeason: (season: string) => void;
  onAddSeasonClick: (season: string) => void;
  onTotalSessionsChange: (season: string, value: string) => void;
}
```

**내부 상태**:
```typescript
const [showAllMembersForSeason, setShowAllMembersForSeason] = useState<boolean>(false);
```

**포함 로직**:
- 시즌 탭 표시 및 선택
- 시즌별 멤버 체크박스 목록
- 총 회차 입력 필드
- 저장 버튼

**현재 코드 위치**: MasterPage.tsx 내 시즌 관리 카드 영역 (~500-750라인 추정)

### 4.7 MemberManagement (신규 멤버 추가)

**목적**: 선택된 시즌에 신규 멤버 추가

**Props**:
```typescript
interface MemberManagementProps {
  selectedSeason: string;
  onCreateMember: (season: string, name: string, phoneLast4: string) => void;
}
```

**내부 상태**:
```typescript
const [newMemberName, setNewMemberName] = useState<string>('');
const [newMemberPhoneLast4, setNewMemberPhoneLast4] = useState<string>('');
```

**포함 로직**:
- 신규 멤버 이름 입력
- 휴대폰 뒷자리 입력 (4자리 검증)
- 멤버 추가 버튼

**현재 코드 위치**: MasterPage.tsx 내 신규 멤버 추가 영역 (~600-700라인 추정)

## 5. 상태 관리 전략

### 5.1 MasterPage에서 관리할 상태

**공유 상태** (자식 컴포넌트와 Props/콜백으로 전달):
```typescript
const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
const [generatedBracket, setGeneratedBracket] = useState<GeneratedMatch[]>([]);
const [bracketMode, setBracketMode] = useState<'random' | 'skill' | 'mixed'>('random');
const [bracketConfirmed, setBracketConfirmed] = useState(false);
const [selectedSeason, setSelectedSeason] = useState<string>('');
const [seasonMemberDrafts, setSeasonMemberDrafts] = useState<Record<string, string[]>>({});
const [seasonTotalSessionsDraft, setSeasonTotalSessionsDraft] = useState<Record<string, string>>({});
const [adminViewMode, setAdminViewMode] = useState<'mobile' | 'desktop'>('desktop');
const [showClosedPastSchedules, setShowClosedPastSchedules] = useState<boolean>(false);
```

### 5.2 각 자식 컴포넌트의 로컬 상태

각 컴포넌트는 UI 상태만 관리:
- ReplacementManager: 폼 입력값 (absentUserId, replacementMode 등)
- MemberManagement: 폼 입력값 (newMemberName, newMemberPhoneLast4)
- SeasonManager: 표시/숨김 상태 (showAllMembersForSeason)

## 6. Props 및 콜백 인터페이스

### 6.1 모든 컴포넌트가 받을 Props

```typescript
// 공통 Props
export interface BaseComponentProps {
  isMobilePreview: boolean;
}

// Context 함수들 (필요한 것만)
export interface ContextProps {
  getUserById?: (id: string) => User | undefined;
  onAction?: (action: string, params: any) => void;
}
```

### 6.2 콜백 함수 패턴

```typescript
// 대진 생성
onGenerateDraw: (type: 'random' | 'skill' | 'mixed') => void;

// 대진 확정
onConfirmBracket: () => void;

// 대참 반영
onApplyReplacement: (params: ReplacementParams) => void;

// 시즌 저장
onSaveSeason: (season: string) => void;

// 멤버 추가
onCreateMember: (params: MemberParams) => void;
```

## 7. 구현 순서

### Phase 1: 기초 준비 (2-3시간)
1. 새로운 컴포넌트 폴더 구조 생성: `src/app/components/admin/`
2. 타입 정의 파일 생성: `src/app/components/admin/types.ts`
3. 유틸리티 함수 분리: `src/app/utils/scheduleUtils.ts`, `src/app/utils/drawUtils.ts`

### Phase 2: 컴포넌트 분리 (1-2시간 × 7 = 7-14시간)
1. ScheduleSelector 추출 및 테스트
2. ScheduleInfo 추출 및 테스트
3. DrawGenerator 추출 및 테스트
4. ReplacementManager 추출 및 테스트
5. AttendanceRecordsView 추출 및 테스트
6. SeasonManager 추출 및 테스트
7. MemberManagement 추출 및 테스트

### Phase 3: 통합 및 검증 (3-4시간)
1. 모든 컴포넌트를 MasterPage에 import 및 결합
2. Props 연결 및 콜백 검증
3. 모바일/데스크톱 뷰 전환 동작 확인
4. 기능별 동작 테스트 (스케줄 선택, 대진 생성, 참석 기록 등)
5. 성능 프로파일링 (리렌더링 최적화)

### Phase 4: 최적화 및 마무리 (1-2시간)
1. 불필요한 리렌더링 최소화 (React.memo 적용)
2. Storybook 스토리 작성 (선택사항)
3. 문서화 및 코드 리뷰

## 8. 예상 효과

### 8.1 코드 품질 개선
- 단일 파일 1,665라인 → 7개 파일 150-250라인씩
- 각 컴포넌트의 복잡도 감소 (구조 명확화)
- 테스트 가능성 증가

### 8.2 유지보수성 개선
- 기능별 변경 영향도 감소
- 버그 수정 시 검토 범위 축소
- 새로운 기능 추가 시 관련 컴포넌트만 수정

### 8.3 재사용성 개선
- 개별 컴포넌트를 다른 페이지에서 재사용 가능
- 예: 대진표 생성 로직 (UserDashboard에서도 사용 가능)
- 예: 참석 기록 조회 (별도의 보고서 페이지에서 사용 가능)

### 8.4 성능 개선
- 자식 컴포넌트별 독립적인 리렌더링
- React.memo 적용으로 불필요한 리렌더링 방지
- 상태 변경의 영향도 제한

## 9. 주의사항

### 9.1 상태 관리
- Props drilling 피하기: 너무 깊은 Props 전달은 피하고, 필요시 Context 추가 고려
- 상태 동기화: 부모 상태와 자식 상태 간의 동기화 규칙 명확히

### 9.2 성능 최적화
- useMemo/useCallback 적절히 활용하여 불필요한 리렌더링 방지
- 큰 리스트(attendanceRecords 등)는 가상화 고려

### 9.3 테스트 용이성
- 각 컴포넌트는 Props만으로 동작 가능하도록 설계
- Context 의존성 최소화

## 10. 추가 검토 사항

1. **진행 가능성 평가**: 전체 리팩토링 vs 단계적 접근
2. **테스트 커버리지**: 리팩토링 후 테스트 추가 계획
3. **성능 측정**: 리팩토링 전후 번들 크기 및 렌더링 성능 비교
4. **문서화**: 각 컴포넌트 사용법 및 Props 문서화
