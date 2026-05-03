import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Badge } from '../ui/badge.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table.js';
import { getTotalStats, type User as UserType } from '../../data/mockData.js';

interface GuestListPanelProps {
  guestUsers: UserType[];
  isMobilePreview: boolean;
}

export function GuestListPanel({ guestUsers, isMobilePreview }: GuestListPanelProps) {
  return (
    <Card className="mt-6 mb-6">
      <CardHeader>
        <CardTitle>게스트 목록</CardTitle>
      </CardHeader>
      <CardContent>
        {guestUsers.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 게스트가 없습니다</p>
        ) : isMobilePreview ? (
          <div className="space-y-2">
            {guestUsers.map(guest => {
              const guestTotals = getTotalStats(guest);
              return (
                <div key={guest.id} className="rounded-lg border border-gray-200 bg-white px-3 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#030213]">{guest.name}</p>
                      <p className="text-xs text-gray-500">{guest.gender === 'F' ? '여성' : '남성'}</p>
                    </div>
                    <Badge variant="outline">게스트</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">전적</span>
                    <span className="font-medium">{guestTotals.wins}승 {guestTotals.losses}패</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>성별</TableHead>
                  <TableHead>표시</TableHead>
                  <TableHead>전적</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guestUsers.map(guest => {
                  const guestTotals = getTotalStats(guest);
                  return (
                    <TableRow key={guest.id}>
                      <TableCell className="font-medium">{guest.name}</TableCell>
                      <TableCell>{guest.gender === 'F' ? '여성' : '남성'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">게스트</Badge>
                      </TableCell>
                      <TableCell>{guestTotals.wins}승 {guestTotals.losses}패</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
