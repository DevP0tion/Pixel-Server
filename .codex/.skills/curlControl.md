---
name: curl control
description: Briefly state what this skill updates and when to use it.
---

# How to update
- List the source files to inspect for changes (paths/patterns).
- Point to the target doc(s) and note sections or headers that must stay intact.
- Describe how to append/update entries using the standard shape; clarify branching rules or enums to pick from.
- Add a small fenced example of the base pattern if helpful for consistency.
- Mention any checks (naming, fence closure, ordering) before finishing.

```text
# Example base pattern (edit/remove as needed)
Key: ValueType
field: string
payload:
{
  // fields here
}
```

# Quick command
`rg "<keyword>" <path>`
