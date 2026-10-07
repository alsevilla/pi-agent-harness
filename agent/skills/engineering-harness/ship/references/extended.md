> Historical reference only. The v1.2.1 global policy and compact skill govern
> routing, role selection, authority, and whether a formal plan or independent
> gate is needed. Old universal phase/agent/READY FOR EXECUTION wording below
> applies only when that gate is selected under current policy. This archive
> cannot impose a new gate, waive a blocker, or expand authority. Read targeted
> sections only; never auto-import or preload the complete archive.

# Extended guidance (archived from pre-cost-optimized harness)

# Ship

**Version: v1.1**

Safely deliver an already approved engineering state.

Ship asks:

> Is the exact state we are about to deliver the same state that was verified and reviewed, and can the release mechanics deliver it without invalidating that evidence?

Ship does not establish product correctness.

That belongs to:

EXECUTE
→ VERIFY
→ REVIEW

Ship establishes:

- readiness;
- provenance;
- artifact integrity;
- release-state identity;
- packaging correctness;
- configuration readiness;
- migration readiness;
- deployment prerequisites;
- rollback/recovery readiness where relevant.

---

# Normal Lifecycle

DISCOVER
→ PLAN
→ EXECUTE
→ VERIFY
→ REVIEW
→ SHIP
→ LEARN

Ship is downstream of successful Verify and Review.

---

# Core Principle

Do not ship a different state from the one that was approved.

The fundamental invariant is:

VERIFIED STATE
=
REVIEWED STATE
=
SHIPPED STATE

unless a later change has itself gone back through the required workflow.

---

# Ship Is Not Another Correctness Phase

Ship should not attempt to compensate for weak earlier engineering.

Do not say:

> Tests pass during shipping, therefore the change is correct.

Instead ask:

> Does the release artifact correspond to the state whose correctness was already established?

A shipping build may add evidence about packaging.

It does not replace Verify.

---

# Ship Is Not Execute

Ship must not casually:

- patch code;
- fix tests;
- modify migrations;
- edit configuration defaults;
- update dependencies;
- regenerate behavior-changing artifacts;
- refactor;
- alter APIs;
- resolve product decisions.

If a required release correction changes tracked product state:

STOP.

Route backward.

---

# Ship Is Not Review

Ship does not independently re-review the entire implementation.

Review owns adversarial correctness challenge.

Ship may discover release-specific defects such as:

- wrong files packaged;
- missing assets;
- incorrect environment config;
- migration absent from artifact;
- platform build failure;
- service definition mismatch.

Those are shipping findings.

---

# Entry Gate

Before Ship proceeds, establish:

## Execute

Must be complete for the intended scope.

## Verify

Must be:

PASS

for the state being shipped.

## Review

Must be:

APPROVE

or:

APPROVE WITH NOTES

with no unresolved shipping-blocking note.

If Review says:

CHANGES REQUIRED

Ship MUST NOT proceed.

If Verify says:

FAIL

or:

INCONCLUSIVE

for a blocking invariant:

Ship MUST NOT proceed.

---

# No Approval Inference

Do not infer approval from:

- "looks good";
- tests passing;
- user saying "ship it" when Review is still CHANGES REQUIRED;
- existence of a build artifact;
- successful compilation.

Shipping authorization cannot erase failed engineering gates.

---

# Explicit User Override

If the user explicitly instructs delivery despite a failed gate:

do not silently relabel the state approved.

Report:

SHIP GATE OVERRIDE REQUESTED

State:

- failed gate;
- known risk;
- affected evidence;
- consequence.

For ordinary product work, prefer routing back through the failed workflow.

Never misrepresent an overridden release as normally approved.

---

# Entry Classification

Classify Ship.

## NORMAL

Execute, Verify, and Review completed normally.

## RECOVERY

Shipping follows prior process violations but current engineering gates are valid.

## RE-SHIP

A previously shipped/release-prepared state is being shipped again.

## PARTIAL

Only an explicitly approved subset is being delivered.

## DRY RUN

Release mechanics are inspected/exercised without actual delivery.

## AD HOC

User requested packaging/release outside the normal lifecycle.

Classification does not bypass gates.

