<template>
  <div class="col">
    <div class="page-grid">
      <section class="info-card" style="font-size: 1.2em">
        <strong>CalR</strong>
        <p>
          Analysis of indirect calorimetry experiments requires specialized statistical treatment to account
          for differential contributions of fat mass and lean mass to metabolic rates.
        </p>
        <p>
          CalR is designed to help scientists translate these guidelines into practice and provide
          standardized methods for reproducible research.
        </p>
      </section>
    </div>
    <div class="page-grid page-grid--three">
      <section class="info-card">
        <strong>Standardization</strong>
        <p>
          Upload your calorimetry instrument data to standardize into a single harmonized format, ready for analysis on CalR. 
        </p>
        <ul>
          <li>Standardized units</li>
          <li>Animal metadata</li>
          <li>Experimental metadata</li>
          <li>Quality control</li>
          <li>Data visualizations</li>
        </ul>
        <div class="mt-auto pt-2 d-flex justify-content-end">
          <RouterLink to="/account" class="btn btn-sm btn-outline-primary">Login or Sign Up</RouterLink>
        </div>
      </section>
  
      <section class="info-card">
        <strong>Analysis</strong>
         <p>
          Generate customizable time plots, box plots, cumulative energy balance plots, and regression-based analyses from a single workflow.
        </p>
        <ul>
          <li>Compatible</li>
          <li>Fast</li>
          <li>Customizable</li>
          <li>Standardized</li>
          <li>Transparent</li>
          <li>Adaptable</li>
        </ul>
        <div class="mt-auto pt-2 d-flex justify-content-end">
          <RouterLink to="/analysis" class="btn btn-sm btn-outline-primary">See Analyses</RouterLink>
        </div>
      </section>
  
      <section class="info-card">
        <strong>Community Repository</strong>
        <p>
          Contribute your data to the CalR community to compare your experiment with other calorimetry
          experiments.
        </p>
        <ul>
          <li>Uploaded by the community</li>
          <li>FAIR data principles</li>
          <li>Standardized framework and metadata</li>
          <li>Search</li>
          <li>Compare</li>
        </ul>
        <div class="mt-auto pt-2 d-flex justify-content-end">
          <RouterLink to="/community" class="btn btn-sm btn-outline-primary">Compare Datasets</RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HomeView',
}
</script>
