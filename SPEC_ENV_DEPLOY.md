# Tennis Sunlete 배포 및 환경 구성

## 1. 프론트엔드 (FE)
- **프레임워크**: React 18 + Vite + TypeScript (strict, ESM, Node16)
- **스타일**: Tailwind CSS, Custom CSS
- **배포**: Vercel
- **환경변수**: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 등
- **빌드/런**: `npm run build`, `npm run dev`

## 2. 백엔드/DB (Supabase)
- **DB**: Supabase(PostgreSQL)
- **테이블**: users, schedules, attendance_requests, doubles_matches
- **DB 관리**: Supabase Dashboard(SQL Editor, Table Editor)
- **API**: Supabase REST API 사용 (Row Level Security 미사용)
- **DB 마이그레이션**: supabase CLI, SQL Editor

## 3. 기타
- **로컬 개발**: .env 파일에 Supabase 키/URL 필요
- **코드 규칙**: ESM, .js 확장자, strict 타입, 방어적 코딩

---

> 환경별 세팅/배포 방법은 README.md 및 Vercel, Supabase 공식 문서 참고
