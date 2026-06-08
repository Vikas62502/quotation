import { api, ApiError } from "@/lib/api"
import {
  createInstallationTeam,
  deleteInstallationTeam,
  readInstallationTeams,
  setTeamAssignment,
  writeInstallationTeams,
  type InstallationTeamRecord,
} from "@/lib/installation-teams"

export function normalizeInstallationTeamRow(row: Record<string, unknown>): InstallationTeamRecord {
  return {
    id: String(row?.id || row?._id || row?.teamId || row?.team_id || ""),
    name: String(row?.name || row?.teamName || row?.team_name || row?.firstName || row?.username || "Installation team"),
    username: String(row?.username || row?.login || "")
      .trim()
      .toLowerCase(),
    password: String(row?.password || ""),
    createdAt: String(row?.createdAt || row?.created_at || new Date().toISOString()),
    createdBy: String(row?.createdBy || row?.created_by || ""),
    isActive: row?.isActive !== false,
  }
}

export function readInstallationTeamsFromBackendResponse(response: unknown): InstallationTeamRecord[] {
  const r = response as Record<string, unknown> | unknown[] | null | undefined
  const raw = Array.isArray(r)
    ? r
    : Array.isArray((r as Record<string, unknown>)?.teams)
      ? ((r as Record<string, unknown>).teams as unknown[])
      : Array.isArray((r as Record<string, unknown>)?.data)
        ? ((r as Record<string, unknown>).data as unknown[])
        : Array.isArray((r as Record<string, unknown>)?.items)
          ? ((r as Record<string, unknown>).items as unknown[])
          : []
  return raw
    .map((row) => normalizeInstallationTeamRow(row as Record<string, unknown>))
    .filter((t) => t.id && t.username)
}

export async function loadInstallationTeamsList(useApi: boolean): Promise<InstallationTeamRecord[]> {
  if (!useApi) return readInstallationTeams()
  try {
    const response = await api.admin.installationTeams.list()
    const rows = readInstallationTeamsFromBackendResponse(response)
    if (rows.length > 0) return rows
    return readInstallationTeams()
  } catch {
    return readInstallationTeams()
  }
}

export async function createInstallationTeamEntry(
  useApi: boolean,
  input: { name: string; username: string; password: string; createdBy?: string },
): Promise<InstallationTeamRecord | null> {
  const name = input.name.trim()
  const username = input.username.trim().toLowerCase()
  const password = input.password
  if (!name || !username || !password) return null

  if (useApi) {
    try {
      await api.admin.installationTeams.create({ name, username, password })
      return readInstallationTeams().find((t) => t.username === username) ?? { id: "", name, username, password, createdAt: new Date().toISOString(), createdBy: input.createdBy, isActive: true }
    } catch {
      return createInstallationTeam({ name, username, password, createdBy: input.createdBy })
    }
  }
  return createInstallationTeam({ name, username, password, createdBy: input.createdBy })
}

export async function removeInstallationTeamEntry(useApi: boolean, team: InstallationTeamRecord): Promise<void> {
  if (useApi) {
    try {
      await api.admin.installationTeams.remove(team.id)
      return
    } catch {
      deleteInstallationTeam(team.id)
      return
    }
  }
  deleteInstallationTeam(team.id)
}

export async function resetInstallationTeamPasswordEntry(
  useApi: boolean,
  teamId: string,
  newPassword: string,
): Promise<void> {
  if (useApi) {
    await api.admin.installationTeams.resetPassword(teamId, newPassword)
    return
  }
  const local = readInstallationTeams()
  const next = local.map((t) => (t.id === teamId ? { ...t, password: newPassword } : t))
  writeInstallationTeams(next)
}

export type PersistTeamAssignmentResult = { ok: true } | { ok: false; message: string }

export async function persistInstallationTeamAssignment(
  useApi: boolean,
  quotationId: string,
  teamId: string,
): Promise<PersistTeamAssignmentResult> {
  const normalized = teamId.trim() || undefined
  setTeamAssignment(quotationId, normalized)
  try {
    const all = JSON.parse(localStorage.getItem("quotations") || "[]")
    const next = Array.isArray(all)
      ? all.map((row: Record<string, unknown>) =>
          row?.id === quotationId ? { ...row, installationTeamId: normalized } : row,
        )
      : all
    localStorage.setItem("quotations", JSON.stringify(next))
  } catch {
    // no-op
  }

  if (!useApi) return { ok: true }

  try {
    await api.admin.quotations.updateInstallationTeamAssignment(quotationId, normalized ?? null)
    return { ok: true }
  } catch (err) {
    const message =
      err instanceof ApiError
        ? `${err.message} Add PATCH /admin/quotations/{id}/installation-team. Until then, assignment exists only in this browser.`
        : "Could not persist team on the server. Assignment exists only in this browser."
    return { ok: false, message }
  }
}
