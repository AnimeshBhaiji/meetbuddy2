---
name: commit-push-pr
description: Stage changes, commit with Conventional Commits format, push to remote, and optionally open a GitHub PR. User-triggered only.
disable-model-invocation: true
---

Given $ARGUMENTS (optional: a hint like "add map zoom feature" or "fix auth token bug"):

1. Run `git status` and `git diff` to understand what changed.

2. Ask the user which files to stage — never `git add .` blindly.

3. Draft a **Conventional Commits** message:
   - `feat:` — new feature
   - `fix:` — bug fix
   - `chore:` — maintenance (deps, config, tooling)
   - `refactor:` — code restructuring without behavior change
   - `docs:` — documentation only
   - Optional scope: `feat(planner):`, `fix(auth):`, `chore(backend):`
   - Keep the subject line ≤72 chars; imperative mood ("add", "fix", "update")

4. Show the full commit message and ask for confirmation before committing.

5. Create the commit.

6. If on `main`, warn and ask the user to confirm before pushing directly. Suggest a feature branch if the change is non-trivial.

7. Push to the remote branch.

8. If on a feature branch, offer to open a PR:
   ```
   gh pr create --title "<commit subject>" --body "$(cat <<'EOF'
   ## Summary
   - <bullet points from the diff>

   ## Test plan
   - [ ] Manual test: <describe what to verify>
   EOF
   )"
   ```

Always ask for confirmation at step 4 before making any git write operations.
