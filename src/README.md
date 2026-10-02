# Source structure

The client uses a feature-first layout so each product area owns its UI, data,
types, and business logic.

```text
src/
├─ app/                 # application shell and tab composition
├─ assets/              # shared static images
├─ features/
│  ├─ auth/             # login, signup, account API and types
│  ├─ home/             # home dashboard (next class, academic calendar)
│  ├─ chat/             # AI 선배: chat UI, feedback, conversation history
│  │                    #   data/ + constants/chatCopy.ts = keyword menu shown when the chatbot server is down
│  ├─ schedule/         # timetable (synced to the server), course catalog, graduation progress
│  ├─ map/              # campus map, nearby places, edit suggestions
│  └─ taxi/             # taxi party posts and chat
├─ shared/              # reusable layout components, API base URL, utilities
└─ styles/              # application-wide shell styles
```

Inside a feature, files are grouped by role: `api/`, `components/`, `constants/`,
`data/`, `hooks/`, `services/`, `types/`, `utils/`, plus one feature stylesheet.

## Dependency rules

- A feature keeps its components, constants, data, services, types, and utils
  inside its own folder.
- Cross-feature orchestration belongs in `app/`.
- Code used by more than one feature belongs in `shared/`.
- Features may import from `shared/`; shared code must not import feature UI.
- Server code and generated course catalogs stay outside `src/`.
