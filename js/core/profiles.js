export const profiles = {
  generic: [
    {id:'generic-mf', name:'Generic Multifunction', status:'GENERIC / IEC MODEL', validated:true, note:'Common reusable function model.'}
  ],
  transformer: [
    {id:'generic-transformer', name:'Generic Transformer Protection', status:'GENERIC / IEC MODEL', validated:true, note:'Common transformer learning profile.'},
    {id:'nr-pcs9671s', name:'NR PCS-9671S', status:'REFERENCE PROFILE', note:'Visual/reference mapping only until exact manual, suffix and firmware are supplied.'},
    {id:'nr-pcs985', name:'NR PCS-985 family', status:'REFERENCE PROFILE', note:'Family reference; exact application depends on suffix/configuration.'},
    {id:'beckwith-m3311a', name:'Beckwith M-3311A', status:'REFERENCE PROFILE', note:'Transformer family reference; proprietary details remain manual-gated.'},
    {id:'siprotec-7ut85', name:'Siemens SIPROTEC 7UT85', status:'REFERENCE PROFILE', note:'Transformer family reference; DIGSI/firmware configuration is not emulated.'}
  ],
  generator: [
    {id:'generic-generator', name:'Generic Generator Protection', status:'GENERIC / IEC MODEL', validated:true, note:'Common synchronous generator learning profile.'},
    {id:'nr-pcs985-gen', name:'NR PCS-985 family', status:'REFERENCE PROFILE', note:'Generator-family mapping only until exact suffix/manual is loaded.'},
    {id:'beckwith-m3425a', name:'Beckwith M-3425A', status:'REFERENCE PROFILE', note:'Generator protection reference profile; not firmware emulation.'},
    {id:'siprotec-7um85', name:'Siemens SIPROTEC 7UM85', status:'REFERENCE PROFILE', note:'Generator family reference; function groups depend on project configuration.'}
  ],
  motor: [
    {id:'generic-motor', name:'Generic Motor Protection', status:'GENERIC / IEC MODEL', validated:true, note:'Common motor state and thermal learning profile.'},
    {id:'nr-pcs9641s', name:'NR PCS-9641S', status:'REFERENCE PROFILE', note:'Motor family reference; exact features remain manual-gated.'},
    {id:'siprotec-7sj81-motor', name:'Siemens SIPROTEC 7SJ81', status:'REFERENCE PROFILE', note:'Used here only as a configurable feeder/motor reference profile.'}
  ],
  feeder: [
    {id:'generic-feeder', name:'Generic MCC / Feeder', status:'GENERIC / IEC MODEL', validated:true, note:'Common feeder protection profile.'},
    {id:'siprotec-7sj81', name:'Siemens SIPROTEC 7SJ81', status:'REFERENCE PROFILE', note:'Feeder/overcurrent family reference; no proprietary firmware claim.'},
    {id:'nr-feeder', name:'NR Feeder Family', status:'REFERENCE PROFILE', note:'Placeholder family adapter pending exact relay model/manual.'}
  ],
  line: [
    {id:'generic-line', name:'Generic Line Protection', status:'GENERIC / IEC MODEL', validated:true, note:'Common line protection profile.'},
    {id:'siprotec-7sl87', name:'Siemens SIPROTEC 7SL87', status:'REFERENCE PROFILE', note:'Line differential/distance reference profile; exact logic remains manual-gated.'},
    {id:'nr-line', name:'NR Line Protection Family', status:'REFERENCE PROFILE', note:'Placeholder family adapter pending exact model.'}
  ]
};

export const assetMeta = {
  generic:{title:'Generic Protection Lab', subtitle:'Canonical secondary injection workbench for reusable IEC/ANSI protection models.'},
  transformer:{title:'Transformer Protection Lab', subtitle:'Differential, REF, backup OC/EF, lockout and breaker trip-chain architecture.'},
  generator:{title:'Generator Protection Lab', subtitle:'Electrical protection, excitation/prime-mover interfaces, 86G and multiple trip philosophies.'},
  motor:{title:'Motor Protection Lab', subtitle:'Starting, running, stall/locked-rotor, thermal memory, earth fault and trip logic.'},
  feeder:{title:'MCC / Feeder Protection Lab', subtitle:'OC/EF, directional functions, interlocking, trip circuit and breaker failure.'},
  line:{title:'Line Protection Lab', subtitle:'Distance, differential, backup OC, teleprotection and breaker management architecture.'}
};

export const assetFunctions = {
  generic:[['50','Instantaneous overcurrent','implemented'],['51','Time overcurrent','implemented'],['50N/51N','Earth-fault OC','planned'],['27/59','Voltage','implemented'],['81U/81O','Frequency','implemented'],['46','Negative sequence','implemented'],['67/67N','Directional OC','planned'],['87','Differential','planned']],
  transformer:[['87T','Biased differential','planned'],['64REF','Restricted earth fault','planned'],['50/51','Backup OC','implemented'],['50N/51N','Earth fault','planned'],['24','Overexcitation','planned'],['63','Mechanical inputs','planned'],['86','Lockout','architecture'],['50BF','Breaker failure','architecture']],
  generator:[['87G','Stator differential','planned'],['64','Stator earth fault','planned'],['40','Loss of excitation','planned'],['32','Reverse power','planned'],['46','Negative sequence','implemented'],['24','V/Hz','planned'],['27/59','Voltage','implemented'],['81','Frequency','implemented'],['50/51','Backup OC','implemented'],['78','Pole slip','planned'],['86G','Lockout','architecture'],['50BF','Breaker failure','architecture']],
  motor:[['49','Thermal model','planned'],['50/51','OC','implemented'],['50N/51N','Earth fault','planned'],['46','Negative sequence','implemented'],['48/51LR','Stall / locked rotor','planned'],['66','Start supervision','planned'],['87M','Differential','planned'],['37','Undercurrent','planned']],
  feeder:[['50/51','Phase OC','implemented'],['50N/51N','Earth fault','planned'],['67/67N','Directional','planned'],['27/59','Voltage','implemented'],['50BF','Breaker failure','architecture'],['74TC','Trip-circuit supervision','planned'],['86','Lockout','architecture'],['Interlock','Scheme logic','architecture']],
  line:[['21','Distance','planned'],['87L','Line differential','planned'],['67/67N','Directional backup','planned'],['50/51','Backup OC','implemented'],['79','Autoreclose','planned'],['25','Synch-check','planned'],['50BF','Breaker failure','architecture'],['GOOSE','Digital trip','planned']]
};
