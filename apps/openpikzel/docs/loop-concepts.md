# Three directions considered for the review cycle

These are implementation concepts, not three tested alternative products. The exact LOOP v2 artifact schema was unavailable when this was recorded.

1. **Review studio.** Keep the current thumbnail central, put analysis next to it when space allows, and retain a nearby editing source on mobile. This is the selected direction because it matches Derrick's earlier choice and directly addresses observed source-loss and cramped-review defects. Complexity: moderate. Existing tests and provider contracts remain applicable.
2. **Guided first thumbnail.** A short sequence asks for an idea, optional person/style, then the required provider connection, with a persistent progress summary. Benefit hypothesis: fewer ambiguous choices for newcomers. Cost: adds navigation and state transitions, and risks slowing experienced users. Not implemented or user-tested.
3. **Conversation-first workbench.** A timeline of briefs, results, analysis and revision actions keeps the composer docked to the current artifact. Benefit hypothesis: stronger provenance and agent parity. Cost: substantial layout and keyboard changes; risks burying image inspection and duplicating existing chat state. Not implemented or user-tested.

The current pass chooses the review studio and borrows clearer setup actions. It does not add speculative density toggles, custom fields or a command palette merely to match a hypothetical evaluator description.