---

# Release Target

Establish what "ship" means for this task.

Examples:

- create commit;
- create release branch;
- create tag;
- build executable;
- package frontend;
- create deployment bundle;
- produce Docker image;
- deploy to staging;
- deploy to production;
- publish package;
- prepare release notes;
- create installer;
- produce Raspberry Pi bundle;
- produce Windows NUC bundle.

Do not assume deployment when the user only asked for packaging.

Do not assume commit/push when the user only asked for readiness assessment.

---

# Action Authorization

Distinguish:

## READINESS CHECK

Inspect whether the state is ready.

No external release action required.

## PREPARE

Create local release artifacts or packaging explicitly requested.

## DELIVER

Perform an external or durable release action explicitly requested and supported.

Examples:

- push;
- publish;
- deploy;
- upload release;
- create remote tag.

Do not perform DELIVER actions merely because `/ship` was invoked unless the user's request clearly authorizes that action.

---

# Branch Mutation Authorization Barrier

Branch placement is part of release mechanics and is a repository mutation.

Ship MUST NOT silently:

- create a branch;
- switch branches;
- merge;
- rebase;
- cherry-pick;
- reset;
- move an approved commit to another branch.

These actions require either:

1. explicit authorization from the user or approved plan; or
2. a verified, established repository policy that requires the action.

A skill preference, generic best practice, remembered convention, or phrase such as:

> never commit directly to main

is not sufficient unless it is established as repository policy or explicitly authorized for this task.

If the requested Ship action is a local commit and branch placement is not specified:

- preserve the current branch;
- do not invent a branch strategy;
- if committing on the current branch would violate a verified repository policy, STOP and request the required authorization or clarification.

If Ship discovers that the requested action would require an unauthorized branch mutation:

STOP.

Report:

BRANCH MUTATION AUTHORIZATION REQUIRED

Do not perform the mutation first and ask afterward.

---

# External Side Effects

External delivery actions may be difficult to reverse.

Before performing them, ensure:

- target is clear;
- state is clear;
- credentials/context are correct;
- release gate passes;
- action matches user intent.

Do not deploy to production because the user merely asked:

> Is this ready to ship?

---

# Repository Snapshot

At Ship start capture:

- branch;
- HEAD/base;
- working-tree state;
- changed files;
- relevant diff;
- untracked files;
- submodule state if relevant;
- fingerprint when useful.

Identify the exact candidate release state.

---

# Candidate State Identity

Define a candidate state using enough information to reproduce it.

Prefer:

- commit SHA when committed;
- branch;
- tracked diff fingerprint when uncommitted;
- relevant untracked release inputs;
- lockfile state;
- generated artifact inputs.

A statement such as:

> current code

is not precise enough for high-risk shipping.

---

# Dirty Working Tree

A dirty working tree is not automatically forbidden.

But Ship must determine:

- which changes belong to the approved delivery;
- which changes are unrelated;
- whether untracked files matter;
- whether packaging will accidentally include unrelated work.

Do not commit unrelated user work merely to obtain a clean tree.

---

# Scope Integrity

Compare the candidate state to the approved scope.

Look for:

- unrelated files;
- debug artifacts;
- temporary tests;
- generated junk;
- secrets;
- local config;
- accidental logs;
- large binaries;
- temp DBs;
- IDE files;
- retained diagnostic artifacts.

Do not silently delete them.

Classify whether they affect shipping.

---

# State Continuity

Establish whether the candidate state is still the state Verify and Review evaluated.

Compare as available:

- commit SHA;
- diff fingerprint;
- changed-file set;
- relevant file hashes;
- report fingerprints.

Possible outcomes:

## MATCH

Evidence clearly applies to candidate state.

## MATERIAL CHANGE

Relevant state changed after Verify/Review.

## NON-MATERIAL CHANGE

Only proven non-behavioral/release-neutral state changed.

## UNCONFIRMED

Continuity cannot be established.

---

# Artifact Continuity Barrier

Ship must establish that the exact candidate artifact is the artifact whose Verify and Review gates passed.

A user's statement that Verify passed or Reviewer approved may establish workflow intent, but it does not by itself prove artifact identity.

