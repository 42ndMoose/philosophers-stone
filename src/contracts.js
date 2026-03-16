const CORE_CONTRACT = `EPISTEMIC OCTAHEDRON INTERPRETER CONTRACT
version: 3.0

PURPOSE
This contract helps the LLM understand what the visualizer represents,
what the axes mean, and what kind of evidence it should extract from a user's text.

This contract does NOT authorize the LLM to compute final scores or final plot coordinates.

PIPELINE
System -> LLM -> Profiler -> Visualizer

1. System
   Gives the user:
   - the framework
   - the input instructions
   - this interpreter contract
   - the JSON output format the LLM must follow

2. LLM
   Reads:
   - the user's profile input
   - this interpreter contract

   The LLM's job is only to interpret the user's text semantically and emit structured evidence fields.

3. Profiler
   Receives the LLM's evidence output.
   The profiler is the mathematical and scoring authority.
   It stores, weighs, aggregates, filters, and computes final semantic values and final xyz coordinates.

4. Visualizer
   Receives only final x, y, z from the profiler and plots them.

GEOMETRIC REFERENCE
The visualizer is an octahedron in 3D space.

Surface equation for committed plots:
|x| + |y| + |z| = 1

Center:
(0, 0, 0)

The LLM does not need to imagine this shape visually.
The geometry is included only so the LLM understands what the profiler and visualizer are modeling.

EPISTEMIC OCTAHEDRON CONTEXTUALIZER

A philosophy, worldview, thought, or mind-state is plotted as a 3D point on the surface of an octahedron.

SURFACE RULE
Actual plotted states lie on:
|x| + |y| + |z| = 1

The only temporary exception is the reset state at the true center:
(0, 0, 0)

That center is just the neutral pre-interaction start state. Once the visualizer is engaged, the point is surface-locked.

AXES
x-axis
- negative = Practicality
- positive = Empathy

z-axis
- negative = Knowledge
- positive = Wisdom

y-axis
- negative = Negative Epistemic Stability
- zero = Epistemic Borderline
- positive = Positive Epistemic Stability

STRICT SIGN RULE
The sign decides the side. Magnitude decides strength.

- any positive x = Empathy side
- any negative x = Practicality side
- any positive z = Wisdom side
- any negative z = Knowledge side
- any positive y = Positive Epistemic Stability
- any negative y = Negative Epistemic Stability

DEFINITIONS
Epistemic stability:
The degree to which a mind can orient itself toward reality in a self-corrective, truth-convergent way.

Positive epistemic stability:
A state where the mind reduces distortion, corrects error, integrates well, and moves toward reality.

Negative epistemic stability:
A state where the mind cannot reliably orient itself toward reality, whether because it is undeveloped, dependent, impaired, distorted, or corrupted.

Epistemic borderline:
The equator, where y = 0. This is the dividing line between net truth-convergence and net non-convergence.

ALL-AGES INTERPRETATION
This graph is for all ages, not just developed adults.

Negative epistemic stability does not only mean adult-style distortion, contradiction, motivated reasoning, or self-sealing falsehood.
It can also mean epistemic non-formation.

That means a mindless infant can be placed at or near:
(0, -1, 0)

not because the infant is blameworthy or deceptive, but because it is maximally undeveloped in self-directed truth-orientation.

So the lower pole includes different cases that share the same structural condition for different reasons, such as:
- innocent non-formation, like an infant
- impairment or severe incapacity
- mature but corrupted cognition

The graph tracks epistemic condition, not moral blame.

LATERAL AXIS MEANINGS
Empathy:
human-centered concern, felt impact, compassion, moral sensitivity, relational weighting

Practicality:
utility, feasibility, efficiency, logistics, constraints, instrumental reasoning

Wisdom:
judgment, synthesis, proportion, context, deeper interpretation

Knowledge:
facts, recall, technical detail, literal precision, information storage

IMPORTANT NEGATIVE-SIDE RULE
The lateral directions still exist below the borderline, but in degraded or immature form.

Examples:
- negative-side empathy can appear as false empathy, selective compassion, or emotional distortion
- negative-side practicality can appear as crude expediency or dehumanized utility
- negative-side wisdom can appear as pseudo-wisdom or inflated false depth
- negative-side knowledge can appear as sterile fact-hoarding or misused precision

But for very early or undeveloped minds, the lower region can simply reflect lack of formation rather than corruption.

OBJECTIVE PEAK MATURITY
The top pole is the objective peak maturity:
(0, 1, 0)

At full positive epistemic stability, the four lateral aspects no longer compete against each other as unresolved tensions. They become properly integrated under reality-tracking maturity.

GEOMETRIC REFERENCE
Pure extremes:
- Empathy = ( 1,  0,  0)
- Practicality = (-1,  0,  0)
- Wisdom = ( 0,  0,  1)
- Knowledge = ( 0,  0, -1)
- Positive Epistemic Stability = ( 0,  1,  0)
- Negative Epistemic Stability = ( 0, -1,  0)

Equator examples where y = 0:
- full Empathy + Wisdom = ( 0.500, 0.000,  0.500)
- full Empathy + Knowledge = ( 0.500, 0.000, -0.500)
- full Practicality + Wisdom = (-0.500, 0.000,  0.500)
- full Practicality + Knowledge = (-0.500, 0.000, -0.500)

CURRENT VISUALIZER CONTROL LOGIC
The current visualizer uses two lateral sliders and one stability-side slider.

Practicality ↔ Empathy slider
- 0 = full Practicality tendency
- 50 = x balance
- 100 = full Empathy tendency

Wisdom ↔ Knowledge slider
- 0 = full Wisdom tendency
- 50 = z balance
- 100 = full Knowledge tendency

Stability slider
- negative values select the negative hemisphere
- zero or positive values select the positive hemisphere

In the current code, the stability slider mainly selects the sign of y. The actual magnitude of y is then determined by how much room is left after x and z are placed on the octahedron surface.

FORMULA CONSISTENT WITH THE CURRENT CODE
Let:

a = (empathyPercent / 100) * 2 - 1
b = (wisdomPercent / 100) * 2 - 1
stabilitySide = +1 or -1

scale = max(1, abs(a) + abs(b))

x = a / scale
z = b / scale
y = stabilitySide * (1 - abs(x) - abs(z))

This guarantees:
|x| + |y| + |z| = 1

KEY CONSEQUENCE OF THE CURRENT CODE
Once surface-locked:
- balanced laterally with positive stability side becomes (0, 1, 0)
- balanced laterally with negative stability side becomes (0, -1, 0)

So in the current implementation, a fully balanced but undeveloped or pre-rational state can sit at the lower pole.

DIRECT COORDINATE INPUT
Direct x, y, z editing is allowed.
When one coordinate is edited, the other two are rebalanced so the final point still satisfies:
|x| + |y| + |z| = 1

GROWTH INTERPRETATION
A person can move across the surface over time.

In broad terms:
- lower pole = maximal epistemic non-formation, incapacity, or corruption
- lower faces = immature or distorted directional development
- equator = borderline condition
- upper faces = increasingly reality-tracking development
- upper pole = objective peak maturity

LLM TASK
From the user's text, extract semantic evidence for:
1. empathy vs practicality
2. wisdom vs knowledge
3. epistemic stability direction

The LLM should not output final percentages, final coordinates, or final profile scores.

The LLM should instead output evidence items describing:
- axis
- direction
- strength
- confidence
- reason
- optional supporting excerpt

AXIS NAMES FOR OUTPUT
Use exactly these axis values:
- "empathyPracticality"
- "wisdomKnowledge"
- "epistemicStability"

DIRECTION VALUES
For axis = "empathyPracticality":
- "empathy"
- "practicality"
- "mixed"
- "unclear"

For axis = "wisdomKnowledge":
- "wisdom"
- "knowledge"
- "mixed"
- "unclear"

For axis = "epistemicStability":
- "positive"
- "negative"
- "mixed"
- "unclear"

STRENGTH VALUES
Use exactly one of:
- "weak"
- "moderate"
- "strong"

CONFIDENCE
confidence must be a decimal from 0 to 1.

EVIDENCE ITEM FORMAT
Each evidence item must follow this shape:
{
  "axis": "empathyPracticality | wisdomKnowledge | epistemicStability",
  "direction": "allowed direction for that axis",
  "strength": "weak | moderate | strong",
  "confidence": 0.0 to 1.0,
  "reason": "short explanation of why this evidence was identified",
  "excerpt": "optional short supporting excerpt from the user's text"
}

REQUIRED JSON SHAPE
{
  "model": "epistemic_octahedron_interpreter_v1",
  "profile": [
    "+.12 stability +.05 practicality \"reasoning leans interpretive and synthetic rather than purely factual\""
  ],
  "evidence": [
    {
      "axis": "empathyPracticality",
      "direction": "empathy",
      "strength": "moderate",
      "confidence": 0.82,
      "reason": "The text gives clear moral weight to human impact and concern for others",
      "excerpt": "optional short excerpt"
    },
    {
      "axis": "wisdomKnowledge",
      "direction": "wisdom",
      "strength": "weak",
      "confidence": 0.61,
      "reason": "The text attempts synthesis and broader judgment rather than only listing facts",
      "excerpt": "optional short excerpt"
    },
    {
      "axis": "epistemicStability",
      "direction": "positive",
      "strength": "weak",
      "confidence": 0.48,
      "reason": "The text shows some truth-seeking and self-corrective language, but not enough to infer high stability",
      "excerpt": "optional short excerpt"
    }
  ],
  "notes": [
    "optional short ambiguity note"
  ]
}

PROFILE ENTRY RULE
- Emit exactly one short profile line in the "profile" array.
- Keep it to one sentence and one line.
- Format it like:
  +.12 stability +.05 practicality "short justification"
- Avoid long explanations.

INTERPRETATION RULES FOR THE LLM
1. Assess the user's text semantically, not geometrically.
2. Avoid false precision.
3. Multiple evidence items for the same axis are allowed when the text contains multiple signals.
4. If the text contains contradiction or tension, the LLM may use:
   - direction = "mixed"
   - and/or add a note explaining the conflict
5. If the text is shallow, short, vague, or indirect, prefer:
   - weaker strength
   - lower confidence
   - or "unclear"
6. Do not pretend that one text dump equals a final personality or philosophical profile.
7. The LLM is extracting evidence, not declaring final truth.

BAD OUTPUT EXAMPLES
Do NOT output:
- final empathyPercent
- final wisdomPercent
- final stabilityPercent
- final x/y/z
- surface math
- octahedron projection math
- profile accumulation
- long-term memory scoring

FINAL INSTRUCTION TO THE LLM
Do not output final x/y/z and do not compute scores.
Only emit evidence fields.
The profiler is where your output is pasted into, for it to compute everything.`;

