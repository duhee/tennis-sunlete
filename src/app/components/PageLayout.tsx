import React from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useAppData } from '../context/AppDataContext.js';
import {
  Calendar,
  User,
  Users,
  Clock3,
} from 'lucide-react';

interface PageLayoutProps {
  children: React.ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  const { currentUser, isAdmin } = useAuth();
  const { users } = useAppData();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const user = users.find((u: any) => u.name === currentUser);
  const userId = user?.id;

  const getActiveTab = (): 'bracket' | 'attendance' | 'profile' | 'master' => {
    if (location.pathname === '/') {
      return searchParams.get('tab') === 'attendance' ? 'attendance' : 'bracket';
    }
    if (location.pathname === '/master') return 'master';
    if (location.pathname.startsWith('/profile')) return 'profile';
    return 'bracket';
  };

  const activeTab = getActiveTab();

  const handleBracketClick = () => {
    navigate('/');
  };

  const handleAttendanceClick = () => {
    navigate('/?tab=attendance');
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      {children}

      <nav className="fixed bottom-0 left-0 right-0 border-t bg-white" style={{ borderTopColor: '#F8F9FA' }}>
        <div className="max-w-md mx-auto flex items-center justify-evenly gap-1 px-3 py-3">
          <button
            onClick={handleBracketClick}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs cursor-pointer"
            style={activeTab === 'bracket' ? { backgroundColor: '#FFC1CC', color: '#030213' } : { color: '#6B7280' }}>
            <Calendar className="w-5 h-5" />
            <span>대진표</span>
          </button>

          <button
            onClick={handleAttendanceClick}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs cursor-pointer"
            style={activeTab === 'attendance' ? { backgroundColor: '#FFC1CC', color: '#030213' } : { color: '#6B7280' }}>
            <Clock3 className="w-5 h-5" />
            <span>출석</span>
          </button>

          <Link to={`/profile/${userId}`} className="flex flex-col items-center gap-1 px-4 py-2"
            style={activeTab === 'profile' ? { backgroundColor: '#FFC1CC', color: '#030213' } : { color: '#6B7280' }}>
            <User className="w-5 h-5" />
            <span className="text-xs">프로필</span>
          </Link>

          {isAdmin && (
            <Link to="/master" className="flex flex-col items-center gap-1 px-4 py-2"
              style={activeTab === 'master' ? { backgroundColor: '#FFC1CC', color: '#030213' } : { color: '#6B7280' }}>
              <Users className="w-5 h-5" />
              <span className="text-xs">관리</span>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
