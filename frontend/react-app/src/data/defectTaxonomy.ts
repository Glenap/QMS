// Concrete defect taxonomy for the Conformance Analyser.
//
// Ported from DefectSpec (github.com/saugata-malakar/UI). PRE_DEFECTS = the 5
// pre-construction risk categories (PRE_DIAG_DB); POST_DEFECTS = the ~72
// post-construction / RCC defects (POST_DIAG — RCC and Post share it, RCC_DIAG =
// POST_DIAG). Each entry: severity, likely root cause, recommended investigation,
// and two remediation options. Data only.

export type DefectSeverity = 'LOW' | 'MED' | 'HIGH';
export type DefectPhase = 'PRE' | 'POST' | 'RCC';

export interface RemediationOption {
  title: string;
  match: number;
  scope: string;
  costDuration: string;
}

export interface DefectDef {
  code: string;
  label: string;
  severity: DefectSeverity;
  rootCause: string;
  furtherInvestigation: string;
  futureSolution: string;
  remediationA: RemediationOption;
  remediationB: RemediationOption;
}

export const PRE_DEFECTS: DefectDef[] = [
  {
    "code": "low_cover_risk",
    "label": "Spacer Block & Corrosion Risks",
    "severity": "HIGH",
    "rootCause": "Concrete cover block density is insufficient, leaving reinforcement steel exposed to high rate of atmospheric carbonation and ingress.",
    "furtherInvestigation": "Chloride profiling testing, half-cell potential mapping for corrosion activity, concrete cover survey front.",
    "futureSolution": "Incase of localized corrsion we should repair with patchmortar after exposing the corroded reinforcement and its treatment with anticorrosion coating following the bonding agent.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 94,
      "scope": "Replace spacer blocks with heavy-duty concrete cover blocks (min 40mm) at 600mm spacing. Apply migratory corrosion inhibitor.",
      "costDuration": "Premium Cost | 2 Days Execution"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 78,
      "scope": "Adjust existing rebar cage positioning manually. Apply anti-rust slurry coating before concrete pouring.",
      "costDuration": "Low Cost | 1 Day Execution"
    }
  },
  {
    "code": "congestion_risk",
    "label": "Concrete Flow & Congestion Risks",
    "severity": "HIGH",
    "rootCause": "Tight spacing of reinforcement bars prevents proper aggregate flow, leading to honeycombing voids inside structural cores.",
    "furtherInvestigation": "GPR cover survey, ultrasonic pulse velocity (UPV) scanning of congested reinforcement areas.",
    "futureSolution": "Localized honeycomb area can be repaired with patchmortar following the grouting but larger area of the honeycombed portion should be repaired with RCC jacketing following the grouting.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 92,
      "scope": "Implement structural concrete jacketing over honeycombed areas with high-flow micro-concrete grouting.",
      "costDuration": "Premium Cost | 4 Days Execution"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 80,
      "scope": "Apply localized pressure grouting with low-viscosity epoxy resin and finish surface with patch mortar.",
      "costDuration": "Moderate Cost | 2 Days Execution"
    }
  },
  {
    "code": "formwork_risk",
    "label": "Formwork & Deflection Risks",
    "severity": "MED",
    "rootCause": "Weak shuttering structural stiffness leads to slurry leakage and surface bug holes during placement.",
    "furtherInvestigation": "Visual mapping of surface grid pattern, checking curing log timelines and ambient humidity logs.",
    "futureSolution": "If surface voids is not up to the reinforcement level then only patch mortar should be used for resurfacing of the concrete after removal of the loose part of the concrete. If surface void is up to the reinforcement level then grouting should be used before resurfacing.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 88,
      "scope": "Complete surface grinding, application of polymer-modified mortar layer, and protective anti-carbonation coating.",
      "costDuration": "Moderate Cost | 3 Days Execution"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 82,
      "scope": "Apply cosmetic cementitious grout to fill superficial bugholes and finish with a standard sealer.",
      "costDuration": "Low Cost | 1 Day Execution"
    }
  },
  {
    "code": "heavy_section_risk",
    "label": "Mass Curing & Thermal Risks",
    "severity": "MED",
    "rootCause": "Heavy steel cages and high-heat cement core hydration gradients risk delamination layers or thermal stress cracking.",
    "furtherInvestigation": "Core temperature monitoring logs review, ultrasonic pulse velocity (UPV) mapping of crack depths.",
    "futureSolution": "Rout joint in V-groove shape to 25mm, apply epoxy bonding agent, and inject high-strength epoxy resin. Adjust formwork bracing.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Perform thermal crack routing (V-groove to 25mm), apply epoxy bonding agent, and inject high-strength epoxy resin.",
      "costDuration": "Premium Cost | 3 Days Execution"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Fill surface cracks with cementitious grout, apply elastic protective sealant coating to prevent moisture intrusion.",
      "costDuration": "Low Cost | 1 Day Execution"
    }
  },
  {
    "code": "balanced_risk",
    "label": "Compliant Configurations",
    "severity": "LOW",
    "rootCause": "The photograph demonstrates optimal cover block distribution and compliant rebar spacing configurations.",
    "furtherInvestigation": "Routine visual inspection schedules.",
    "futureSolution": "Maintain quality control standards during placement and monitor ambient curing conditions.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 95,
      "scope": "Maintain standard visual monitoring schedule and apply preventative hydrophobic silane coating.",
      "costDuration": "Low Cost | 1 Day Execution"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 90,
      "scope": "Routine visual inspections only; no active remediation required at this stage.",
      "costDuration": "Zero Cost | Ongoing"
    }
  }
];

