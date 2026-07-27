# Motion Improvement Plans

This directory contains precise design-engineering implementation plans to improve the feel, performance, and cohesion of motion throughout the CorreTop workspace, following the guidelines in [MACRO-MICRO_ANIMATIONS.md](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/MACRO-MICRO_ANIMATIONS.md).

## Available Plans

| Number | Title | Severity | Status | File |
| :--- | :--- | :--- | :--- | :--- |
| **001** | Fix High-Frequency Dashboard Header Jitter | HIGH | DONE | [001-fix-dashboard-header-jitter.md](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/plans/001-fix-dashboard-header-jitter.md) |
| **002** | Fix Row Hover Animation Overlap and Jarring Badge Scale | HIGH | DONE | [002-fix-row-hover-transitions.md](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/plans/002-fix-row-hover-transitions.md) |

## Recommended Execution Order

1. **Plan 001** (Dashboard Header Jitter) — Immediate feel improvement, very low complexity.
2. **Plan 002** (Row Hover Animations) — Performance improvement, zero chance of regressions.

## Dependencies

- There are no dependencies between Plan 001 and Plan 002. They can be executed independently or in parallel.
