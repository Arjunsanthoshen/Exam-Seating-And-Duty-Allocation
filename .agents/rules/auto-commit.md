# Auto-Commit and Push After Changes

After completing **any code change** to this project, always run the following steps in order without asking for confirmation:

1. `git add .` from the repository root (`/home/arjun/Documents/miniproject/ExamSeating&DutyAllocation`)
2. `git commit -m "<descriptive message>"` — write a concise, meaningful commit message that describes what was changed and why
3. `git push` — push to the current branch

**Rules:**
- Do **not** stop or pause after committing. Always attempt the push as part of the same flow.
- If the push fails due to authentication, a rejected push, or any other Git error, **report the error clearly** and stop. Do not retry the push in a loop.
- If there is nothing to commit (`git status` shows a clean tree), skip silently — do not error.
- This applies to all file changes: source code, config files, CSS, SQL, documentation, etc.
