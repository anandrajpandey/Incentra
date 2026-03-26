# Incentra Backend Architecture

## Overview

The backend is a single Lambda-backed HTTP API that handles:

- auth
- video metadata
- subtitle analysis
- watch companion chat
- social reactions
- admin stats

Primary implementation lives in [backend/src/index.ts](C:/Users/pc/Documents/New%20project/backend/src/index.ts).

## AWS Services

- `API Gateway` for HTTP routing
- `AWS Lambda` for all backend logic
- `S3` for media and subtitle uploads
- `CloudFront` for playback delivery
- `DynamoDB` for videos, comments, users, and subtitle analysis persistence

## Main Data Shapes

### Video

The video record now stores more than basic playback metadata. Current fields include:

- `id`
- `title`
- `description`
- `category`
- `thumbnail`
- `videoUrl`
- `duration`
- `views`
- `likes`
- `uploadedAt`
- `uploadedBy`
- `isFeatured`
- `subtitleUrl`
- `subtitleLabel`
- `subtitleLanguage`
- `subtitleSource`
- `companionBeats`
- `subtitleContext`
- `subtitleTranscript`
- `subtitleMetadata`

### Social Comments

Comment records support the watch-page social layer:

- text reactions
- spoiler flags
- timestamp anchoring
- author display data

These are later clustered into `Scene Pulse` groups on the watch page.

### Subtitle Analysis

Subtitle analysis is stored separately and then projected back onto the video model. It includes:

- parsed transcript cues
- scene/context summaries
- beat/key-moment injections
- metadata like total duration and highlight reel

## Subtitle and Companion Flow

### Analysis

`POST /subtitle-analysis`

This route accepts raw subtitle content and produces:

- `subtitleContext`
- `companionBeats`
- `subtitleTranscript`
- `subtitleMetadata`

Current behavior:

1. parse subtitle text into transcript cues
2. build local subtitle chunks and scene context
3. derive deterministic fallback beats
4. attempt AI beat generation
5. sanitize and rebalance moments

### Reanalysis

`POST /videos/{id}/reanalyze-subtitles`

This route fetches the attached subtitle file for an existing video and rebuilds the stored companion/subtitle data.

### Reset

`POST /videos/{id}/reset-subtitles`

Removes subtitle-derived companion data from a title.

### Companion Chat

`POST /videos/{id}/companion/chat`

This route powers `Second Seat`.

Current prompt behavior:

- answers only from subtitle context that has happened up to the current timestamp
- uses recent companion messages for continuity
- falls back gracefully when subtitles are missing

## Route Map

### Health

- `GET /health`

### Auth

- `POST /auth/login`
- `POST /auth/google`

### Videos

- `GET /videos`
- `GET /videos/{id}`
- `POST /videos`
- `PATCH /videos/{id}`
- `DELETE /videos/{id}`

### Uploads

- `POST /upload-url`

### Subtitle / Companion

- `POST /subtitle-analysis`
- `POST /videos/{id}/companion/chat`
- `POST /videos/{id}/reanalyze-subtitles`
- `POST /videos/{id}/reset-subtitles`

### Comments / Social

- `GET /videos/{id}/comments`
- `POST /videos/{id}/comments`

### Admin

- `GET /admin/stats`

## DynamoDB Notes

The backend currently uses multiple logical tables via environment variables, including:

- videos
- users
- comments
- subtitle analyses

The code aliases reserved DynamoDB names where needed, such as `views`.

## Design Notes

- The backend favors a single Lambda with internal routing for simplicity.
- Subtitle analysis is now context-first rather than relying on whole-movie synthesis alone.
- Companion beats are generated to feel like in-the-moment reactions rather than raw transcript lines.
- Social reactions are timestamp-aware so the watch page can build scene-level clusters.

## Operational Notes

- Gemini model and key are injected through environment variables.
- Subtitle analysis quality depends heavily on subtitle quality and coverage.
- Titles without subtitles fall back to a limited companion mode.
