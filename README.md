# HVAC Troubleshooting Web App

A web application for HVAC troubleshooting with an AI agent powered by OpenAI in production, with optional LM Studio for local development. This application prioritizes safety and provides users with accurate troubleshooting assistance.

## Features

- AI-powered troubleshooting assistant using OpenAI (production)
- Safety-first approach with warnings and disclaimers
- User authentication and session management
- Comprehensive HVAC knowledge base
- Professional HVAC knowledge section with detailed wiring and component information
- Responsive design for mobile and desktop use

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   - Create a `.env` file based on `.env.example`.
   - For production, set `OPENAI_API_KEY` (and optional `OPENAI_MODEL`).
   - For manuals and auth, set Supabase variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and (optionally) `SUPABASE_BUCKET`.

3. Optional: Local development with LM Studio
   - Download and install LM Studio from [lmstudio.ai](https://lmstudio.ai/)
   - Download a local model (e.g., Gemma 3 4B) and start the local inference server.
   - Set `LM_STUDIO_API_URL` (default: http://localhost:1234/v1) and `LM_STUDIO_MODEL` in `.env`.
   - Note: Production uses OpenAI; LM Studio is for local-only testing.

4. Install Python dependencies (if using Python components):
   ```bash
   pip install -r requirements.txt
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open your browser and navigate to `http://localhost:3000`

## Deployment

To make the application publicly accessible, you have several options:

- For general deployment options, refer to the [Deployment Guide](DEPLOYMENT.md)
- For Render-specific deployment, see the [Render Deployment Guide](RENDER_DEPLOYMENT.md)
- For GitHub repository setup, check the [GitHub Setup Guide](GITHUB_SETUP.md)

### Quick GitHub Setup

This project includes scripts to quickly set up your GitHub repository:

- For Windows: `setup-github.ps1`
- For Linux/macOS: `setup-github.sh`

See [GitHub Setup Scripts Guide](GITHUB_SETUP_SCRIPTS.md) for usage instructions.

## AI Backend Modes

- Production (default): OpenAI via environment variables `OPENAI_API_KEY` and optional `OPENAI_MODEL` (defaults to `gpt-4o-mini`).
- Local (optional): LM Studio using `LM_STUDIO_API_URL` and `LM_STUDIO_MODEL`. This path is intended for local development/testing only.

### Format
The file is a structured JSON document with two main sections:

- `safety-protocols`: Contains safety categories (e.g., electrical, gas, refrigerant, general) with fields:
   - `title`: Human-readable title
   - `tags`: Array of tags for search/filter
   - `difficulty`: Skill level (e.g., all, beginner, advanced)
   - `procedures`: Array of step-by-step safety procedures
   - `references`: Array of `{ label, url }` objects for external resources
- `troubleshooting`: Contains troubleshooting flows (e.g., no-heat, no-cooling) with fields:
   - `title`: Human-readable title
   - `systemTypes`: Array of applicable system types
   - `difficulty`: Skill level
   - `steps`: Array of troubleshooting steps
   - `safetyWarnings`: Array of safety warnings
   - `tags`: Array of tags for search/filter

#### Example
```json
{
   "safety-protocols": {
      "electrical-safety": {
         "title": "Electrical Safety Procedures",
         "icon": "fas fa-bolt",
         "tags": ["safety", "electrical"],
         "difficulty": "all",
         "procedures": ["ALWAYS turn off power at the main breaker before electrical work"],
         "references": [{ "label": "OSHA Electrical Safety", "url": "https://www.osha.gov/electrical" }]
      }
   },
   "troubleshooting": {
      "no-heat": {
         "title": "No Heat",
         "systemTypes": ["Furnace", "Heat Pump", "Boiler"],
         "difficulty": "beginner",
         "steps": ["Check thermostat settings"],
         "safetyWarnings": ["Turn off power before inspecting internal components"],
         "tags": ["heating", "troubleshooting"]
      }
   }
}
```

### How to Add or Edit Knowledge Entries

1. **Open** `data/hvac-knowledge-base.json` in your editor.
2. **To add a new safety protocol:**
    - Add a new key under `safety-protocols` with the structure above.
3. **To add a new troubleshooting flow:**
    - Add a new key under `troubleshooting` with the structure above.
4. **To edit an entry:**
    - Update the relevant fields (title, steps, procedures, etc.).
5. **Validate** your JSON (use an online validator or your editor's linter) to avoid syntax errors.
6. **Test** your changes by running the app and checking the knowledge base UI and search.

### Contribution Guidelines

- Use clear, concise language for steps and procedures.
- Always include safety warnings where appropriate.
- Add references to reputable sources when possible.
- Use tags to improve searchability.
- Submit a pull request with a summary of your changes.

For questions or suggestions, open an issue or contact the maintainers.

## License

MIT