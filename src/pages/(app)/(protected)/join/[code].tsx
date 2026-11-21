/**
 * Share-link entry: /join/:code (docs/features.md F3). Sign-in is handled by
 * the (protected) layout. Placeholder until rooms exist: it shows the code
 * that was entered; joinRoom → lobby replaces this.
 */

import { Link, useParams } from 'react-router-dom'
import { parseJoinCode } from '@/lib/join-code'

export default function JoinPage() {
  const { code: raw = '' } = useParams()
  const code = parseJoinCode(raw)

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      {code ? (
        <>
          <p className="text-sm text-muted-foreground">Joining room</p>
          <p className="font-mono text-4xl font-bold tracking-[0.2em]">{code}</p>
          <p className="max-w-sm text-sm text-muted-foreground">Rooms aren&apos;t live yet. The lobby will open here.</p>
        </>
      ) : (
        <>
          <h1 className="font-display text-2xl font-bold">That code doesn&apos;t look right</h1>
          <p className="text-sm text-muted-foreground">Codes are 6 letters or numbers, like K7QX9P.</p>
        </>
      )}
      <Link to="/" className="mt-2 text-sm font-bold text-primary-text underline-offset-4 hover:underline">
        Back to StudyArena
      </Link>
    </div>
  )
}