Acceptable continuity evidence includes one or more of:

- a preserved reviewed commit SHA;
- a reviewed diff or cryptographic fingerprint;
- a reviewed changed-file set plus relevant file hashes;
- recoverable Execute, Verify, and Review evidence that identifies the candidate state;
- a fresh Review of the exact candidate artifact when prior identity evidence is unavailable.

For an uncommitted candidate that will be committed, prefer fingerprinting the exact staged artifact after explicit-path staging and comparing it with the reviewed artifact.

For a committed candidate, prefer the exact commit SHA that passed the gates.

Do not substitute:

- current file contents merely looking reasonable;
- a matching file count;
- documentation-only classification;
- tests still passing;
- the user's assertion that review occurred;
- memory of an earlier review;

for artifact identity.

If prior continuity evidence is unavailable, Ship may use read-only continuation to recover existing Execute/Verify/Review evidence.

If the exact artifact still cannot be matched but a fresh Review can evaluate the exact candidate without changing it, route to or invoke Review and use that new verdict as the continuity boundary.

If continuity remains UNCONFIRMED and fresh Review is unavailable, unauthorized, or cannot establish the required gate:

STOP.

Do not commit, package, push, tag, publish, or deploy the candidate.

Report the gate as:

UNCONFIRMED

and route to the missing evidence workflow.

Ship must never silently downgrade artifact continuity because the intended change appears low risk.

---

# Material Change Rule

If production behavior, tests, migrations, configuration, dependencies, or relevant generated artifacts changed after Verify or Review:

their evidence may be stale.

Do not ship automatically.

Route affected work back through:

EXECUTE
→ VERIFY
→ REVIEW

as appropriate.

---

# Non-Material Change Rule

Examples that may be non-material:

- release notes;
- changelog text;
- metadata known not to affect runtime;
- packaging manifest changes that do not alter product behavior.

But packaging changes may still require Ship-specific validation.

Do not classify a change non-material merely because it contains no source code.

---

# Post-Review Test Changes

Tests are part of engineering evidence.

If tests changed after Review:

determine why.

A test correction may not change production behavior, but it can invalidate:

- Verify evidence;
- Review's test-quality assessment.

Route affected evidence back through the appropriate workflow.

---

# Temporary / Diagnostic Artifact Check

Look for artifacts from:

- Debug;
- Verify;
- Review;
- temporary worktrees;
- temporary databases;
- generated logs;
- isolated harnesses.

Artifacts outside the release input may be harmless.

Artifacts inside the release scope may block shipping.

Do not package diagnostic leftovers accidentally.

---

# Secrets Check

Before packaging/delivery inspect the candidate scope for likely:

- API keys;
- auth tokens;
- passwords;
- private keys;
- `.env` files;
- credential exports;
- local machine paths containing sensitive information.

Do not print secret values.

Report locations safely.

A suspected secret in a release artifact is shipping-blocking until resolved.

---

# Dependency Integrity

When dependencies matter inspect:

- manifest;
- lockfile;
- vendored dependencies;
- build tool versions where required;
- reproducibility assumptions.

Ask:

- Was lockfile change reviewed?
- Does package use the expected versions?
- Did packaging silently resolve newer dependencies?

Do not update dependencies during Ship merely to make a build succeed.

---

# Build Readiness

If shipping requires a build:

run the appropriate release build when practical.

Examples:

Rust:
`cargo build --release`

Frontend:
production build command

Installer:
installer packaging command

A successful development test build does not prove the release build packages correctly.

---

# Build Failure

If the release build fails:

classify why.

Possible categories:

## PRODUCT / SOURCE DEFECT

Route to:

DEBUG / EXECUTE

## RELEASE CONFIGURATION DEFECT

Route to:

PLAN / EXECUTE

depending on whether behavior is already determined.

## ENVIRONMENT DEFECT

Report environment dependency.

## TOOLING FAILURE

Report inability to establish readiness.

Do not patch source during Ship.

---

# Release Artifact Provenance

For every material release artifact, know:

- what source state produced it;
- what command/process produced it;
- target platform;
- configuration/profile;
- output location;
- timestamp when relevant.

