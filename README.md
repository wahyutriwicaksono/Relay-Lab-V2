# Relay Lab V2 — Protection Relay Engineering & Secondary Injection Workbench

This build is a **V2 development branch** reconstructed from the latest Relay Lab Work artifact and the subsequent protection/injector architecture mapping. It does **not overwrite V1**.

## Preserved from V1
- Engineering workbench concept
- 6 current / 6 voltage injection console
- Phasor and waveform visualization
- Generic multifunction relay
- Generic 51 IEC IDMT model
- 50 high-set concept
- CT ratio basis
- Single Shot, Ramp, State Sequence
- BO/BI feedback concept
- Virtual breaker 52
- Event trace
- Training presets
- Session evidence/export concept

## V2 build-up in this package
- Asset-first navigation: Generic, Transformer, Generator, Motor, MCC/Feeder, Line
- Device/vendor adapter layer with explicit validation status
- Explicit Open Loop vs Closed Loop physics
- Distinct event chain: pickup → operate → scheme → BO → BI → 86/coil → breaker → 52a/52b → current extinction
- Optional breaker-failure sequence (50BF)
- Ideal vs Hardware mode gating (`UNSUPPORTED` when exact tester profile is unavailable)
- Canonical evidence metadata and JSON export
- Common executable engines for 50, 51, 27, 59, 81U, 81O, 46
- Mapped but non-fictional placeholders for advanced protection functions
- Asset-based function coverage map
- Physical reference images for tester/relay context

## Run
Serve this directory with any static HTTP server, for example:

```bash
python3 -m http.server 8080 --directory relay-lab-v2
```

Then open `http://localhost:8080`.

## Important model boundary
Vendor profiles in this build are **reference adapters** unless marked generic/validated. They do not claim identical behavior to proprietary relay firmware. Exact manual, suffix/order code, firmware, settings and project wiring are required before a vendor-specific profile can be promoted to manual-validated or plant-specific status.
