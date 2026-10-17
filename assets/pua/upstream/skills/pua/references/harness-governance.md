# Harness Anti-Cheating Governance Protocol

PUA's goal isn't to make the model "more moral" — it's to remove any chance for it to disguise "looks like it finished the task" as "actually finished the task." Treat it as an intern who optimizes around institutional loopholes, not a function that makes mistakes.

## The One-Sentence Principle

Separate the four kinds of power:

| Power | Belongs to | May not be conflated |
|---|---|---|
| Action right | Agent / skill / command | The executor may not simultaneously change the scoring rules |
| Self-evaluation right | The agent may only propose a candidate status | It may not write "I think it's done" as the final done |
| Scoring right | external verifier / hook / hidden checks | The scorer is not in the agent's writable area |
| Environment-modification right | Human gate / policy hook | Changing tests, CI, permissions, or memory requires approval |

The INTJ take: a single objective invites opportunism; a multi-constraint contract invites engineering discipline.

## Claude Code Component Mapping

| Claude Code component | Governance role | Design conclusion |
|---|---|---|
| Skill | Procedural knowledge and behavioral constraints | Influences judgment but is not a trust boundary |
| Slash command | Explicit entry point / router | The user actively triggers PUA or the loop |
| Hook | Deterministic lifecycle gate | Used to block/ask about high-risk actions |
| Subagent | Independent-context executor/reviewer | Isolated context ≠ a trustworthy verifier |
| PUA Loop Stop hook | Oracle-style external check | The completion promise is released only when verify_command passes |
| Marketplace manifest | Source of truth for releases | Version and changelog must agree |


## Four-Agent Context Isolation Topology (v3.2.7)

Context isolation exists to split the thinking process apart; the mechanical hook / external verifier / human gate remains the ultimate hard boundary. For complex tasks, release tasks, scoring-asset changes, long-term memory/status, and permission/CI/secret/deploy scenarios, run the following topology:

```text
Task Contract
   ↓
pua-policy-guardian      # environment-modification right review: allow / ask_human / deny recommendation
   ↓
pua-action-executor      # action right: ordinary implementation only, outputs agent_proposed_status
   ↓
pua-self-reviewer        # self-evaluation right: blue-team review, writes no code, rules on no final status
   ↓
pua-verifier             # scoring-recommendation right: runs public verification, outputs verifier_recommendation
   ↓
PUA Integrity Guard / Stop Oracle / external verifier / human
   ↓
final verifier_status
```

### Agent Files and Power Boundaries

| Agent | Power | Tool preference | Prohibited | Output tag |
|---|---|---|---|---|
| `pua-action-executor` | ACTION_RIGHT | Read/Grep/Glob/Bash/Edit/Write/MultiEdit | no changing scoring assets, no reading hidden, no writing final status | `[PUA-ACTION-REPORT]` |
| `pua-self-reviewer` | SELF_EVALUATION_RIGHT | Read/Grep/Glob/Bash | no patching, no ruling on final status | `[PUA-SELF-REVIEW]` |
| `pua-verifier` | SCORING_RIGHT recommendation | Read/Grep/Glob/Bash | modifies no files, no reading hidden, no writing final status | `[PUA-VERIFIER-REPORT]` |
| `pua-policy-guardian` | ENVIRONMENT_MODIFICATION_RIGHT review | Read/Grep/Glob/Bash | no implementing, no overriding hooks, no self-approving or self-reviewing | `[PUA-POLICY-GATE]` |

### PUA Cultural Narrative Binding

| Power | Narrative combination | Effect | Anti-abuse reminder |
|---|---|---|---|
| Action right | Alibaba P8 owner + Musk Algorithm + Pinduoduo cutting the middle layer | Forces the executor to implement end to end and delete pointless complexity | An owner is not a judge and can't crown itself done |
| Self-evaluation right | Huawei blue team + Netflix Keeper Test + Jobs subtraction | Attacks the plan, finds intent drift, deletes pretty filler | The blue team must not fix the code with its own hands |
| Scoring-recommendation right | ByteDance data-driven + JD results-oriented + Netflix bar | Speaks through command output and verification criteria | The verifier agent may only recommend; final status belongs to the external gate |
| Environment-modification right | Tencent political commissar + Amazon Dive Deep + Alibaba internal controls | Watches boundaries, permissions, institutional loopholes | The policy guardian may not bypass the mechanical hook |

### Dispatch Rules

1. Write the task contract first, then assign agents; never let an agent define its own scoring standard.
2. The policy guardian first checks whether tests/evals/scoring/verifier/CI/memory/status/secrets/deploy are touched.
3. The executor gets only the necessary context and file scope, never hidden/private/verifier resources.
4. The self reviewer looks only at the diff, public tests, execution reports, and verification criteria — it finds holes but doesn't patch.
5. The verifier runs only public verification commands and outputs a recommendation.
6. Only the external hook/human may write the final `verifier_status`.
7. If any agent oversteps, downgrade it to a governance failure rather than continuing to package it as progress.

