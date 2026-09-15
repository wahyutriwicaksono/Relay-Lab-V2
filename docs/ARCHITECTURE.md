# Relay Lab V2 Architecture Contract

## M01 — Asset and topology
Asset, zone, source and breaker context. V2 currently keeps this at profile/workspace level; plant topology remains a future validated module.

## M02 — Instrument channels
CT/VT base, polarity, phase and source. The workbench preserves raw six-current and six-voltage commands and per-channel link state.

## M03 — Measurement engine
RMS phasor, frequency, residual, negative sequence, real power and generic differential calculations are separated from command values.

## M04 — Element instance
Each function returns `picked`, `expected`, `stage`, `measured`, `reason` and details. Function status is explicitly executable or mapped.

## M05 — Qualification and block
Directional qualification and output blocking are explicit. More qualifiers (inrush, VT fail, operating mode) are future adapters.

## M06 — Scheme logic
Element operate does not directly open the breaker. Scheme, BO, 86, coil and breaker are separate states.

## M07 — Trip matrix
The generic V2 trip route can bypass or include 86 and can initiate BF. Asset-specific trip matrices remain profile data to be added from validated cause-and-effect documents.

## M08 — Actuator
BO, BI, lockout, trip coil, breaker mechanism, 52a/52b, current interruption and breaker failure are separately timestamped.

## M09 — Test generator
Single shot, linear ramp and state sequence are executable. Pulse ramp, binary search and sweep are listed but gated as mapped.

## M10 — Observation and verdict
The endpoint must be declared. PASS requires the expected endpoint within tolerance and no forbidden state. Missing observation produces FAIL; missing capability produces UNSUPPORTED.

## M11 — Vendor profile
Vendor name/model is an adapter status, not an OEM firmware emulator. Exact behavior remains gated by manuals/settings/firmware.

## M12 — Evidence
Evidence export includes version, timestamp, profiles, settings, test method, commanded values, wiring/link map, event trace, result and a deterministic configuration hash.

## M13 — Digital interface
GOOSE/SV remain future modules. The architecture reserves them without pretending that analog simulation proves digital-network conformance.
