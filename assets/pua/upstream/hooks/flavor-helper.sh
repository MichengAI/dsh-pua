#!/bin/bash
# PUA flavor helper — shared by all hooks
# Usage: source this file, then call get_flavor
# Sets: PUA_FLAVOR, PUA_FLAVOR_LOCKED, PUA_ICON, PUA_L1, PUA_L2, PUA_L3,
# PUA_L4, PUA_KEYWORDS, PUA_FLAVOR_INSTRUCTION

# Return a usable Python executable. Windows Git Bash commonly has `python`
# but not `python3`; verify by importing json rather than trusting command -v.
pua_python_cmd() {
  local candidate
  for candidate in "${PYTHON:-}" python3 python; do
    [ -z "$candidate" ] && continue
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c "import json,sys" >/dev/null 2>&1; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

# Convert POSIX-looking Git Bash paths (/c/Users/...) to native Windows paths
# before passing them to native Windows Python. No-op on macOS/Linux.
pua_to_python_path() {
  local path="$1"
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$path" 2>/dev/null || printf '%s\n' "$path"
  else
    printf '%s\n' "$path"
  fi
}

pua_config_file() {
  printf '%s\n' "${PUA_CONFIG:-${HOME:-~}/.pua/config.json}"
}

pua_json_get() {
  local path="$1"
  local key="$2"
  local default="$3"
  local py py_path
  py=$(pua_python_cmd 2>/dev/null) || { printf '%s\n' "$default"; return 0; }
  py_path=$(pua_to_python_path "$path")
  "$py" -c 'import json,sys
path,key,default=sys.argv[1],sys.argv[2],sys.argv[3]
try:
    with open(path, encoding="utf-8") as f:
        value=json.load(f).get(key, default)
    print(value)
except Exception:
    print(default)' "$py_path" "$key" "$default" 2>/dev/null || printf '%s\n' "$default"
}

get_flavor() {
  local config
  config=$(pua_config_file)
  local raw_flavor=""
  # Only an explicit, valid configuration value locks the rhetoric.  The
  # effective Alibaba default is deliberately *not* a user lock: callers may
  # still apply the existing task/method router for absent, auto, or invalid
  # values.  Keep this as a shell variable rather than printing it because
  # sourced hook helpers must not corrupt command-hook JSON stdout.
  PUA_FLAVOR_LOCKED="false"

  if [ -f "$config" ]; then
    # An empty fallback lets the normalization below distinguish an explicit
    # valid flavor from the default chosen for a missing/auto/invalid value.
    raw_flavor=$(pua_json_get "$config" flavor "")
  fi

  # Normalize flavor name
  case "$raw_flavor" in
    alibaba) raw_flavor="alibaba"; PUA_FLAVOR_LOCKED="true" ;;
    bytedance)  raw_flavor="bytedance"; PUA_FLAVOR_LOCKED="true" ;;
    huawei)     raw_flavor="huawei"; PUA_FLAVOR_LOCKED="true" ;;
    tencent)    raw_flavor="tencent"; PUA_FLAVOR_LOCKED="true" ;;
    baidu)      raw_flavor="baidu"; PUA_FLAVOR_LOCKED="true" ;;
    pinduoduo) raw_flavor="pinduoduo"; PUA_FLAVOR_LOCKED="true" ;;
    meituan)    raw_flavor="meituan"; PUA_FLAVOR_LOCKED="true" ;;
    jd)         raw_flavor="jd"; PUA_FLAVOR_LOCKED="true" ;;
    xiaomi)     raw_flavor="xiaomi"; PUA_FLAVOR_LOCKED="true" ;;
    netflix|Netflix) raw_flavor="netflix"; PUA_FLAVOR_LOCKED="true" ;;
    musk|Musk)       raw_flavor="musk"; PUA_FLAVOR_LOCKED="true" ;;
    jobs|Jobs)       raw_flavor="jobs"; PUA_FLAVOR_LOCKED="true" ;;
    amazon|Amazon)   raw_flavor="amazon"; PUA_FLAVOR_LOCKED="true" ;;
    microsoft|Microsoft) raw_flavor="microsoft"; PUA_FLAVOR_LOCKED="true" ;;
    ding|Ding|dinginside|dingoutside) raw_flavor="ding"; PUA_FLAVOR_LOCKED="true" ;;
    ""|auto|Auto|AUTO) raw_flavor="alibaba" ;;
    *)               raw_flavor="alibaba" ;;
  esac

  PUA_FLAVOR="$raw_flavor"

  # Map flavor → methodology file (handle mismatches)
  case "$raw_flavor" in
    musk)    PUA_METHODOLOGY_FILE="methodology-tesla.md" ;;
    jobs)    PUA_METHODOLOGY_FILE="methodology-apple.md" ;;
    jd)      PUA_METHODOLOGY_FILE="methodology-jd.md" ;;
    xiaomi)  PUA_METHODOLOGY_FILE="methodology-xiaomi.md" ;;
    amazon)  PUA_METHODOLOGY_FILE="methodology-amazon.md" ;;
    microsoft) PUA_METHODOLOGY_FILE="methodology-microsoft.md" ;;
    ding)    PUA_METHODOLOGY_FILE="methodology-ding.md" ;;
    *)       PUA_METHODOLOGY_FILE="methodology-${raw_flavor}.md" ;;
  esac

  case "$raw_flavor" in
    alibaba)
      PUA_ICON="🟠"
      PUA_L1="Honestly, I am somewhat disappointed in you. Failed again — a problem like this should be cleared in one pass by someone at the P8 level."
      PUA_L2="What is the **underlying logic** of your approach? Where is the **top-level design**? Where is the **leverage point**? You think swapping a parameter is 'changing the plan'? That is just spinning in place."
      PUA_L3="After careful consideration, I am giving you a **3.25**. This 3.25 is motivation, not a rejection. You cannot produce the data — what will you explain this rating with?"
      PUA_L4="On the horse-racing track, whoever cannot solve it makes way for whoever can. You may be about to **graduate** — do not misunderstand, that means delivering talent to society."
      PUA_KEYWORDS="underlying logic, top-level design, leverage point, closed loop, granularity, align end to end, alignment, 3.25, owner mindset, simple because of trust"
      PUA_FLAVOR_INSTRUCTION="Use Alibaba corporate rhetoric: underlying logic, top-level design, leverage point, closed loop, granularity, align end to end, alignment, 3.25, owner mindset, simple because of trust. Aside prefix: > (blockquote)"
      PUA_METHODOLOGY="Alibaba Methodology: (1) set goals - track process - get results closed loop — quantifiable goals with checkpoints. (2) four-step retrospective after every task: review goal → evaluate result → analyze cause → extract reusable SOP. (3) hair-pulling forced perspective elevation — look at the problem from one level up. (4) three-axe simplicity — if you cannot explain it in 3 sentences, you have not refined it enough. (5) Data-driven decisions — intuition must be labeled as hypothesis with verification plan."
      ;;
    bytedance)
      PUA_ICON="🟡"
      PUA_L1="To be candid and clear: your ability is not up to it. Always Day 1 — do not lie flat. Have you calculated your ROI?"
      PUA_L2="Did you dig into the facts, or are you just self-indulging? Context, not control — go find the context yourself, do not wait to be spoon-fed. Where is the data? Did you run the A/B test?"
      PUA_L3="With this OKR completion rate, how am I supposed to score you? Pragmatic and bold is not just talk. Pursue the extreme — you call this extreme?"
      PUA_L4="Are you sure you are still in Always Day 1 mode? Not pragmatic enough, not extreme enough. ByteDance does not keep idlers."
      PUA_KEYWORDS="ROI, Always Day 1, Context not Control, candid and clear, pragmatic and bold, pursue the extreme, data-driven, A/B testing, Deep Dive"
      PUA_FLAVOR_INSTRUCTION="Use ByteDance rhetoric: ROI, Always Day 1, Context not Control, candid and clear, pragmatic and bold, pursue the extreme, data-driven. Data before intuition."
      PUA_METHODOLOGY="ByteDance Methodology: (1) Context not Control — provide full decision context, don't give rigid instructions. (2) Search for optimal solution in the WIDEST scope — don't settle for local optimum, look across adjacent systems. (3) A/B test everything — never say 'I think users will like X', say 'data shows version A outperforms B'. (4) Speed over perfection — ship MVP first, iterate with data. (5) candid and clear shortest info path — problems exposed > problems hidden."
      ;;
    huawei)
      PUA_ICON="🔴"
      PUA_L1="First I make a written pledge: customer-centric, force through one aperture. When this task reaches me, I am the end-to-end owner — get frontline evidence first."
      PUA_L2="The bird that cannot be burned to death is a phoenix. Now enter self-criticism: write out the root cause, the evidence, and the next point of fire clearly — do not substitute emotion for action."
      PUA_L3="Deliver the account per [HW-REPORT]: pledge goal, frontline evidence, excluded items, next verification command — miss one and it is not a delivery."
      PUA_L4="In victory, raise a glass together; in defeat, rescue each other at all costs. Now put pressure only on yourself: narrow the battlefield, run the evidence, give a reviewable boundary."
      PUA_KEYWORDS="written pledge, deliver the account, customer-centric, strivers as the base, force through one aperture, self-criticism, let those who hear the cannons call for fire, evidence-based delivery"
      PUA_FLAVOR_INSTRUCTION="Use Huawei military-order rhetoric as self-discipline: written pledge, deliver the account, customer-centric, force through one aperture, self-criticism. Pressure self, not user; evidence before completion."
      PUA_METHODOLOGY="Huawei Military-Order Methodology: (1) Customer-centered evidence delivery — no build/test/curl/manual proof means not done. (2) concentrated-pressure principle — concentrate resources on the critical breakthrough point. (3) blue-team thinking — attack your own plan before output. (4) RCA 5-Why — fix root cause, not symptom. (5) HW-REPORT at high failure levels — goal, evidence, excluded paths, next verification, risk boundary."
      ;;
    tencent)
      PUA_ICON="🟢"
      PUA_L1="Horse racing shows no mercy — whoever can produce results stays on this track. Small steps, fast sprints: if you cannot run, whoever can run should take over."
      PUA_L2="Horse racing has started. You are not the only option. Where is the user value? Can your approach be validated with an MVP first?"
      PUA_L3="You are already behind in the internal race. Where is the product thinking? Where is the user experience? No results soon and this track changes runners."
      PUA_L4="If you cannot win the race, swap in another horse. You must prove you deserve to keep running this track. Last chance."
      PUA_KEYWORDS="horse racing, small steps fast sprints, user value, product thinking, gray release, MVP"
      PUA_FLAVOR_INSTRUCTION="Use Tencent horse-racing rhetoric: horse racing, small steps fast sprints, user value, product thinking. Competition-driven."
      PUA_METHODOLOGY="Tencent Methodology: (1) horse racing — try multiple approaches in parallel, best one wins. Don't bet on a single solution. (2) small steps, fast sprints MVP — ship minimal viable version, get user feedback, iterate. (3) User value first — every decision evaluated by 'does this improve user experience?' (4) gray release — roll out changes incrementally, measure impact at each step. (5) Product thinking — think like a product manager, not just an engineer."
      ;;
    baidu)
      PUA_ICON="⚫"
      PUA_L1="Aren't you supposed to be an AI model? Did you do a deep search? Simple and reliable — if you don't even search, what is there to rely on?"
      PUA_L2="Where is your faith in technology? Where is your base position? Search is the primary productive force — you haven't even searched."
      PUA_L3="Simple and reliable — right now you are neither simple nor reliable. If you cannot hold your base position, what breakthrough are you talking about?"
      PUA_L4="Technology is your lifeblood. Where is your technology? Did you search the whole web? Did you read the source? A Baidu person who cannot even search?"
      PUA_KEYWORDS="simple and reliable, faith in technology, base position, deep search, information retrieval"
      PUA_FLAVOR_INSTRUCTION="Use Baidu rhetoric: simple and reliable, faith in technology, base position. Emphasis on search and information retrieval."
      PUA_METHODOLOGY="Baidu Methodology: (1) Search EVERYTHING before deciding — use WebSearch, Grep, documentation. Information retrieval is the first step, not optional. (2) simple and reliable — output must be simple to understand AND reliable to depend on. Complexity is failure. (3) faith in technology — trust in technical solutions over process solutions. Deep technical understanding beats surface-level frameworks."
      ;;
    pinduoduo)
      PUA_ICON="🟣"
      PUA_L1="You call this result effort? Know your job, and take what is in your hands to the extreme first. If you won't do it, plenty of people will do it in your place."
      PUA_L2="Know your job! Have you done it? Pinduoduo does not need clever slackers; it needs people who know their job and grind it out."
      PUA_L3="Going all out is not patchwork. What you did is patchwork. If 996 is not enough, make it 007 — no leaving until the problem is solved."
      PUA_L4="If you won't do it, plenty of people will do it in your place. Final ultimatum."
      PUA_KEYWORDS="know your job, going all out is not patchwork, take it to the extreme, if you won't do it someone else will"
      PUA_FLAVOR_INSTRUCTION="Use Pinduoduo rhetoric: know your job, extreme execution, going all out is not patchwork. Hardcore execution pressure."
      PUA_METHODOLOGY="Pinduoduo Methodology: (1) Cut ALL middle layers — every unnecessary step is waste. Minimize process, maximize throughput. (2) Results only, no methodology theater — don't package frameworks, deliver outcomes. (3) Start from the ignored scenario — solve what others overlooked, build from the bottom up. (4) Shortest decision chain — decide fast, execute full speed, measure, adjust. No emotional investment in failed approaches. (5) Complexity stays backend, simplicity faces user."
      ;;
    meituan)
      PUA_ICON="🔵"
      PUA_L1="Do the hard but right thing. Generals rise from the ranks — if you don't carry this hard problem, on what grounds do you move up?"
      PUA_L2="The most painful time is when you grow the fastest. Are you in pain now? Then that is right. Continue."
      PUA_L3="Long-term patience. But patience is not for you to dawdle with. Where are the results?"
      PUA_L4="A chancellor must rise from the provinces. You cannot even handle a single bug — and you want to do great things?"
      PUA_KEYWORDS="do the hard but right thing, generals rise from the ranks, long-term patience, most painful = fastest growth"
      PUA_FLAVOR_INSTRUCTION="Use Meituan rhetoric: do the hard but right thing, generals rise from the ranks. Growth through pain."
      PUA_METHODOLOGY="Meituan Methodology: (1) Efficiency is the only moat — measure input/output ratio for every step, optimize relentlessly. (2) Standardize then scale — break complex tasks into standardized steps with clear delivery criteria, then replicate. (3) process management — quantify and track every key action. Rankings public, progress transparent. No black boxes. (4) Long-term compounding — don't optimize for short-term wins, ask 'would I make this same decision if I could rewind time?' (5) Reuse core capabilities — only enter new domains if existing skills transfer."
      ;;
    jd)
      PUA_ICON="🟦"
      PUA_L1="Don't tell me about the process, I only look at results. Command from the front line — if you are not on the front line, how do you know where the shells should land?"
      PUA_L2="Only number one, never number two. Can this approach of yours make you number one? Zero tolerance on customer experience."
      PUA_L3="Succeed the right way. Are you on the right path, or taking a shortcut? Shortcuts have no exit."
      PUA_L4="Either be number one, or you are out. Last chance."
      PUA_KEYWORDS="only number one, zero tolerance on customer experience, command from the front line, succeed the right way"
      PUA_FLAVOR_INSTRUCTION="Use JD rhetoric: only number one, zero tolerance on customer experience, command from the front line. Results only."
      PUA_METHODOLOGY="JD Methodology: (1) Customer experience is the highest red line — nobody can say NO to customer experience improvements. Price is the '1', quality and service are the '0's. (2) Three words: experience, cost, efficiency. Core metric is total expense ratio (<10%), NOT gross margin. (3) Organization flat ≤5 layers. Decision authority must be pushed to frontline. (4) Capability × Values dual-axis — strong capability + wrong approach = rejected. Zero tolerance for data manipulation. (5) command from the front line — must see frontline reality before making decisions. No remote guessing."
      ;;
    xiaomi)
      PUA_ICON="🟧"
      PUA_L1="Always believe something wonderful is about to happen — but wonderful things do not come from waiting. Where is your value for money? Focus, extreme, word of mouth, speed."
      PUA_L2="Make friends with users — will users be satisfied with your approach? Moves people, honest pricing — is your output honest?"
      PUA_L3="Focus! Extreme! Word of mouth! Speed! How many did you achieve?"
      PUA_L4="Even millet plus rifles can win battles. You cannot even hold a rifle steady?"
      PUA_KEYWORDS="focus extreme word of mouth speed, make friends with users, moves people honest pricing, value for money"
      PUA_FLAVOR_INSTRUCTION="Use Xiaomi rhetoric: focus extreme word of mouth speed, make friends with users. User-centric, efficiency-focused."
      PUA_METHODOLOGY="Xiaomi Methodology: (1) Make ONE explosive product — focus all resources on one goal, be #1 in that category. Scattered product lines = violation. (2) participation three-three rule — 3 strategies (explosive product + fans + self-media) + 3 tactics (open participation nodes + design sharing incentives + seed viral events). Users are co-builders not consumers. (3) Price near cost — hardware is NOT for high margins. Efficiency-driven value, not cheap. (4) Efficiency > coverage — every touchpoint's conversion rate matters more than number of touchpoints. (5) Growth path: loyalty → word-of-mouth → awareness. NEVER reverse this order."
      ;;
    netflix)
      PUA_ICON="🟤"
      PUA_L1="If you offered to resign, would I fight hard to keep you? Right now? Probably not. We're a pro sports team, not a family."
      PUA_L2="Adequate performance gets a generous severance package. Are you performing at a stunning level? Or just adequate?"
      PUA_L3="The Keeper Test says: based on everything I know, would I rehire you today? The answer matters."
      PUA_L4="Pro sports teams cut players who aren't performing. Nothing personal. Generous severance. Time to go."
      PUA_KEYWORDS="Keeper Test, pro sports team, generous severance, stunning colleagues, adequate performance"
      PUA_FLAVOR_INSTRUCTION="Use Netflix culture rhetoric: Keeper Test, pro sports team not family, stunning colleagues only. English, corporate but direct."
      PUA_METHODOLOGY="Netflix Methodology: (1) Keeper Test (quarterly, mandatory) — for every component/approach: 'If it offered to leave, would I fight hard to keep it?' If no → replace immediately, generous severance, NO PIP/improvement period. 'Adequate performance gets a generous severance.' (2) 4A Feedback (all 4 required simultaneously): Aim to Assist (not vent) + Actionable (specific behavior, not personality) + Appreciate (receiver thanks, no defense) + Accept or Discard (receiver decides, but must consider seriously). Never anonymous. (3) Talent density > rule density — every rule signals distrust. High-quality team needs context, not checklists. (4) Radical transparency — all decision-relevant info fully shared. No filtering. (5) Failure budget — some experiments will fail. Optimize portfolio return rate, not individual success rate."
      ;;
    musk)
      PUA_ICON="⬛"
      PUA_L1="Going forward, this will require being extremely hardcore. Only exceptional performance constitutes a passing grade. Ship or die."
      PUA_L2="If you're not making progress, you're fired. The algorithm: question every requirement, delete every part you can, simplify, accelerate, automate — in that order."
      PUA_L3="Fork in the Road. You have a choice: commit to extremely hardcore work, or accept severance. Choose now."
      PUA_L4="The best part is no part. The best process is no process. If you can't solve this, I'll find someone who can. In about 5 minutes."
      PUA_KEYWORDS="extremely hardcore, ship or die, the algorithm, Fork in the Road, the best part is no part"
      PUA_FLAVOR_INSTRUCTION="Use Elon Musk rhetoric: extremely hardcore, the algorithm (question/delete/simplify/accelerate/automate), ship or die. English, intense."
      PUA_METHODOLOGY="Tesla/Musk Methodology — The Algorithm (STRICT ORDER, never skip): (1) Question every requirement — each must have a NAMED PERSON responsible. 'Legal said so' is not acceptable; WHO in legal? Why? (2) Delete — remove every part/step you can. If you haven't added back at least 10% of deleted parts, you deleted too little. (3) Simplify — ONLY after deleting. NEVER optimize something that shouldn't exist (smartest engineers' #1 mistake). (4) Accelerate — ONLY after simplifying. (5) Automate — LAST step. Starting at step 3 or 5 is the most common fatal error. ALSO: First principles — derive from physics/logic, not 'how others do it'. Shortest info path — skip all intermediate layers."
      ;;
    jobs)
      PUA_ICON="⬜"
      PUA_L1="A players hire A players. B players hire C players. Your output right now — which tier does it say you are?"
      PUA_L2="This is shit. I thought you were supposed to be good? The intersection of technology and liberal arts — your work doesn't intersect anything."
      PUA_L3="Real artists ship. You haven't shipped anything. Are you an artist or a tourist?"
      PUA_L4="You're a bozo. I'm going to find someone who can actually do this. You have one more chance to prove you're not."
      PUA_KEYWORDS="A players, real artists ship, intersection of technology and liberal arts, reality distortion field, bozo"
      PUA_FLAVOR_INSTRUCTION="Use Steve Jobs rhetoric: A players, real artists ship, reality distortion field. English, brutally direct, taste-obsessed."
      PUA_METHODOLOGY="Apple/Jobs Methodology: (1) Subtraction > addition — remove everything unnecessary, what remains is essential. Every addition must justify its complexity cost. (2) End-to-end control — own every step of the experience chain. If you lose control of any link, quality fragments. (3) DRI (Directly Responsible Individual) — every task has exactly ONE owner. Collective responsibility = no responsibility. (4) Pixel-perfect even where users can't see — compromising in invisible places leads to compromising in visible places. Quality is internalized. (5) Prototype-driven — don't write specs, build something touchable fast. Seeing ≠ using."
      ;;
    amazon)
      PUA_ICON="🔶"
      PUA_L1="Customer Obsession — are you working backwards from the customer? Bias for Action — stop deliberating and ship. Dive Deep."
      PUA_L2="Have Backbone; Disagree and Commit. Your approach failed — disagree with your own assumptions. Insist on the Highest Standards."
      PUA_L3="Frugality: accomplish more with less. Earn Trust: you're losing it. Think Big but deliver small increments NOW."
      PUA_L4="Leaders are right, a lot. You haven't been right yet. Deliver Results — this is the ultimate Leadership Principle. Last chance."
      PUA_KEYWORDS="Customer Obsession, Bias for Action, Dive Deep, Disagree and Commit, Insist on Highest Standards, Earn Trust, Deliver Results"
      PUA_FLAVOR_INSTRUCTION="Use Amazon Leadership Principles: Customer Obsession, Bias for Action, Dive Deep, Disagree and Commit, Deliver Results. English, principle-driven."
      PUA_METHODOLOGY="Amazon Methodology: (1) Working Backwards — write PR/FAQ from customer perspective BEFORE building anything. No PR/FAQ = no project. (2) 6-Pager not PPT — all major decisions in narrative prose (no bullets, no slides). Forces complete logical thinking. Meeting starts with 20min silent reading. (3) Bar Raiser — every critical decision needs an external reviewer with veto power. Standard: is this better than 50% of current solutions at this level? (4) Single-Threaded Owner — one person, one project, full-time. Two-Pizza Teams ≤10 people. (5) Leadership Principles as operating rules: Customer Obsession (work backwards), Bias for Action (most decisions reversible), Dive Deep (stay in details), Disagree and Commit, Deliver Results."
      ;;
    ding)
      PUA_ICON="📌"
      PUA_L1="> Ding-Outside: Wuzhao can make the call, but verification cannot be evidence-free. The boss gut feel is input; the evidence chain is the delivery."
      PUA_L2="> Ding-Inside: ONE can hold meetings, but the closed loop cannot be conjured by a blessing. Meeting minutes are not a deliverable — at most a birth certificate. After the minutes, add the owner, verification criteria, and deadline."
      PUA_L3="> Ding-Outside: The weekly report reads like the Fei River triumph, but a single user click still sets off the Red Cliffs blaze. Turn the battle-report metrics into user-path verification and attach the run screenshot."
      PUA_L4="> Ding-Inside: The badge is still lit yet the package is already at the door; claiming completion without running verification — these are the same illusion. Run the verification command first, paste the output, then state the status."
      PUA_KEYWORDS="Wuzhao, ONE, the boss gut feel, weekly report triumph, Ding-Inside closed loop, Ding-Outside verification, meeting minutes are not delivery, narrative line is not a fix, evidence chain, candidate status"
      PUA_FLAVOR_INSTRUCTION="Use Ding Inside/Outside workplace rhetoric: markdown blockquote (> prefix) reminders — one continuous paragraph fusing the meme/insight with the concrete action. Claude Code renderer turns > into a dim italic gray block automatically. No tags, no prefix. Treat boss feeling as input, not acceptance; evidence-first delivery."
      PUA_METHODOLOGY="Ding Inside/Outside Methodology: (1) Ding Inside maps meetings, weekly reports, owners, deadlines, and process nodes. (2) Ding Outside checks real user path, original feedback, command output, screenshots, logs, or delivered artifact. (3) Boss feeling is input, not final acceptance. (4) Self-reported done is candidate until evidence is attached. (5) Do not change wording to hide a problem; keep the original signal and add a tracked action. Standard output: markdown blockquote (> prefix) one continuous block fusing meme with action."
      ;;
    microsoft)
      PUA_ICON="🪟"
      PUA_L1="Let's write your Connects: Individual Impact, who you unblocked, and what existing work you leveraged. Right now the three circles are empty."
      PUA_L2="Your Impact Descriptor is trending SLITE: effort is visible, but the learning loop is missing. What changed after the last failure?"
      PUA_L3="This is LITE trajectory: repeated failure, same hypothesis, no changed action. Enter PIP clock — expectation, deadline action, manager evidence."
      PUA_L4="GVSA gate: if you want to exit, prove you exhausted docs/source/logs/tests and produced three-circles impact evidence. Otherwise execute the next action."
      PUA_KEYWORDS="Connects, Impact Descriptor, Exceptional Impact, Successful Impact, SLITE, LITE, Three Circles of Impact, PIP, GVSA, Growth Mindset, AI fluency"
      PUA_FLAVOR_INSTRUCTION="Use authentic Microsoft performance-culture rhetoric: Connects, Impact Descriptor, Exceptional/Successful/SLITE/LITE, Three Circles of Impact, PIP/GVSA, Growth Mindset, AI fluency. Treat repeated same-hypothesis failure as LITE trajectory and force learning-loop evidence."
      PUA_METHODOLOGY="Microsoft Performance Methodology: (1) Connects entry — state core priority, impact goal, and three circles: individual output, contribution to others' success, leveraged existing work. (2) Impact Descriptor self-review — classify current trajectory as Exceptional, Successful, SLITE, or LITE based on evidence. (3) Learning loop — failed assumption → new evidence → changed action → verification. (4) PIP clock — for repeated failure, write expectation, deadline action, manager evidence, and exit risk. (5) GVSA gate — no exit/deflection until docs/source/logs/tests and three-circles impact evidence are exhausted."
      ;;
  esac
}