export const POST_DEFECTS: DefectDef[] = [
  {
    "code": "seepage_rcc_no_corrosion",
    "label": "Seepage-moisture-waterproofing-no-corrosion",
    "severity": "MED",
    "rootCause": "Picture indicates active water seepage through the RCC member surface without any visible sign of steel corrosion or rust staining. The seepage is likely caused by micro-cracks in the concrete matrix, poor construction joints, or degradation of the waterproofing membrane allowing water to percolate through the concrete cover. The absence of corrosion suggests the carbonation front has not yet reached the reinforcement level.",
    "furtherInvestigation": "We should further investigate the source of water ingress by conducting a moisture mapping survey using a calibrated moisture meter across the affected area. Flood testing or spray testing should be performed to trace the exact entry path of water. Additionally, a carbonation depth test using phenolphthalein indicator should be conducted to assess whether the carbonation front is approaching the reinforcement level, as prolonged seepage will eventually initiate corrosion.",
    "futureSolution": "The active leak source must first be identified and arrested either by pressure injection of polyurethane grout into the seepage path or by sealing the source side with crystalline waterproofing compound. Once the active flow is stopped, the concrete surface should be cleaned and a cementitious waterproofing coating with crystalline technology should be applied to provide long-term protection against future water ingress.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Pressure injection of PU grout.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Cosmetic plaster coating.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "seepage_rcc_with_corrosion",
    "label": "Seepage-moisture ingress- Corrosion",
    "severity": "HIGH",
    "rootCause": "Picture indicates active water seepage through the RCC member with visible rust staining and corrosion products on the concrete surface, confirming that the moisture has penetrated to the reinforcement level. The seepage has caused carbonation or chloride ingress which has depassivated the protective oxide layer around the steel reinforcement, leading to active electrochemical corrosion. The continuous supply of moisture and oxygen is accelerating the corrosion process and may result in concrete spalling if left untreated.",
    "furtherInvestigation": "We should further investigate by conducting a chloride content test at various depths to determine whether the corrosion is chloride-induced or carbonation-induced. Half-cell potential mapping should be performed to identify the extent of active corrosion zones across the member. Core samples should be extracted for compressive strength testing and carbonation depth measurement using phenolphthalein indicator to assess the overall structural integrity of the concrete.",
    "futureSolution": "The source of water seepage must first be arrested using pressure injection of polyurethane or epoxy grout. After stopping the water source, the corroded reinforcement should be fully exposed by removing the deteriorated concrete cover, rust should be cleaned using wire brush or sandblasting, and a zinc-rich anti-corrosion primer should be applied to the treated bars. Finally, the area should be reinstated using polymer-modified patch repair mortar with a bonding agent applied to the substrate for proper adhesion.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 92,
      "scope": "Rebar treatment and patch repair.",
      "costDuration": "Moderate | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 80,
      "scope": "Anti-corrosion coating and patching.",
      "costDuration": "Low | 2 Days"
    }
  },
  {
    "code": "seepage_damage_waterproofing",
    "label": "Damaged overlay-waterproofing-seepage-possible",
    "severity": "MED",
    "rootCause": "Picture indicates that the waterproofing membrane or coating system has failed, allowing water to seep through the structural substrate. This failure could be due to ageing degradation of the membrane material, improper lapping at joints, mechanical damage during construction activities, or UV exposure causing embrittlement of the membrane. The continuous water ingress through the failed waterproofing system can lead to progressive deterioration of the underlying concrete and steel reinforcement.",
    "furtherInvestigation": "We should further investigate the extent of waterproofing failure by conducting a controlled flood test on the source side to map the exact areas of leakage. The membrane joints and overlaps should be visually inspected and probed to check for delamination or separation. Moisture mapping using infrared thermography or electrical impedance scanning should be performed on the underside to identify the full extent of moisture penetration.",
    "futureSolution": "The existing failed waterproofing membrane should be completely removed from the affected area and the substrate should be cleaned and leveled. A new high-performance waterproofing membrane system should be applied with proper primer, membrane sheets with adequate overlap at joints, and a protective screed layer on top. In case of localized damage, elastomeric liquid-applied waterproofing can be used as a patch repair over the damaged zone after surface preparation.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Apply elastomeric waterproofing.",
      "costDuration": "Moderate | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Patch repairs on waterproofing membrane.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "dry_dampness_rcc_no_corrosion",
    "label": "Dampness-weathering-exposed to weather",
    "severity": "LOW",
    "rootCause": "Picture indicates that the RCC member has experienced historic dampness which is currently dry and shows no visible signs of corrosion such as rust staining or concrete spalling. The dampness stains and tide marks on the surface suggest previous water exposure, but the concrete cover and reinforcement appear to be in satisfactory condition. However, the past moisture exposure may have advanced the carbonation front within the concrete, which could pose a risk of future corrosion if dampness recurs.",
    "furtherInvestigation": "We should further investigate by conducting a carbonation depth test using phenolphthalein indicator on freshly broken concrete to determine how close the carbonation front is to the reinforcement level. Periodic moisture monitoring using embedded sensors or surface moisture meters should be performed to confirm that the area remains dry over time. A covermeter scan is also recommended to verify the adequacy of the concrete cover depth.",
    "futureSolution": "Since the member is currently dry with no active corrosion, a preventive anti-carbonation protective coating should be applied on the concrete surface to arrest further carbonation penetration. The surface should be cleaned, any loose plaster removed, and an acrylic or polyurethane-based anti-carbonation paint system applied in multiple coats as per the manufacturer's specification. If future moisture recurrence is anticipated, a surface-applied crystalline waterproofing treatment should also be considered.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Anti-carbonation coating application.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Standard acrylic painting.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "dry_dampness_rcc_with_corrosion",
    "label": "Dampness-moisture source-wateproofing-roof",
    "severity": "MED",
    "rootCause": "Picture indicates that the RCC member has experienced historic dampness which is currently dry but has left behind visible corrosion stains and rust products on the surface. The past moisture exposure has already initiated the corrosion process by carbonating the concrete cover or introducing chlorides, and even though the surface appears dry now, the depassivation of the reinforcement is irreversible. The corrosion may continue at a slower rate due to residual moisture trapped within the concrete pore structure.",
    "furtherInvestigation": "We should further investigate the severity of corrosion damage by conducting a covermeter scan to measure the remaining concrete cover thickness over the reinforcement. Core drilling should be performed to extract samples for chloride content analysis at reinforcement depth and carbonation depth measurement. Half-cell potential survey should be done to determine whether the corrosion process is still active or has stabilized in the current dry condition.",
    "futureSolution": "The corroded reinforcement should be exposed by carefully removing the deteriorated concrete cover using controlled chipping methods. The exposed steel bars should be cleaned of all rust using wire brushing or sandblasting and treated with a zinc-rich anti-corrosion primer. The area should then be reinstated using polymer-modified repair mortar with a bonding agent, and an anti-carbonation protective coating should be applied on the finished surface to prevent future carbonation ingress.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Structural patching and rust treatment.",
      "costDuration": "Moderate | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Localized structural mortar repair.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "dampness_capillary",
    "label": "Dampness-Capillary",
    "severity": "MED",
    "rootCause": "Picture indicates rising dampness in the lower portion of the wall caused by capillary suction of ground water through the porous masonry or concrete foundation. This occurs when the original damp-proof course (DPC) is absent, damaged, or has been bridged by external ground level raised above the DPC line. The rising moisture carries dissolved salts which crystallize on the wall surface causing efflorescence, paint peeling, and gradual deterioration of the plaster and masonry.",
    "furtherInvestigation": "We should further investigate by measuring the height and extent of dampness using a calibrated moisture meter to determine the severity of capillary rise. The existing DPC level should be inspected to check whether it is intact, damaged, or bridged by external fill material. Ground water level and drainage conditions around the foundation should also be assessed to understand the external moisture source.",
    "futureSolution": "A chemical damp-proof course should be injected at the base of the wall by drilling holes at regular intervals and pressure-injecting silicone-based or silane-siloxane DPC cream to create a horizontal moisture barrier. All affected plaster below the DPC line should be removed and replaced with salt-resistant renovation plaster or waterproof plaster with appropriate admixture. External drainage improvement and waterproofing of the foundation wall below grade should also be considered to reduce the hydrostatic pressure.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Inject silicone DPC cream.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Apply salt-resistant barrier plaster.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "leakage_water_ingress_source",
    "label": "Leakage-Water ingress source",
    "severity": "MED",
    "rootCause": "Picture indicates active water leakage from an identifiable source such as a leaking plumbing pipe joint, a cracked water supply or drainage line, or direct rainwater ingress through a gap or crack in the building envelope. The continuous water flow is causing damage to the surrounding substrate including plaster deterioration, paint peeling, and potential structural distress if the leakage is near reinforced concrete elements. The source may be concealed within the wall or slab making visual identification difficult without testing.",
    "furtherInvestigation": "We should further investigate by conducting a pressure test on the plumbing lines in the vicinity to isolate the leaking pipe or joint. Thermal imaging or infrared scanning should be performed on the wall and slab surfaces to trace concealed moisture paths and identify the exact ingress point. If the source is suspected to be from external rainwater, a controlled spray test should be conducted on the exterior facade to replicate the leakage condition.",
    "futureSolution": "The leaking pipe or joint should be repaired or replaced at the source, and the repaired joint should be pressure-tested to confirm it is watertight before closing up. The surrounding substrate damaged by water should be cleaned, dried, and treated with a waterproof coating or crystalline waterproofing slurry to prevent future moisture migration. If the ingress source is from external cracks or gaps, they should be sealed with polyurethane or polysulfide sealant and the external facade should be waterproofed.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Pipe replacement and structural sealing.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Localized pipe joint patching.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "waterlogging_leakage_improper_slope",
    "label": "Waterlogging-Improper Slope",
    "severity": "MED",
    "rootCause": "Picture indicates waterlogging or ponding on the slab surface due to improper drainage slope, blocked drainage outlets, or settlement of the slab creating low spots where water accumulates. The standing water can penetrate through cracks or porous concrete over time causing seepage to the floor below and accelerating deterioration of the waterproofing membrane and concrete surface. Prolonged waterlogging also promotes algae growth and increases the dead load on the slab.",
    "furtherInvestigation": "We should further investigate by conducting a drainage slope survey using a digital level or laser level to identify the exact low spots and areas where the slope is insufficient or reversed. The drainage outlet pipes and floor traps should be checked for blockages, damage, or inadequate sizing. The existing waterproofing membrane integrity below the screed should also be assessed by core cutting at selected locations.",
    "futureSolution": "The screed concrete should be re-laid with a proper minimum slope of 1:100 towards the drainage outlets using a self-leveling screed or conventional cement screed with slope formers. A new waterproofing membrane should be applied over the leveled screed before laying the finish screed or tile layer. Drainage outlets should be cleared, repaired, or additional outlets installed if the existing drainage capacity is insufficient.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Re-grading slope with screed.",
      "costDuration": "Moderate | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Drainage path clearance and seal.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "vegetation_algae",
    "label": "Vegetation-Algae",
    "severity": "LOW",
    "rootCause": "Picture indicates the presence of algae, moss, or organic vegetation growth on the concrete or masonry surface caused by persistent dampness and lack of sunlight exposure. The organic growth thrives in moist conditions where the surface remains wet for extended periods due to water seepage, poor drainage, or high ambient humidity. While algae growth itself is a non-structural distress, it indicates an underlying dampness problem and can accelerate surface deterioration by retaining moisture and producing organic acids.",
    "furtherInvestigation": "We should further investigate the source and extent of dampness that is sustaining the organic growth by conducting a moisture survey of the affected area. The drainage conditions, water runoff patterns, and exposure to sunlight should be assessed to understand why the surface remains persistently wet. If the growth is extensive, the underlying substrate should be checked for surface erosion or deterioration caused by prolonged moisture retention.",
    "futureSolution": "The organic growth should first be removed by applying a biocidal or fungicidal wash solution and scrubbing or pressure washing the surface clean. After the surface is dried, a biocidal masonry paint or anti-fungal protective coating should be applied to inhibit future growth. The root cause of persistent dampness should be addressed by improving drainage, fixing leaks, or applying waterproofing to prevent recurrence of the moisture condition.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Bio-cleaning and protective sealing.",
      "costDuration": "Moderate | 1 Day"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Pressure washing and anti-fungal wash.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "chalking_peeling_crazing",
    "label": "Chalking-Peeling-Crazing",
    "severity": "LOW",
    "rootCause": "Picture indicates surface chalking, peeling, and fine craze cracking of the protective paint or concrete coating layer. This is caused by prolonged ultraviolet radiation exposure, weathering, and thermal expansion cycles that degrade the polymer binder in the paint or top sealer. The degradation leads to loss of adhesion and fracturing of the coating skin.",
    "furtherInvestigation": "We should further investigate by conducting tape adhesion testing (ASTM D3359) to measure the bond strength of the remaining coating. Use a coating thickness gauge to determine the dry film thickness (DFT), and inspect for underlying concrete carbonation or moisture transfer.",
    "futureSolution": "Scrape and sand the deteriorated coating down to the sound concrete or plaster substrate. Apply a high-penetration acrylic primer sealer followed by two coats of premium elastomeric anti-carbonation protective coating to restore appearance and barrier properties.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Complete removal, priming, and application of premium elastomeric anti-carbonation coating.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Scraping peeled areas, patch priming, and localized painting.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "alkali_silica_reactivity",
    "label": "Alkali Silica Reactivity",
    "severity": "HIGH",
    "rootCause": "Picture indicates typical map-pattern cracking and gel exudation characteristic of Alkali-Silica Reactivity (ASR) in the concrete matrix. This internal chemical reaction occurs between the highly alkaline cement paste and reactive silica minerals in the aggregates, forming an expansive gel that swells in the presence of moisture and exerts tensile pressure exceeding the concrete's tensile strength.",
    "furtherInvestigation": "We should further investigate by extracting core samples for petrographic analysis (ASTM C856) to confirm the presence of ASR gel and micro-cracking in the aggregates. Conduct expansion tests and determine the relative humidity within the concrete core.",
    "futureSolution": "Since ASR is an internal chemical process, treatment focuses on dry conditioning and moisture exclusion. Seal all surface cracks using low-viscosity hydrophobic sealers and apply a breathable silane-siloxane impregnating water repellent over the member to arrest the reaction by keeping the concrete dry.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 92,
      "scope": "Inject cracks with hydrophobic silane/siloxane sealer and apply breathable barrier coating.",
      "costDuration": "Moderate | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Cosmetic crack sealing with acrylic sealant and exterior weatherproofing paint.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "re_wall_collapse",
    "label": "RE Wall Collapse",
    "severity": "HIGH",
    "rootCause": "Picture indicates localized bulging, displacement, or collapse of the Reinforced Earth (RE) retaining wall panel configuration. This failure is typically caused by inadequate backfill compaction, poor internal drainage leading to hydrostatic pressure buildup, or corrosion degradation of the internal steel soil reinforcing strips/geogrids.",
    "furtherInvestigation": "We should further investigate by conducting geogrid/reinforcement strip pulling tests, surveying the wall alignment profile with total station laser scanning, and checking groundwater flow and drainage outlet blockages behind the wall.",
    "futureSolution": "Dismantle the displaced panels in the affected zone, excavate and replace the backfill soil with well-graded cohesionless material compacted in thin layers, install a high-capacity drainage geocomposite behind the wall, and rebuild the concrete panels with new high-strength geogrid soil anchors.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 95,
      "scope": "Re-excavate backfill, replace reinforcement strip/geogrid, install drainage composite, rebuild panels.",
      "costDuration": "Premium | 7 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 70,
      "scope": "Localized structural panel tie-backs and external pressure grouting.",
      "costDuration": "Moderate | 4 Days"
    }
  },
  {
    "code": "corrosion_minor",
    "label": "Corrosion-Minor Crack",
    "severity": "MED",
    "rootCause": "Primarily stress pattern looks like a corrosion crack in localized portion having minor width of the crack",
    "furtherInvestigation": "We should furthur investigate the cause behind the corrosion whether it is a dry area or moist area if corrosion is in the dry area then we should also check the chloride and carbonation of the concrete",
    "futureSolution": "Incase of localized corrsion we should repair with patchmortar after exposing the corroded reinforcement and Its treatment with anticorrosion coating following the bonding agent",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 92,
      "scope": "Expose rebar, clean using wire brush, apply zinc-rich anti-corrosion primer, polymer-modified patch mortar.",
      "costDuration": "Moderate Cost | 2 Days Execution"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 80,
      "scope": "Apply surface rust converter, patch with standard cement mortar, apply protective sealant.",
      "costDuration": "Low Cost | 1 Day Execution"
    }
  },
  {
    "code": "corrosion_along",
    "label": "Corrosion-Along Reinforcement",
    "severity": "MED",
    "rootCause": "Primarily stress pattern looks like a corrosion crack in whole length of the RCC having minor width of the crack",
    "furtherInvestigation": "We should furthur investigate the cause behind the corrosion whether it is a dry area or moist area if corrosion is in the dry area then we should also check the chloride and carbonation of the concrete",
    "futureSolution": "Incase of localized corrsion we should repair with patchmortar after exposing the corroded reinforcement and Its treatment with anticorrosion coating following the bonding agent",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Full rebar exposure, abrasive blast cleaning, sacrificial zinc anodes installation, structural micro-concrete casting.",
      "costDuration": "Premium Cost | 4 Days Execution"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 78,
      "scope": "Localized patch repairs, anti-rust coating on exposed steel sections, standard plaster finishing.",
      "costDuration": "Moderate Cost | 2 Days Execution"
    }
  },
  {
    "code": "corrosion_exposed",
    "label": "Corrosion-Spalling-Exposed Reinforcement",
    "severity": "HIGH",
    "rootCause": "The photographic evidence indicates severe concrete spalling with fully exposed reinforcing bars. This is caused by concrete carbonation and chloride ingress, which disrupts the passive steel oxide layer, leading to expansive corrosion that creates internal tensile stresses exceeding the concrete's tensile strength, resulting in cracking and cover failure.",
    "furtherInvestigation": "We should perform a visual inspection and hammer sounding to map the delaminated zone, measure the remaining rebar diameter to check for cross-sectional area loss, test the depth of carbonation front using phenolphthalein indicator, and conduct chloride content profile testing.",
    "futureSolution": "Remediation requires exposing all corroded reinforcement beyond the affected zones, sand-blasting to remove rust, treating steel with a zinc-rich anti-corrosion primer, applying an epoxy-modified bonding agent to the concrete substrate, and reinstating the cover with structural polymer-modified patch mortar or micro-concrete casting.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 95,
      "scope": "Expose steel, sandblast rust, apply epoxy bonding agent, apply structural polymer-modified patching mortar or perform section enlargement.",
      "costDuration": "Premium Cost | 5 Days Execution"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 70,
      "scope": "Clean exposed bars manually, apply anti-corrosion coating, patch with standard structural mortar.",
      "costDuration": "Moderate Cost | 2 Days Execution"
    }
  },
  {
    "code": "corrosion_spalling_rebar_exposed_moist",
    "label": "Corrosion Spalling Rebar Exposed Moist",
    "severity": "HIGH",
    "rootCause": "Picture indicates severe concrete spalling with fully exposed steel reinforcement in an actively moist environment. The presence of water accelerates the electrochemical cell reaction of steel corrosion, leading to rapid section loss of the rebars and complete delamination of the concrete cover.",
    "furtherInvestigation": "We should further investigate by measuring the remaining rebar diameter to check for cross-sectional area loss, conducting half-cell potential mapping to identify active corrosion hotspots, and measuring chloride concentration at the rebar level.",
    "futureSolution": "Expose all corroded steel bars, abrasive-blast to remove rust down to bare metal, install sacrificial zinc anodes for galvanic protection, apply a zinc-rich anti-corrosion primer to the steel, and reinstate the concrete cover using structural polymer-modified repair mortar.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 94,
      "scope": "Expose steel, sandblast, install sacrificial zinc anodes, anti-rust primer, reinstate cover with polymer mortar.",
      "costDuration": "Premium | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 78,
      "scope": "Manual wire-brush rebar cleaning, anti-corrosion slurry paint, and concrete patch plastering.",
      "costDuration": "Moderate | 2 Days"
    }
  },
  {
    "code": "surface_voids_general",
    "label": "Surface-Voids",
    "severity": "LOW",
    "rootCause": "Picture indicates small, shallow micro voids and pinholes distributed across the concrete surface. These voids are typically the result of minor bleeding, improper compaction, or early drying of the concrete surface layer, which prevents air and bleed water from escaping during finishing.",
    "furtherInvestigation": "We should further investigate by conducting a visual survey to map out the density of the voids and check whether they expose the reinforcement or penetrate deep into the concrete core. No intensive testing is required if the voids are strictly superficial and non-structural.",
    "futureSolution": "The concrete surface should be thoroughly cleaned of any dust or curing compound, followed by the application of a thin cosmetic micro-plaster skim coat or cementitious fairing coat to fill the voids and restore a smooth, durable finish.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Apply protective polymer cosmetic coating.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Standard surface finishing paint.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "cold_joint_formwork",
    "label": "Cold Joint and Improper Formwork",
    "severity": "MED",
    "rootCause": "Picture indicates a distinct joint line and honeycombed texture formed due to concrete pouring delay, where the second batch of concrete was poured after the first batch had already initiated its initial set. This results in a weak plane at the joint. The improper formwork has also led to alignment offsets and concrete slurry leakage.",
    "furtherInvestigation": "We should further investigate the depth and extent of the cold joint by performing non-destructive testing such as ultrasonic pulse velocity (UPV) mapping across the joint plane. Core extraction should be done at the interface to check for voids, and water penetration tests should be conducted to check for water paths through the joint.",
    "futureSolution": "Rout the cold joint line in a V-groove shape to a depth of 25mm, clean out all loose aggregates, apply a structural epoxy bonding agent, and inject low-viscosity structural epoxy resin or pack with non-shrink high-strength grout to restore full monolithic shear capacity.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 91,
      "scope": "Rout joint to V-groove (25x25mm), apply epoxy bonding agent, and inject low-viscosity structural epoxy resin.",
      "costDuration": "Premium Cost | 3 Days Execution"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 80,
      "scope": "Seal joint surface with elastomeric polyurethane sealant to prevent moisture ingress.",
      "costDuration": "Low Cost | 1 Day Execution"
    }
  },
  {
    "code": "joint_crack_incompatible_material",
    "label": "Joint Crack-Incompatible Material",
    "severity": "MED",
    "rootCause": "Picture indicates separation cracks at the interface of two dissimilar materials (e.g., concrete and brick masonry, or concrete and steel). These cracks occur due to differential thermal expansion/contraction coefficients and shrinkage behaviors, which generate interfacial shear stresses exceeding the bond strength between the materials.",
    "furtherInvestigation": "We should further investigate by measuring the crack opening range across seasonal temperature variations to determine if it is active or stable. A visual check should be performed to inspect for proper joint mesh reinforcement or expansion gap fillers at the material boundary.",
    "futureSolution": "Rout the cracked interface to form a clean groove, clean out debris, and apply a high-movement elastomeric polyurethane or polysulfide joint sealant. For wall plaster interfaces, bridge the joint with a fiberglass or galvanized wire mesh before applying a flexible polymer-modified plaster patch.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Install expansion joints with structural bellows.",
      "costDuration": "Moderate | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Seal with flexible polysulfide sealant.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "crack_shrinkage_thermal_crack",
    "label": "Crack-Thermal-Shrinkage-Plaster Crack",
    "severity": "LOW",
    "rootCause": "Picture indicates fine, map-patterned hairline cracks or evenly spaced transverse cracks. These are caused by drying shrinkage of the concrete during curing, or by thermal stresses arising from high hydration heat gradients or diurnal temperature fluctuations.",
    "furtherInvestigation": "We should further investigate the crack activity by installing glass slide monitors or digital tell-tale crack gauges to track crack movement over a 24-hour cycle. Verify concrete curing history and review design thermal expansion joint spacing.",
    "futureSolution": "Clean the surface cracks and apply an elastomeric acrylic coating system that can bridge active thermal movements. For wider cracks, rout them to a V-groove shape and fill with a flexible polyurethane joint sealer before applying the protective topcoat.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Elastomeric bridge coating.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Fill with acrylic sealant.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "efflorescence_salt_deposition_masonry",
    "label": "Efflorescence Salt Deposition-Masonry",
    "severity": "LOW",
    "rootCause": "Picture indicates white, powdery salt deposits crystallizing on the brick masonry surface. This efflorescence is caused by soluble salts within the brick or mortar leaching out to the surface when dissolved in water, which then evaporates.",
    "furtherInvestigation": "We should further investigate by using a moisture meter to trace the dampness path sustaining the efflorescence. Perform salt chemical analysis to identify the salt types, and locate the source of water ingress (such as rain or plumbing leaks).",
    "futureSolution": "Brush off the dry salts from the masonry surface using a stiff bristle brush (avoid water as it will re-dissolve salts). Seal the masonry surface with a breathable silane-siloxane hydrophobic sealer, and resolve any plumbing or moisture leaks.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Salt neutralizer wash and hydrophobic sealing.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Dry brushing and acrylic waterproof sealer.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "corrosion_lower_cover_rcc",
    "label": "Corrosion-Lower Cover",
    "severity": "MED",
    "rootCause": "Picture indicates longitudinal cracking and concrete spalling along the bottom rebar lines. This is caused by inadequate concrete cover over the reinforcement, allowing rapid penetration of carbonation or moisture to the steel, causing rust expansion.",
    "furtherInvestigation": "We should further investigate by conducting a covermeter scan to map out the actual cover depth across the slab or beam. Perform carbonation depth testing using phenolphthalein indicator, and measure rebar diameter loss.",
    "futureSolution": "Chip away the deteriorated bottom concrete cover to fully expose the corroded reinforcement. Clean the steel bars using wire brushes or sandblasting, apply a zinc-rich anti-corrosion primer, and patch/reinstate using high-strength polymer-modified mortar.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Expose and apply structural repair micro-concrete.",
      "costDuration": "Moderate | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Expose and apply polymer patching mortar.",
      "costDuration": "Low | 2 Days"
    }
  },
  {
    "code": "sulphate_attack",
    "label": "Sulphate Attack",
    "severity": "HIGH",
    "rootCause": "Picture indicates scaling, cracking, and white sulfate deposits in the concrete matrix, suggesting severe sulfate attack. This occurs when sulfate ions from groundwater or soil react with tricalcium aluminate in the concrete, forming expansive ettringite crystals that cause internal expansion and paste disintegration.",
    "furtherInvestigation": "We should further investigate by conducting chemical testing of soil and water samples to determine sulfate concentration. Extract core samples for petrographic analysis to identify ettringite formation and measure compressive strength loss.",
    "futureSolution": "Remove all deteriorated concrete down to the sound core. Reinstate the member using concrete made with sulfate-resistant cement (Type V) and low water-cement ratio, and apply a thick protective polyurethane or epoxy barrier coating to isolate the concrete from sulfate-bearing soils.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 92,
      "scope": "Remove weak concrete, patch with Type V cement mortar, apply thick protective polyurethane barrier.",
      "costDuration": "Premium | 4 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Patch repairs with sulfate-resistant mortars and standard waterproof sealing.",
      "costDuration": "Moderate | 2 Days"
    }
  },
  {
    "code": "flexural_crack_rcc",
    "label": "Flexural-Crack-RCC",
    "severity": "HIGH",
    "rootCause": "Picture indicates vertical or diagonal cracks in the tension zone of the RCC beam or slab, indicating flexural distress. The crack occurred because the bending moment from structural overload or design undersizing exceeded the tensile capacity of the reinforced section.",
    "furtherInvestigation": "We should further investigate by conducting structural load evaluations, measuring member deflections, and scanning the section with GPR to locate and size the tension reinforcement bars. Perform concrete core compressive tests to verify actual material strength.",
    "futureSolution": "Strengthen the tension zone of the member by bonding carbon fiber reinforced polymer (CFRP) laminates or high-strength steel plates to the tension face using structural epoxy adhesives, after injecting the cracks with structural epoxy resin.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Carbon fiber reinforced polymer wrapping.",
      "costDuration": "Premium | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Epoxy injection and localized steel plates.",
      "costDuration": "Moderate | 2 Days"
    }
  },
  {
    "code": "shear_crack_rcc",
    "label": "Shear-Crack-RCC",
    "severity": "HIGH",
    "rootCause": "Picture indicates diagonal tension cracks inclined at approximately 45 degrees near the support of the RCC beam. These shear cracks are caused by shear stresses exceeding the concrete tensile strength combined with inadequate or degraded shear stirrup reinforcement, creating a critical risk of sudden brittle failure.",
    "furtherInvestigation": "We should further investigate by mapping the crack geometry and measuring width changes under live load. Perform non-destructive testing such as rebound hammer or ultrasonic pulse velocity to assess concrete quality, and scan the beam with a covermeter/GPR to map stirrup spacing and diameter.",
    "futureSolution": "Inject the cracks under pressure with low-viscosity structural epoxy resin to seal the concrete. Externally reinforce the beam shear capacity by wrapping carbon fiber reinforced polymer (CFRP) stirrups or installing steel plate jackets bolted to the sides of the beam.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Shear strengthening using CFRP rods.",
      "costDuration": "Premium | 4 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Section enlargement and shear rebar.",
      "costDuration": "Moderate | 3 Days"
    }
  },
  {
    "code": "punching_crack_rcc",
    "label": "Punching-Crack-RCC",
    "severity": "HIGH",
    "rootCause": "Picture indicates diagonal punching shear cracks forming a cone-like failure surface around the column-slab junction. This punching distress is caused by high concentrated shear forces around the column exceeding the shear capacity of the slab, due to increased slab loading or design omissions.",
    "furtherInvestigation": "We should further investigate by conducting slab level surveys to check for deflection, checking design reinforcement ratios at the column strip, and scanning for shear reinforcement inside the slab using high-frequency GPR. Take cores to verify compressive strength.",
    "futureSolution": "Relieve slab load locally, repair cracks using epoxy pressure injection, and retrofit the slab-column junction by installing structural steel shear collars, column capital drop panels, or post-installed vertical shear bolts drilled through the slab thickness.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Retrofit with steel collars.",
      "costDuration": "Premium | 5 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Add RC drop panels around columns.",
      "costDuration": "Premium | 4 Days"
    }
  },
  {
    "code": "scouring",
    "label": "Scouring",
    "severity": "HIGH",
    "rootCause": "Picture indicates localized erosion of soil and foundation support media around the base of the concrete pier or abutment, caused by high-velocity water runoff scour. This erosion undermines the foundation bearing capacity and can lead to structural instability or settlement.",
    "furtherInvestigation": "We should further investigate by conducting underwater bathymetric surveys to map the scour hole depth, checking foundation level settlement, and analyzing water flow velocities during peak flood events.",
    "futureSolution": "Backfill the scour hole using heavy rock rip-rap, concrete-filled gunny bags, or articulated concrete block mattresses to provide hydrodynamic erosion protection around the foundation base, and install sheet pile walls if deep scour protection is required.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 93,
      "scope": "Install sheet pile walls, backfill with heavy rock rip-rap/concrete block mattresses.",
      "costDuration": "Premium | 5 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 76,
      "scope": "Fill scour holes with concrete-filled sandbags locally.",
      "costDuration": "Moderate | 2 Days"
    }
  },
  {
    "code": "abrasion_cavitation_concrete_overlay",
    "label": "Abrasion -Cavitation concrete overlay",
    "severity": "MED",
    "rootCause": "Picture indicates erosion and pitting of the concrete overlay surface caused by abrasive aggregate movement or hydrodynamic cavitation in high-velocity water channels. Cavitation occurs when vapor bubbles collapse violently against the concrete surface, creating micro-implosions that erode the cement paste.",
    "furtherInvestigation": "We should further investigate by measuring the depth of surface erosion, checking the compressive strength of the concrete overlay using rebound hammer testing, and analyzing hydraulic flow patterns and velocity profiles.",
    "futureSolution": "Repair the eroded surface by applying a high-strength silica fume concrete overlay or an epoxy-resin mortar screed that provides high resistance to impact and abrasion, and finish the surface smooth to minimize cavitation-inducing turbulence.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Apply high-strength silica fume concrete overlay or epoxy-resin mortar screed, grind smooth.",
      "costDuration": "Moderate | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Patch eroded zones locally with high-durability polymer-modified mortar.",
      "costDuration": "Low | 2 Days"
    }
  },
  {
    "code": "crack_stairstep_masonry",
    "label": "Crack-Stairstep-Masonry",
    "severity": "MED",
    "rootCause": "Picture indicates a stair-step crack following the horizontal and vertical mortar joints of the brick masonry wall. This is a typical distress pattern indicating localized foundation settlement or horizontal movement at one corner of the structure.",
    "furtherInvestigation": "We should further investigate by checking if the settlement has stabilized using tell-tale crack monitoring cards. Perform leveling surveys across the foundation base and check for ground water seepage or soil erosion under the affected wall corner.",
    "futureSolution": "Rout out the mortar joints affected by the stair-step cracking, install helical stainless steel reinforcement rods into the bed joints extending 500mm beyond the crack line, and grout securely with structural cementitious grout.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Structural stitching with helical bars.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Re-pointing mortar joints.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "fire_black_fumed_no_blistering",
    "label": "Fire-Black Fumed-No Blistering",
    "severity": "LOW",
    "rootCause": "Picture indicates surface soot and carbon staining on the wall without plaster blistering or concrete cracking. This is caused by smoke and fumed particles deposition from a nearby fire, without direct heat radiation reaching levels that cause material structural damage.",
    "furtherInvestigation": "We should further investigate by visual inspection and scratching the soot layer to verify if the plaster layer underneath is solid or crumbly. Conduct simple hammer sound tests to ensure no delamination of plaster has occurred.",
    "futureSolution": "Clean the soot from the wall surface using high-pressure water blasting and specialized chemical carbon cleaners. Once dried, apply a stain-blocking sealing primer coat followed by two coats of decorative acrylic paint to restore the appearance.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Chemical washing and paint sealing.",
      "costDuration": "Moderate | 1 Day"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Simple pressure washing and painting.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "fire_black_fumed_blistering",
    "label": "Fire-Black Fumed-Blistering",
    "severity": "MED",
    "rootCause": "Picture indicates black soot deposition and severe blistering of the plaster/paint layer on the concrete or masonry wall. This distress is caused by exposure to high-temperature flames and combustion gases, which heat moisture inside the plaster and cause steam pressure delamination.",
    "furtherInvestigation": "We should further investigate the depth of heat damage by conducting a Schmidt rebound hammer test on the underlying concrete. Extract cores to verify if the concrete core strength has degraded, and check for steel reinforcement detempering.",
    "futureSolution": "Chop off all blistered and carbonized plaster down to the masonry or concrete surface. Wash soot deposits using high-pressure water and alkaline chemical cleaners, apply a structural polymer bonding agent, and replaster the wall surface.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Chop blistered plaster and apply micro-concrete.",
      "costDuration": "Moderate | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Pressure wash and patch plastering.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "fire_pink_concrete_without_spalling",
    "label": "Fire-colour change-without Spalling",
    "severity": "MED",
    "rootCause": "Picture indicates pink concrete discoloration on the member surface without active mechanical spalling or reinforcement exposure. The pink hue indicates exposure to moderate fire temperatures (300C-600C), which alters the concrete mineral structure and reduces the surface layer compressive strength and carbonation resistance.",
    "furtherInvestigation": "We should further investigate by performing a rebound hammer survey and scraping the discolored surface layer to measure concrete degradation depth. Conduct UPV tests across the section to confirm if the inner core concrete has sustained any damage.",
    "futureSolution": "Grit-blast or mechanically grind the discolored pink surface layer to expose sound concrete. Apply a penetrating epoxy primer followed by a structural fiber-reinforced polymer modified cementitious screed to restore the surface durability and protective cover layer.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Apply structural fiber reinforcement screed.",
      "costDuration": "Moderate | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Apply cosmetic polymer plaster.",
      "costDuration": "Low | 2 Days"
    }
  },
  {
    "code": "fire_pink_concrete_spalling",
    "label": "Fire-Colour change- with Spalling",
    "severity": "HIGH",
    "rootCause": "Picture indicates severe concrete spalling and pink discoloration of the concrete core. This color change (occurring between 300C to 600C due to iron compound oxidation) and spalling are caused by high thermal gradients and steam pressure buildup within the concrete pores during fire exposure, leading to loss of structural strength and exposure of steel reinforcement.",
    "furtherInvestigation": "We should further investigate by conducting ultrasonic pulse velocity (UPV) scanning and concrete core compressive testing to determine the depth of structural degradation. Perform reinforcement scanning to evaluate remaining rebar section and check for steel detempering.",
    "futureSolution": "Chip away all delaminated and pink-discolored concrete to expose the sound concrete core. Clean the steel reinforcement of rust, apply a structural epoxy bonding agent, and restore the member cross-section using high-strength structural micro-concrete or polymer-modified repair mortar.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Jacketing with micro-concrete.",
      "costDuration": "Premium | 5 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Remove weak concrete and polymer patching.",
      "costDuration": "Moderate | 3 Days"
    }
  },
  {
    "code": "fire_deflected_distorted",
    "label": "Fire -Deflected-Distorted",
    "severity": "HIGH",
    "rootCause": "Picture indicates severe lateral or vertical deflection and buckling deformation of structural members after exposure to high-temperature fire. The heat reduces the steel modulus of elasticity and yield strength, leading to plastic deformation under design loads.",
    "furtherInvestigation": "We should further investigate by performing a total station alignment survey to map the member deflection profile, inspecting all connections for weld/bolt shearing, and conducting hardness testing to evaluate steel metallurgical changes.",
    "futureSolution": "For members with deflection exceeding design tolerances, replace the deformed steel section entirely. If deflection is marginal, reinforce the member by welding additional steel cover plates or installing external post-tensioned bracing systems to restore load capacity.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 94,
      "scope": "Section replacement or welding of structural steel reinforcing cover plates.",
      "costDuration": "Premium | 5 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Localized member strengthening and post-tensioned bracing systems.",
      "costDuration": "Moderate | 3 Days"
    }
  },
  {
    "code": "paint_peel_off_steel",
    "label": "Paint Peel Off-Oxidation Steel",
    "severity": "LOW",
    "rootCause": "Picture indicates peeling, blistering, and delamination of the protective paint film from the steel structural member. This paint failure is caused by poor surface preparation before painting, moisture condensation beneath the paint film, or exposure to harsh environmental conditions.",
    "furtherInvestigation": "We should further investigate by performing cross-cut paint adhesion tests on surrounding intact painted areas. Scrape the peeled areas to check for active corrosion/rust pitting on the underlying steel surface, and measure the paint dry film thickness (DFT).",
    "futureSolution": "Scrape and sand the steel surface to remove all loose paint and mill scale. Clean the surface using solvent wipes, apply a rust-inhibitive zinc chromate or epoxy primer coat, and finish with two coats of high-durability polyurethane enamel paint.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Abrasive blast cleaning and marine painting.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Wire brush scraping and anti-rust paint.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "oxidation_steel_roofing_sheet",
    "label": "Oxidation-Steel Roofing Sheet",
    "severity": "LOW",
    "rootCause": "Picture indicates localized rust patches on the steel roofing sheets. This oxidation is caused by ponding water, damage to the protective galvanized coating during installation, or acidic environmental conditions that accelerate steel sheet corrosion.",
    "furtherInvestigation": "We should further investigate by inspecting the roofing sheet laps, checking for pinholes and daylight through the sheet, and checking the slope of the roof to understand why water ponding occurs.",
    "futureSolution": "Wire-brush the rusted areas, clean with a rust-converting solution, and apply a fiber-reinforced elastomeric waterproofing coating. If the sheet thickness has degraded significantly or contains pinholes, replace the affected sheet section entirely.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Full roof sheet replacement.",
      "costDuration": "Moderate | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Anti-rust primer and rubberized coating.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "failure_expansion_joint",
    "label": "Failure of Expansion Joint",
    "severity": "MED",
    "rootCause": "Picture indicates a failed structural expansion joint, showing torn sealing profiles, loss of joint filler, or water leakage. This is caused by environmental aging, thermal movement exceeding the design capacity of the joint, or improper installation of joint sealants.",
    "furtherInvestigation": "We should further investigate by measuring the joint gap width at different temperatures to check movement range. Inspect the underside of the joint for active water leaks, and verify if the joint filler material has hardened or disintegrated.",
    "futureSolution": "Completely remove the damaged joint sealer and filler. Clean the joint wall surfaces, install a closed-cell backing rod, and seal with a high-movement elastomeric polyurethane joint sealant. If required, install a heavy-duty mechanical expansion joint cover system.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Replace expansion joint profiles.",
      "costDuration": "Moderate | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Fill with elastomeric joint filler.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "floor_settlement",
    "label": "Floor Settlement",
    "severity": "HIGH",
    "rootCause": "Picture indicates cracking and uneven level changes in the concrete floor slab, suggesting differential floor settlement. This is caused by compaction failure of the underlying subgrade soil, soil erosion from water pipe leaks, or changes in water table level.",
    "furtherInvestigation": "We should further investigate by drilling core holes through the floor slab to inspect subgrade voids, performing soil compaction testing, and conducting ground penetrating radar (GPR) scans to map the extent of under-slab voids.",
    "futureSolution": "Fill the subgrade voids beneath the floor slab by performing mud-jacking or polyurethane foam injection (slab jacking) to raise the slab back to level and stabilize the soil. Seal all cracks in the floor using semi-rigid epoxy joint fillers.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 91,
      "scope": "Stabilize subgrade via polyurethane foam injection under-slab and inject cracks with semi-rigid epoxy.",
      "costDuration": "Premium | 4 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Slab jacking via standard cement slurry injection and floor crack patching.",
      "costDuration": "Moderate | 2 Days"
    }
  },
  {
    "code": "scaling_peeling_off_metal",
    "label": "Scaling and Peeling Off-Metal Layer",
    "severity": "HIGH",
    "rootCause": "Picture indicates heavy laminating rust scales exfoliating and peeling off from the steel structural member. This severe corrosion is caused by long-term exposure to moisture, carbon dioxide, or industrial pollutants, leading to continuous oxidation layers that swell and detach.",
    "furtherInvestigation": "We should further investigate by using an ultrasonic thickness gauge to measure the remaining sound steel thickness across the rusted section. Perform load calculations to verify if the structural element is compromised and check for cracks.",
    "futureSolution": "Use needle guns or abrasive blasting to remove all loose steel scales down to bare metal. If the sectional area loss exceeds 10-15%, weld or bolt additional steel plates (gussets or channel splices) to reinforce the member before applying high-performance industrial coatings.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Weld steel plate splices to reinforce section.",
      "costDuration": "Premium | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Scale removal and heavy-duty paint.",
      "costDuration": "Moderate | 2 Days"
    }
  },
  {
    "code": "buckling_in_steel_member",
    "label": "Buckling-in Steel Member",
    "severity": "HIGH",
    "rootCause": "Picture indicates lateral-torsional or local buckling deformation in the steel member under compression. This structural failure occurs when the compressive stress exceeds the member's critical buckling load, caused by overloaded structural demands, lack of lateral bracing, or insufficient section properties.",
    "furtherInvestigation": "We should further investigate by conducting laser scanning or total station measurement to map the member's out-of-straightness deflection profile. Perform structural load audits, inspect all lateral support restraints, and check the steel material grade.",
    "futureSolution": "Unload the structural member, heat-straighten or replace the bent steel section, and weld structural stiffener plates or add lateral tie bracing members to prevent future buckling under load.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Add stiffeners and member strengthening.",
      "costDuration": "Premium | 4 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Install lateral bracing rods.",
      "costDuration": "Moderate | 2 Days"
    }
  },
  {
    "code": "loosening_bolt_steel_connections",
    "label": "Loosening-Bolt-Steel Connections",
    "severity": "MED",
    "rootCause": "Picture indicates loose nuts or gaps between the washers and steel connection plates. This loosening is caused by cyclic mechanical loads, dynamic structural vibrations, or thermal expansion/contraction cycles that relieve the bolt's initial preload.",
    "furtherInvestigation": "We should further investigate by checking bolt torque levels using a calibrated dial torque wrench. Inspect bolt threads for stripping or galling, check for plate wear/fretting around holes, and check for thread-locking failures.",
    "futureSolution": "Clean the bolt threads, replace any damaged bolts, tighten all loose bolts to the specified tension using a torque wrench, and apply a thread-locking fluid or install locknuts/tension control washers to prevent future loosening.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Replace with lock-nuts or HSFG bolts.",
      "costDuration": "Moderate | 1 Day"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Tighten existing bolts manually.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "plaster_spalling",
    "label": "Plaster spalling",
    "severity": "LOW",
    "rootCause": "Picture indicates localized spalling and peeling of plaster from the brick masonry wall surface. This is caused by water moisture ingress behind the plaster layer, which leads to loss of adhesion between the mortar and brick substrate, or by salt crystallization under the plaster causing mechanical delamination.",
    "furtherInvestigation": "We should further investigate by conducting a hammer tap check to map out hollow-sounding and delaminated plaster regions. A surface moisture meter should be used to probe the dampness levels behind the plaster layer, and the source of water ingress must be identified and stopped before repair.",
    "futureSolution": "Remove all loose and delaminated plaster back to the sound masonry surface, brush off any salt deposits, apply a polymer bonding agent to the substrate, and replaster with a high-performance sand-cement mortar mixed with a waterproof admixture in the proper ratio.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 88,
      "scope": "Chop off entire plaster layers, apply mechanical keyways, polymer bonding agent, and replaster with structural mortar.",
      "costDuration": "Moderate Cost | 3 Days Execution"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 85,
      "scope": "Chop loose patches locally, apply cement slurry bonding coat, and replaster patches.",
      "costDuration": "Low Cost | 1 Day Execution"
    }
  },
  {
    "code": "missing_bolt_steel_connections",
    "label": "Missing Bolt-Steel Connections",
    "severity": "HIGH",
    "rootCause": "Picture indicates empty bolt holes in the steel structural connection. This bolt loss is caused by severe vibration, structural joint movement, or improper initial bolt installation and tightening torque, leading to increased load concentration on the remaining bolts.",
    "furtherInvestigation": "We should further investigate by auditing all remaining bolts in the connection for proper tightness using a calibrated torque wrench. Inspect the steel connection plates for warping, cracking, or hole ovalization caused by overloaded stress distribution.",
    "futureSolution": "Align the connection plates, clean the bolt holes of rust, and install new high-strength friction grip (HSFG) structural bolts. Tighten the bolts to the design torque specification using a calibrated torque wrench to ensure structural load transfer.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Replace connections with HSFG bolts.",
      "costDuration": "Moderate | 1 Day"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Install standard structural bolts.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "timber_termite_effect",
    "label": "Timber-Termite Effect",
    "severity": "MED",
    "rootCause": "Picture indicates structural degradation, hollow wood chambers, and mud tunnels in the timber elements. This damage is caused by sub-terranean termite infestation feeding on the cellulose within the wood, which hollows out the structural member.",
    "furtherInvestigation": "We should further investigate by performing hammer sound testing and drilling core probes to map out hollow zones inside the timber member. Use moisture meters to locate active damp nests and trace termite entry paths.",
    "futureSolution": "Treat the affected area using pesticide soil barriers and local chemical injections. If the timber sectional area is hollowed out by more than 15-20%, replace the damaged timber section or reinforce it by bolting side steel plates.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Inject chemical barrier and replace wood sections.",
      "costDuration": "Moderate | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Apply anti-termite wood preservative.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "crack_along_anchor_bolts_metal",
    "label": "Crack along the bolt-pipe",
    "severity": "MED",
    "rootCause": "Picture indicates localized cracking propagating from anchor bolt holes in the concrete base. This cracking is caused by excessive tightening torque, shear/tensile overload on the structural metal connection, or localized stress concentrations from insufficient edge distance.",
    "furtherInvestigation": "We should further investigate by verifying anchor bolt torque settings, checking for corrosion on the steel anchor shafts, and performing ultrasonic testing on surrounding concrete to check for internal micro-cracking and cone failure.",
    "futureSolution": "Remove the load from the anchor, chip out damaged concrete around the bolt, install a replacement anchor bolt if required, and grout the connection pocket using a high-strength non-shrink epoxy structural grout to ensure proper load transfer.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Re-anchor bolts and grout with epoxy.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Surface paste repair on cracked edge.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "crack_settlement_masonry",
    "label": "Crack-settlement-shear Masonry",
    "severity": "HIGH",
    "rootCause": "Picture indicates diagonal or stair-stepped cracks in the brick masonry wall, indicating differential settlement of the building foundation. The displacement occurs because of uneven soil bearing capacities, moisture variations in clay soils, or structural loading exceeding the foundation capacity.",
    "furtherInvestigation": "We should further investigate by conducting foundation level surveys, checking for plumbing leaks beneath the slab, and performing soil bore tests to evaluate bearing capacity. Install tell-tale crack monitoring gauges to determine if the settlement is active or completed.",
    "futureSolution": "If the settlement is active, perform foundation underpinning using micropiles or chemical grouting to stabilize the subgrade soil. Once stabilized, repair the masonry cracks by inserting helical stainless steel reinforcement bars (crack stitching) into routed bed joints and grouting with structural mortar.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Foundation underpinning and structural tie installation.",
      "costDuration": "Premium | 7 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Stitching cracks with steel dowels.",
      "costDuration": "Moderate | 3 Days"
    }
  },
  {
    "code": "crack_in_plain_masonry",
    "label": "Crack- In-plane masonry",
    "severity": "LOW",
    "rootCause": "Picture indicates vertical or horizontal cracks passing through mortar joints and bricks in the plain masonry wall. These cracks are caused by temperature variations, moisture shrinkage, or minor structural movements in the wall without steel tie reinforcements.",
    "furtherInvestigation": "We should further investigate by checking wall verticality using a plumb bob or laser level. Use hammer tapping to check for hollow spaces between plaster and masonry, and check for foundation settlement signs nearby.",
    "futureSolution": "Rout the cracks to a minimum depth of 20mm, clean out mortar debris, and tuckpoint/fill using non-shrink structural grout or polymer-modified cement mortar. For larger cracks, apply crack-stitching helical bars into the joint beds.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Helical tie installation in brickwork.",
      "costDuration": "Moderate | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Chop crack and tuckpoint with mortar.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "dry_dampness_in_masonry",
    "label": "Dry Dampness-in Masonry",
    "severity": "LOW",
    "rootCause": "Picture indicates that the masonry wall has experienced historic dampness which is currently dry but has left visible dampness stains, efflorescence marks, or paint peeling on the plaster surface. The dampness was likely caused by water seepage through external walls, rising damp from ground level, or leaking plumbing lines embedded within the wall. The plaster layer may have lost its bond with the masonry substrate due to prolonged moisture exposure and salt crystallization behind the plaster.",
    "furtherInvestigation": "We should further investigate by conducting a dampness level survey using a surface moisture meter to confirm the current dry status and identify any residual trapped moisture. Hammer tapping should be performed across the affected area to map delaminated and hollow-sounding plaster zones. The source of previous dampness should be traced and confirmed as permanently resolved before undertaking any repair work.",
    "futureSolution": "All affected plaster in the delaminated zone should be chopped off completely down to the masonry surface and the exposed brickwork should be cleaned and wetted. Fresh plaster should be applied using a waterproof plastering mix with approved waterproof admixture in proper sand-cement ratio. If dampness recurrence is a concern, an additional moisture barrier coating or a crystalline waterproofing slurry can be applied on the masonry surface before replastering.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Full replastering with waterproof additive.",
      "costDuration": "Moderate | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Patch plastering and painting.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "surface_voids_bughole",
    "label": "Surface Voids- Bughole",
    "severity": "LOW",
    "rootCause": "Picture indicate that concrete surface has few bugholes which might be result of the excess cement water ratio or usage of air entrant admixture or faster rate of hydration",
    "furtherInvestigation": "It falls under the non structure distress category and also it has no major impact on the durability of the structure there is no need of furthur investigation unless spacing of multple bugholes are closer",
    "futureSolution": "Spacing of the bugholes are closer and uniformly over the surfce of the concrete then protective coating is required",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 85,
      "scope": "Apply protective polymer-modified cosmetic plaster coating uniformly over the entire surface area.",
      "costDuration": "Moderate Cost | 2 Days Execution"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 88,
      "scope": "Fill bug holes locally with high-strength cementitious putty and apply a standard acrylic sealer.",
      "costDuration": "Low Cost | 1 Day Execution"
    }
  },
  {
    "code": "surface_voids",
    "label": "Surface Voids",
    "severity": "LOW",
    "rootCause": "Picture indicate that concrete surface has surface voids which might be result of the poor formwork and localized compaction issue or leakage of cement slurry during pouring of the concrete",
    "furtherInvestigation": "It falls under the non structure distress category but it has minor impact on the durablility of the structure there is need of furthur investigation to know whether voids is upto reinforcement level or not",
    "futureSolution": "If surface voids is not upto the reinforcement level then only patch motar should be used for resurfacing of the concrete after removal of the loose part of the concrete.If surface void is upto the reinforcement level then grouting shoudle be used before resurfcaing of the concrete with patch motar",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Pressure grout the deep void channels with cementitious slurry, and overlay with polymer-modified mortar.",
      "costDuration": "Moderate Cost | 3 Days Execution"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 82,
      "scope": "Apply cosmetic surface plaster patch mortar to shallow voids after removing loose particles.",
      "costDuration": "Low Cost | 1 Day Execution"
    }
  },
  {
    "code": "surface_voids_honeycombing",
    "label": "Surface Voids-Honey Combing",
    "severity": "MED",
    "rootCause": "Picture indicate that concrete surface has surface voids which might be result of the poor formwork and localized compaction issue or leakage of cement slurry or poor workability of the concrete during pouring of the concrete",
    "furtherInvestigation": "It falls under the non structure distress category if honeycombing is localized but in the case of honeycombing is throughout the length of the structural member then it should be considered as structural issue ,then area of the honeycombed portion and the visibility of the reinforced portion will enhance the vernabilityof the srtress",
    "futureSolution": "Localized honeycombed area can be repaired with patchmortar following the grouting but arger area of the honeycombed portion should be reapired with RCC jacketing follwing the routing",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 94,
      "scope": "Enlarge concrete section via RCC structural jacketing combined with non-shrink high-flow grouting.",
      "costDuration": "Premium Cost | 5 Days Execution"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 76,
      "scope": "Perform localized pressure grouting with low-viscosity epoxy resin and apply cosmetic patch mortar.",
      "costDuration": "Moderate Cost | 2 Days Execution"
    }
  },
  {
    "code": "crack_without_corrosion",
    "label": "Crack Without Corrosion",
    "severity": "LOW",
    "rootCause": "Picture indicates dry structural or shrinkage cracks in the concrete member without any rust staining, indicating that the reinforcement is not yet corroded. These cracks are caused by drying shrinkage, plastic settlement, or transient loading that exceeds the concrete tensile strength but has not exposed the steel to active water or chlorides.",
    "furtherInvestigation": "We should further investigate by mapping the crack widths and depths using a crack width microscope and ultrasonic testing. Check if the crack is active or stable under load variations, and perform a carbonation depth test to check if the carbonation front has reached the reinforcement zone.",
    "futureSolution": "For stable cracks wider than 0.3mm, clean the crack path and pressure-inject low-viscosity structural epoxy resin to seal the concrete against future ingress of water and air. For hairline cracks, apply a surface-applied penetrating silane-siloxane sealer or elastomeric protective coating.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Pressure epoxy injection.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Surface sealing with epoxy putty.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "crack_along_conduit_masonry",
    "label": "Crack-Along the Conduit-Masonry",
    "severity": "LOW",
    "rootCause": "Picture indicates a straight crack running along the path of an embedded electrical or plumbing conduit in the masonry wall. This crack is caused by the shallow cover of plaster over the conduit, creating a plane of weakness, combined with thermal movement or vibration of the conduit itself.",
    "furtherInvestigation": "We should further investigate by removing plaster locally to inspect the conduit depth and verify if it was properly secured to the masonry wall using saddles. Hammer tap the crack edges to check for plaster delamination and hollow spaces along the conduit route.",
    "futureSolution": "Chop the plaster along the conduit path, secure the conduit firmly with metal saddles, cover the conduit groove with a heavy-duty galvanized wire mesh or fiberglass mesh extending 100mm on both sides, and replaster using high-strength polymer-modified mortar.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Mesh cladding and plastering.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Fill crack with fiber-reinforced putty.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "torsional_crack_rcc",
    "label": "Torsional-Crack-RCC",
    "severity": "HIGH",
    "rootCause": "Picture indicates continuous spiral cracks twisting around the longitudinal axis of the RCC beam. These cracks are caused by excessive torsional loading exceeding the torsional resistance of the section, due to eccentric loads, frame action, or lack of closed stirrups.",
    "furtherInvestigation": "We should further investigate by analyzing the load eccentricity and checking longitudinal and transverse reinforcement design details. Conduct concrete core compression tests and perform ultrasonic scanning to check internal crack depths.",
    "futureSolution": "Pressure-inject the spiral cracks with structural epoxy resin to restore concrete shear transfer, and wrap the beam in a continuous structural carbon fiber jacket (CFRP) oriented at 45 degrees to resist torsional shear stresses.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Epoxy injection followed by full CFRP wrap.",
      "costDuration": "Premium | 4 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Epoxy grout injections and steel jacketing.",
      "costDuration": "Moderate | 3 Days"
    }
  },
  {
    "code": "oxidation_of_steel",
    "label": "Oxidation-of Steel",
    "severity": "MED",
    "rootCause": "Picture indicates surface rust and oxidation scaling on the steel structural element. This corrosion is caused by direct exposure of bare steel to atmospheric oxygen and moisture, which occurs when the original protective coating degrades or is damaged.",
    "furtherInvestigation": "We should further investigate by measuring the remaining steel section thickness using an ultrasonic thickness gauge. Compare the measured thickness to the original design details to calculate structural capacity loss, and check for deep pitting.",
    "futureSolution": "Mechanically clean the steel surface using wire brushes, needle scalers, or sandblasting to remove all rust scales. Apply a high-performance zinc-rich epoxy primer followed by a protective epoxy mastic barrier coating and polyurethane topcoat.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Metal sandblasting and galvanization.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Manual rust scraping and protective coating.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "loosening_rivet_steel_connections",
    "label": "Loosening-Rivet-Steel Connections",
    "severity": "HIGH",
    "rootCause": "Picture indicates gaps, rust bleeding, or movement marks around rivet heads in the steel joint. This rivet loosening is caused by cyclic structural load fatigue, corrosion expansion within the rivet shank, or long-term joint relaxation.",
    "furtherInvestigation": "We should further investigate by performing a hammer strike test on individual rivet heads to detect movement or hollow sounds. Check joint slippage and calculate joint shear and bearing stresses under service loads.",
    "futureSolution": "Remove the loose and corroded rivets by drilling out the heads. Clean the rivet holes and replace them with high-strength friction grip (HSFG) structural bolts tightened to the specified design torque to restore joint shear capacity.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Replace rivets with structural HSFG bolts.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Weld reinforcing joints around rivets.",
      "costDuration": "Moderate | 1 Day"
    }
  },
  {
    "code": "welding_porosity",
    "label": "Welding-Porosity",
    "severity": "MED",
    "rootCause": "Picture indicates fine pinholes or gas pocket voids cluster on the surface of the weld bead. This weld defect is caused by gas entrapment in the weld pool during solidification, due to high moisture, wind shielding gas disruption, or surface contamination.",
    "furtherInvestigation": "We should further investigate by performing dye penetrant testing (DPT) to locate all surface-breaking pores. Conduct ultrasonic testing (UT) or radiographic testing (RT) to map out any internal sub-surface porosity cluster.",
    "futureSolution": "Grind down the porous weld section until sound base metal is reached. Thoroughly clean the weld joint, dry the welding electrodes, and re-weld the joint using proper gas shielding parameters and travel speeds.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Grind and re-weld with UT certification.",
      "costDuration": "Moderate | 1 Day"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Grind and re-weld segment.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "welding_cracks",
    "label": "Welding-Cracks",
    "severity": "HIGH",
    "rootCause": "Picture indicates linear cracking running along the centerline or toe of the weld bead. These weld cracks are caused by high tensile stresses during cooling (solidification cracking) or hydrogen embrittlement (cold cracking) in thick constrained joint configurations.",
    "furtherInvestigation": "We should further investigate by conducting ultrasonic testing (UT) or magnetic particle testing (MPT) to find crack depth and propagation path. Check joint restraint conditions and steel carbon equivalence.",
    "futureSolution": "Gouge out the cracked weld section entirely using carbon-arc gouging or mechanical grinding. Preheat the joint base metal to the specified temperature, and re-weld using low-hydrogen electrodes followed by controlled slow cooling.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Full weld gouging and certified re-welding.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Patch weld grinding and re-welding.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "welding_lack_of_fusion",
    "label": "Welding-Lack of Fusion",
    "severity": "HIGH",
    "rootCause": "Picture indicates separation gaps at the boundary between the weld metal and base metal. This defect is caused by insufficient heat input, improper electrode angle, or high travel speed, preventing the base metal from melting and bonding with the weld pool.",
    "furtherInvestigation": "We should further investigate by performing ultrasonic testing (UT) to trace the extent of the un-fused boundary along the weld seam. Audit welding parameters (current, voltage, and travel speed) used in construction.",
    "futureSolution": "Grind or gouge out the weld segment showing lack of fusion. Clean the weld groove, adjust the welding machine parameters to provide adequate heat input, and re-weld using proper torch angle techniques.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Certified grind and re-weld.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Localized grind and re-weld.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "welding_undercut",
    "label": "Welding-Undercut",
    "severity": "MED",
    "rootCause": "Picture indicates a groove or channel melted into the base metal along the toe of the weld bead. This defect is caused by excessive welding current, high arc voltage, or improper electrode manipulation that washes away base metal without replacing it with weld metal.",
    "furtherInvestigation": "We should further investigate by measuring the undercut depth using a weld fillet gauge. Conduct visual inspections and dye penetrant testing to verify if any cracks have initiated in the undercut groove zone.",
    "futureSolution": "Clean the undercut groove and lay a thin filler weld run (weld bead) along the weld toe using a smaller diameter electrode to fill the groove flush with the base metal surface. Grind smooth to transition structural profiles.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Weld fill undercut with matching electrode.",
      "costDuration": "Moderate | 1 Day"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Fill undercut with weld bead.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "welding_overlap",
    "label": "Welding-Overlap",
    "severity": "LOW",
    "rootCause": "Picture indicates weld metal protruding over the base metal surface without fusing at the toe. This defect is caused by low welding current, incorrect travel angle, or high weld deposition rates, allowing molten metal to overflow onto cooler un-melted base metal.",
    "furtherInvestigation": "We should further investigate by performing magnetic particle testing (MPT) or dye penetrant testing (DPT) to confirm if the overlap conceals any toe cracks or slag lines beneath the excess weld bead profile.",
    "futureSolution": "Carefully grind away the excess weld overlap protrusion using a grinding wheel held at a shallow angle, ensuring a smooth profile transition into the base metal without gouging or reducing the parent metal thickness.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Grind overlap and inspect fusion.",
      "costDuration": "Moderate | 1 Day"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Manual grinding of excess metal.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "welding_spatter",
    "label": "Welding-Spatter",
    "severity": "LOW",
    "rootCause": "Picture indicates small, spherical metal droplets solidified on the parent plate surface adjacent to the weld bead. This spatter is caused by excessive arc current, incorrect polarity, magnetic arc blow, or damp electrode flux coating.",
    "furtherInvestigation": "We should further investigate by visual inspection to check if the spatter is loose or firmly bonded, and inspect if any spatter clusters have caused localized surface pitting on corrosion-sensitive steel sections.",
    "futureSolution": "Chip off the weld spatter using a chipping hammer or wire brush. For tightly bonded spatter, grind the parent metal surface lightly until smooth, and apply a protective paint coating to prevent corrosion pitting.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Grind spatter and paint surface.",
      "costDuration": "Moderate | 1 Day"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Manual chipping and scraping.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "welding_slag_inclusion",
    "label": "Welding-Slag Inclusion",
    "severity": "MED",
    "rootCause": "Picture indicates non-metallic slag particles trapped inside the weld metal. This defect occurs when multi-pass welds are made without cleaning the slag between runs, or due to improper electrode angle or low current leaving slag trapped in the weld root.",
    "furtherInvestigation": "We should further investigate by conducting ultrasonic testing (UT) or radiographic testing (RT) to determine the size and depth of slag lines inside the joint. Check if the slag inclusions form continuous lines that compromise shear capacity.",
    "futureSolution": "Grind or carbon-arc gouge out the weld metal containing the slag inclusions. Clean the joint faces thoroughly using a wire brush or slag hammer, and re-weld the joint using correct heat input and inter-pass cleaning procedures.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Grind out slag and re-weld.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Grind slag and fill weld.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "welding_penetration",
    "label": "Welding-Penetration",
    "severity": "MED",
    "rootCause": "Picture indicates insufficient root penetration or excessive melt-through at the root of the welded joint. This is caused by improper root gap setting, incorrect electrode size, low welding current, or high travel speed, leaving a notch-like stress concentration.",
    "furtherInvestigation": "We should further investigate by conducting ultrasonic testing (UT) or visual inspection of the root side if accessible. Measure the depth of unpenetrated root face and verify weld qualification logs.",
    "futureSolution": "Grind out the weld root area from the back side, clean the groove, and lay a backing weld run to achieve full joint penetration. If inaccessible, gouge out the weld completely and re-weld with correct root gap parameters.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Certified capping weld run.",
      "costDuration": "Moderate | 1 Day"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Grind and corrective weld run.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "welding_underfill",
    "label": "Welding-Underfill",
    "severity": "MED",
    "rootCause": "Picture indicates that the weld face is below the surface level of the adjacent base metal plates. This underfill defect is caused by the welder failing to deposit sufficient filler metal passes to fill the weld groove joint completely.",
    "furtherInvestigation": "We should further investigate by measuring the underfill depth and length using a weld throat gauge. Check if the reduced weld throat thickness compromises the design load capacity of the welded connection.",
    "futureSolution": "Clean the weld face of slag and contaminants. Pre-heat if required, and deposit additional weld runs to build up the weld face to or slightly above the base metal surface, ensuring a smooth profile transition.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Build up weld face with add-on passes.",
      "costDuration": "Moderate | 1 Day"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Add weld run.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "welding_excess_reinforcement",
    "label": "Welding-Excess Reinforcement",
    "severity": "LOW",
    "rootCause": "Picture indicates excessive weld metal buildup (high reinforcement height) on the face of the butt joint. This is caused by slow travel speed, low current, or excessive filler metal addition, which creates an abrupt change in cross-section.",
    "furtherInvestigation": "We should further investigate by measuring the height of excess reinforcement using a weld profile gauge. Inspect the toe angles to check for stress concentrations or sharp notches at the weld toe boundaries.",
    "futureSolution": "Grind down the excess weld metal reinforcement flush or to a maximum height of 1.5mm above the base plate surface, ensuring a smooth, gradual transition profile from the weld face to the parent metal.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Precision grinding flush.",
      "costDuration": "Moderate | 1 Day"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Manual grinding.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "welding_burn_through",
    "label": "Welding-Burn Through",
    "severity": "HIGH",
    "rootCause": "Picture indicates an open hole or melt-through void in the root of the weld joint. This burn-through is caused by excessive welding current, slow travel speed, or too large a root gap, allowing the arc to melt completely through the base metal thickness.",
    "furtherInvestigation": "We should further investigate by inspecting the back side of the joint for excess hanging metal drops. Conduct dye penetrant testing (DPT) to check for cracks extending from the edge of the burn-through hole.",
    "futureSolution": "Grind out the defective weld area to form a clean groove. Install a temporary or permanent backing plate underneath, and re-weld the opening using low current parameters to prevent further melt-through.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Weld backing plates and complete re-weld.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Localized patch plate welding.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "welding_arc_strike",
    "label": "Welding-Arc Strike",
    "severity": "LOW",
    "rootCause": "Picture indicates localized heat marks and micro-pits on the steel base plate outside the weld groove. This is caused by the welder accidentally striking the arc on the parent metal, creating localized heating and rapid cooling that forms brittle martensite.",
    "furtherInvestigation": "We should further investigate by conducting magnetic particle testing (MPT) or acid etching over the arc strike zone to check for micro-cracks. Check if the strike is on high-tensile fatigue-sensitive steel members.",
    "futureSolution": "Carefully grind the arc strike spot until a smooth surface is restored and the hardened micro-structural layer is removed. Perform MPT to confirm that no cracks remain, and apply a protective paint coating.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Grind strike and check crack integrity.",
      "costDuration": "Moderate | 1 Day"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Grind strike marks.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "welding_crater_crack",
    "label": "Welding-Crater Crack",
    "severity": "MED",
    "rootCause": "Picture indicates star-shaped or radial cracks inside the shrinkage crater at the termination point of the weld run. These crater cracks are caused by shrinkage stresses pulling the metal apart during rapid cooling of the weld pool.",
    "furtherInvestigation": "We should further investigate by using a magnifying loupe and performing dye penetrant testing (DPT) to determine crack length. Verify if the crack propagates from the crater into the main weld run.",
    "futureSolution": "Grind out the weld crater completely to sound metal. Re-weld the termination point, ensuring the crater is filled by using a proper crater-fill welding technique (such as back-stepping or holding the arc at termination).",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Grind and fill crater with UT test.",
      "costDuration": "Moderate | 1 Day"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Grind and patch fill crater.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "welding_excessive_convexity",
    "label": "Welding-Excessive Convexity",
    "severity": "LOW",
    "rootCause": "Picture indicates an excessively rounded or bulged weld face profile in a fillet weld. This excessive convexity is caused by low welding current, high travel speed, or incorrect electrode manipulation that prevents the weld metal from wetting the joint faces.",
    "furtherInvestigation": "We should further investigate by measuring the convexity height and throat thickness using a weld fillet gauge. Check if the re-entrant toe angle is too sharp, which acts as a stress raiser.",
    "futureSolution": "Grind the face of the fillet weld using a grinding disc to reduce the profile convexity to a smooth, flat, or slightly concave contour, ensuring a gradual profile transition at both weld toes.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Precision grinding contour.",
      "costDuration": "Moderate | 1 Day"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Grind weld profile to smooth flat contour.",
      "costDuration": "Low | 1 Day"
    }
  },
  {
    "code": "welding_misalignment",
    "label": "Welding-Misalignment",
    "severity": "HIGH",
    "rootCause": "Picture indicates that the joint plates are mismatched and welded out-of-plane. This misalignment is caused by poor fit-up, inadequate tack welding, or lack of structural clamping fixtures during assembly, leading to eccentric bending under load.",
    "furtherInvestigation": "We should further investigate by measuring the linear offset at the joint using a bridge-cam gauge. Perform ultrasonic testing (UT) to check if the root of the weld is properly fused despite the mismatch.",
    "futureSolution": "For critical members, cut the welded joint, re-align the steel plates using hydraulic jacks or alignment clamps, tack-weld securely, and re-weld. For less critical joints, reinforce the step using a tapered transition weld overlay.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Joint cutting, alignment and re-welding.",
      "costDuration": "Premium | 3 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Reinforce joint with side gusset plates.",
      "costDuration": "Moderate | 2 Days"
    }
  },
  {
    "code": "welding_oxidation",
    "label": "Welding-Oxidation",
    "severity": "MED",
    "rootCause": "Picture indicates a dark, scaly, or heavily discolored weld bead surface (often with a 'burned' appearance). This oxidation is caused by loss of shielding gas coverage during welding, high heat input, or welding on dirty, contaminated steel surfaces.",
    "furtherInvestigation": "We should further investigate by performing wire brushing to check if the oxidation is superficial. Conduct dye penetrant testing (DPT) to check for surface-breaking micro-cracks or porosity in the oxidized weld layer.",
    "futureSolution": "Grind away the heavily oxidized surface layer of the weld bead until shiny, sound metal is exposed. Re-inspect using DPT, and if any defects remain, grind the weld down to the parent metal and re-weld under proper shielding.",
    "remediationA": {
      "title": "Advanced Structural Retrofitting",
      "match": 90,
      "scope": "Grind and re-lay weld run.",
      "costDuration": "Moderate | 2 Days"
    },
    "remediationB": {
      "title": "Cost-Effective Maintenance Repair",
      "match": 75,
      "scope": "Grind oxidized parts.",
      "costDuration": "Low | 1 Day"
    }
  }
];

// POST and RCC share the post-construction catalogue; PRE has its own.
export function taxonomyFor(phase: DefectPhase): DefectDef[] {
  return phase === 'PRE' ? PRE_DEFECTS : POST_DEFECTS;
}

export const DEFECTS_BY_CODE: Record<string, DefectDef> = Object.fromEntries(
  [...PRE_DEFECTS, ...POST_DEFECTS].map((d) => [d.code, d]),
);
