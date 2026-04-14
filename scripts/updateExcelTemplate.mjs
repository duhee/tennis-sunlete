import fs from 'node:fs/promises';
import XLSX from 'xlsx';

const raw = await fs.readFile('server/data/app-data.json', 'utf-8');
const data = JSON.parse(raw);

const wb = XLSX.utils.book_new();
const now = new Date().toISOString();

const usersSheet = [
  ['id', 'name', 'gender', 'phone_last4', 'active_seasons_json', 'is_guest', 'total_sessions', 'attended_sessions', 'wins', 'losses', 'avatar', 'updated_at'],
  ...((data.users ?? []).map((u) => [
    u.id ?? '',
    u.name ?? '',
    u.gender ?? '',
    u.phoneLast4 ?? '',
    JSON.stringify(u.activeSeasons ?? []),
    Boolean(u.isGuest),
    Number(u.total_sessions ?? 0),
    Number(u.attended_sessions ?? 0),
    Number(u.wins ?? 0),
    Number(u.losses ?? 0),
    u.avatar ?? '',
    now,
  ])),
];

const schedulesSheet = [
  ['id', 'date', 'attendance_deadline', 'status', 'max_participants', 'updated_at'],
  ...((data.schedules ?? []).map((s) => [
    s.id ?? '',
    s.date ?? '',
    s.attendanceDeadline ?? '',
    s.status ?? '',
    Number(s.maxParticipants ?? 0),
    now,
  ])),
];

const attendanceRows = [];
for (const schedule of data.schedules ?? []) {
  for (const req of schedule.attendanceRequests ?? []) {
    attendanceRows.push([
      schedule.id ?? '',
      req.userId ?? '',
      req.requestedAt ?? '',
      req.status ?? '',
    ]);
  }
}
const attendanceSheet = [
  ['schedule_id', 'user_id', 'requested_at', 'status'],
  ...attendanceRows,
];

const matchesSheet = [
  ['id', 'schedule_id', 'date', 'team_a_json', 'team_b_json', 'score_a', 'score_b', 'result', 'is_confirmed', 'updated_at'],
  ...((data.doublesMatches ?? []).map((m) => [
    m.id ?? '',
    m.scheduleId ?? '',
    m.date ?? '',
    JSON.stringify(m.teamA ?? []),
    JSON.stringify(m.teamB ?? []),
    m.scoreA ?? '',
    m.scoreB ?? '',
    m.result ?? '',
    Boolean(m.isConfirmed),
    now,
  ])),
];

XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(usersSheet), 'users');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(schedulesSheet), 'schedules');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(attendanceSheet), 'attendance_requests');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matchesSheet), 'doubles_matches');

XLSX.writeFile(wb, 'tennis-db-template.xlsx');
console.log('updated: tennis-db-template.xlsx');
