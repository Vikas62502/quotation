"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  createInstallationTeamEntry,
  loadInstallationTeamsList,
  removeInstallationTeamEntry,
  resetInstallationTeamPasswordEntry,
} from "@/lib/installation-team-management"
import type { InstallationTeamRecord } from "@/lib/installation-teams"

type InstallationTeamsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  useApi: boolean
  createdBy?: string
  onTeamsChanged?: () => void
}

export function InstallationTeamsDialog({
  open,
  onOpenChange,
  useApi,
  createdBy,
  onTeamsChanged,
}: InstallationTeamsDialogProps) {
  const { toast } = useToast()
  const [installationTeams, setInstallationTeams] = useState<InstallationTeamRecord[]>([])
  const [installationTeamForm, setInstallationTeamForm] = useState({ name: "", username: "", password: "" })
  const [installationTeamSubmitting, setInstallationTeamSubmitting] = useState(false)
  const [installationTeamResetPasswordById, setInstallationTeamResetPasswordById] = useState<Record<string, string>>({})
  const [refreshKey, setRefreshKey] = useState(0)

  const reloadTeams = async () => {
    const rows = await loadInstallationTeamsList(useApi)
    setInstallationTeams(rows)
    setRefreshKey((n) => n + 1)
    onTeamsChanged?.()
  }

  useEffect(() => {
    if (!open) return
    void reloadTeams()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, useApi])

  const handleCreateInstallationTeam = async () => {
    const name = installationTeamForm.name.trim()
    const username = installationTeamForm.username.trim().toLowerCase()
    const password = installationTeamForm.password
    if (!name || !username || !password) {
      toast({
        title: "Could not create team",
        description: "Fill all fields and use a unique username.",
        variant: "destructive",
      })
      return
    }
    setInstallationTeamSubmitting(true)
    try {
      const created = await createInstallationTeamEntry(useApi, { name, username, password, createdBy })
      if (!created) throw new Error("create_failed")
      await reloadTeams()
      setInstallationTeamForm({ name: "", username: "", password: "" })
      toast({
        title: "Team created",
        description: "Credentials are saved. Team can login from /installation-team-login.",
      })
    } catch {
      toast({
        title: "Could not create team",
        description: "Fill all fields and use a unique username.",
        variant: "destructive",
      })
    } finally {
      setInstallationTeamSubmitting(false)
    }
  }

  const handleDeleteInstallationTeam = async (team: InstallationTeamRecord) => {
    try {
      await removeInstallationTeamEntry(useApi, team)
      await reloadTeams()
      toast({
        title: "Team removed",
        description: "Assignments to this team were cleared.",
      })
    } catch {
      toast({
        title: "Could not remove team",
        description: "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleResetInstallationTeamPassword = async (team: InstallationTeamRecord) => {
    const nextPassword = (installationTeamResetPasswordById[team.id] || "").trim()
    if (!nextPassword) {
      toast({
        title: "Enter new password",
        description: `Type a new password for ${team.name}.`,
        variant: "destructive",
      })
      return
    }
    try {
      await resetInstallationTeamPasswordEntry(useApi, team.id, nextPassword)
      setInstallationTeamResetPasswordById((prev) => ({ ...prev, [team.id]: "" }))
      toast({ title: "Password reset", description: "Team can login with the new password now." })
    } catch {
      toast({
        title: "Password reset failed",
        description: "Backend reset endpoint is not available yet.",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Installation teams</DialogTitle>
          <DialogDescription>
            Create team logins and assign each installation row to a team. Teams sign in at{" "}
            <span className="font-mono text-xs">/installation-team-login</span> and only see jobs assigned to them.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded-md border border-border p-3 space-y-2">
            <p className="text-xs font-semibold">Create team</p>
            <div className="space-y-2">
              <Label className="text-xs">Team name</Label>
              <Input
                value={installationTeamForm.name}
                onChange={(e) => setInstallationTeamForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. North Zone Crew"
              />
              <Label className="text-xs">Login username</Label>
              <Input
                value={installationTeamForm.username}
                onChange={(e) => setInstallationTeamForm((p) => ({ ...p, username: e.target.value }))}
                placeholder="Unique login id"
              />
              <Label className="text-xs">Password</Label>
              <Input
                type="password"
                value={installationTeamForm.password}
                onChange={(e) => setInstallationTeamForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Team password"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => void handleCreateInstallationTeam()}
                disabled={installationTeamSubmitting}
              >
                {installationTeamSubmitting ? "Creating..." : "Create team"}
              </Button>
            </div>
          </div>
          <div className="space-y-2" key={refreshKey}>
            <p className="text-xs font-semibold">Existing teams</p>
            {installationTeams.length === 0 ? (
              <p className="text-xs text-muted-foreground">No teams yet.</p>
            ) : (
              installationTeams.map((t) => (
                <div key={t.id} className="space-y-2 rounded-md border border-border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">@{t.username}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      value={installationTeamResetPasswordById[t.id] || ""}
                      onChange={(e) =>
                        setInstallationTeamResetPasswordById((prev) => ({
                          ...prev,
                          [t.id]: e.target.value,
                        }))
                      }
                      placeholder="New password"
                      className="h-8 text-xs"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => void handleResetInstallationTeamPassword(t)}>
                      Reset
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => void handleDeleteInstallationTeam(t)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