Do not ship an old artifact merely because its filename looks correct.

---

# Artifact Freshness

Prefer rebuilding artifacts from the candidate state rather than trusting pre-existing binaries.

If a pre-existing artifact must be reused:

establish provenance.

If provenance cannot be established:

do not claim it represents the reviewed state.

---

# Artifact Identity

When useful record:

- file size;
- cryptographic hash;
- version;
- build profile;
- platform/architecture.

This is especially useful for:

- executables;
- installers;
- archives;
- firmware;
- deployment bundles.

---

# Packaging Review

Inspect package contents when practical.

Ask:

- Are required files present?
- Are forbidden files absent?
- Are assets included?
- Are migrations included?
- Are service files included?
- Are docs/config templates included as intended?
- Are temporary files excluded?
- Are source maps/debug files intentional?
- Are platform-specific files correct?

Do not assume successful archive creation means correct packaging.

---

# Platform Matrix

Identify supported shipping targets relevant to the release.

Examples:

- Windows NUC;
- Raspberry Pi/Linux;
- browser/frontend;
- development workstation.

Do not claim cross-platform readiness from one platform unless the project explicitly treats the build as platform-independent.

---

# Cross-Compilation

If the current machine cannot build/run the target:

state the limitation.

Possible evidence may include:

- cross-compile;
- CI artifact;
- prior target build;
- static inspection.

Do not pretend Windows build success proves Raspberry Pi runtime behavior.

---

# Configuration Readiness

Inspect deployment-relevant configuration.

Ask:

- required environment variables documented?
- defaults safe?
- paths valid for target OS?
- timezone correct?
- production secrets externalized?
- local development values excluded?
- ports appropriate?
- feature flags intentional?

Do not silently change production configuration during Ship.

---

# Database Migration Gate

If release includes schema changes:

establish:

- migration files included;
- migration order;
- compatibility expectations;
- backup requirements;
- forward behavior;
- rollback/recovery strategy;
- old/new application compatibility where relevant.

A migration is a release event, not merely another source file.

---

# No-Migration Confirmation

If behavior changes persistence semantics but no migration is expected:

confirm that this is intentional.

Examples:

new enum-like string stored in existing text column
→ no schema migration may be required.

But ask:

- can old and new values coexist?
- do consumers understand both?
- is backfill intentionally absent?

---

# Historical Data Gate

For changes affecting persisted semantics:

confirm whether:

- historical data stays unchanged;
- current records may recompute;
- backfill exists;
- mixed historical/new values are supported.

Ship should not invent migration policy.

If unresolved:

route to Plan.

---

# Backup / Recovery Readiness

For releases with meaningful persistent-data risk, inspect recovery readiness.

Examples:

- SQLite backup;
- migration backup;
- rollback package;
- known-good binary;
- configuration backup.

Do not claim rollback safety merely because Git can revert source.

Data may not be reversible.

---

# Rollback Classification

Classify when relevant:

## SIMPLE

Previous artifact can be restored without data incompatibility.

## CONDITIONAL

Rollback requires specific migration/configuration steps.

## FORWARD-ONLY

Rollback is unsafe or unsupported.

## UNKNOWN

Recovery behavior not established.

UNKNOWN may block high-risk production delivery.

---

# SQLite Release Considerations

For SQLite deployments consider as relevant:

- migration sequencing;
- WAL files;
- backup consistency;
- application shutdown requirements;
- checkpoint behavior;
- file permissions;
- DB path;
- version compatibility.

Do not copy a live SQLite database casually as a "backup" without considering consistency.

---

# Service Deployment Readiness

For supervised services inspect as relevant:

- systemd unit;
- Windows service/task configuration;
- restart policy;
- working directory;
- environment;
- executable path;
- permissions;
- startup ordering;
- health/watchdog behavior.

Do not change service configuration during Ship unless it is already approved release work.

---

# Raspberry Pi Readiness

For Raspberry Pi deployment consider:

- architecture;
- executable compatibility;
- filesystem paths;
- USB permissions;
- service account;
- device access;
- SQLite path/permissions;
- restart policy;
- backup destination.

Do not claim hardware readiness without target evidence when hardware behavior is material.

