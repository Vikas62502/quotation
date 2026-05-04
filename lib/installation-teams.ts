export const INSTALLATION_TEAMS_STORAGE_KEY = "installationTeams"
export const INSTALLATION_TEAM_ASSIGNMENTS_KEY = "installationTeamAssignmentsByQuotationId"

export type InstallationTeamRecord = {
  id: string
  name: string
  username: string
  password: string
  createdAt: string
  createdBy?: string
  isActive?: boolean
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `it-${Date.now()}-${Math.random().toString(16).slice(2)}`

export function readInstallationTeams(): InstallationTeamRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = JSON.parse(localStorage.getItem(INSTALLATION_TEAMS_STORAGE_KEY) || "[]")
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function writeInstallationTeams(teams: InstallationTeamRecord[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(INSTALLATION_TEAMS_STORAGE_KEY, JSON.stringify(teams))
  } catch {
    // no-op
  }
}

export function createInstallationTeam(input: {
  name: string
  username: string
  password: string
  createdBy?: string
}): InstallationTeamRecord | null {
  const name = input.name.trim()
  const username = input.username.trim().toLowerCase()
  const password = input.password
  if (!name || !username || !password) return null
  const teams = readInstallationTeams()
  if (teams.some((t) => String(t.username || "").toLowerCase() === username)) return null
  const row: InstallationTeamRecord = {
    id: newId(),
    name,
    username,
    password,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    isActive: true,
  }
  writeInstallationTeams([...teams, row])
  return row
}

export function deleteInstallationTeam(teamId: string) {
  const teams = readInstallationTeams().filter((t) => t.id !== teamId)
  writeInstallationTeams(teams)
  const map = readTeamAssignments()
  const next: Record<string, string> = {}
  Object.entries(map).forEach(([qid, tid]) => {
    if (tid !== teamId) next[qid] = tid
  })
  writeTeamAssignments(next)
}

export function readTeamAssignments(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = JSON.parse(localStorage.getItem(INSTALLATION_TEAM_ASSIGNMENTS_KEY) || "{}")
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}
  } catch {
    return {}
  }
}

export function writeTeamAssignments(map: Record<string, string>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(INSTALLATION_TEAM_ASSIGNMENTS_KEY, JSON.stringify(map))
  } catch {
    // no-op
  }
}

export function setTeamAssignment(quotationId: string, teamId: string | null | undefined) {
  const map = { ...readTeamAssignments() }
  if (!teamId) delete map[quotationId]
  else map[quotationId] = teamId
  writeTeamAssignments(map)
}

/** Resolved team id for a quotation (API field wins, then local assignment map). */
export function getInstallationTeamIdForQuotation(quotationId: string, q?: { installationTeamId?: string; installation_team_id?: string }): string | undefined {
  const fromQ = (q as any)?.installationTeamId || (q as any)?.installation_team_id
  if (fromQ) return String(fromQ)
  const map = readTeamAssignments()
  return map[quotationId]
}
