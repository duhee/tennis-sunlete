# Tennis Sunlete 프로젝트 스펙

## 1. 프로젝트 개요 및 기획

- **목표**: 동호회 테니스 리그(선레테) 운영을 위한 출석, 경기, 통계, 브래킷 관리 및 공유 플랫폼
- **주요 사용자**: 일반 회원, 마스터(운영자)
- **핵심 기능**:
  - 회원 출석 신청/관리
  - 주간 경기 스케줄 및 브래킷 자동 생성/확정
  - 경기 결과 입력 및 통계 집계
  - 시즌별 출석/승률/기록 열람
  - 공유용 브래킷 페이지 생성
  - 관리자(마스터) 기능: 회원 관리, 출석/경기 강제 수정, 시즌 관리 등

## 2. 기술 스택 및 배포 환경

- **프론트엔드**: React 18, Vite, TypeScript (strict, ESM, Node16)
- **상태관리**: React Context (AppDataContext, AuthContext)
- **라우팅**: React Router DOM 7+
- **스타일**: Tailwind CSS, Custom CSS
- **백엔드/DB**: Supabase (PostgreSQL, Auth 미사용)
- **배포**: Vercel (FE), Supabase (DB)

## 3. 데이터베이스 구조 (Supabase)

### users
- id: string (PK)
- name: string
- gender: 'M' | 'F' | 'W'
- phone_last_4: string
- is_guest: boolean
- is_withdrawn: boolean
- active_seasons: string[]
- season_stats: JSONB (season별 출석/승/패 등)

### schedules
- id: string (PK)
- date: string (YYYY-MM-DD)
- season_code: string
- attendance_deadline: string (ISO)
- max_participants: number
- status: 'open' | 'draw_waiting' | 'closed'

### attendance_requests
- id: string (PK)
- schedule_id: string (FK)
- user_id: string (FK)
- requested_at: string (ISO)
- status: 'attend' | 'absent'

### doubles_matches
- id: string (PK)
- schedule_id: string (FK)
- date: string (YYYY-MM-DD)
- team_a: string[] (user ids)
- team_b: string[] (user ids)
- score_a: number
- score_b: number
- result: 'teamA' | 'teamB' | 'draw'
- is_confirmed: boolean

## 4. 주요 페이지 및 UI/기능

### / (UserDashboard)
- 내 정보, 시즌별 출석/경기/승률 요약
- 출석 신청/취소, 대기자 관리
- 이번주 경기 브래킷/결과 확인

### /login (LoginPage)
- 이름 + 휴대폰 뒷자리 4자리로 로그인
- 탈퇴/비회원/게스트 로그인 제한

### /profile/:userId (ProfilePage)
- 회원별 시즌별 출석/경기/승률 상세
- 시즌별 출석일, 경기기록, 파트너/상대별 통계

### /master (MasterPage)
- 마스터(운영자)만 접근 가능
- 회원 관리(추가/수정/탈퇴)
- 시즌/스케줄/브래킷 강제 생성/수정
- 출석/경기결과 강제 입력

### /shared/:bracketId (SharedBracket)
- 비회원도 접근 가능한 공유용 브래킷 뷰
- 경기 결과/스코어만 표시, 수정 불가

### 404 (NotFound)
- 잘못된 경로 안내

## 5. 기타
- 모든 데이터 fetch/저장 시 Supabase REST API 사용
- FE/BE 데이터 구조 일치 보장 (mockData.ts 타입 기준)
- ESM, .js 확장자, strict 타입, 방어적 코딩 준수
- 관리자 기능은 마스터 계정(이름: 장두희)만 노출

---

> 상세 UI/기능, 데이터 타입 정의, API 명세 등은 별도 md 파일로 분리 가능
