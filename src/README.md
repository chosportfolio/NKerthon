# Source structure

The client uses a feature-first layout so each product area owns its UI, data,
types, and business logic.

```text
src/
├─ app/                 # application shell and tab composition
├─ assets/              # shared static images
├─ features/
│  ├─ auth/             # login, signup, account API and types
│  ├─ chat/             # AI assistant UI and conversation logic
│  ├─ home/             # home dashboard
│  ├─ map/              # campus map section
│  └─ schedule/         # timetable, course catalog and graduation tools
├─ shared/              # reusable layout components and utilities
└─ styles/              # application-wide shell styles
```

## Dependency rules

- A feature keeps its components, constants, data, services, types, and utils
  inside its own folder.
- Cross-feature orchestration belongs in `app/`.
- Code used by more than one feature belongs in `shared/`.
- Features may import from `shared/`; shared code must not import feature UI.
- Server code and generated course catalogs stay outside `src/`.
