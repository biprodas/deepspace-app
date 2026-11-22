# Study Arena — Database Schema

Written in Prisma syntax for readability only; the app does not use Prisma.
The real definitions are DeepSpace `CollectionSchema` files in
`src/schemas/`, stored in SQLite inside the app's `RecordRoom` Durable Object.

Every record also gets `recordId`, `createdBy`, `createdAt` and `updatedAt`
automatically; they're listed once, on `Quiz`. `User` is DeepSpace's
built-in users collection. Permissions are in [trd.md §4](./trd.md#4-data-model).
`DateTime` fields on game collections are stored as epoch milliseconds
(`number` columns), so deadline arithmetic needs no parsing.

**Rule that shapes this schema:** DeepSpace permissions are per record, not
per field. Anything a player must not see yet (correct answer, explanation)
lives in a record they can't read, or stays empty until the server fills it.

```prisma
// ─── Enums ──────────────────────────────────────────────

enum SourceType {
  manual    // hand-written questions, no AI run
  wikipedia
  notes
}

enum Difficulty {
  easy
  mixed
  hard
}

enum QuizStatus {
  generating
  ready
  failed
}

enum GenerationStatus {
  pending
  running
  completed
  failed
}

enum RoomStatus {
  lobby
  question
  reveal
  paused
  final
  cancelled
}

enum RoundStatus {
  active
  revealed
  skipped
}

// ─── Built-in (managed by DeepSpace) ────────────────────

model User {
  id         String    @id
  name       String
  imageUrl   String?
  role       String    // viewer | member | admin
  lastSeenAt DateTime?
}

// ─── Quiz content ───────────────────────────────────────

model Quiz {
  recordId     String     @id
  ownerId      String     // User.id
  title        String
  sourceType   SourceType
  sourceUrls   Json       // string[]; empty for notes
  difficulty   Difficulty
  status       QuizStatus
  generationId String?    // latest Generation.recordId
  createdBy    String     // automatic on every record
  createdAt    DateTime   // automatic on every record
  updatedAt    DateTime   // automatic on every record
}

model Question {
  recordId  String  @id
  quizId    String  // Quiz.recordId
  order     Int     // not unique: reordering swaps values
  prompt    String
  options   Json    // string[4]
  timeLimit Int     // 10 | 20 | 30 | 60 seconds
  approved  Boolean @default(false)
}

/// Readable by the quiz owner only. Kept apart from Question
/// so the answer and explanation never reach players before reveal.
model AnswerKey {
  recordId     String  @id
  questionId   String  @unique // Question.recordId
  quizId       String
  ownerId      String  // read: 'own'
  correctIndex Int     // 0..3
  explanation  String
  sourceQuote  String
  sourceUrl    String? // null for notes
}

/// One row per AI generation run. Used for the per-user daily cap,
/// cost tracking and reproducibility. Readable by its owner only.
model Generation {
  recordId      String           @id
  userId        String           // read: 'own'
  quizId        String
  jobId         String?          // JobRoom job
  sourceType    SourceType
  topics        Json?            // string[]: Wikipedia topics as typed
  notes         String?          // pasted notes (owner-only, like the row)
  difficulty    Difficulty
  questionCount Int              // requested
  replaceQuestionId String?      // set when regenerating one question
  model         String           // e.g. claude-sonnet-5-5
  promptVersion String           // e.g. "v1"
  status        GenerationStatus
  stage         String?          // fetching | writing | saving (progress line)
  heartbeatAt   DateTime?        // stamped every 15 s by the live job
  droppedCount  Int              @default(0) // invalid questions dropped
  inputTokens   Int?             // if the integration returns usage
  outputTokens  Int?
  error         String?
  completedAt   DateTime?
}

// ─── Live game ──────────────────────────────────────────

model Room {
  recordId       String     @id
  quizId         String     // Quiz.recordId
  code           String     @unique // 6 characters
  hostId         String     // User.id
  coHostIds      Json       // string[]
  status         RoomStatus
  currentRoundId String?    // Round.recordId
  startedAt      DateTime?
  completedAt    DateTime?
  spaceId        String?   // Space.recordId when hosted in a study space
}

/// One row per question played in a room. Readable by all members:
/// the reveal fields stay null until revealQuestion fills them after
/// the deadline.
model Round {
  recordId     String      @id
  roomId       String      // Room.recordId
  questionId   String      // Question.recordId
  roundNumber  Int         // 1, 2, 3...
  status       RoundStatus
  startedAt    DateTime
  deadline     DateTime
  timeLimitMs  Int         // copied from the question; pauses move deadline, not this
  remainingMs  Int?        // set while the room is paused
  revealedAt   DateTime?
  // reveal fields (null until reveal)
  correctIndex Int?
  explanation  String?
  sourceQuote  String?
  sourceUrl    String?
  distribution Json?       // number[4]: players per option
  confusedCount Int @default(0) // players who flagged "still confused" (from RoundFlag)

  @@unique([roomId, roundNumber])
}

model RoomPlayer {
  recordId         String   @id
  roomId           String   // Room.recordId
  userId           String   // User.id
  displayName      String
  removed          Boolean  @default(false)
  joinedAt         DateTime
  firstRoundNumber Int      // late joiners start at the next round

  @@unique([roomId, userId])
}

/// A host's invite to one person, by account or email. Only the invitee
/// (by account) reads it; email-only invites are delivered by email.
model RoomInvite {
  recordId    String   @id
  roomId      String   // Room.recordId
  code        String   // copied from Room
  quizTitle   String   // copied from Quiz
  invitedBy   String   // User.id (host or co-host)
  inviterName String
  key         String   // lower-cased email, or "user:<id>" when the account has none
  email       String?
  inviteeId   String?  // User.id; read: 'own'
  status      String   // pending | accepted | dismissed
  invitedAt   DateTime
  emailSent   Boolean  @default(false)

  @@unique([roomId, key])
}

/// "Still confused" on a revealed round; each player reads only their own.
model RoundFlag {
  recordId String @id
  roomId   String
  roundId  String // Round.recordId
  userId   String // read: 'own'

  @@unique([roundId, userId])
}

/// A live poll in a room; one open at a time. Counts recomputed from PollVote.
model Poll {
  recordId  String    @id
  roomId    String
  question  String
  options   Json      // string[2..6]
  kind      String    // poll | confidence
  status    String    // open | closed
  createdBy String    // User.id (host or co-host)
  counts    Json      // number[]: votes per option
  createdAt DateTime
  closedAt  DateTime?
}

/// Each player reads only their own vote.
model PollVote {
  recordId    String @id
  pollId      String // Poll.recordId
  roomId      String
  userId      String // read: 'own'
  choiceIndex Int

  @@unique([pollId, userId])
}

/// A study space; a DeepSpace team. read: 'team' (owner or active TeamMember).
model Space {
  recordId    String   @id
  name        String
  description String?
  ownerId     String   // User.id
  code        String   @unique
  teamId      String   // = recordId; the 'team' rule matches against it
  createdAt   DateTime
}

/// Membership. The SDK's 'team' rule reads this collection by name.
model TeamMember {     // collection: team_members
  recordId    String   @id
  teamId      String   // Space.recordId
  userId      String   // User.id
  displayName String
  role        String   // owner | member
  status      String   // active | removed (removed can't rejoin)
  joinedAt    DateTime

  @@unique([teamId, userId])
}

/// Like RoomInvite, for a space; only the invitee reads it.
model SpaceInvite {
  recordId    String   @id
  spaceId     String
  code        String
  spaceName   String
  invitedBy   String
  inviterName String
  key         String
  email       String?
  inviteeId   String?
  status      String   // pending | accepted | dismissed
  invitedAt   DateTime
  emailSent   Boolean  @default(false)

  @@unique([spaceId, key])
}

/// A shared note in a space. Named `documents` because the Yjs route reads it;
/// the text lives in the Yjs room named after recordId. read: 'team'.
model Note {           // collection: documents
  recordId  String   @id
  title     String
  spaceId   String   // Space.recordId
  teamId    String   // = spaceId
  ownerId   String   // User.id (author)
  roomId    String?  // set on a game's session note
  createdAt DateTime
}

/// A whiteboard or AI mind map in a space; shapes live in the canvas room
/// named after recordId. read: 'team'.
model Board {          // collection: boards
  recordId     String   @id
  title        String
  kind         String   // whiteboard | mindmap
  spaceId      String   // Space.recordId
  teamId       String   // = spaceId
  ownerId      String   // User.id (creator)
  topic        String?  // mind map: the Wikipedia article
  mindMap      Json?    // mind map: the generated tree (src/lib/mindmap.ts)
  mindMapDrawn Boolean  @default(false)
  createdAt    DateTime
}

/// Each player reads only their own rows.
model Answer {
  recordId    String  @id
  roomId      String
  roundId     String  // Round.recordId
  questionId  String
  userId      String  // read: 'own'
  choiceIndex Int
  correct     Boolean
  points      Int     // 0 or 500..1000
  answerMs    Int     // server receive time - round start

  @@unique([roundId, userId])
}

/// Recomputed from Answer at each reveal (not incremented).
model Standing {
  recordId     String @id
  roomId       String
  userId       String
  score        Int
  correctCount Int
  correctMs    Int    // total answer time on correct answers (tie-break)
  rank         Int

  @@unique([roomId, userId])
}

/// All-time totals over finished games, written by the server at game end.
model LeaderboardEntry {
  recordId       String @id
  userId         String @unique
  displayName    String
  totalScore     Int
  games          Int
  wins           Int
  correctAnswers Int
  roomIds        Json   // string[]: rooms already counted (idempotent)
}
```

## Relationships

```
User ─┬─< Quiz ─┬─< Question ── 1:1 ── AnswerKey
      │         ├─< Generation
      │         └─< Room ─┬─< Round ─< Answer >── User
      │                   ├─< RoomPlayer >── User
      │                   ├─< RoomInvite >── User (optional)
      │                   ├─< Poll ─< PollVote >── User
      │                   ├─< RoundFlag >── User (per Round)
      │                   └─< Standing   >── User
      └─< Space ─┬─< TeamMember >── User
                 ├─< SpaceInvite >── User (optional)
                 ├─< Note (documents; text in Yjs)
                 ├─< Board (shapes in the canvas room)
                 └─< Room (optional spaceId)
```

References are plain id columns. Assume no foreign-key enforcement (the
permissions and schema docs read so far don't describe any); server actions
check that referenced records exist before writing.

## Deliberately not modelled

Tournaments, teams, subscriptions, purchases, cosmetics, reviews,
favorites, categories, visibility/slugs, extra question types, guest
players, stored per-player counters (standings are recomputed instead) —
see [features.md §3](./features.md#3-deliberately-left-out-explain-in-the-write-up).
