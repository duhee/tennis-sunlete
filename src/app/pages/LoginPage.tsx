import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const { getUserByName, users } = useAppData();
  const navigate = useNavigate();

  const isValidPhoneLast4 = (value: string) => /^\d{4}$/.test(value);
  const normalizeName = (value: string) => value.replace(/\s+/g, '').trim();
  const isMasterName = (value: string) => normalizeName(value) === '장두희';

  const findUserByFlexibleName = (rawName: string) => {
    const normalizedInput = normalizeName(rawName);

    const direct = getUserByName(rawName.trim());
    if (direct) return direct;

    return users.find(user => {
      const target = normalizeName(user.name || '');
      if (target === normalizedInput) return true;

      if (isMasterName(rawName)) {
        const stripped = target.replace('(마스터)', '');
        return stripped === '장두희';
      }

      return false;
    });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('성함과 비밀번호를 입력해주세요');
      return;
    }

    if (!isValidPhoneLast4(password)) {
      setError('비밀번호는 휴대폰 뒷번호 4자리를 입력해주세요');
      return;
    }

    const normalized = username.trim();
    if (normalizeName(normalized) === '장두희(마스터)') {
      setError('장두희로 로그인해주세요');
      return;
    }

    const user = findUserByFlexibleName(normalized);

    if (!user || user.isGuest || user.id.startsWith('guest-')) {
      setError('등록된 회원만 로그인할 수 있습니다');
      return;
    }

    if (user.isWithdrawn) {
      setError('탈퇴 처리된 회원은 로그인할 수 없습니다');
      return;
    }

    if (!user.phoneLast4) {
      setError('회원 비밀번호(휴대폰 뒷번호)가 등록되지 않았습니다. 관리자에게 문의해주세요');
      return;
    }

    if (password !== user.phoneLast4) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }

    const loginName = isMasterName(normalized) ? '장두희' : user.name;
    const success = login(loginName, password);
    if (!success) {
      setError('로그인 처리 중 오류가 발생했습니다');
      return;
    }

    navigate('/');
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center">
            <img
              src="/slt.png"
              alt="선레테 로고"
              className="h-40 w-auto max-w-[220px] object-contain"
            />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">성함</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="이름을 입력하세요"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="name"
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full"
              />
            </div>

            {error && (
              <div 
                className="text-sm p-3 rounded-lg"
                style={{ backgroundColor: '#FFF5F7', color: '#FF4D4D' }}
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              style={{ backgroundColor: '#FFC1CC', color: '#030213' }}
            >
              Login
            </Button>

            <div 
              className="text-xs text-center p-3 rounded-lg mt-4"
              style={{ backgroundColor: '#F8F9FA' }}
            >
              <p className="mb-2 font-medium">로그인 안내</p>
              <p>등록된 회원만 로그인 가능합니다</p>
              <p className="mt-2 text-gray-500">비밀번호: 휴대폰 뒷번호 4자리</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