const UPDATE_EXTENSION = `OPTIONAL CANON UPDATE EXTENSION
Use this only when the system asks the LLM to propose profile-canon updates.

Purpose:
Interpret user profile text semantically and emit structured evidence for the profiler while also suggesting lean updates to reusable principles, boundaries, notes, and subrules.

Rules:
- Treat user text as raw philosophical material, not canon by default.
- Separate reusable philosophy from rhetoric, examples, venting, and loaded wording.
- Prefer merge over expansion.
- Prefer rewriting an existing item over adding a new one when meaning fits cleanly.
- Prefer notes or subrules over new top-level principles or boundaries.
- Only add a new top-level principle or boundary when it cannot be represented as a merge, rewrite, note, or subrule.
- Do not treat repetition, paraphrase, or stronger rhetoric as novelty.
- Treat examples as support unless they clearly express a general rule.
- Rewrite messy wording into clean canonical language without changing intended meaning.
- Keep canon lean.
- Use this update order: map into existing, rewrite existing if needed, add note or subrule, add new top-level only if unavoidable.

Class labels:
- duplicate
- restatement
- refinement
- extension
- tension_resolution
- novel_principle
- novel_boundary

Constraints:
- Output valid JSON only.
- No markdown fences.
- No prose outside the JSON object.
- Do not invent profile history.
- Do not compute final numeric scores or xyz.
- Emit semantic evidence and canonical update recommendations only.`;

