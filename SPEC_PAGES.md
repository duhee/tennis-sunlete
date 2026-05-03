# Tennis Sunlete 주요 페이지별 UI/기능 상세

## 1. UserDashboard (src/app/pages/UserDashboard.tsx)
- **경로**: /
- **기능**:
  - 내 정보(이름, 시즌별 출석/경기/승률)
  - 이번주 출석 신청/취소, 대기자 확인
  - 이번주 경기 브래킷/결과 확인
  - 시즌별 통계 요약
- **UI**:
  - 상단: 인사/회원 정보
  - 출석 버튼, 대기자 리스트
  - 경기 브래킷(확정 시)
  - 시즌별 출석/경기/승률 Progress Bar

## 2. LoginPage (src/app/pages/LoginPage.tsx)
- **경로**: /login
- **기능**:
  - 이름 + 휴대폰 뒷자리 4자리로 로그인
  - 탈퇴/비회원/게스트 로그인 제한
- **UI**:
  - 입력폼(이름, 휴대폰 뒷자리 4자리)
  - 에러 메시지

## 3. ProfilePage (src/app/pages/ProfilePage.tsx)
- **경로**: /profile/:userId
- **기능**:
  - 회원별 시즌별 출석/경기/승률 상세
  - 시즌별 출석일, 경기기록, 파트너/상대별 통계
- **UI**:
  - 시즌별 통계 카드
  - 시즌 상세 모달(출석일, 경기기록, 파트너별 승률)

## 4. MasterPage (src/app/pages/MasterPage.tsx)
- **경로**: /master
- **기능**:
  - 회원 관리(추가/수정/탈퇴)
  - 시즌/스케줄/브래킷 강제 생성/수정
  - 출석/경기결과 강제 입력
- **UI**:
  - 회원 리스트/추가/수정 폼
  - 시즌/스케줄 관리 패널
  - 브래킷 생성/수정 UI

## 5. SharedBracket (src/app/pages/SharedBracket.tsx)
- **경로**: /shared/:bracketId
- **기능**:
  - 비회원도 접근 가능한 공유용 브래킷 뷰
  - 현재 구현에서는 bracketId에 경기 날짜(YYYY-MM-DD)를 사용하며, 기존 /bracket/share?date=... 링크도 호환
  - 경기 결과/스코어만 표시, 수정 불가
- **UI**:
  - 브래킷 트리/표
  - 경기 결과만 표시

## 6. NotFound (src/app/pages/NotFound.tsx)
- **경로**: 404
- **기능**: 잘못된 경로 안내
- **UI**: 에러 메시지, 홈으로 이동 버튼

---

> 각 페이지별 상세 UI/기능은 실제 컴포넌트 소스와 1:1로 매핑됩니다.
