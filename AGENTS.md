## ## Workflow and Deliverables

Work on one change at a time. Reuse existing OpenSpec artifacts.

Before implementation, state the selected level and justify it in

one sentence.

### Lite

Use for local changes with clear expected behavior and an existing

implementation pattern. No new contracts, persistence behavior,

authorization rules, or financial policies.

Examples: correcting text, adjusting a table layout, or fixing an

existing UI interaction.

Execution: use Gentle AI's supported direct route when appropriate. Define acceptance criteria, implement, and verify. Do not start a formal SDD change solely for a small, understood task. If the task belongs to an active SDD change, preserve its lifecycle.

### Standard

Use when adding bounded behavior within the existing architecture and

accepted contracts, with no unresolved critical decisions.

Examples: a vehicle-class screen connected to existing endpoints, or

a fare form implementing approved pricing rules.



Execution: use existing contracts and perform only the exploration

needed for this feature. If using SDD, follow the installed workflow's

required phases and prerequisites. Keep required artifacts concise;

do not omit them based on this classification.

Default flow: `focused explore -> short spec -> apply -> verify`.

### Full

Use when defining or changing architecture, financial contracts,

authorization, integrations with external effects, migrations, or data

integrity and concurrency guarantees.

Examples: defining refund behavior, changing fare calculation semantics,

guaranteeing payment idempotency, or redesigning zone persistence.

Logical flow:

Execution: use SDD to resolve the identified uncertainty through the

installed workflow's supported phases. Apply the model escalation

policy where required. Complete functional verification and the

applicable review before declaring delivery ready.



Limit research and design to the unresolved decisions.

Review does not replace executable verification.

Apply the project's model escalation policy when its triggers are met.

### Selection and Gentle AI Compatibility

- Select depth by risk and uncertainty, not line count.

- Mentioning prices or payments does not automatically require Full.

  Implementing an accepted contract may be Standard.

- Lite, Standard, and Full are project planning labels, not assumed

  native Gentle AI modes.

- Use the installed Gentle AI version's supported direct or SDD route.

- For an active SDD change, preserve native prerequisites, artifacts,

  and valid transitions. These logical flows do not authorize skipping

  required phases or fabricating completion state.

- If new uncertainty requires a deeper process, record why and resolve

  it before continuing the affected work.

- Reuse current evidence and accepted decisions. Repeat investigation

  only when relevant changes or new evidence invalidate them.

- A logical stage does not automatically require another document,

  agent, or session. Respect native requirements where applicable.

### Context and Continuity

- Search and locate relevant code before reading entire files.

- Load only project rules, relevant contracts, the current change,

  and files needed for the task.

- Preserve decisions, verification results, blockers, and one concrete

  next action in the existing change record.

- For direct work without an OpenSpec change, use a concise handoff

  when continuation is needed; do not invent an SDD lifecycle.

- Store conclusions and references, not conversation transcripts or

  complete tool logs.

### Usable MVP Deliverables

For operational MVP features, first define the action the user will

perform in Medusa Admin and how its outcome will be verified.

Implement the necessary end-to-end path:

UI → endpoint → persistence → visible result.

Reuse working components. Do not expand scope to additional features.

A feature is complete when:

- It can be opened and used in Medusa Admin.

- It uses real application data.

- Writes persist after reloading, where applicable.

- Read-only views reflect persisted data.

- Relevant loading, empty, and error states are handled.

- Required checks pass.

- The Admin route and concrete manual test steps are provided.

For purely visual or documentation changes, verify their own acceptance

criteria without requiring unrelated backend changes.

If runtime verification was unavailable, report:

"Implemented; runtime verification pending."

### Required completion report

End every development session with:

- `Implemented`: repository behavior that changed and works, plus the principal entry point or where to open/use it when applicable.
- `Verified`: exact executable checks and results, plus how to reproduce or test the delivered behavior when applicable.
- `Remaining`: concrete unfinished work or `None`.
- `Escalations`: unresolved decisions or `None`.

This is the only completion-report format. Do not output a second overlapping checklist.

Do not declare work complete solely because code was written.

## Model Escalation

Follow `.opencode/escalation-policy.md` for escalation triggers,
worker blocker reporting, specialist consultations, and resumption.

OpenCode loads this policy through the project's `instructions` setting.
If it is not present in your context, read it before handling escalation.

Apply only the rules for your assigned role:
- Workers report blockers to the parent.
- The parent orchestrator invokes specialists and resumes the work.
- Consultants never delegate or modify files.

Preserve Gentle AI's native workflow, authorization, and output contracts.

### Escalate to sol-specialist

Consult Sol:

- Before implementing new contracts involving money, authorization,

  migrations, data integrity, or concurrency guarantees.

- Before closing executable changes that affect those guarantees.

- After two distinct, unsuccessful fixes for the same defect. Include

  the hypotheses, attempted fixes, and observed errors.

An administrative screen that only consumes an existing contract does

not require escalation merely because it displays prices or payments.

Do not escalate missing credentials, unavailable services, or environment

failures as reasoning problems. Report the actual blocker.

### Escalate to astra-architect

Consult Astra:

- Before adopting new architecture spanning multiple domains.

- When incompatible contracts require architectural redesign.

- When Sol identifies a specific unresolved architectural decision.

Do not request general audits or repeat an existing architectural

decision without new evidence.

### Delegation Boundaries

Only the parent orchestrator may invoke specialists.

SDD agents must return escalation requests to the parent with:

- The escalation trigger.

- A concrete question.

- Supporting evidence.

- Relevant artifact and file paths.

- Work completed and the exact continuation point.

SDD agents must not invoke specialists from inside another delegation.

Consultants must never invoke, spawn, delegate to, or coordinate other

agents through any tool, command, MCP service, or external mechanism.

If another specialist is needed, they must return that need to the parent.

If Sol recommends Astra, the parent invokes Astra separately.

Sol must never invoke Astra directly, or vice versa.

### Consultation Input

Provide only:

- One concrete question and the expected outcome.

- Relevant spec, design, code, and test references.

- A concise summary of relevant decisions.

- Failed attempts and observed errors, when applicable.

Do not forward the full conversation, repository, historical reports,

or unrelated tool output.

The requested response should contain:

- Decision or diagnosis.

- Evidence and relevant file references.

- Required changes.

- Required verification.

- Unresolved questions, if any.

### Resume the Existing Workflow

After a consultation:

- Record the decision in the appropriate existing OpenSpec artifact.

- Resume the pending phase through its original SDD agent.

- Update affected specs, designs, and tasks if a contract changes.

- Apply corrections and verify the affected behavior.

- Request another consultation only when findings remain unresolved

  or new evidence materially changes the decision.

Consultants provide advice and review findings. Their response is not

proof that tests passed or that a native workflow gate was satisfied.

Keep one implementation writer active at a time.

### Completion and Availability

Do not declare critical work complete while a required consultation

or blocking finding remains unresolved.

If a required specialist is unavailable:

- Record the blocked portion and reason.

- Continue only independent work.

- Do not silently substitute another model.

- Do not claim that the required review occurred.

When business policy is missing, ask the user for the specific decision.

No model may invent that policy.

### Workflow Compatibility

Lite, Standard, and Full are project planning labels, not assumed native

Gentle AI modes.

Use Gentle AI's supported direct route for suitable small changes.

For active SDD changes, follow the installed version's valid transitions.

Do not bypass required phases or fabricate lifecycle state.