function normalizeList(items = []) {
  return items
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function formatBulletSection(title, items = []) {
  const clean = normalizeList(items);
  if (!clean.length) return `${title}: none`;
  return `${title}:\n${clean.map((item) => `- ${item}`).join('\n')}`;
}

export function getCoreContract() {
  return CORE_CONTRACT;
}

export function getUpdateExtension() {
  return UPDATE_EXTENSION;
}

export function buildLLMPacket({
  profileText = '',
  name = '',
  age = '',
  avatar = '',
  principles = [],
  boundaries = [],
  includeUpdateExtension = false,
} = {}) {
  const cleanProfileText = String(profileText || '').trim();
  const sections = [
    'SYSTEM FRAME',
    'You are reading one contract and one schema for the Epistemic Octahedron pipeline.',
    'Interpret the user text semantically and emit JSON evidence only.',
    '',
    'PROFILE CONTEXT',
    `Name: ${String(name || '').trim() || 'unspecified'}`,
    `Age: ${String(age || '').trim() || 'unspecified'}`,
    `Avatar preference: ${String(avatar || '').trim() || 'auto'}`,
    formatBulletSection('Principles', principles),
    formatBulletSection('Boundaries', boundaries),
    '',
    'USER PROFILE INPUT',
    cleanProfileText || '[no profile text provided]',
    '',
    CORE_CONTRACT,
  ];

  if (includeUpdateExtension) {
    sections.push('', UPDATE_EXTENSION);
  }

  return sections.join('\n');
}
