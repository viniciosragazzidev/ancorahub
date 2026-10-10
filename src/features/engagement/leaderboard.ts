import type { LeaderboardBroker, LeaderboardTeam, TeamInternalLeaderboard, TeamLeaderboard, UnitLeaderboard, JourneyWeek } from "./journey-types";

export type BrokerStanding = Omit<LeaderboardBroker, "position" | "previousPosition" | "positionChange">;
export type TeamProfile = { supervisorId: string; name: string; imageUrl: string | null; branchId: string | null };
function positions<T>(rows: readonly T[], score: (row: T) => number, id: (row: T) => string): Map<string, number> {
  const ordered = [...rows].sort((a, b) => score(b) - score(a) || id(a).localeCompare(id(b)));
  let rank = 0;
  return new Map(ordered.map((row, i) => {
    if (i === 0 || score(row) !== score(ordered[i - 1]!)) rank = i + 1;
    return [id(row), rank];
  }));
}
export function rankBrokers(rows: readonly BrokerStanding[]): LeaderboardBroker[] {
  const current = positions(rows, (r) => r.points, (r) => r.brokerId);
  const previous = positions(rows, (r) => r.previousPoints, (r) => r.brokerId);
  return rows.map((row) => ({ ...row, position: current.get(row.brokerId)!, previousPosition: previous.get(row.brokerId)!, positionChange: previous.get(row.brokerId)! - current.get(row.brokerId)! }))
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "pt-BR") || a.brokerId.localeCompare(b.brokerId));
}
export function buildUnitLeaderboard(week: JourneyWeek, rows: readonly BrokerStanding[], brokerId: string): UnitLeaderboard {
  // Whoever left the board is out of the ranking for everyone else: no position, no gap, no count
  // that could reveal their points. The viewer always sees their own place among the visible ones.
  const ranked = rankBrokers(rows.filter((row) => !row.optedOut || row.brokerId === brokerId));
  const self = ranked.find((row) => row.brokerId === brokerId) ?? null;
  const next = self ? ranked.filter((r) => r.points > self.points && r.brokerId !== brokerId).at(-1) : null;
  return { ...week, topThree: ranked.filter((r) => !r.optedOut).slice(0, 3), self,
    gapToNext: self && next ? next.points - self.points : null, totalParticipants: ranked.length };
}
export function buildTeamLeaderboard(week: JourneyWeek, rows: readonly BrokerStanding[], profiles: readonly TeamProfile[]): TeamLeaderboard {
  const teams = profiles.flatMap((profile) => {
    const members = rows.filter((row) => row.supervisorId === profile.supervisorId && row.branchId === profile.branchId);
    if (!members.length) return [];
    const totalPoints = members.reduce((n, row) => n + row.points, 0);
    const previousPoints = members.reduce((n, row) => n + row.previousPoints, 0);
    return [{ ...profile, activeBrokers: members.length, totalPoints, averagePoints: totalPoints / members.length, previousAveragePoints: previousPoints / members.length }];
  });
  const current = positions(teams, (r) => r.averagePoints, (r) => r.supervisorId);
  const previous = positions(teams, (r) => r.previousAveragePoints, (r) => r.supervisorId);
  const ranked: LeaderboardTeam[] = teams.map((team) => ({ ...team, position: current.get(team.supervisorId)!, previousPosition: previous.get(team.supervisorId)!, positionChange: previous.get(team.supervisorId)! - current.get(team.supervisorId)! }));
  return { ...week, teams: ranked.sort((a, b) => a.position - b.position || a.supervisorId.localeCompare(b.supervisorId)) };
}
export function buildTeamInternal(week: JourneyWeek, rows: readonly BrokerStanding[], supervisorId: string, viewerId?: string): TeamInternalLeaderboard {
  return { ...week, supervisorId, brokers: rankBrokers(rows.filter((r) => r.supervisorId === supervisorId)).filter((r) => !r.optedOut || r.brokerId === viewerId) };
}
