# Tennis Sunlete API 명세 (FE <-> Supabase)

## 1. 데이터 Fetch/저장
- **모든 데이터는 Supabase REST API를 통해 CRUD**
- **직접 SQL/Row Level Security 미사용**

### 1.1. 회원 목록 조회
- `GET /rest/v1/users`
- **필드**: id, name, gender, phone_last_4, is_guest, is_withdrawn, active_seasons, season_stats

### 1.2. 스케줄 목록 조회
- `GET /rest/v1/schedules`
- **필드**: id, date, season_code, attendance_deadline, max_participants, status

### 1.3. 출석 요청 목록 조회
- `GET /rest/v1/attendance_requests`
- **필드**: id, schedule_id, user_id, requested_at, status

### 1.4. 경기(복식) 목록 조회
- `GET /rest/v1/doubles_matches`
- **필드**: id, schedule_id, date, team_a, team_b, score_a, score_b, result, is_confirmed

### 1.5. 데이터 저장/수정
- `POST/PATCH/DELETE` 각 테이블별 REST API 사용
- **예시**: 출석 신청 → `POST /rest/v1/attendance_requests`

### 1.6. 데이터 집계/가공
- FE에서 fetch 후, Context에서 가공/집계(출석률, 승률 등)

---

# Tennis Sunlete UX 정책

## 1. 로그인/인증
- 이름 + 휴대폰 뒷자리 4자리(비밀번호)
- 게스트/탈퇴 회원 로그인 불가
- 마스터(운영자)는 이름: 장두희

## 2. 출석/경기 신청
- 출석 신청/취소는 출석 마감 전까지만 가능
- 대기자는 자동/수동으로 관리
- 경기 브래킷은 마감 후 자동 생성, 마스터가 강제 수정 가능

## 3. 경기 결과 입력
- 경기 결과는 출석자만 입력 가능
- 마스터는 모든 경기 결과/스코어 강제 수정 가능

## 4. 시즌/통계
- 시즌별 출석/경기/승률/기록 제공
- 시즌/스케줄/회원 정보는 마스터만 추가/수정 가능

## 5. 공유 브래킷
- 누구나 접근 가능(비회원 포함)
- 경기 결과/스코어만 표시, 수정 불가

---

# Tennis Sunlete 운영 정책

## 1. 데이터 관리
- 모든 데이터는 Supabase에 실시간 저장
- 회원/경기/스케줄/출석 등은 마스터만 강제 수정 가능
- 데이터 구조 변경 시 FE/BE 동시 반영 필수

## 2. 권한 정책
- 일반 회원: 본인 정보/출석/경기만 수정 가능
- 마스터: 전체 회원/스케줄/경기/통계 수정 가능

## 3. 장애/백업
- Supabase DB 백업 정책 활용
- 장애 발생 시 Supabase Dashboard에서 직접 복구

## 4. 개인정보/보안
- 비밀번호는 휴대폰 뒷자리 4자리(민감정보 최소화)
- Supabase Auth 미사용(별도 인증 없음)

---

> 상세 API 호출 예시, UX 플로우차트, 운영 매뉴얼 등은 필요시 추가 문서화 가능
