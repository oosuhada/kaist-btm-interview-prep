# KAIST BTM Interview Prep

Interactive bilingual active-recall training for KAIST Business and Technology Management graduate-admissions interviews.

## Features

- **Application Defense** — opening, motivation, career, academic record, projects, and personal-fit practice
- **Research Defense** — research question, literature gap, methodology, contribution, feasibility, and faculty-fit drills
- **Bilingual KR/EN practice** — switch questions, cues, and example answers between Korean and English
- **Audio Recall** — pre-generated question-and-answer tracks for continuous listening
- **Visual Recall** — a visual knowledge map connecting experience, research design, and BTM fit
- **Difficulty masking** — progressively hide answer details to strengthen active recall

## Technology

- Next.js 16 App Router
- React 19 and TypeScript
- Tailwind CSS
- Pre-generated MP3 assets; no TTS credentials or runtime synthesis are required

## Run locally

Node.js 20 or newer is recommended.

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production build

```bash
npm ci
npm run lint
npm run build
npm start
```

Set `PORT` to choose a production port, for example `PORT=3010 npm start`.

## Data layout

- `data/interview/content.json` is a sanitized snapshot of only the content rendered by the app.
- `public/audio/interview/` contains per-card answer audio.
- `public/audio/tracks/` contains the Audio Recall manifest and continuous-playback tracks.

The bundled snapshot is the default, so a fresh clone runs without any external personal folders. For private local development only, `INTERVIEW_CONTENT_DIR` may point to a compatible Markdown source tree and overrides the bundled snapshot.

## Privacy

Original application PDFs, recommendation letters, device histories, personal logs, credentials, and private source documents are deliberately excluded. This public repository contains only the interview-preparation content already presented by the website and the assets needed to run it.

## License

[MIT](LICENSE)
