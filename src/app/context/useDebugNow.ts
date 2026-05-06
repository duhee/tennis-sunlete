import React from 'react';

export const DEBUG_TIME_ENABLED_KEY = 'sunlete-master-debug-time-enabled';
export const DEBUG_TIME_VALUE_KEY = 'sunlete-master-debug-time-value';
const DEBUG_TIME_EVENT = 'sunlete-debug-time-change';

function readDebugTimeState() {
  if (typeof window === 'undefined') {
    return { enabled: false, value: '' };
  }

  return {
    enabled: window.localStorage.getItem(DEBUG_TIME_ENABLED_KEY) === 'true',
    value: window.localStorage.getItem(DEBUG_TIME_VALUE_KEY) ?? '',
  };
}

function emitDebugTimeChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(DEBUG_TIME_EVENT));
}

export function toDatetimeLocalValue(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function getNextMondayAt11(base: Date): Date {
  const result = new Date(base);
  const day = result.getDay();
  const daysUntilNextMonday = ((8 - day) % 7) || 7;
  result.setDate(result.getDate() + daysUntilNextMonday);
  result.setHours(11, 0, 0, 0);
  return result;
}

export function useDebugNow() {
  const [state, setState] = React.useState(readDebugTimeState);

  React.useEffect(() => {
    const sync = () => setState(readDebugTimeState());

    window.addEventListener('storage', sync);
    window.addEventListener(DEBUG_TIME_EVENT, sync);

    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(DEBUG_TIME_EVENT, sync);
    };
  }, []);

  const setEnabled = React.useCallback((enabled: boolean) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DEBUG_TIME_ENABLED_KEY, String(enabled));
    emitDebugTimeChange();
  }, []);

  const setValue = React.useCallback((value: string) => {
    if (typeof window === 'undefined') return;
    if (value) {
      window.localStorage.setItem(DEBUG_TIME_VALUE_KEY, value);
    } else {
      window.localStorage.removeItem(DEBUG_TIME_VALUE_KEY);
    }
    emitDebugTimeChange();
  }, []);

  const reset = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DEBUG_TIME_ENABLED_KEY, 'false');
    window.localStorage.removeItem(DEBUG_TIME_VALUE_KEY);
    emitDebugTimeChange();
  }, []);

  const debugNow = React.useMemo(() => {
    if (!state.enabled || !state.value) return null;
    const parsed = new Date(state.value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [state.enabled, state.value]);

  return {
    debugTimeEnabled: state.enabled,
    debugTimeValue: state.value,
    debugNow,
    effectiveNow: debugNow ?? new Date(),
    setDebugTimeEnabled: setEnabled,
    setDebugTimeValue: setValue,
    resetDebugTime: reset,
  };
}