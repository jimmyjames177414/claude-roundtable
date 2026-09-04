<p align="center">
  <img src="docs/avatar.png" width="88" alt="jimmyjames177414">
</p>

<h1 align="center">claude-roundtable</h1>

<p align="center">
  <b>Two Claude personas argue your decision adversarially in the terminal, and a third one calls it.</b>
</p>

<p align="center">
  <a href="https://github.com/jimmyjames177414/claude-roundtable/actions/workflows/ci.yml"><img src="https://github.com/jimmyjames177414/claude-roundtable/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license">
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node >=18">
</p>

Ask a model for its opinion and you get a balanced answer: three points for, three
points against, "it depends on your use case." That answer is useless because nothing in
it is trying to win. This runs the same question as a fight instead. The Skeptic's job is
to attack, so the objection you had not thought of shows up in the second turn, and the
Moderator is prompted in as many words to be **"decisive, not diplomatic - do not simply
summarize both sides as equally valid"**
([`src/debate.ts`](src/debate.ts)). It is a small tool. The output is the strongest case
against your idea, on demand.

```bash
npx github:jimmyjames177414/claude-roundtable "should we rewrite the parser in Rust?" --judge
```

The shape of what comes back, streamed live, one colour per speaker:

```
Proponent:
The parser is the hot path and it is where every memory bug we shipped last quarter came
from. Rust removes that entire class of failure at compile time, and the rewrite is
bounded: one module, one well-tested interface.

Skeptic:
"Bounded" is doing a lot of work there. You are not rewriting a parser, you are rewriting
the parser plus every FFI boundary it touches, in a language two people on the team can
review. The memory bugs were caught by fuzzing, and fuzzing is cheaper than a rewrite.
...
```

<sub><i>Illustrative, not a captured run - no Anthropic API key was available in the
environment this was built in. See <a href="#example-output">Example output</a>.</i></sub>

<p align="center">
  <img src="docs/demo.png" width="720" alt="Example roundtable debate output">
  <br>
  <sub><i>Illustrative example output, styled for display - not a captured run. See
  <a href="#example-output">Example output</a> for why, and how to get a real one.</i></sub>
</p>

## What it is for

Use it on the decision you have already half-made and want stress-tested - a library
choice, an architecture call, a "should we bother" question. You are not reading it for a
winner. You are reading it for the one rebuttal that lands, which is usually the
constraint you had quietly assumed away.

Two things make that work, and both are just prompt design:

- **Each persona is told to rebut the opponent's most recent point specifically**, not to
  restate its own position. That forces the argument forward instead of into two parallel
  monologues.
- **Turns are capped at roughly 2–4 sentences.** A model given room to hedge will hedge.
  A model given four sentences has to pick its best shot.

## Install

```bash
npx github:jimmyjames177414/claude-roundtable "should I use Redux or Zustand?"
```

Nothing is published to npm; the `github:` form clones the repo, builds it, and runs the
`roundtable` binary. Node ≥ 18.

You need an Anthropic API key either way. Get one at
[console.anthropic.com](https://console.anthropic.com) and export it:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Commands

```
roundtable <topic> [options]
```

| Option | Default | Description |
|---|---|---|
| `--rounds <n>` | `3` | Exchanges per persona. Each round is one turn for each side, so `--rounds 3` is six turns. |
| `--personas <a,b>` | `Proponent,Skeptic` | Two labels or stances, comma-separated. Exactly two. |
| `--judge` | off | After the last round, a `Moderator` persona reads the full transcript and renders a verdict. |
| `--model <id>` | `claude-sonnet-5` | Override the Claude model id. Rejected with a clear error if it does not look like a real Claude model id. |
| `--fast` | off | Shorthand for the cheaper `claude-haiku-4-5-20251001`. Mutually exclusive with `--model`. |

The personas are stances, not just names, and that is the main lever worth playing with:

```bash
roundtable "ship the migration on Friday" --personas "Staff engineer,On-call engineer"
roundtable "adopt Kubernetes" --personas "CTO,The person who gets paged" --judge
roundtable "this PR is ready" --personas "Author,Reviewer who has seen this before" --fast
```

## What each turn actually costs

There is no session, no agent loop and no shared memory between turns. Every turn is one
independent `messages.stream` call: the persona's stance goes in the system prompt, and the
topic plus the transcript so far goes in the user message. The transcript is plain text
that gets rebuilt and resent each time.

That makes the cost trivially predictable - **`rounds × 2` calls, plus one more with
`--judge`** - so the default `--rounds 3 --judge` is seven calls, each capped at 500
output tokens and requested at low effort. It also means the state you can see on screen
is the entire state that exists. Kill it halfway and nothing is left behind.

Output streams token by token, one colour per speaker: persona A cyan, persona B magenta,
Moderator bold green.

## What it will not do

- **It does not check facts.** Both personas argue from the model's priors. A rebuttal
  that sounds devastating can be simply wrong, and the Moderator will not catch it - it
  only reads the transcript it was handed.
- **The verdict is not a decision procedure.** The Moderator is *instructed* to be
  decisive. Instructed decisiveness is not the same thing as being right, and running the
  same topic twice can land differently.
- **It is not a multi-agent framework.** No tools, no file access, no memory, no
  retrieval. If you want the personas to read your codebase, this is the wrong tool.
- **It does not save anything.** The transcript goes to stdout and is gone. Redirect it
  yourself: `roundtable "..." --judge | tee debate.md`.
- **Two sides only.** `--personas` takes exactly two and errors otherwise.

## Example output

No Anthropic API key was available in the environment this was built in, so the image
above is a styled mock-up of the real format rather than a captured run. Text version:

<details>
<summary>Show illustrative transcript</summary>

```
$ roundtable "should I use Redux or Zustand?" --rounds 1 --judge

Proponent:
Redux's explicit action/reducer pattern gives you time-travel debugging and a single
predictable source of truth - invaluable once a team grows past a couple of engineers.

Skeptic:
That "predictability" comes at the cost of boilerplate Redux itself spent a decade trying
to shed. Zustand gives you the same single-store model in a fraction of the code, with no
action-type ceremony.

Moderator:
Skeptic's argument holds up better for the common case: most teams aren't at the scale
where Redux's tooling pays for itself. Verdict: Zustand, unless you specifically need
Redux's middleware ecosystem or time-travel debugging.
```

</details>

Run it with a real key and this section (and the image above) can be replaced with an
actual capture - PRs welcome. A [VHS](https://github.com/charmbracelet/vhs) tape is
already checked in as scaffolding: `vhs demo.tape` will record a GIF once a key is
present.

## Working on it

```bash
git clone https://github.com/jimmyjames177414/claude-roundtable.git
cd claude-roundtable
npm install
npm run build
npm test

export ANTHROPIC_API_KEY=sk-ant-...
node dist/index.js "should I use Redux or Zustand?" --judge
```

The debate loop is pure and takes an injected client, so the tests cover turn ordering,
transcript accumulation, persona and rounds parsing, and model-id validation without
touching the network. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT

---

<p align="center"><sub>by <a href="https://github.com/jimmyjames177414">@jimmyjames177414</a></sub></p>
