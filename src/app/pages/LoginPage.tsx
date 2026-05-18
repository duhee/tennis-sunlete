import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useAppData } from '../context/AppDataContext.js';
import { reportFailedLogin, reportLoginAttempt } from '../api/appDataApi.js';
import { Card, CardContent, CardHeader } from '../components/ui/card.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [phoneLast4, setPhoneLast4] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const { getUserByName, users, hydrated } = useAppData();
  const navigate = useNavigate();

  const isValidPhoneLast4 = (value: string) => /^\d{4}$/.test(value);
  // 이름에서 공백, 괄호, '마스터' 등 부가 텍스트 제거
  const normalizeName = (value: string) => value.replace(/\s+/g, '').replace(/\(.*?\)/g, '').replace(/마스터/g, '').trim();

  const findUsersByFlexibleName = (rawName: string) => {
    const normalizedInput = normalizeName(rawName);

    const matched = users.filter((user: any) => {
      const target = normalizeName(user.name || '');
      return target === normalizedInput;
    });

    if (matched.length > 0) {
      return matched;
    }

    // 기존 동작 호환: 완전 일치가 있으면 후보로 포함
    const direct = getUserByName(rawName.trim());
    return direct ? [direct] : [];
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // console.log('[LoginPage] handleLogin called', { username, phoneLast4, usersCount: users.length, hydrated });
    // console.log('[LoginPage] users from context', users.map(u => ({ name: u.name, phoneLast4: u.phoneLast4, isGuest: u.isGuest, isWithdrawn: u.isWithdrawn, id: u.id })));
    setError('');

    if (!username || !phoneLast4) {
      setError('성함과 휴대폰 뒷자리 4자리를 입력해주세요');
      return;
    }

    if (!isValidPhoneLast4(phoneLast4)) {
      setError('휴대폰 뒷자리 4자리를 숫자로 입력해주세요');
      return;
    }

    const normalized = username.trim();
    if (normalizeName(normalized) === '장두희(마스터)') {
      setError('장두희로 로그인해주세요');
      return;
    }

    const candidates = findUsersByFlexibleName(normalized);

    // 동일 이름이 회원/게스트로 중복될 수 있어, 회원+전화번호 일치 항목을 최우선으로 선택
    const preferredUser =
      candidates.find((item: any) => !item.isGuest && !item.id.startsWith('guest-') && item.phoneLast4 === phoneLast4) ||
      candidates.find((item: any) => !item.isGuest && !item.id.startsWith('guest-')) ||
      candidates[0];

    const user = preferredUser;
    // console.log('[LoginPage] findUserByFlexibleName for "' + normalized + '"', { 
    //   found: !!user,
    //   name: user?.name,
    //   id: user?.id,
    //   isGuest: user?.isGuest,
    //   isWithdrawn: user?.isWithdrawn,
    //   idStartsWithGuest: user?.id?.startsWith('guest-'),
    // });

    if (!user || user.isGuest || user.id.startsWith('guest-')) {
      const reason = !user ? '회원 없음' : user.isGuest ? '게스트 플래그' : 'id가 guest-로 시작';
      // console.log('[LoginPage] 등록된 회원만 로그인 가능 - 실패 사유: ' + reason);
      await reportFailedLogin({
        inputName: normalized,
        inputPhoneLast4: phoneLast4,
        reason: reason,
        foundInDb: !!user,
        isGuest: user?.isGuest ?? false,
      });
      setError('등록된 회원만 로그인할 수 있습니다');
      return;
    }

    if (user.isWithdrawn) {
      // console.log('[LoginPage] 탈퇴 처리된 회원');
      await reportFailedLogin({
        inputName: normalized,
        inputPhoneLast4: phoneLast4,
        reason: '탈퇴 처리된 회원',
        foundInDb: true,
        isWithdrawn: true,
      });
      setError('탈퇴 처리된 회원은 로그인할 수 없습니다');
      return;
    }

    if (!user.phoneLast4) {
      await reportFailedLogin({
        inputName: normalized,
        inputPhoneLast4: phoneLast4,
        reason: '회원 비밀번호 미등록',
        foundInDb: true,
      });
      setError('회원 비밀번호(휴대폰 뒷자리)가 등록되지 않았습니다. 관리자에게 문의해주세요');
      return;
    }

    if (phoneLast4 !== user.phoneLast4) {
      // console.log('[LoginPage] 휴대폰 뒷자리 불일치');
      await reportFailedLogin({
        inputName: normalized,
        inputPhoneLast4: phoneLast4,
        reason: '비밀번호 불일치',
        foundInDb: true,
      });
      setError('휴대폰 뒷자리 4자리가 일치하지 않습니다');
      return;
    }

    const success = login(user, phoneLast4);
    // console.log('[LoginPage] login result', { success, userName: user?.name, inputPhoneLast4: phoneLast4, storedPhoneLast4: user?.phoneLast4 });
    if (!success) {
      await reportFailedLogin({
        inputName: normalized,
        inputPhoneLast4: phoneLast4,
        reason: '인증 처리 실패',
        foundInDb: true,
      });
      setError('로그인 처리 중 오류가 발생했습니다');
      return;
    }

    await reportLoginAttempt({
      inputName: normalized,
      inputPhoneLast4: phoneLast4,
      reason: '로그인 성공',
      foundInDb: true,
      isGuest: false,
      isWithdrawn: false,
    });

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
              <Label htmlFor="phoneLast4">휴대폰 뒷자리 4자리</Label>
              <Input
                id="phoneLast4"
                name="phoneLast4"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="숫자 4자리를 입력하세요"
                value={phoneLast4}
                onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
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
              로그인
            </Button>

            <div 
              className="text-xs text-center p-3 rounded-lg mt-4"
              style={{ backgroundColor: '#F8F9FA' }}
            >
              <p className="mb-2 font-medium">로그인 안내</p>
              <p>등록된 회원만 로그인 가능합니다</p>
              <p className="mt-2 text-gray-500">입력값: 등록된 휴대폰 뒷자리 4자리</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
