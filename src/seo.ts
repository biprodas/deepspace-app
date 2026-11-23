/**
 * Public-page SEO — what search engines, AI answer engines, and link previews
 * see for this app.
 *
 * Two consumers read this file, so the values can never disagree:
 *   - `<Seo {...seo} path="/" />` in src/pages/index.tsx renders them at
 *     runtime (React 19 hoists <title>/<meta>/<link> into <head>);
 *   - prerender.ts (app root, via vite.config.ts) stamps them into the static
 *     HTML at `vite build`, so crawlers that do not run JavaScript still get a
 *     real title, description, and canonical URL.
 *
 * Fill `title` and `description` when you design the landing page: a headline
 * with a category descriptor ("Acme | Team task boards") and one plain
 * sentence of about 150 characters. Set `noindex: true` for an app that
 * should stay out of search results (the build allows crawlers to read the
 * noindex directive and publishes no sitemap). Crawler access and training
 * restrictions require separate controls.
 */

/** Injected by prerender.ts: `https://<name>.app.space` from wrangler.toml, or
 *  what `deepspace deploy` passes (staging: spacestest.com). Absent in unit
 *  tests, hence the guard. */
declare const __DEEPSPACE_SITE_ORIGIN__: string | undefined

export const seo = {
  title: 'StudyArena | Live multiplayer quizzes backed by sources',
  description:
    'Turn a Wikipedia topic or your notes into a live, sourced quiz, then keep studying together with shared notes, whiteboards and AI mind maps.',
  /** Public origin for canonical URLs, og:url, and the sitemap — no trailing
   *  slash. Replace with the custom domain once one is attached, e.g.
   *  'https://www.example.com'. */
  origin: typeof __DEEPSPACE_SITE_ORIGIN__ === 'string' ? __DEEPSPACE_SITE_ORIGIN__ : 'http://localhost',
  /** 1200×630 preview image, root-relative to public/. Rendered from a design
   *  in the landing page's style: the logo, the headline and a quiz card. */
  ogImage: '/og.png',
  ogImageAlt:
    'StudyArena: “Make learning a game everyone wants to play.” beside a quiz card whose answer, Oxygen, is ticked and sourced from Wikipedia.',
  noindex: false,
  /**
   * The signed-in app shell (_spa.html), served for /join/CODE and every
   * other client route. A shared invite link previews with this, so it
   * speaks to someone who was just sent a code. prerender.ts stamps it into
   * the shell only; the landing page above keeps its own tags.
   */
  appShell: {
    title: 'StudyArena — live quizzes from your sources',
    description:
      'Join a live StudyArena quiz with your game code, or turn a Wikipedia topic or your notes into a quiz with sources.',
  },
}
