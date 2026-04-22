// src/app/types/AppData.ts


export interface User {
  id: string;
  name: string;
  gender: 'M' | 'F' | 'W'; // 남성/여성/미상
  phoneLast4?: string;
  password?: string; // 로그인용 비밀번호(plain, 예시)
  isGuest?: boolean;
  activeSeasons?: string[];
  seasonStats?: Array<{
    seasonCode: string;
    total_sessions: number;
    attended_sessions: number;
    wins: number;
    losses: number;
  }>;
  [key: string]: any;
}

export interface Schedule {
  id: string;
  date: string;
  attendanceDeadline?: string;
  participants: string[];
  waitlist: string[];
  maxParticipants: number;
  [key: string]: any;
}

export interface DoublesMatch {
  id: string;
  teamA: string[];
  teamB: string[];
  [key: string]: any;
}

export interface AppData {
  users: User[];
  schedules: Schedule[];
  doublesMatches: DoublesMatch[];
  [key: string]: any;
}
