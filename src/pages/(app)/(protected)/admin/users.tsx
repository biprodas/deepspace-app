/**
 * Admin console, users: /admin/users (docs/features.md F16). Everyone who
 * has signed in to StudyArena, newest first, searchable, with their app role.
 * Admins change roles here (`useUsers().setRole`; the platform checks the
 * caller is an admin) and recorded in the audit log. Viewers are read-only; members play and host;
 * admins also get this console.
 */

import { useMemo, useState } from 'react'
import { ROLE_CONFIG, ROLES, useUser, useUsers, type Role } from 'deepspace'
import { Search } from 'lucide-react'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  ConfirmModal,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@/components/ui'
import { AdminHeader, formatCount } from '@/components/admin/admin-ui'
import { callAction } from '@/lib/actions-client'
import { usePageTitle } from '@/lib/page-title'

const ROLE_ORDER: Role[] = [ROLES.ADMIN, ROLES.MEMBER, ROLES.VIEWER]

const when = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '—')

export default function AdminUsersPage() {
  usePageTitle('Users')
  const { user: me } = useUser()
  const { users, usersLoaded, setRole, refresh } = useUsers()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<{ id: string; name: string; from: string; role: Role } | null>(null)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...users]
      .filter((u) => !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }, [users, query])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const u of users) c[u.role] = (c[u.role] ?? 0) + 1
    return c
  }, [users])

  return (
    <>
      <AdminHeader
        title="Users"
        description={
          usersLoaded
            ? `${formatCount(users.length)} people · ${ROLE_ORDER.map((r) => `${counts[r] ?? 0} ${ROLE_CONFIG[r].title.toLowerCase()}`).join(' · ')}`
            : 'Loading…'
        }
        onRefresh={refresh}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          aria-label="Search users"
          className="pl-9"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table data-testid="admin-users" className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">
                User
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Joined
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Last seen
              </th>
              <th scope="col" className="w-40 px-4 py-2.5 font-medium">
                Role
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((u) => {
              const isMe = u.id === me?.id
              return (
                <tr key={u.id} data-testid="admin-user-row">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarImage src={u.imageUrl} referrerPolicy="no-referrer" />
                        <AvatarFallback className="text-xs">{(u.name?.[0] ?? u.email?.[0] ?? '?').toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {u.name || 'No name'}
                          {isMe && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{when(u.createdAt)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{when(u.lastSeenAt)}</td>
                  <td className="px-4 py-2.5">
                    <Select
                      value={u.role}
                      disabled={isMe}
                      onValueChange={(v) => {
                        const role = String(v) as Role
                        if (role !== u.role) setPending({ id: u.id, name: u.name || u.email || 'this user', from: u.role, role })
                      }}
                    >
                      <SelectTrigger aria-label={`Role for ${u.name || u.email}`} className="h-8" title={isMe ? 'You can’t change your own role' : undefined}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_ORDER.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_CONFIG[r].title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              )
            })}
            {usersLoaded && shown.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {query ? `No one matches “${query}”.` : 'No users yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={pending !== null}
        onClose={() => setPending(null)}
        variant={pending?.role === ROLES.ADMIN ? 'destructive' : 'default'}
        title={pending ? `Make ${pending.name} ${ROLE_CONFIG[pending.role].title.toLowerCase()}?` : ''}
        description={pending ? ROLE_CONFIG[pending.role].description : undefined}
        confirmText="Change role"
        onConfirm={() => {
          if (!pending) return
          setRole(pending.id, pending.role)
          // The platform made the change; record it in the audit log (the server verifies the role).
          void callAction('logRoleChange', { userId: pending.id, from: pending.from, to: pending.role })
          toast.success(`${pending.name} is now ${ROLE_CONFIG[pending.role].title.toLowerCase()}`)
          setPending(null)
        }}
      />
    </>
  )
}