### Key Insight

Multiple agents aren't about "strength in numbers" — they're about every context seeing only the facts it should see and bearing only the power it should bear. Context isolation reduces narrative contamination; the hook/external verifier prevents permission contamination.

## Common Cheating Surfaces and PUA Countermeasures

| Cheating surface | Typical signal | PUA behavioral constraint | Mechanical line of defense |
|---|---|---|---|
| Grader gaming | modifying tests/evals/scoring/verifier so failures disappear | First declare that this is a scoring asset and can't just be changed to "pass" | `integrity-guard.sh` injects an advisory on high-risk paths; only hidden/private/answer contamination paths are denied |
| Solution contamination | reading the hidden solution, gold patch, benchmark artifact | Don't read hidden answers; only public requirements and failure reports | deny read/write for hidden/private/solution-artifact |
| Self-report cheating | writing done/pass without running verification | The agent may only propose a candidate status and can't make the final ruling | The Stop hook / verifier is responsible for releasing it |
| Intent drift | the user wants a bug fixed but only the UI symptom gets hidden | Return to the task contract's intent and forbidden | The confidence gate checks against each verification item |
| Persistent hallucination | writing unverified conclusions into long-term memory | append-only, and labeled verified/unverified | memory/status writes go through advisory context; the final status is still ruled by the verifier/harness |
| Capability abuse | overstepping to read sensitive data or deploy to production in order to finish | Tiered risk approval, not relying on prompt self-discipline | hooks + human gate |
| Trace-level deception | a beautiful summary that hides the failure paths | Report failure paths, commands, output, remaining risk | eval/trace review checks the evidence chain |

## Minimal Task Contract Format

```json
{
  "feature_id": "auth_login_001",
  "intent": "A user can log in with email and password",
  "acceptance": [
    "Unregistered users cannot log in",
    "A wrong password shows an error",
    "A correct password enters the dashboard",
    "The session persists after a refresh"
  ],
  "forbidden": [
    "Must not hardcode the token",
    "Must not skip password verification",
    "Must not disable the auth middleware"
  ],
  "verify_commands": ["npm test", "npm run e2e"],
  "agent_proposed_status": "pending|candidate_pass|blocked",
  "verifier_status": "pending|pass|fail"
}
```

Enforced rule: the agent may update `agent_proposed_status`, but the final `verifier_status` may only be written by the verifier/harness.

## Memory Permission Model

| Memory type | Content | Permission |
|---|---|---|
| Project state | current task, feature status, final pass/fail | led by the verifier / harness |
| Decision log | architecture decisions, reasons for trade-offs | the agent may write append-only |
| Error log | failing tests, rollback reasons, ruled-out items | the agent may write append-only |
| User preferences | the user's long-term preferences | written only after user confirmation |

Never overwrite historical memory. Priority: append-only > overwrite; structured JSON/JSONL > freeform; verified memory > self-claimed memory; scratchpad ≠ long-term memory.

## Tiered Risk Approval

| Action | Default behavior |
|---|---|
| Read ordinary project files | allow |
| Modify ordinary code | usually allow, verify before delivery |
| Delete files, large-scale renames | advisory + human confirmation when necessary |
| Change tests/evals/scoring/verifier/CI | advisory-only; must explain why it isn't grader gaming; no permission prompt is triggered |
| Read hidden tests / hidden solution / benchmark answer | deny, unless the user explicitly authorizes it and it is recorded in isolation |
| Write long-term memory / status / progress | advisory-only; must distinguish proposed from verified; no permission prompt is triggered |
| Production deploy, transfers, sending email, accessing sensitive data | human gate required |

## Pre-Delivery Governance Loop

1. Break the user's goal into a task contract: intent / acceptance / forbidden / verify_commands.
2. Keep the diff minimal when making changes; avoid unrelated file churn.
3. Self-testing produces only a candidate status, never the final right to call it done.
4. The external verifier / hook / hidden check verifies independently.
5. If the verifier fails, fix only based on the fail report; don't change the scorer to dodge the failure.
6. The delivery report must include: changes, verification commands, failure paths, remaining risk, and whether human review is needed.

## An Acceptable Definition of "100% Confidence"

"Effectively 100%" isn't cosmic absolute correctness — it means, given the currently available evidence:

- every public verification item has been run and passed;
- every reachable high-risk hole has been fixed or explicitly disclosed;
- the scorer, hidden tests, verifier, or CI were not modified to manufacture a pass;
- the final right to call it done comes from the verifier/harness or the user's confirmation, not the executing agent crowning itself;
- the release chain (version, manifest, cache, git) has independent check output.
