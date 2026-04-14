const SHEETS = {
  USERS: "users",
  SCHEDULES: "schedules",
  ATTENDANCE_REQUESTS: "attendance_requests",
  DOUBLES_MATCHES: "doubles_matches",
};

const HEADERS = {
  users: [
    "id",
    "name",
    "gender",
    "phone_last4",
    "active_seasons_json",
    "is_guest",
    "is_withdrawn",
    "season_stats_json",
    "avatar",
    "updated_at",
  ],
  schedules: [
    "id",
    "date",
    "attendance_deadline",
    "status",
    "max_participants",
    "updated_at",
  ],
  attendance_requests: ["schedule_id", "user_id", "requested_at", "status"],
  doubles_matches: [
    "id",
    "schedule_id",
    "date",
    "team_a_json",
    "team_b_json",
    "score_a",
    "score_b",
    "result",
    "is_confirmed",
    "updated_at",
  ],
};

function doOptions(e) {
  return ContentService.createTextOutput("").setMimeType(
    ContentService.MimeType.TEXT,
  );
}

function doGet() {
  try {
    const payload = readAppData_();
    return jsonOutput_(payload);
  } catch (error) {
    return jsonOutput_({
      message: "Failed to read app data",
      error: String(error),
    });
  }
}

function doPost(e) {
  try {
    const parsed = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    if (!isValidAppData_(parsed)) {
      return jsonOutput_({ ok: false, message: "Invalid app data shape" });
    }

    writeAppData_(parsed);
    return jsonOutput_({ ok: true });
  } catch (error) {
    return jsonOutput_({
      ok: false,
      message: "Failed to save app data",
      error: String(error),
    });
  }
}

function readAppData_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSchema_(ss);

  const users = readUsers_(ss);
  const schedules = readSchedules_(ss, users);
  const doublesMatches = readDoublesMatches_(ss);

  return { users, schedules, doublesMatches };
}

function writeAppData_(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSchema_(ss);

  writeUsers_(ss, data.users || []);
  writeSchedulesAndAttendance_(ss, data.schedules || []);
  writeDoublesMatches_(ss, data.doublesMatches || []);
}

function ensureSchema_(ss) {
  migrateSheetSchema_(ss, SHEETS.USERS, HEADERS.users);
  migrateSheetSchema_(ss, SHEETS.SCHEDULES, HEADERS.schedules);
  migrateSheetSchema_(
    ss,
    SHEETS.ATTENDANCE_REQUESTS,
    HEADERS.attendance_requests,
  );
  migrateSheetSchema_(ss, SHEETS.DOUBLES_MATCHES, HEADERS.doubles_matches);
}

// Automatically migrates an existing sheet to the new column definition.
// - New columns are added with blank values.
// - Removed columns are dropped (data is discarded).
// - Reordered columns are remapped so existing data stays in the right place.
// No-op (fast check) if schema is already up to date.
function migrateSheetSchema_(ss, sheetName, newHeaders) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
    return;
  }

  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
    return;
  }

  const existingHeaders = sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(String);

  // Fast-path: already up to date
  const same =
    existingHeaders.length === newHeaders.length &&
    newHeaders.every(function (h, i) {
      return h === existingHeaders[i];
    });
  if (same) return;

  // Read all existing data rows (may be empty)
  const lastRow = sheet.getLastRow();
  const existingData =
    lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];

  // Remap each row: keep value if column name matches, blank for new columns
  const migratedData = existingData.map(function (row) {
    return newHeaders.map(function (newHeader) {
      const oldIdx = existingHeaders.indexOf(newHeader);
      return oldIdx >= 0 ? row[oldIdx] : "";
    });
  });

  sheet.clearContents();
  sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
  if (migratedData.length > 0) {
    sheet
      .getRange(2, 1, migratedData.length, newHeaders.length)
      .setValues(migratedData);
  }

  Logger.log(
    "Schema migrated [" +
      sheetName +
      "]: " +
      existingHeaders.join(",") +
      " → " +
      newHeaders.join(","),
  );
}

// Run this once from the Apps Script editor (▶ Run > runSchemaMigration)
// after deploying a new Code.gs to immediately update all sheet schemas.
function runSchemaMigration() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  migrateSheetSchema_(ss, SHEETS.USERS, HEADERS.users);
  migrateSheetSchema_(ss, SHEETS.SCHEDULES, HEADERS.schedules);
  migrateSheetSchema_(
    ss,
    SHEETS.ATTENDANCE_REQUESTS,
    HEADERS.attendance_requests,
  );
  migrateSheetSchema_(ss, SHEETS.DOUBLES_MATCHES, HEADERS.doubles_matches);
  SpreadsheetApp.getUi().alert(
    "✅ Schema migration complete!\n\nAll sheets are now up to date.",
  );
}

