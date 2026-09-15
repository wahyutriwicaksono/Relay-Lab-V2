# V1 → V2 Regression Contract

V2 must not regress these V1 behaviors.

## Navigation
- Workbench
- Principles Lab
- ANSI Function Library
- Equipment Guide
- Relay Library
- SOE / Evidence
- Trip Logic

## Tester
- 6 current + 6 voltage channels
- magnitude / angle per channel
- selected channel
- fine adjustment 0.01 / 0.1 / 1
- link / disconnect
- output enable
- frequency
- binary I/O
- phasor and waveform

## Relay / scheme
- pickup / operate indications
- BO / BI
- element reset
- F1 Meter / F2 Setting / F3 Event / F4 Reset
- CB 52 and 52a/52b
- optional 86
- 50BF
- breaker-failure scenario

## Methods and presets
- Single Shot
- Ramp pickup / dropout
- State Sequence
- Normal condition
- Fault / Pickup
- 5× Pickup
- Pickup & Dropout
- BI1 disconnected

## Protection baseline
- 51 IEC SI / VI / EI / DT
- parallel 50 inside 51
- CT and VT ratios
- pre-test prediction
- primary equivalent
- curve visualization

## Evidence
- live event trace
- session notes
- CSV report
- JSON evidence package
- reset / repeatability

## Core test status
`node tests/core-smoke.mjs` → 52/52 PASS in V2.2.0-rebuild.
