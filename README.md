# Incentra

Incentra is a cinematic streaming app built with a Next.js frontend and an AWS serverless backend. The current product centers on subtitle-aware viewing: an AI watch companion called `Second Seat`, spoiler-safe scene reactions, subtitle-driven beat injection, and a branded intro/login experience with the animated Incentra eye.

## Current Experience

- `Discover` landing flow with branded intro animation
- `Watch` page with:
  - video playback
  - `Second Seat` companion chat
  - auto-injected timeline beats from subtitle analysis
  - `Narrative Beat Map`
  - `Scene Pulse`
  - `Spoiler-Safe Social`
- `Login` experience with Google sign-in support and a large branded eye hero
- `Admin` upload flow for media, subtitles, and companion analysis refreshes

## Stack

### Frontend

- Next.js App Router
- TypeScript
- Tailwind CSS
- Framer Motion
- Zustand

### Backend

- AWS Lambda (Node.js/TypeScript)
- API Gateway
- DynamoDB
- S3 pre-signed uploads
- CloudFront playback delivery
- Gemini-powered subtitle analysis and companion chat

## Core Features

### 1. Subtitle-Aware Watch Companion

`Second Seat` answers user questions using subtitle context up to the current timestamp. It is designed to stay grounded in what has already happened on screen rather than spoiling future scenes.

Current behavior:

- chat replies are AI-generated
- auto-injected companion beats are generated from subtitle analysis
- subtitle analysis stores:
  - transcript cues
  - scene context
  - companion beats
  - subtitle metadata

### 2. Subtitle Analysis Pipeline

When a subtitle file is uploaded or reanalyzed, the backend:

1. parses `.srt` / `.vtt` into transcript cues
2. builds local subtitle scene context
3. derives fallback beat candidates
4. optionally generates stronger AI beat lines
5. stores the result with the video metadata

### 3. Spoiler-Safe Social

The watch page includes spoiler-shielded reactions with:

- spoiler-hidden comments
- timestamp anchoring
- scene-aware reaction loading
- `Scene Pulse` clustering from timestamped comments

### 4. Branded Visual System

The UI currently includes:

- a red-on-dark-blue palette
- the original display/body font stack restored
- Incentra eye animation with:
  - animated iris/pupil
  - mouse-following pupil
  - moving catchlight
  - branded intro usage

## Routes

- `/`
- `/watch/[id]`
- `/genre/[slug]`
- `/login`
- `/profile`
- `/admin`
- `/admin/upload`
- `/admin/videos`

## Project Structure

```text
app/                  Next.js routes and layouts
components/           Shared, user, admin, and UI components
hooks/                Auth and video state hooks
services/             Frontend API clients and config
types/                Shared TypeScript contracts
backend/              Lambda source and build output
terraform/            AWS infrastructure deployment
public/               Static brand/media assets
```

## Local Development

1. Install dependencies.

```bash
npm install
```

2. Create `.env.local`.

3. Start the app.

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Frontend Environment

Typical frontend variables:

```bash
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_USE_MOCK_AUTH=true
NEXT_PUBLIC_API_BASE_URL=https://your-api-id.execute-api.ap-south-1.amazonaws.com
NEXT_PUBLIC_CLOUDFRONT_BASE_URL=https://your-cloudfront-domain.cloudfront.net
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
```

## Upload and Companion Flow

1. Admin requests `POST /upload-url`
2. Browser uploads media or subtitle files directly to S3
3. Frontend creates or updates the video record
4. Subtitle analysis runs through `POST /subtitle-analysis` or `POST /videos/{id}/reanalyze-subtitles`
5. Watch page consumes:
   - `companionBeats`
   - `subtitleContext`
   - `subtitleTranscript`
   - social reactions and scene pulses

## Backend Notes

See [BACKEND_ARCHITECTURE.md](C:/Users/pc/Documents/New%20project/BACKEND_ARCHITECTURE.md) for the current API surface, data model, and subtitle-companion flow.

## Deployment

### Frontend

- Vercel-ready Next.js app
- set frontend env vars
- deploy from this repo

### AWS

- Lambda source: [backend/src/index.ts](C:/Users/pc/Documents/New%20project/backend/src/index.ts)
- Infra docs: [terraform/README.md](C:/Users/pc/Documents/New%20project/terraform/README.md)

Build backend before applying Terraform:

```powershell
Set-Location backend
npm.cmd install
npm.cmd run build
Set-Location ..
```

## Notes

- Subtitle-driven companion features work best when each title has an attached `.srt` or `.vtt`.
- The current watch companion is context-bounded and does not intentionally answer from future unseen subtitle content.
- Some visual assets in `public/` are still being iterated on for the Incentra eye shell.