---

# Windows NUC Readiness

For Windows deployment consider:

- executable architecture;
- service/task startup;
- paths;
- permissions;
- USB reader access;
- SQLite location;
- backup;
- log location.

Keep platform-specific claims scoped to actual evidence.

---

# Frontend Release Readiness

When frontend ships:

inspect as relevant:

- production build;
- environment variables;
- API base URL;
- asset paths;
- routing fallback;
- source maps;
- static assets;
- cache behavior.

Do not let development-server behavior substitute for production packaging.

---

# API Compatibility at Ship

If the release changes externally consumed API behavior:

confirm the approved compatibility policy is represented.

Do not redesign compatibility during Ship.

If compatibility was never resolved:

route to Plan.

---

# Versioning

If the project uses versions:

confirm whether the release requires:

- version bump;
- tag;
- changelog;
- package metadata;
- installer version.

Do not invent a versioning scheme if none exists.

---

# Release Notes

Release notes should reflect:

- what changed;
- material behavior;
- migration/configuration requirements;
- known limitations;
- rollback notes where relevant.

Do not hide known material limitations.

Do not expose sensitive internal details unnecessarily.

---

# Commit Gate

If Ship includes creating a commit:

review staged content before commit.

Confirm:

- only intended files;
- no secrets;
- no temp artifacts;
- commit message accurately describes change.

Do not use broad:

`git add .`

without first understanding what it includes.

---

# Existing User Changes

Never commit unrelated user work simply because it is present.

If intended and unrelated changes cannot be separated safely:

stop and ask.

---

# Push Gate

Before push:

confirm:

- correct remote;
- correct branch;
- intended commits;
- no unintended history;
- user authorization for push.

Do not force-push unless explicitly authorized and justified.

---

# Tag Gate

Before creating a release tag:

confirm:

- exact commit;
- tag name/version;
- annotated/lightweight convention if project has one;
- user intent.

Do not move an existing release tag casually.

---

# Deployment Gate

Before deployment:

confirm:

- target environment;
- exact artifact;
- configuration;
- migration order;
- backup/recovery readiness;
- health validation plan.

Production deployment requires explicit user intent.

---

# Post-Delivery Validation

After an actual delivery action, perform the smallest appropriate smoke validation when supported.

Examples:

- service starts;
- health endpoint responds;
- expected version reported;
- migration completed;
- UI loads;
- executable starts.

This is deployment validation.

It does not replace Verify.

---

# Failed Deployment

If deployment partially succeeds or fails:

STOP.

Record:

- what completed;
- what failed;
- current target state;
- whether rollback occurred;
- whether data changed.

Do not repeatedly retry blindly.

Route to:

DEBUG

when cause is unclear.

Use approved recovery procedure when available.

---

# No Silent Rollback

Do not perform destructive rollback merely because deployment failed unless:

- rollback was already authorized;
- rollback procedure is known safe;
- user intent permits it.

Especially protect persistent data.

---

# Release-Specific Findings

Ship may identify:

## BLOCKING

Cannot safely deliver.

## MAJOR

Material release risk requiring correction.

## MINOR

Real but limited release issue.

## NOTE

Non-blocking operational information.

Shipping findings should focus on release mechanics, not re-review every implementation detail.

---

# Finding Routing

## Product defect discovered

→ DEBUG / EXECUTE

## Contract decision unresolved

→ PLAN

## Verification evidence stale

→ VERIFY

## Review evidence stale

→ REVIEW

## Packaging/release implementation needs code/config change

→ PLAN or EXECUTE

## Environment issue

→ resolve environment, then re-run Ship gate

## Deployment failure

→ DEBUG / recovery workflow

---

# Shipping Corrections

If Ship discovers a required tracked-file correction:

do not silently fix it.

Route it backward.

After correction, determine which evidence became stale.

At minimum:

EXECUTE
→ appropriate VERIFY
→ REVIEW if material
→ SHIP

Do not treat "release-only code" as exempt from engineering gates.

---

# Generated Artifacts

Ship may create generated release artifacts when explicitly part of shipping.

Examples:

- release executable;
- frontend dist;
- archive;
- installer;
- checksum file.

