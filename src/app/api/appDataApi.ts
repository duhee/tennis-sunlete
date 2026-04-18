import type { DoublesMatch, User, WeeklyMatchSchedule } from '../data/mockData.js';

export interface PersistedData {
  users: User[];
  schedules: WeeklyMatchSchedule[];
  doublesMatches: DoublesMatch[];
}

const APP_DATA_API_URL = '/api/proxy';
const APP_DATA_API_MODE = (import.meta.env.VITE_APP_DATA_API_MODE || 'local').trim().toLowerCase();

function getEndpointUrl() {
  if (APP_DATA_API_MODE !== 'apps-script' || !APP_DATA_API_URL) {
    throw new Error('Google Sheets 연동 전용 모드입니다. .env.local의 Apps Script 설정을 확인해주세요.');
  }
  return APP_DATA_API_URL;
}

function isAppsScriptMode() {
  return APP_DATA_API_MODE === 'apps-script';
}

async function parseJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

export async function fetchAppData(): Promise<PersistedData | null> {
  const response = await fetch(getEndpointUrl(), {
    method: 'GET',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Failed to fetch app data from server.');
  }

  return (await parseJson(response)) as PersistedData;
}

export async function saveAppData(data: PersistedData): Promise<void> {
  const response = await fetch(getEndpointUrl(), {
    method: isAppsScriptMode() ? 'POST' : 'PUT',
    headers: isAppsScriptMode() ? {
      'Content-Type': 'text/plain;charset=utf-8',
    } : {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to save app data to server.');
  }

  if (isAppsScriptMode()) {
    const parsed = await parseJson(response);
    if (parsed && parsed.ok === false) {
      throw new Error(parsed.message || 'Failed to save app data to Apps Script.');
    }
  }
}