function readUsers_(ss) {
  const sheet = ss.getSheetByName(SHEETS.USERS);
  const rows = getDataRowsAsObjects_(sheet, HEADERS.users);

  return rows.map(function (row) {
    return {
      id: toString_(row.id),
      name: toString_(row.name),
      gender: toString_(row.gender) || "M",
      phoneLast4: toString_(row.phone_last4),
      activeSeasons: parseJsonArray_(row.active_seasons_json),
      isGuest: toBoolean_(row.is_guest),
      isWithdrawn: toBoolean_(row.is_withdrawn),
      seasonStats: parseSeasonStats_(row.season_stats_json),
      avatar: toString_(row.avatar) || undefined,
    };
  });
}

function readSchedules_(ss, users) {
  const scheduleSheet = ss.getSheetByName(SHEETS.SCHEDULES);
  const attendanceSheet = ss.getSheetByName(SHEETS.ATTENDANCE_REQUESTS);

  const scheduleRows = getDataRowsAsObjects_(scheduleSheet, HEADERS.schedules);
  const attendanceRows = getDataRowsAsObjects_(
    attendanceSheet,
    HEADERS.attendance_requests,
  );

  const requestsBySchedule = {};
  attendanceRows.forEach(function (row) {
    const scheduleId = toString_(row.schedule_id);
    if (!scheduleId) return;

    if (!requestsBySchedule[scheduleId]) {
      requestsBySchedule[scheduleId] = [];
    }

    requestsBySchedule[scheduleId].push({
      userId: toString_(row.user_id),
      requestedAt: toString_(row.requested_at),
      status: toString_(row.status) || "absent",
    });
  });

  return scheduleRows.map(function (row) {
    const id = toString_(row.id);
    const attendanceRequests = requestsBySchedule[id] || [];
    const maxParticipants = toNumber_(row.max_participants);
    const derived = deriveParticipantState_(
      attendanceRequests,
      users,
      maxParticipants,
    );

    return {
      id: id,
      date: toDateOnlyString_(row.date),
      attendanceRequests: attendanceRequests,
      participants: derived.participants,
      waitlist: derived.waitlist,
      attendanceDeadline: toString_(row.attendance_deadline),
      status: toString_(row.status) || "open",
      maxParticipants: maxParticipants,
    };
  });
}

function readDoublesMatches_(ss) {
  const sheet = ss.getSheetByName(SHEETS.DOUBLES_MATCHES);
  const rows = getDataRowsAsObjects_(sheet, HEADERS.doubles_matches);

  return rows.map(function (row) {
    return {
      id: toString_(row.id),
      scheduleId: toString_(row.schedule_id),
      date: toString_(row.date),
      teamA: parseJsonArray_(row.team_a_json),
      teamB: parseJsonArray_(row.team_b_json),
      scoreA: toNullableNumber_(row.score_a),
      scoreB: toNullableNumber_(row.score_b),
      result: toNullableString_(row.result),
      isConfirmed: toBoolean_(row.is_confirmed),
    };
  });
}

function writeUsers_(ss, users) {
  const sheet = ss.getSheetByName(SHEETS.USERS);

  // Merge with existing seasonStats to prevent data loss
  const existingUsers = readUsers_(ss);

  const values = users.map(function (user) {
    // Find existing user to merge seasonStats
    const existingUser = existingUsers.find(function (u) {
      return u.id === user.id;
    });

    let mergedSeasonStats = user.seasonStats || [];

    if (
      existingUser &&
      existingUser.seasonStats &&
      existingUser.seasonStats.length > 0
    ) {
      // Merge: combine existing and new seasonStats by seasonCode
      const newStatsMap = {};
      mergedSeasonStats.forEach(function (stat) {
        newStatsMap[stat.seasonCode] = stat;
      });

      // 기존 시즌 데이터 보존하되, 새로운 데이터로 업데이트
      existingUser.seasonStats.forEach(function (stat) {
        if (!newStatsMap[stat.seasonCode]) {
          mergedSeasonStats.push(stat);
        }
      });
    }

    return [
      toString_(user.id),
      toString_(user.name),
      toString_(user.gender),
      toString_(user.phoneLast4),
      JSON.stringify(user.activeSeasons || []),
      Boolean(user.isGuest),
      Boolean(user.isWithdrawn),
      JSON.stringify(mergedSeasonStats),
      toString_(user.avatar),
      nowIso_(),
    ];
  });

  rewriteSheet_(sheet, HEADERS.users, values);
}

