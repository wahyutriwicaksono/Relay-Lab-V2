# Changelog

## V2.2.0-rebuild

### V1 parity restored
- Restored selected channel + fine adjustment.
- Restored explicit channel link/disconnect behavior.
- Restored proper OUTPUT OFF isolation between command and injected quantity.
- Restored F1/F2/F3/F4 faceplate controls.
- Restored CT/VT basis, progress, presets, session notes and CSV report.
- Restored Principles, ANSI and Equipment sections alongside the newer V2 library/evidence views.

### Architecture corrections
- Added canonical tester model with commanded vs injected quantities.
- Added deterministic 1 ms virtual simulation substeps.
- Separated pickup / operate / scheme / BO / BI / 86 / coil / 52 / current-zero timestamps.
- Rebased breaker-failure timer on BF initiation.
- Removed premature closed-loop current-zero behavior.
- Made open-loop current-zero an unsupported automatic endpoint.
- Made 25 a permissive path rather than a protection-trip path.
- Added distinct Element Reset, 86 Reset and breaker close controls.
- Added explicit capability gating and evidence hashes.

### Generic protection coverage
- 50 / 51 with parallel 50 stage
- 50N / 51N
- 67 generic directional model
- 27 / 59 / 59N
- 81U / 81O
- 46
- 24
- 25
- 32R
- 63
- generic compensated-input 87T
- 86 / 50BF trip-chain behavior

### Validation
- Added `tests/core-smoke.mjs`.
- Current package result: 52/52 core tests PASS.
