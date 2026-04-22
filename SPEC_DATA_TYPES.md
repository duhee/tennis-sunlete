# Tennis Sunlete 데이터 타입/구조 명세

## 1. User (회원)
```ts
export interface User {
  id: string;
  name: string;
  gender: 'M' | 'F' | 'W';
  phoneLast4?: string;
  activeSeasons?: string[];
  isWithdrawn?: boolean;
  seasonStats?: SeasonStats[];
  avatar?: string;
  isGuest?: boolean;
}
```

## 2. SeasonStats (시즌별 통계)
```ts
export interface SeasonStats {
  seasonCode: string;
  total_sessions: number;
  attended_sessions: number;
  wins: number;
  losses: number;
}
```

## 3. WeeklyMatchSchedule (주간 경기 스케줄)
```ts
export interface WeeklyMatchSchedule {
  id: string;
  date: string; // YYYY-MM-DD
  seasonCode?: string;
  attendanceRequests: AttendanceRequest[];
  participants: string[];
  waitlist: string[];
  attendanceDeadline: string;
  status: 'open' | 'draw_waiting' | 'closed';
  maxParticipants: number;
}
```

## 4. AttendanceRequest (출석 요청)
```ts
export interface AttendanceRequest {
  userId: string;
  requestedAt: string; // ISO
  status: 'attend' | 'absent';
}
```

## 5. DoublesMatch (복식 경기)
```ts
export interface DoublesMatch {
  id: string;
  scheduleId: string;
  date: string;
  teamA: string[];
  teamB: string[];
  scoreA?: number | null;
  scoreB?: number | null;
  result?: 'teamA' | 'teamB' | 'draw' | null;
  isConfirmed: boolean;
}
```

## 6. AppData (앱 전체 데이터)
```ts
export type AppData = {
  users: User[];
  schedules: WeeklyMatchSchedule[];
  doublesMatches: DoublesMatch[];
};
```

---

- 모든 타입은 src/app/data/mockData.ts에 정의되어 있으며, FE/BE가 동일 구조를 사용합니다.
- Supabase 테이블 구조와 1:1 매핑됩니다.
- 타입 확장/변경 시 반드시 FE/BE 동시 반영 필요.
