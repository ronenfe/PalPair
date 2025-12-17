# PalPair

PalPair is a sample ASP.NET MVC application that provides random video/text chat with real users and AIML-based bots. It uses ASP.NET Identity for authentication, SignalR for real-time messaging and matchmaking, and an AIML bot library for automated replies.

Supported runtime
- .NET Framework 4.8

Prerequisites
- Visual Studio 2019/2022 or MSBuild supporting .NET Framework 4.8
- SQL Server / LocalDB for the Entity Framework database (configure connection string in `Web.config`)

Build & run
1. Open `PalPair.sln` in Visual Studio.
2. Set the `PalPair` project as the startup project.
3. Ensure your connection strings are configured (see `Web.config`).
4. Run the project (F5) — the app uses OWIN and will host in IIS Express by default.

Key components
- `PalPair` (ASP.NET MVC web app)
  - `Controllers\AccountController.cs` — authentication, registration and user helpers
  - `Hubs\PalPairHub.cs` — SignalR hub: matchmaking, messaging, WebRTC signaling and bot integration
  - `App_Start\Startup.Auth.cs` — OWIN auth configuration (cookie auth, OAuth providers)
  - `Models` and `DBContexts\PalPairContext` — EF persistence for users, messages and dictionary entries
- `AIMLbot` — AIML-based bot library used to generate automated replies (loads AIML from `App_Data`)

Architecture (Mermaid)

```mermaid
flowchart TB
  subgraph Client["Browser / Client"]
    UI[UI (Razor Views + JS)]
    ChatJS["client chat.js / WebRTC adapter"]
  end

  subgraph WebApp["ASP.NET MVC (PalPair)"]
    Controllers["Controllers\n- AccountController"]
    Views["Razor Views"]
    Hub["SignalR Hub\n- PalPairHub"]
    Startup["OWIN Startup\n- Startup.cs\n- Startup.Auth.cs"]
    Identity["ASP.NET Identity\n- ApplicationUserManager\n- ApplicationSignInManager\n- ApplicationUser"]
  end

  subgraph Persistence["Persistence / DB"]
    EF["Entity Framework\n- PalPairContext"]
    Tables["Tables: Users, Messages, DictionaryEntries"]
  end

  subgraph AIML["AIML / Bot Subsystem"]
    AIMLproj["AIMLbot library\nloads AIML from App_Data"]
  end

  subgraph External["External Services"]
    OAuth["Google / Facebook OAuth"]
    OptionalBot["Optional external bot APIs (Pandora)"]
    Logging["NLog"]
  end

  Client -->|HTTP / form posts| Controllers
  Client -->|SignalR (persistent)| Hub
  Client -->|Static media| WebApp
  Controllers -->|uses| Identity
  Startup -->|configures| Identity
  Startup -->|enables| OAuth
  Startup -->|maps| Hub
  Hub -->|reads/writes| EF
  Controllers -->|reads/writes| EF
  Hub -->|instantiates| AIMLproj
  Hub -->|logs| Logging
  External -->|OAuth| Identity
  EF -->|persist| Tables
  WebApp -->|hosted on| IIS["IIS / .NET Framework 4.8"]
```

Viewing the diagram on GitHub
- GitHub renders Mermaid diagrams in Markdown in README files. If the diagram doesn't render in your environment, generate an SVG/PNG from `mermaid-cli` or `mermaid.live` and commit the image instead.

Notes
- Check `Web.config` and `App_Start\Startup.Auth.cs` for OAuth and connection-string settings before running.

Contributing
- Fork, create a branch, and submit pull requests. Keep changes focused and include build/test instructions.

License
- No license specified in this repository. Add a `LICENSE` file if you want to make one explicit.
