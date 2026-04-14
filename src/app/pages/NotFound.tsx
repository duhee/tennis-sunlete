import { Link } from "react-router";

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <p className="text-xl mb-8">페이지를 찾을 수 없습니다</p>
        <Link 
          to="/" 
          className="px-6 py-3 rounded-lg"
          style={{ backgroundColor: '#FFC1CC', color: '#030213' }}
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
