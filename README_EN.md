[中文](./README.md) | English

# User Modeling & Global Context Management

**Give LLMs a continuously evolving user model + global context management. More effective than giving it memory.**

---

## Why This Is Not a "Memory System"

A typical memory system answers one question: "What did the user say?"

This pipeline answers a different question: **"Who is the user, what state are they in right now, and what are their thinking patterns?"**

The difference: memory systems slice conversation history into fragments, store them, and stitch them back together on retrieval. This pipeline **synthesizes those fragments into a continuously evolving digital twin**, injected into every conversation's context.

This is an architectural distinction, not a semantic one. In metacognition and emotional processing scenarios, a pre-built user model is far more effective than ad-hoc memory retrieval — because understanding a person requires knowing *who they are* as a whole, not just what they said last week.

## How It Works

Three pipelines, connected end-to-end:

```
Conversation Messages
  ↓
Capsule Extraction (DeepSeek Flash, per cron trigger)
  ├── Experience Capsules: user's interactions with others/the world
  └── Internal Info Capsules: values, worldview, preferences, beliefs
  ↓
Pipeline 1 (Daily): User Profile Generation (DeepSeek Pro)
  ├── fact_layer:      basic info (age, occupation, goals)
  ├── project_status:  project name, phase, progress, challenges
  └── current_status:  current state (~3-month window) + recent activity
  ↓
Pipeline 2 (Weekly): User Trait Generation (DeepSeek Pro)
  └── pattern_layer:   intrinsic traits and thinking patterns (positively framed)
  ↓
Injected at Layer 1 (static context, before the prompt cache breakpoint)
  └── Full profile injected in every conversation — the LLM "knows" the user from the start
```

**Retrieval is auxiliary**: when the user mentions specific events, hybrid search (entity matching + vector similarity + significance weighting) pulls relevant facts from capsules. But retrieval serves the model, not the other way around.

## Directory Structure

```
schema/
  tables.sql           — user_experiences, user_internal_info, user_profiles table definitions
  triggers.sql         — raw_content auto-merge trigger
  hybrid-search.sql    — PostgreSQL hybrid search function (entity + vector + significance)

pipelines/
  capsule-extractor.ts — Extract two capsule types from conversations (DeepSeek Flash)
  daily-profile.ts     — Pipeline 1: daily profile generation (fact layer + status layer)
  weekly-traits.ts     — Pipeline 2: weekly trait generation (pattern layer)

retrieval/
  hybrid-search.ts     — Hybrid search client
  keyword-extractor.ts — Chinese keyword extraction (Segment tokenizer + regex fallback)
  embedding.ts         — Qwen text-embedding-v3 wrapper
  context-assembler.ts — Context assembler (profile + long-term memory + working memory)

prompts/
  capsule-extractor.md — Capsule extraction prompt (with examples, for reading & debugging)
  profile-generator.md — Profile generation prompt
  traits-generator.md  — Trait generation prompt
  Note: the prompts actually used at runtime live in each pipeline file's constants.
        The .md files are annotated reference versions.

types/
  index.ts             — Core type definitions
```

## Core Design Decisions

### 1. Async Modeling, Synchronous Injection

The user model is not updated in real-time during conversations. After each conversation ends, working memory (current-turn summary) is saved to Session. Capsules are batch-extracted in daily cron jobs. Profiles are updated in daily/weekly cron jobs.

This means **what you say today enters the user model tomorrow at the earliest**. This is intentional — real-time modeling introduces noise and cost, and requires the full conversation context to be complete before processing. The trade-off: timeliness of model updates in exchange for modeling quality and cost efficiency.

### 2. Experiences and Internal Info Are Separate

Both capsule types are extracted from the same conversation, but stored in different tables and follow different retrieval paths.

- **Experience Capsules**: objective events, "what happened" — third-person narrative, journalistic style
- **Internal Info Capsules**: subjective traits, "who the user is" — values, preferences, thinking patterns

This separation allows each area to stay focused during user modeling, preventing external facts and internal traits from blending together.

### 3. Hybrid Search Is Entity-Biased

Default weights: entity 0.7 / vector 0.2 / significance 0.1.

Entity matching (ILIKE exact matching on keywords in topic_tag and narrative) gets the highest weight, because specific memories users want to recall usually contain concrete entities — names, places, project names. Vector similarity serves as a fallback, catching semantically similar but differently phrased events.

### 4. Full Profile Injection in the Static Layer

The user profile sits at Layer 1 (the first static block after the System Prompt), injected in full, never selectively retrieved on demand.

The reasoning: the LLM needs a complete user model to make good judgments. Selective injection ("only inject the relevant parts") assumes the system knows which parts are relevant — but determining relevance itself requires understanding the user. That's a circular dependency.

## Dependencies

- **DeepSeek API** — capsule extraction (flash) + profile generation (pro)
- **Alibaba Cloud DashScope (Qwen)** — text-embedding-v3, 1024 dimensions
- **Supabase + pgvector** — storage + HNSW vector index + RPC functions
- **Node Segment** — Chinese tokenization (optional, pure JS fallback available)

## License

This project is licensed under the Business Source License (BSL) — see [LICENSE](./LICENSE) for details.

tl;dr: Free for non-production use, evaluation, and research. Commercial production use requires a license.