function writeSchedulesAndAttendance_(ss, schedules) {
  const scheduleSheet = ss.getSheetByName(SHEETS.SCHEDULES);
  const attendanceSheet = ss.getSheetByName(SHEETS.ATTENDANCE_REQUESTS);

  const scheduleValues = [];
  const attendanceValues = [];

  schedules.forEach(function (schedule) {
    scheduleValues.push([
      toString_(schedule.id),
      toDateOnlyString_(schedule.date),
      toString_(schedule.attendanceDeadline),
      toString_(schedule.status),
      toNumber_(schedule.maxParticipants),
      nowIso_(),
    ]);

    (schedule.attendanceRequests || []).forEach(function (req) {
      attendanceValues.push([
        toString_(schedule.id),
        toString_(req.userId),
        toString_(req.requestedAt),
        toString_(req.status),
      ]);
    });
  });

  rewriteSheet_(scheduleSheet, HEADERS.schedules, scheduleValues);
  rewriteSheet_(attendanceSheet, HEADERS.attendance_requests, attendanceValues);
}

function writeDoublesMatches_(ss, matches) {
  const sheet = ss.getSheetByName(SHEETS.DOUBLES_MATCHES);
  const values = matches.map(function (m) {
    return [
      toString_(m.id),
      toString_(m.scheduleId),
      toString_(m.date),
      JSON.stringify(m.teamA || []),
      JSON.stringify(m.teamB || []),
      nullableNumberToSheet_(m.scoreA),
      nullableNumberToSheet_(m.scoreB),
      toNullableString_(m.result),
      Boolean(m.isConfirmed),
      nowIso_(),
    ];
  });

  rewriteSheet_(sheet, HEADERS.doubles_matches, values);
}

function rewriteSheet_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function getDataRowsAsObjects_(sheet, headers) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values
    .filter(function (row) {
      return row.some(function (cell) {
        return String(cell).trim() !== "";
      });
    })
    .map(function (row) {
      const obj = {};
      headers.forEach(function (header, idx) {
        obj[header] = row[idx];
      });
      return obj;
    });
}

function deriveParticipantState_(attendanceRequests, users, maxParticipants) {
  const userById = {};
  (users || []).forEach(function (user) {
    userById[String(user.id)] = user;
  });

  const attendOnly = (attendanceRequests || []).filter(function (r) {
    return r.status === "attend";
  });

  const ranked = attendOnly.slice().sort(function (a, b) {
    const rateA = attendanceRate_(userById[a.userId]);
    const rateB = attendanceRate_(userById[b.userId]);

    if (rateA !== rateB) {
      return rateA - rateB;
    }

    return (
      new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime()
    );
  });

  const cap = Math.max(0, toNumber_(maxParticipants));
  const participants = ranked.slice(0, cap).map(function (r) {
    return r.userId;
  });
  const waitlist = ranked.slice(cap).map(function (r) {
    return r.userId;
  });

  return { participants: participants, waitlist: waitlist };
}

function attendanceRate_(user) {
  if (!user || !user.seasonStats || user.seasonStats.length === 0) return 0;

  const seasonStats = user.seasonStats;
  const totalAttended = seasonStats.reduce(function (sum, s) {
    return sum + toNumber_(s.attended_sessions);
  }, 0);
  const totalSessions = seasonStats.reduce(function (sum, s) {
    return sum + toNumber_(s.total_sessions);
  }, 0);

  if (totalSessions <= 0) return 0;

  return Math.round((totalAttended / totalSessions) * 100);
}

function isValidAppData_(data) {
  return (
    data &&
    typeof data === "object" &&
    Array.isArray(data.users) &&
    Array.isArray(data.schedules) &&
    Array.isArray(data.doublesMatches)
  );
}

function parseJsonArray_(value) {
  const text = toString_(value);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed)
      ? parsed.map(function (v) {
          return String(v);
        })
      : [];
  } catch (error) {
    return [];
  }
}

function parseSeasonStats_(value) {
  const text = toString_(value);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed)
      ? parsed.map(function (item) {
          return {
            seasonCode: toString_(item.seasonCode),
            total_sessions: toNumber_(item.total_sessions),
            attended_sessions: toNumber_(item.attended_sessions),
            wins: toNumber_(item.wins),
            losses: toNumber_(item.losses),
          };
        })
      : [];
  } catch (error) {
    return [];
  }
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function nowIso_() {
  return new Date().toISOString();
}

function toString_(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toDateOnlyString_(value) {
  if (value === null || value === undefined) return "";

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone() || "Asia/Seoul",
      "yyyy-MM-dd",
    );
  }

  const text = toString_(value);
  if (!text) return "";

  const ymd = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    return ymd[1] + "-" + ymd[2] + "-" + ymd[3];
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return Utilities.formatDate(
      parsed,
      Session.getScriptTimeZone() || "Asia/Seoul",
      "yyyy-MM-dd",
    );
  }

  return text;
}

function toBoolean_(value) {
  if (typeof value === "boolean") return value;
  const normalized = toString_(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function toNumber_(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toNullableNumber_(value) {
  const text = toString_(value);
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function nullableNumberToSheet_(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
}

function toNullableString_(value) {
  const text = toString_(value);
  return text || null;
}
