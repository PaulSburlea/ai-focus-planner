# AI Focus Planner

An intelligent task management application that uses AI to optimize your daily schedule. Built with React, TypeScript, and OpenAI's GPT-4o-mini.

**Live Demo:** https://ai-focus-planner-iota.vercel.app/

## Features

- **Task Management** - Create, update, delete, and track tasks with estimates and deadlines
- **AI-Powered Optimization** - Let GPT-4o-mini analyze your tasks and generate an optimal daily schedule
- **Smart Scheduling** - AI considers deadlines, task estimates, and working hours (9:00-18:00)
- **Dark/Light Theme** - Toggle between themes with persistence
- **Past Tasks View** - Separate view for completed and historical tasks
- **Real-time Stats** - Track today's tasks, scheduled hours, and completion status
- **User Authentication** - Secure auth via Supabase (email/password + Google OAuth)

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Database:** Supabase (PostgreSQL)
- **AI:** OpenAI GPT-4o-mini
- **Styling:** CSS Variables + Tailwind CSS
- **Deployment:** Vercel
- **Testing:** Vitest + React Testing Library

## LLMs & Tools Used

| Tool | Purpose |
|------|---------|
| **Claude (Anthropic)** | Core implementation, component architecture, business logic |
| **GLM 4.7 (via Claude Code)** | Refactoring, test generation, code reviews |
| **OpenAI GPT-4o-mini** | Task scheduling and optimization API |

## Setup Locally

1. **Clone the repo**
   ```bash
   git clone https://github.com/yourusername/ai-focus-planner.git
   cd ai-focus-planner
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a project at [supabase.com](https://supabase.com)
   - Run this SQL in the Supabase SQL Editor:
   ```sql
   create table tasks (
     id uuid default gen_random_uuid() primary key,
     user_id uuid default auth.uid() not null,
     title text not null,
     estimate_minutes integer not null,
     deadline timestamp with time zone,
     notes text,
     ai_plan jsonb,
     completed boolean default false,
     sort_order integer default 0,
     created_at timestamp with time zone default now()
   );

   alter table tasks enable row level security;
   create policy "Users can only access their own tasks" on tasks
     for all using (auth.uid() = user_id);

   -- Enable Google OAuth in Supabase Auth settings
   ```

4. **Environment variables**
   - Copy `.env.example` to `.env`
   - Fill in your values:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
   SUPABASE_SECRET_KEY=your_supabase_service_role_key
   OPENAI_API_KEY=your_openai_api_key
   FRONTEND_URL=http://localhost:5173
   ```

5. **Run the app**
   ```bash
   npm run dev
   ```

## How AI Optimization Works

1. User selects tasks for the day
2. Frontend sends tasks to `/api/optimize` (Vercel serverless function)
3. GPT-4o-mini analyzes deadlines and estimates
4. AI returns:
   - Optimized task order
   - Time slots for each task
   - Rationale for scheduling decisions
5. User can accept or discard the plan

## Technical Challenge: The "Hallucination" Problem

**The Issue:** When I first implemented the AI optimization endpoint, GPT-4o-mini occasionally returned malformed responses - sometimes wrapping the JSON in markdown code blocks (\`\`\`json), sometimes adding explanatory text before/after the JSON.

**How I Solved It:**
1. **Prompt Engineering:** I refined the system prompt to explicitly state "respond ONLY with valid JSON - no explanation, no markdown"
2. **Defensive Parsing:** Created a `safeParseJson()` function that strips markdown before parsing:
   ```typescript
   const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
   ```
3. **Validation:** Added runtime validation to check if the parsed response has all required fields (`ordered_task_ids`, `slots`, `rationale`)
4. **Fallback:** Return a user-friendly error if parsing fails, asking them to try again

This iterative prompting approach reduced the failure rate from ~30% to near 0%.

## Database Schema

```sql
tasks (
  id: uuid (primary key)
  user_id: uuid (foreign key to auth.users)
  title: text
  estimate_minutes: integer
  deadline: timestamp (nullable)
  notes: text (nullable)
  ai_plan: jsonb (nullable) - stores the AI-optimized schedule
  completed: boolean
  sort_order: integer - for custom ordering
  created_at: timestamp
)
```

## Project Structure

```
ai-focus-planner/
├── api/
│   └── optimize.ts          # AI optimization endpoint
├── src/
│   ├── components/          # React components
│   ├── lib/
│   │   ├── api.ts           # Database operations
│   │   └── supabaseClient.ts
│   ├── types.ts             # TypeScript interfaces
│   └── App.tsx              # Main app component
├── public/                  # Static assets
└── vercel.json             # Deployment config
```

## License

MIT

---

**Built with AI assistance from Claude and GLM-4.7** 🤖
