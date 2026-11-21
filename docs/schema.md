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
  questionCount Int              // requested
  model         String           // e.g. claude-sonnet-5-5
  promptVersion String           // e.g. "v1"
  status        GenerationStatus
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
```

## Relationships

```
User ─┬─< Quiz ─┬─< Question ── 1:1 ── AnswerKey
      │         ├─< Generation
      │         └─< Room ─┬─< Round ─< Answer >── User
      │                   ├─< RoomPlayer >── User
      │                   └─< Standing   >── User
```

References are plain id columns. Assume no foreign-key enforcement (the
permissions and schema docs read so far don't describe any); server actions
check that referenced records exist before writing.

## Deliberately not modelled

Tournaments, teams, subscriptions, purchases, cosmetics, reviews,
favorites, categories, visibility/slugs, extra question types, guest
players, stored per-player counters (standings are recomputed instead) —
see [features.md §3](./features.md#3-deliberately-left-out-explain-in-the-write-up).
