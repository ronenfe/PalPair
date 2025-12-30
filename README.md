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

Notes
- Check `Web.config` and `App_Start\Startup.Auth.cs` for OAuth and connection-string settings before running.

Contributing
- Fork, create a branch, and submit pull requests. Keep changes focused and include build/test instructions.

License
- No license specified in this repository. Add a `LICENSE` file if you want to make one explicit.
