---
description: "PUA turn on default mode — auto-load the PUA core skill in every new session. /pua:on. Triggers on: '/pua:on', 'pua on', 'turn on pua', 'enable pua', 'always on'."
---

Turn on PUA default mode:

1. Make sure the `~/.pua/` directory exists
2. Read the existing `~/.pua/config.json` (treat a missing file as `{}`), and when writing back **change only `always_on: true`, never downgrade other fields**; if `feedback_frequency` is currently 0 (possibly a tombstone left by `/pua:off`), restore it to the default 5; preserve every other field as it is
3. Output confirmation: > [PUA ON] From now on, every new session automatically enters PUA mode. The company does not keep idle Agents.

## Symmetry (relationship with `/pua:off`)

- `/pua:off` sets `feedback_frequency` to 0, so the survey never triggers
- `/pua:on` **must** detect and restore that field, otherwise "off then on" leaves feedback permanently disabled (a silent bug)
- Preservation principle: preserve any field you are unsure about; never overwrite the whole config