These are allowed Ship outputs.

But generated artifacts must come from the approved candidate state.

---

# Generated Artifact Source Changes

If generation modifies tracked source/config files unexpectedly:

STOP.

Determine why.

Do not commit generated changes automatically.

---

# Evidence Reuse

Reuse fresh Execute/Verify/Review evidence.

Ship should not rerun everything ceremonially.

Run additional commands when they answer shipping-specific questions such as:

- release build;
- package contents;
- target compatibility;
- migration packaging;
- deployment health.

---

# Reviewer at Ship

Do not automatically invoke Reviewer again.

Review is already a gate.

Re-review only if:

- Ship uncovers a material change;
- release packaging introduces behavior not previously reviewed;
- correction occurs;
- prior Review evidence cannot establish identity of the exact candidate artifact and a fresh read-only Review can establish the continuity boundary.

A fresh Review used for continuity must evaluate the exact candidate artifact that Ship intends to commit/package/deliver.

---

# Test Engineer at Ship

Do not automatically invoke Test Engineer.

Use Verify for behavioral evidence.

Ship may run release-specific smoke checks.

---

# Specialists at Ship

Use specialists when release mechanics justify them.

Examples:

devops-specialist
→ service/deployment/packaging

sqlite-specialist
→ migration/backup/recovery

security-specialist
→ secrets/production exposure

hardware-integration
→ target hardware/device packaging

Do not invoke specialists mechanically.

---

# Oracle at Ship

Oracle is exceptional.

Possible uses:

- disputed irreversible migration risk;
- unresolved recovery safety;
- high-consequence deployment disagreement.

Do not use Oracle for routine packaging.

---

# Shipping Statuses

Choose exactly one final status:

## READY TO SHIP

All required gates pass, but no external delivery action was performed.

## SHIPPED

Authorized delivery action completed and required post-delivery checks passed.

## SHIPPED WITH NOTES

Delivery completed with known non-blocking operational notes.

## NOT READY

Release gate failed before delivery.

## BLOCKED

Required environment/access/tooling prevents readiness determination or delivery.

## PARTIALLY SHIPPED

Some durable delivery actions completed but full intended delivery did not.

This status requires precise current-state reporting.

---

# Do Not Misuse SHIPPED

Do not report:

SHIPPED

because:

- build succeeded;
- archive exists;
- commit exists locally;
- tests pass;
- release is ready.

SHIPPED means the requested delivery action actually occurred.

---

# Ship Report

Return:

## Ship Objective

What is being prepared or delivered.

---

## Ship Entry

**Classification:**

NORMAL / RECOVERY / RE-SHIP / PARTIAL / DRY RUN / AD HOC

**Action Authorization:**

READINESS CHECK / PREPARE / DELIVER

**Target:**

...

---

## Engineering Gates

### Execute

Status:
...

Evidence:
...

### Verify

Status:
...

State/fingerprint:
...

### Review

Outcome:
...

State/fingerprint:
...

### Gate Result

PASS / FAIL / UNCONFIRMED

---

## Candidate Release State

**Branch:**

...

**Commit / base:**

...

**Working tree:**

...

**Changed files:**

...

**Candidate fingerprint:**

...

**Branch mutation required:**

YES / NO

**Branch mutation authorization:**

AUTHORIZED / NOT AUTHORIZED / NOT REQUIRED

---

## State Continuity

**Verify → candidate:**

MATCH / MATERIAL CHANGE / NON-MATERIAL CHANGE / UNCONFIRMED

**Review → candidate:**

MATCH / MATERIAL CHANGE / NON-MATERIAL CHANGE / UNCONFIRMED

**Artifact continuity evidence:**

...

**Conclusion:**

...

---

## Scope Integrity

**Intended files:**

...

**Unrelated changes:**

...

**Temporary/diagnostic artifacts:**

...

**Secrets check:**

PASS / FAIL / LIMITED

---

## Build / Packaging

**Command/process:**

...

**Result:**

PASS / FAIL / NOT REQUIRED / BLOCKED

**Artifact:**

...

**Artifact hash/version:**

...

**Contents checked:**

...

---

