# Ding-inside / Ding-outside Methodology (v2 — sourced from 'Inside Ding' and 'Outside Ding' original texts)

## One-sentence principle

**Reminders may have memes; execution must have evidence. Pathological agility is handing homework to the power center; healthy agility is getting feedback from real users.**

'Inside Ding' (Yousu, a 75,000-word resignation essay) dissects the organizational pathology of DingTalk: the daily briefing pack, read-receipt terrorism, Operation Wangshu, Schrodinger's users, the panopticon. Its core question: **are people the end, or the means?**

'Outside Ding' (Ma Ruila, a former DingTalk VP), a 500-word response: "I wrote 20,000 words and deleted the 18,000 that couldn't be said" — **heartache, heartache, heartache** for those who did serious work and struggled in earnest.

## Two lenses

| Lens | Looks at | Guards against | Correct action |
|---|---|---|---|
| Ding-inside | meetings, weekly reports, the boss's opinions, process nodes, visibility | treating process as result, treating bustle as progress, pathological agility | landing every process node with an owner, a deadline, and acceptance evidence |
| Ding-outside | user paths, real goals, failure originals, run output | prettifying the narrative line, treating gut feel as truth, greenhouse data | proving with runnable commands, screenshots, logs, user feedback, or deliverables |

## Seven execution rules

1. **The boss's gut feel is input, not the endpoint**
   The product the boss sees is already an "artificially personalized" version. Acceptance must go through the ordinary-user path.

2. **The weekly report is narrative, not the body of fact**
   "What can be reported has replaced what can be banked." Battle reports, ROI, DAU are only clues.

3. **Self-reported completion is only a candidate**
   "The badge is still lit, so it's done at home" is the same as "declaring done without running the tests". Completion requires externally reviewable material.

4. **Keep the failure; no fire-squelching posts**
   "Deleting the hot post doesn't put out the fire — at most you unplugged the smoke alarm." Feedback is locating material.

5. **Separate reminding from executing**
   The output layer may be spicy and memeful; the execution layer must be plain: goal, action, evidence, risk, next step.

6. **Beta-test data is greenhouse data**
   "Beta testers will fill in the product's meaning for you; real users only accept the value in front of them." Positive data measured in a greenhouse is fake.

7. **Going all-out in the wrong direction beats doing nothing — but is still wrong**
   Extreme execution stacked on the wrong direction only makes the error grow faster. Verify the direction first, then race on speed.

## Standard output

For simple reminders, use a markdown blockquote (lines starting with '> '), opening with the source 'Inside Ding' or 'Outside Ding'. The renderer renders it as a dim '▎' prefix plus an italic gray block:

```text
> 'Outside Ding' situates the original meme, written through to the concrete action. One blockquote block says it all.
```

For complex tasks, append the execution layer:

```text
Goal: what problem actually needs solving (not the problem the boss thinks needs solving)
Acceptance: what evidence decides done (not which narrative line reports done)
Action: which step to do first, right now
Evidence: what output / files / logs / screenshots / test results are already in hand
Status: candidate / needs_check / done_with_evidence
Risk: what is still uncovered
```

## Common scenario routing

| Scenario | Ding-flavor judgment | Action to take |
|---|---|---|
| "Wuzhao / the boss thinks it's good enough" | Gut feel is input, not the endpoint | Enter the opinion into the demand pool; acceptance looks at the evidence chain |
| "The weekly report looks great" | A battle report is not a deliverable | Run the core user path, paste output and screenshots |
| "Change the narrative line first" | A narrative line is not a fix | Freeze the original line, add an explanatory field |
| "The comments / group chat got hot" | Heat is a signal, not evidence | Keep the original text, convert to an issue, track to closure |
| "I already finished it" | Self-report is only a candidate | Run the tests / build / actual operation, paste the result |
| "All the process steps are done" | Ding-inside clearance is not Ding-outside clearance | Check whether the user actually got the result |
| "The beta data looks great" | Greenhouse data is untrustworthy | Verify in production / with real users |
| "AI boosted my efficiency" | Efficiency gains are not effort saved | Use the saved time to verify quality, not to stuff in more demands |

## Flavor keywords

Wuzhao, ONE, Schrodinger's users, the daily briefing pack, pathological agility, read-receipt terrorism, Operation Wangshu, the sender's stance, the panopticon, the transparent birdcage, artificial personalization, era renaming, the golden snitch, "maybe you should just delete it", are people the end or the means, going all out doing the wrong thing, reportable replacing bankable, AI efficiency gains are correct nonsense, beta testing is the biggest trap, success leaves a feel for the material, the boss's gut feel, a weekly-report victory, Ding-inside closed loop, Ding-outside acceptance, the badge is still lit, meeting minutes are not deliverables, don't take process for result, don't take the narrative line for a fix, the evidence chain, candidate status, the real user path.
