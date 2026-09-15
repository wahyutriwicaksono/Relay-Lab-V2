# Known Limits

This build deliberately refuses to fake the following:

- 21 distance: no mho/quadrilateral zones, loops, k0, polarization or PSB/OOS engine yet.
- 49 thermal: no persistent asset-specific heating/cooling model yet.
- 40 loss of excitation: no machine impedance/admittance trajectory model yet.
- 48/51LR and 66: no persistent motor STARTING/RUNNING/STOPPED state engine yet.
- 87T currently treats six injected currents as already ratio/phase-compensated; raw CT/vector-group compensation and harmonic restraint are future transformer-module work.
- 67 is a generic training torque-sign model, not an OEM directional algorithm.
- 25 models permissive criteria only; the complete close-coil/interlock/mechanical closing path is not yet executable.
- No vendor profile is labeled manual-verified or plant-validated.
- The ONLLY photo remains a visual reference only; exact model, ranges, VA/compliance and binary thresholds are unknown.
- No primary injection, COMTRADE playback, GOOSE or SV execution is claimed.
