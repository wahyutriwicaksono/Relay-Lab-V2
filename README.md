# Relay Lab V2 — Protection Engineering Workbench

Relay Lab V2 is a static, vendor-neutral protection relay and secondary-injection simulator. This rebuild treats the original V1 website as a **behavioral baseline** and the research mapping as the **engineering contract**.

## Design rule

**Preserve → Verify → Correct → Extend → Integrate**

V1 is not overwritten. V2 keeps V1 workbench behaviors while separating the simulation into:

1. asset / topology context,
2. instrument channels and measurement,
3. protection elements,
4. qualification / blocking,
5. scheme logic and trip matrix,
6. relay output / DC / actuator,
7. test generator,
8. observation / verdict,
9. vendor and tester profiles,
10. evidence / reproducibility.

## Current executable generic functions

- 50, 51, including a parallel 50 stage inside a 51 test
- 50N, 51N using calculated residual current
- 67 generic directional-overcurrent training model
- 27, 59, 59N
- 81U, 81O
- 46 negative-sequence current
- 24 V/Hz
- 25 generic synchronism-check permissive
- 32R generic reverse power
- 63 binary / mechanical contact logic
- 87T generic biased differential using already-compensated two-side current inputs
- scheme functions 86 and 50BF through the executable trip path

Functions such as 21, 49, 40, 48/51LR and 66 remain visibly **MAPPED / NOT EXECUTABLE** until their required state/algorithm engines are implemented.

## Important modeling rules

- Commanded setpoint and injected/measured quantities are separate.
- OUTPUT OFF means relay input is zero even if setpoints remain configured.
- A disconnected channel produces zero injected quantity without deleting its setpoint.
- Open-loop breaker opening does not remove test-set current.
- Closed-loop current changes only when current-extinction is reached by the system model.
- Pickup, operate, trip-matrix, BO, BI, 86, trip coil, 52 and current-zero are separate events.
- 50BF timing starts from BF initiation, not from element operate.
- 25 is a permissive/control path, not a protection-trip element.
- Reference vendor profiles do not claim proprietary firmware equivalence.
- Hardware mode refuses physical feasibility when the exact tester profile is not validated.

## V1 behaviors restored

- 6I / 6V injection console
- per-channel magnitude and angle
- selected channel and fine adjustment (0.01 / 0.1 / 1)
- link / disconnect per channel
- frequency
- Current / Voltage / Binary I/O tabs
- Output ON/OFF with real isolation behavior
- phasor / waveform / curve views
- relay faceplate and F1/F2/F3/F4 controls
- element reset distinct from 86 reset and full reset
- CB 52 state and 52a/52b
- 1× / 5× / 20× simulation speed
- Single Shot, Ramp and State Sequence
- V1-compatible presets
- CT and VT ratios
- prediction, primary equivalent and WHY explanation
- live SOE
- session report with notes
- CSV export and JSON evidence export
- Principles Lab, ANSI library, Equipment Guide and Relay Library

## Run locally

Serve this folder with any static HTTP server, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

## Tests

Core deterministic regression tests:

```bash
node tests/core-smoke.mjs
```

Expected result in this package: **52/52 PASS**.

A browser self-test is also available through `?selftest=1`; it exercises navigation, output isolation, fine adjustment, channel disconnect, 51 prediction, breaker endpoint, closed-loop current zero and BI-disconnected failure.

## Vendor fidelity

The current NR, Beckwith and SIPROTEC entries are reference profiles. Promote a profile only through an explicit status ladder:

`GENERIC MODEL → REFERENCE PROFILE → PARTIAL MANUAL MAPPING → MANUAL VERIFIED → PLANT VALIDATED`

Exact manuals, firmware/order code, approved settings, I/O routing, SLD, CT/VT data and trip philosophy are required before plant-specific claims.