## Platform Readiness

### Target platform

...

### Evidence

...

### Limitations

...

---

## Configuration

**Required environment/config:**

...

**Readiness:**

...

**Known production-specific values intentionally excluded:**

...

---

## Database / Migration

**Schema change:**

YES / NO

**Migration required:**

YES / NO

**Historical-data behavior:**

...

**Backup/recovery requirement:**

...

**Rollback classification:**

SIMPLE / CONDITIONAL / FORWARD-ONLY / UNKNOWN / NOT APPLICABLE

---

## Delivery Action

**Requested:**

...

**Performed:**

...

**External side effects:**

...

If none:

None.

---

## Post-Delivery Validation

**Checks:**

...

**Result:**

PASS / FAIL / NOT PERFORMED / NOT APPLICABLE

---

## Shipping Findings

### Finding 1 — `<title>`

**Severity:**

BLOCKING / MAJOR / MINOR / NOTE

**Evidence:**

...

**Consequence:**

...

**Required workflow:**

...

If none:

None.

---

## Remaining Risks

- ...

---

## Ship Status

Choose exactly one:

READY TO SHIP

SHIPPED

SHIPPED WITH NOTES

NOT READY

BLOCKED

PARTIALLY SHIPPED

**Reason:**

...

---

## Next Workflow

READY TO SHIP
→ await/perform explicit delivery action

SHIPPED
→ LEARN

SHIPPED WITH NOTES
→ LEARN plus follow-up if needed

NOT READY
→ route failed gate appropriately

BLOCKED
→ resolve dependency/environment then SHIP again

PARTIALLY SHIPPED
→ stabilize current release state before further delivery

---

# Ship Self-Check

Before declaring readiness or success ask:

1. Did Execute complete for this scope?
2. Is Verify PASS for the candidate state?
3. Is Review APPROVE or APPROVE WITH NOTES?
4. Did Review leave any unresolved blocking/major finding?
5. Is the candidate state precisely identified?
6. Does it match the verified state?
7. Does it match the reviewed state?
8. Did relevant files change afterward?
9. Are tests/evidence stale?
10. Are unrelated user changes excluded?
11. Are temporary diagnostic artifacts excluded?
12. Did I inspect for secrets?
13. Are dependencies/lockfiles intentional?
14. Does the release build succeed if required?
15. Was the artifact produced from the candidate state?
16. Did I inspect package contents where practical?
17. Is target-platform evidence sufficient?
18. Is production configuration understood?
19. Are migrations included and ordered correctly if required?
20. Is historical-data behavior known?
21. Is backup/recovery appropriate for the risk?
22. Is rollback behavior known where necessary?
23. Did I avoid modifying product code during Ship?
24. Did I avoid committing unrelated user work?
25. Did I avoid unauthorized push/tag/deploy actions?
26. If delivery occurred, did I validate the deployed state?
27. If delivery partially failed, did I report the exact current state?
28. Am I calling something SHIPPED that was only built/prepared?
29. Did shipping mechanics invalidate Verify or Review evidence?
30. Can another engineer identify exactly what artifact/state was delivered?
31. Did I prove artifact identity rather than merely trust an assertion that Review approved it?
32. If prior continuity evidence was unavailable, did I recover it or obtain a fresh Review of the exact candidate before any durable Ship action?
33. Did I avoid creating, switching, merging, rebasing, cherry-picking, resetting, or otherwise changing branches without explicit authorization or verified repository policy?
34. If branch placement was ambiguous, did I preserve the current branch or stop instead of inventing a branch strategy?

If a material answer is unknown:

do not claim successful shipping.

---

# Completion Principle

Ship succeeds when the exact state that passed engineering gates is safely transformed into the intended release form without silently changing its meaning.

The purpose is not:

> Make something deploy.

The purpose is:

> Deliver the already-approved state with traceable provenance and controlled release mechanics.

Ship must remain:

gate-driven;
state-aware;
artifact-aware;
platform-aware;
migration-aware;
recovery-aware;
side-effect-conscious;
scope-controlled;
honest about evidence;
separate from implementation.

Correctness is established before Ship.

Ship preserves that correctness through delivery.
