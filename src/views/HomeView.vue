<template>
  <div class="home-page">

    <section class="home-hero" style="padding-bottom:20px">
      <!--<div class="home-eyebrow">Calorimetry Research Platform</div>-->
      <h1 class="home-title">CalRepository</h1>
      <!--
      <p class="home-subtitle">
        Upload raw calorimetry data, run reproducible ANCOVA-based analyses,
        and compare your experiments with a growing community repository.
      </p>
      -->
      <!--
      <div class="home-hero-actions">
        <RouterLink to="/analysis" class="btn btn-primary">Start Analyzing</RouterLink>
        <RouterLink to="/community" class="btn btn-outline-secondary">Browse Community</RouterLink>
      </div>
      -->
    </section>

    <div class="col" style="gap: 16px; padding: 0 100px 60px;">
      <div class="home-section-header">
        <p class="home-section-kicker" style="padding-bottom:20px;">Calorimetry Research Platform</p>
        <!--
        <h2 class="home-section-title">Calorimetry Research Platform</h2>
        -->
        <!--
        <p class="home-section-subtitle">Import, standardize, quality-control, save, visualize, analyze, share, and compare indirect calorimetry data.</p>
        -->
      </div>

      <div class="page-grid page-grid--three">

        <section class="info-card">
          <div class="home-feature-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <h3 class="home-card-heading">Upload</h3>
          <p>
            Upload your indirect calorimetry data and standardize it into a single harmonized format. Save experiments to your account for reuse and sharing.
          </p>
          <ul>
            <li>Multi-instrument support</li>
            <li>Standardized units & metadata</li>
            <li>Quality control</li>
            <li>Save to your account</li>
            <li>Share with collaborators</li>
          </ul>
          <div class="mt-auto pt-2 d-flex justify-content-end">
            <RouterLink to="/account" class="btn btn-outline-primary">Create Account</RouterLink>
          </div>
        </section>

        <section class="info-card">
          <div class="home-feature-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <h3 class="home-card-heading">Analyze</h3>
          <p>
            Generate customizable time plots, box plots, cumulative energy balance plots, and regression-based analyses — all from a single workflow.
          </p>
          <ul>
            <li>ANCOVA-corrected regression</li>
            <li>Time-series & distribution plots</li>
            <li>Cumulative energy balance</li>
            <li>Customizable & reproducible</li>
            <li>Transparent methodology</li>
          </ul>
          <div class="mt-auto pt-2 d-flex justify-content-end">
            <RouterLink to="/analysis" class="btn btn-outline-primary">Browse Analyses</RouterLink>
          </div>
        </section>

        <section class="info-card">
          <div class="home-feature-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h3 class="home-card-heading">Compare</h3>
          <p>
            Contribute your datasets to the CalR community and compare your results against experiments from researchers worldwide.
          </p>
          <ul>
            <li>Publicly shared datasets</li>
            <li>FAIR data principles</li>
            <li>Standardized metadata</li>
            <li>Search & filter</li>
            <li>Side-by-side comparison</li>
          </ul>
          <div class="mt-auto pt-2 d-flex justify-content-end">
            <RouterLink to="/community" class="btn btn-outline-primary">Compare Results</RouterLink>
          </div>
        </section>

      </div>
    </div>

  </div>
</template>

<script>
export default {
  name: 'HomeView',
}
</script>
