/**
 * "New study space" (name + optional description), or, given `editing`,
 * the owner's "Edit space". Opens the new space on success.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Label, Modal, Textarea } from '@/components/ui'
import { SPACE_DESCRIPTION_MAX, SPACE_NAME_MAX } from '@/lib/game-rules'
import { useAction } from '@/lib/use-action'

interface CreateSpaceModalProps {
  open: boolean
  onClose: () => void
  editing?: { spaceId: string; name: string; description?: string }
}

export function CreateSpaceModal({ open, onClose, editing }: CreateSpaceModalProps) {
  const navigate = useNavigate()
  const { run, pending } = useAction()
  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')

  async function save() {
    const fields = { name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}) }
    if (editing) {
      const res = await run('updateSpace', { spaceId: editing.spaceId, ...fields })
      if (res.success) onClose()
      return
    }
    const res = await run<{ spaceId: string }>('createSpace', fields)
    if (res.success) navigate(`/spaces/${res.data.spaceId}`)
  }

  return (
    <Modal open={open} onClose={onClose} size="md" data-testid="create-space">
      <Modal.Header>
        <Modal.Title>{editing ? 'Edit space' : 'New study space'}</Modal.Title>
        {!editing && (
          <Modal.Description>A home for your study group: its members and the games you play together.</Modal.Description>
        )}
      </Modal.Header>
      <form
        className="contents"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Modal.Body className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="space-name">Name</Label>
            <Input
              id="space-name"
              autoFocus
              value={name}
              maxLength={SPACE_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="Biology exam group"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="space-description">Description (optional)</Label>
            <Textarea
              id="space-description"
              rows={3}
              value={description}
              maxLength={SPACE_DESCRIPTION_MAX}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Weekly revision for the June exam"
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!name.trim()}
            loading={pending === 'createSpace' || pending === 'updateSpace'}
          >
            {editing ? 'Save' : 'Create space'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
