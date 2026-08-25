// Community plot presets.
//
// A preset is a starting point for a question, expressed purely in terms of
// standardized column roles — never dataset ids or dataset-specific filter
// values. That keeps every preset usable on any dataset that follows the
// standard, including ones added later.
//
// Where a reference figure also needed a particular subset of animals, that
// step is noted in a comment rather than encoded, because the values that
// matter differ from one experiment to the next.
//
// `requires` lists the columns a preset needs, so it can be offered or
// explained against whatever is currently selected.

export const COMMUNITY_PRESETS = [
  {
    id: 'age-cohorts',
    // Reference figure: Panel A
    title: 'Age Cohort Comparison',
    description:
      'Energy expenditure against body mass, split into a panel per treatment and colored by age cohort. Shows whether a treatment changes metabolic rate as animals age.',
    // Manual step: Filter Treatment to the groups you want to compare.
    requires: ['body_mass_g', 'energy_expenditure_kcal_hr', 'age', 'treatment'],
    facetRequirement: 'treatment',
    config: {
      photoperiod: 'Full day',
      xVar: 'body_mass_g',
      yVar: 'energy_expenditure_kcal_hr',
      colorBy: 'age',
      numericColorMode: 'natural',
      facetBy: 'treatment',
      fitType: 'linear',
      fitScope: 'group',
      showEquations: false,
    },
  },
  {
    id: 'strain-survey',
    // Reference figure: Panel B
    title: 'Strain Survey',
    description:
      'Energy expenditure against body mass across strains, with one non-linear trend through every animal. Shows the population mass–EE relationship without assuming it is a straight line.',
    requires: ['body_mass_g', 'energy_expenditure_kcal_hr', 'strain'],
    config: {
      photoperiod: 'Light',
      xVar: 'body_mass_g',
      yVar: 'energy_expenditure_kcal_hr',
      colorBy: 'strain',
      facetBy: '',
      fitType: 'loess',
      fitScope: 'overall',
      showEquations: false,
    },
  },
  {
    id: 'group-regressions',
    // Reference figure: Panel C
    title: 'Group Regressions',
    description:
      'Energy expenditure against body mass with a separate regression per experimental group and the fitted equations printed on the plot. Use it to compare slopes and intercepts between groups.',
    requires: ['body_mass_g', 'energy_expenditure_kcal_hr', 'group'],
    config: {
      photoperiod: 'Full day',
      xVar: 'body_mass_g',
      yVar: 'energy_expenditure_kcal_hr',
      colorBy: 'group',
      facetBy: '',
      fitType: 'linear',
      fitScope: 'group',
      showEquations: true,
    },
  },
  {
    id: 'ambient-temperature',
    // Reference figure: Panel D
    title: 'Ambient Temperature',
    description:
      'Energy expenditure against body mass with a regression per housing temperature, colored along a temperature scale. Shows how ambient temperature shifts metabolic rate.',
    // Manual step: Switch the color scale to Gradient for a continuous colorbar instead of one fit per temperature.
    requires: ['body_mass_g', 'energy_expenditure_kcal_hr', 'ambient_temperature_c'],
    config: {
      photoperiod: 'Full day',
      xVar: 'body_mass_g',
      yVar: 'energy_expenditure_kcal_hr',
      colorBy: 'ambient_temperature_c',
      numericColorMode: 'natural',
      facetBy: '',
      fitType: 'linear',
      fitScope: 'group',
      showEquations: false,
    },
  },
]
