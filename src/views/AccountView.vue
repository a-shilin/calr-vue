<template>
  <div class="page-column" style="gap:20px;">
    <div class="page-header">
      <p class="page-kicker">CalRepository</p>
      <h1 class="page-title">Account</h1>
    </div>
    <!--
    <section v-if="store.auth.token" class="panel panel--spaced">
      <div class="row-between">
          <div>
            Logged in as <strong>{{ store.auth.userInfo?.user?.username }}</strong>
          </div>
          <button class="btn btn-outline-secondary btn-sm" @click="handleLogout">Logout</button>
        </div>
    </section>
    -->
    <section class="panel panel--spaced">
      <div v-if="!store.auth.token" class="row-between login-layout">
        <div class="login-copy">
          <p>
            Log in to upload, standardize, and analyze your own data. Then contribute to the CalR community repository.
          </p>
        </div>

        <div class="login-card">
          <div class="card-tabs">
            <button class="card-tab-2" :class="{ active: store.auth.mode === 'login' }" @click="setAuthMode('login')">
              Login
            </button>
            <button class="card-tab-2" :class="{ active: store.auth.mode === 'create' }" @click="setAuthMode('create')">
              Create Account
            </button>
          </div>
          <div class="login-body">
            <form v-if="store.auth.mode === 'login'" class="login-form" key="login-form" @submit.prevent="handleLogin">
              <div class="field-grid">
                <label class="field-grid__label">Email</label>
              <input
                v-model="store.auth.username"
                name="login_email"
                type="text"
                autocomplete="username"
                placeholder="Username or email"
              />
                <label class="field-grid__label">Password</label>
                <input
                  v-model="store.auth.password"
                  name="login_password"
                  type="password"
                  autocomplete="current-password"
                  placeholder="Password"
                />
              </div>
              <button
                class="btn btn-primary"
                :disabled="store.loaders.login || store.loaders.createAccount"
                type="submit"
              >
                <BSpinner v-if="store.loaders.login" small />
                <span v-else>Login</span>
              </button>
            </form>
  
            <form v-else key="create-form" autocomplete="off" class="login-form" @submit.prevent="handleCreateAccount">
              <div class="field-grid">
                <label class="field-grid__label">Email</label>
                <input
                  v-model="store.auth.username"
                  name="create_email"
                  type="email"
                  autocomplete="off"
                />
                <label class="field-grid__label">Password</label>
                <input
                  v-model="store.auth.password"
                  name="create_password"
                  type="password"
                  autocomplete="new-password"
                />
              </div>
              <button
                class="btn btn-primary"
                :disabled="store.loaders.login || store.loaders.createAccount"
                type="submit"
              >
                <BSpinner v-if="store.loaders.createAccount" small />
                <span v-else>Create Account</span>
              </button>
            </form>
  
            <div v-if="store.auth.message" class="message-text">{{ store.auth.message }}</div>
          </div>
        </div>
      </div>

      <template v-else>
        <div class="page-column" v-if="store.auth.token && store.account.userCreatingNew">
          <div>
            <div class="row-between">
              <div>
                <h2 class="section-title">{{ isEditingExperiment ? 'Edit Experiment' : 'Create New Experiment' }}</h2>
              </div>
              <div class="button-row" style="align-items: center;">
                <span class="status-tooltip builder-action-tooltip" tabindex="0">
                  <button
                    class="btn"
                    :class="canSaveExperiment && !store.loaders.uploadExperiment ? 'btn-primary' : 'btn-outline-secondary'"
                    :disabled="store.loaders.uploadExperiment || !canSaveExperiment"
                    @click="saveExperiment"
                  >
                    <BSpinner v-if="store.loaders.uploadExperiment" small />
                    <span v-else>Save</span>
                  </button>
                  <span class="status-tooltip__panel builder-action-tooltip__panel" role="tooltip">
                    <span class="builder-action-tooltip__title">To save</span>
                    <ul class="builder-action-tooltip__list">
                      <li v-for="item in saveRequirementChecklist" :key="item.label" class="builder-action-tooltip__item">
                        <i
                          class="bi"
                          :class="item.complete ? 'bi-check-circle-fill builder-action-tooltip__icon--complete' : 'bi-circle builder-action-tooltip__icon--incomplete'"
                        ></i>
                        <span>{{ item.label }}</span>
                      </li>
                    </ul>
                  </span>
                </span>
                <span v-if="builderExperimentRecord" class="status-tooltip builder-action-tooltip" tabindex="0">
                  <button
                    class="btn builder-action-icon-btn"
                    :class="shareButtonClass"
                    :disabled="!canShareFromBuilder"
                    aria-label="Share"
                    @click="openBuilderShareDialog"
                  >
                    <i class="bi bi-share"></i>
                  </button>
                  <span class="status-tooltip__panel builder-action-tooltip__panel" role="tooltip">
                    <span class="builder-action-tooltip__title">To share</span>
                    <ul class="builder-action-tooltip__list">
                      <li v-for="item in shareRequirementChecklist" :key="item.label" class="builder-action-tooltip__item">
                        <i
                          class="bi"
                          :class="item.complete ? 'bi-check-circle-fill builder-action-tooltip__icon--complete' : 'bi-circle builder-action-tooltip__icon--incomplete'"
                        ></i>
                        <span>{{ item.label }}</span>
                      </li>
                    </ul>
                  </span>
                </span>
                <span v-if="builderExperimentRecord" class="status-tooltip builder-action-tooltip" tabindex="0">
                  <button
                    class="btn builder-action-icon-btn"
                    :class="contributeButtonClass"
                    :disabled="!canContributeFromBuilder && !builderExperimentIsPublic"
                    aria-label="Contribute to CalR community"
                    @click="openBuilderContributeDialog"
                  >
                    <i class="bi bi-patch-plus"></i>
                  </button>
                  <span class="status-tooltip__panel builder-action-tooltip__panel" role="tooltip">
                    <span class="builder-action-tooltip__title">To contribute to CalR community</span>
                    <ul class="builder-action-tooltip__list">
                      <li v-for="item in contributeRequirementChecklist" :key="item.label" class="builder-action-tooltip__item">
                        <i
                          class="bi"
                          :class="item.complete ? 'bi-check-circle-fill builder-action-tooltip__icon--complete' : 'bi-circle builder-action-tooltip__icon--incomplete'"
                        ></i>
                        <span>{{ item.label }}</span>
                      </li>
                    </ul>
                  </span>
                </span>
                <BButton v-if="store.account.userCreatingNew" variant="outline-secondary" @click="closeBuilderTab">
                  Close
                </BButton>
              </div>
            </div>
            <!--
            <div class="muted-copy">
              {{ isEditingExperiment ? 'Update an existing experiment and session configuration.' : 'Upload, configure, and save a new experiment.' }}
            </div>
            -->
            <div class="row-between">
              <div class="muted-copy">
                Status:
                <BBadge :variant="currentDraftStatus.variant || 'secondary'" class="editor-status-pill">
                  {{ currentDraftStatus.label }}
                </BBadge>
              </div>
              <div v-if="saveMessage" class="message-text row-end">{{ saveMessage }}</div>
            </div>
          </div>

          
          <div class="session-builder">
            <section class="session-step page-column" style="gap: 20px">
              <div class="builder-core-fields">
                <label class="control-stack builder-core-fields__name">
                  <div class="row-between">
                    <strong>Experiment name</strong>
                    <i
                      v-if="hasExperimentName"
                      class="bi bi-check-circle-fill builder-ready-check"
                      aria-label="Experiment name complete"
                    ></i>
                    <i
                      v-else
                      class="bi"
                      :class="'bi-circle builder-action-tooltip__icon--incomplete'"
                    ></i>
                  </div>
                  <input v-model="experimentDraft.name" type="text" placeholder="" />
                </label>
  
                <label class="control-stack builder-core-fields__description">
                  <div class="row-between">
                    <strong>Description</strong>
                    <i
                      v-if="hasExperimentDescription"
                      class="bi bi-check-circle-fill builder-ready-check"
                      aria-label="Experiment description complete"
                    ></i>
                    <i
                      v-else
                      class="bi"
                      :class="'bi-circle builder-action-tooltip__icon--incomplete'"
                    ></i>
                  </div>
                  <textarea
                    v-model="experimentDraft.description"
                    rows="1"
                    placeholder=""
                  ></textarea>
                </label>

                <div class="control-stack">
                  <div class="row-between">
                    <strong>Full Metadata</strong>
                    <i
                      v-if="hasCompletePublicMetadata"
                      class="bi bi-check-circle-fill builder-ready-check"
                      aria-label="Full metadata complete"
                    ></i>
                    <i
                      v-else
                      class="bi"
                      :class="'bi-circle builder-action-tooltip__icon--incomplete'"
                    ></i>
                  </div>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-secondary builder-core-fields__toggle"
                    :aria-expanded="showMetadataEditor ? 'true' : 'false'"
                    @click="toggleMetadataEditor"
                  >
                    {{ showMetadataEditor ? 'Hide' : 'Show' }}
                  </button>
                </div>
              </div>
              <div v-if="showMetadataEditor" class="page-column">
                <div class="metadata-columns">
                  <section v-for="section in metadataSections" :key="section.title" class="metadata-section-columns">
                    <strong>{{ section.title }}</strong>
                    <label v-for="field in section.fields" :key="field.key" class="control-stack">
                      <span class="metadata-field-label">{{ field.label }}</span>
                      <MetadataFieldInput v-model="metadataDraft[field.key]" :field="field" />
                    </label>
                  </section>
                </div>
              </div>
            </section>
            

            <section class="session-step page-column">
              <div style="display:flex; flex-direction: column; gap: 20px">
                <div>
                  <strong>Experiment Data</strong>
                  <div class="muted-copy">
                    Convert instrument CSV files into CalR format. Or upload your CalR-standard CSV directly.
                  </div>
                </div>
                <div class="session-uploads">
                  <div class="session-upload-row">
                    <div class="session-uploads-convert">
                      <div class="session-uploads-intruments">
                        <div class="session-uploads-intrument" :class="{'detected': highlightedUploadSystemFormat==='sable'}">SABLE</div>
                        <div class="session-uploads-intrument" :class="{'detected': highlightedUploadSystemFormat==='oxymax'}">CLAMS</div>
                        <div class="session-uploads-intrument" :class="{'detected': highlightedUploadSystemFormat==='tse'}">TSE</div>
                      </div>
                      <div class="session-uploads-arrow">➧</div>
                      <div class="session-uploads-intrument" style="background: #eee;" :class="{'detected-calr': store.upload.detectedFileFormat==='calr' || store.upload.convertedJSON}">CalR</div>
                    </div>
                  </div>


                  <!-- session data upload dropzone -->
                  <div
                    v-if="showEditingCalrDownload"
                    class="session-import-row col-between"
                  >
                    <div>
                      <div class="row-between">
                        <strong>Calorimetry Data</strong>
                        <i
                          v-if="hasCalorimetryData"
                          class="bi bi-check-circle-fill builder-ready-check"
                          aria-label="Calorimetry data complete"
                        ></i>
                        <i
                          v-else
                          class="bi"
                          :class="'bi-circle builder-action-tooltip__icon--incomplete'"
                        ></i>
                      </div>
                      <div class="muted-copy">
                        Uploaded format: {{ highlightedUploadSystemFormat || 'CalR' }}
                      </div>
                    </div>
                    <div class="row-between">
                      <div style="display:flex; gap:10px">
                        <BButton variant="outline-secondary" @click="beginCalrReupload">
                          Re-upload
                        </BButton>
                        <BButton variant="outline-secondary" @click="downloadCurrentCalrFile">
                          Download CalR
                        </BButton>
                        
                      </div>
                      <div style="display:flex; gap:10px; align-items: center;">
                        <BButton variant="info" @click="toggleCalrPreview">
                          {{ showCalrPreview ? 'Hide' : 'View' }}
                        </BButton>
                      </div>
                    </div>
                  </div>
  
  
                  <div v-else class="session-import-row col-center">
                    <div class="row-between">
                        <strong>Upload calorimetry data</strong>
                        <i
                          v-if="hasCalorimetryData"
                          class="bi bi-check-circle-fill builder-ready-check"
                          aria-label="Calorimetry data complete"
                        ></i>
                        <i
                          v-else
                          class="bi"
                          :class="'bi-circle builder-action-tooltip__icon--incomplete'"
                        ></i>
                      </div>
                    <div
                      class="dropzone"
                      :class="{ 
                        dragover: store.upload.dragover, 
                        'dropzone--error': store.upload.formatError,
                        'detected': store.upload.detectedFileFormat.trim() && store.upload.detectedFileFormat!=='calr', 
                        'detected-calr': store.upload.detectedFileFormat==='calr' || store.upload.convertedJSON 
                      }"
                      @click="openFileDialog"
                      @dragover.prevent="store.upload.dragover = true"
                      @dragleave="store.upload.dragover = false"
                      @drop.prevent="handleDrop"
                    >
                      <div v-if="!store.upload.files.length" class="dropzone-note">
                        Drag and drop CSV files here<br/>or click to select.
                      </div>
          
                      <div v-else class="dropzone-files">
                        <strong>{{ store.upload.files.length }} file(s) selected</strong>
                        <div v-for="file in store.upload.files" :key="file.name">{{ file.name }}</div>
                      </div>
                    </div>
          
                    <input
                      ref="fileInput"
                      type="file"
                      multiple
                      hidden
                      @change="handleFileSelect"
                    />
          
                    <div class="row-between">
                      <div
                        v-if="store.upload.detectedFileFormat || store.upload.formatError"
                        :class="store.upload.formatError ? 'message-text upload-detect-error' : 'message-text'"
                      >
                        <strong>Detected format:</strong>
                        {{ store.upload.formatError ? 'unrecognized as CLAMS, TSE, Sable, or CalR data.' : store.upload.detectedFileFormat }}
                      </div>
                      <div v-if="store.upload.files.length" class="row-end" style="gap:5px;">
                        <button class="btn btn-outline-secondary btn-sm" @click="clearSelectedFiles">
                          Clear
                        </button>
                        <button
                          v-if="hasConvertedData"
                          type="button"
                          class="btn btn-info btn-sm"
                          @click="toggleCalrPreview"
                        >
                          {{ showCalrPreview ? 'Hide' : 'View' }}
                        </button>
                        <button
                          v-if="!store.upload.isCalrFormat && !store.upload.formatError && !store.upload.convertedJSON"
                          class="btn btn-sm"
                          :class="{'btn-primary': !store.upload.convertedJSON, 'btn-success': store.upload.convertedJSON}"
                          :disabled="store.loaders.convertFile || store.upload.convertedJSON"
                          @click="convertSelectedFiles"
                        >
                          <BSpinner v-if="store.loaders.convertFile" small />
                          <span v-else>Convert</span>
                        </button>
                      </div>
                    </div>
                    
                    <div v-if="store.upload.textResponse && !store.upload.formatError" class="message-text">
                      {{ store.upload.textResponse }}
                    </div>
      
                  </div>

                  <!-- session metadata upload dropzone -->
                  <div
                    v-if="showEditingSessionDownload"
                    class="session-import-row col-between"
                  >
                    <div>
                      <div class="row-between">
                        <strong>Session Configuration</strong>
                        <i
                          v-if="hasSessionConfiguration"
                          class="bi bi-check-circle-fill builder-ready-check"
                          aria-label="Session configuration complete"
                        ></i>
                        <i
                          v-else
                          class="bi"
                          :class="'bi-circle builder-action-tooltip__icon--incomplete'"
                        ></i>
                      </div>
                      <div class="muted-copy">
                        {{ hasSessionConfiguration ? 'Complete' : 'Not configured yet' }}
                      </div>
                    </div>
                    <div class="row-between" style="flex:1">
                      <div style="display:flex; gap:10px">
                        <BButton variant="outline-secondary" @click="beginSessionReupload">
                          Re-upload
                        </BButton>
                        <BButton variant="outline-secondary" @click="downloadEditingSessionFile">
                          Download Session
                        </BButton>
                      </div>
                      <div style="display:flex; gap:10px; align-items: center">
                        <BButton variant="info" @click="toggleSessionEditor">
                          {{ showSessionEditor ? 'Hide' : 'Edit' }}
                        </BButton>
                      </div>
                    </div>
                  </div>

                  <div
                    v-if="hasConvertedData && !showEditingSessionDownload && !showSessionEditor"
                    class="session-import-row col-between"
                  >
                    <div>
                      <div class="row-between">
                        <strong>Session configuration</strong>
                        <i
                          v-if="hasSessionConfiguration"
                          class="bi bi-check-circle-fill builder-ready-check"
                          aria-label="Session configuration complete"
                        ></i>
                        <i
                          v-else
                          class="bi"
                          :class="'bi-circle builder-action-tooltip__icon--incomplete'"
                        ></i>
                      </div>
                      <div class="muted-copy">
                        Configure groups, diets, subjects, hours, or import an existing session CSV.
                      </div>
                    </div>
                    <button
                      type="button"
                      class="btn btn-primary"
                      @click="openSessionConfiguration"
                    >
                      Configure Session
                    </button>
                  </div>
                  <div
                    v-if="hasConvertedData && !showEditingSessionDownload && showSessionEditor"
                    class="session-import-row col-between"
                    :class="{ 'session-import-row--disabled': !isSessionImportEnabled }"
                  >
                    <div class="session-import-drop">
                      <div class="row-between">
                        <strong>Have an existing session CSV?</strong>
                        <i
                          v-if="hasSessionConfiguration"
                          class="bi bi-check-circle-fill builder-ready-check"
                          aria-label="Session configuration complete"
                        ></i>
                        <i
                          v-else
                          class="bi"
                          :class="'bi-circle builder-action-tooltip__icon--incomplete'"
                        ></i>
                      </div>
                      <div
                        class="dropzone"
                        :class="{
                          dragover: sessionDragover,
                          'detected-calr': sessionImportName && !sessionImportFormatError,
                          'dropzone--error': sessionImportFormatError,
                          'dropzone--disabled': !isSessionImportEnabled,
                        }"
                        @click="openSessionFileDialog"
                        @dragover.prevent="sessionDragover = true"
                        @dragleave="sessionDragover = false"
                        @drop.prevent="handleSessionFileDrop"
                      >
                        <div v-if="!sessionImportName" class="dropzone-note">
                          Drag and drop a session CSV here<br/>or click to select.
                        </div>
                        <div v-else class="dropzone-files">
                          <strong>1 file(s) selected</strong>
                          <div>{{ sessionImportName }}</div>
                        </div>  
                      </div>
                      <div v-if="!showEditingSessionDownload && !sessionImportName">
                        Otherwise you can configure your session below.
                      </div>
                      <div v-if="sessionImportName || sessionImportMessage" class="row-between">
                        <div v-if="sessionImportMessage" class="message-text">
                          {{ sessionImportMessage }}
                        </div>
                        <div v-if="sessionImportFormatError" class="message-text upload-detect-error">
                          Unrecognized as a CalR session CSV.
                        </div>
                        <button class="btn btn-outline-secondary btn-sm" @click="clearImportedSession">
                          Clear
                        </button>
                      </div>
                      <input
                        ref="sessionFileInput"
                        type="file"
                        accept=".csv,text/csv"
                        hidden
                        @change="handleSessionFileSelect"
                      />
                    </div>
                  </div>
                </div>
              </div>
            <div v-if="hasConvertedData && showCalrPreview" class="upload-preview-layout">
              <div class="page-column upload-preview-layout__table">
                <div class="row-between">
                  <strong>CalR Data Preview</strong>
                </div>
                <div class="table-scroll-shell">
                  <BTable
                    class="preview-table"
                    :items="calrPreviewRows"
                    :fields="calrPreviewFields"
                    :tbody-tr-class="getCalrPreviewRowClass"
                    responsive
                    small
                    striped
                    hover
                  />
                </div>
                <div class="row-between">
                  <div class="muted-copy">
                    Showing {{ calrPreviewRangeStart }}-{{ calrPreviewRangeEnd }} of {{ calrPreviewSourceRows.length }} row(s)
                  </div>
                  <div v-if="calrPreviewPageCount > 1" class="preview-pagination">
                    <BButton
                      size="sm"
                      variant="outline-secondary"
                      :disabled="calrPreviewPage <= 1"
                      @click="goToCalrPreviewPage(calrPreviewPage - 1)"
                    >
                      Previous
                    </BButton>
                    <span class="muted-copy">Page {{ calrPreviewPage }} of {{ calrPreviewPageCount }}</span>
                    <BButton
                      size="sm"
                      variant="outline-secondary"
                      :disabled="calrPreviewPage >= calrPreviewPageCount"
                      @click="goToCalrPreviewPage(calrPreviewPage + 1)"
                    >
                      Next
                    </BButton>
                  </div>
                </div>
              </div>
              <div class="upload-preview-layout__qc">
                <div class="upload-summary-grid" style="flex:1">
                  <div>
                    <strong>Subjects</strong>
                    <div>{{ sessionEditor.subjects.length }}</div>
                  </div>
                  <div>
                    <strong>Total Hours</strong>
                    <div>{{ totalCalrHours }}</div>
                  </div>
                </div>
                <div
                  class="upload-qc-check"
                  :class="{ 'upload-qc-check--pass': energyExpenditureQc.passed, 'upload-qc-check--fail': !energyExpenditureQc.passed }"
                >
                  <strong>Energy Expenditure QC</strong>
                  <div>
                    {{ energyExpenditureQc.passed
                      ? `Passed: all RER values are > 0.6 and < 1.5.`
                      : `Failed: ${formatQcFailureCount(energyExpenditureQc.invalidCount, energyExpenditureQc.checkedRowCount)} RER value(s) fell outside 0.6-1.5 or were missing.` }}
                  </div>
                  <div v-if="energyExpenditureQc.invalidCount" class="upload-qc-nav">
                    <button
                      v-if="!isQcActive('energyExpenditure')"
                      class="upload-qc-nav__show"
                      @click="showQcInTable('energyExpenditure')"
                    >
                      Show in table
                    </button>
                    <template v-else>
                      <button class="upload-qc-nav__button" @click="stepQcFailure('energyExpenditure', -1)">&lt;</button>
                      <button class="upload-qc-nav__current" @click="focusQcFailure('energyExpenditure')">
                        {{ currentQcInvalidLabel('energyExpenditure') }}
                      </button>
                      <button class="upload-qc-nav__button" @click="stepQcFailure('energyExpenditure', 1)">&gt;</button>
                      <button class="upload-qc-nav__dismiss" @click="clearQcTableFocus()">X</button>
                    </template>
                  </div>
                </div>

                <div
                  class="upload-qc-check"
                  :class="{ 'upload-qc-check--pass': foodIntakeQc.passed, 'upload-qc-check--fail': !foodIntakeQc.passed }"
                >
                  <strong>Food Intake QC</strong>
                  <div>
                    {{ foodIntakeQc.passed
                      ? `Passed: all feed values are non-negative.`
                      : `Failed: ${formatQcFailureCount(foodIntakeQc.invalidCount, foodIntakeQc.checkedRowCount)} feed value(s) were negative or missing.` }}
                  </div>
                  <div v-if="foodIntakeQc.invalidCount" class="upload-qc-nav">
                    <button
                      v-if="!isQcActive('foodIntake')"
                      class="upload-qc-nav__show"
                      @click="showQcInTable('foodIntake')"
                    >
                      Show in table
                    </button>
                    <template v-else>
                      <button class="upload-qc-nav__button" @click="stepQcFailure('foodIntake', -1)">&lt;</button>
                      <button class="upload-qc-nav__current" @click="focusQcFailure('foodIntake')">
                        {{ currentQcInvalidLabel('foodIntake') }}
                      </button>
                      <button class="upload-qc-nav__button" @click="stepQcFailure('foodIntake', 1)">&gt;</button>
                      <button class="upload-qc-nav__dismiss" @click="clearQcTableFocus()">X</button>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="hasConvertedData && shouldShowSessionEditor" style="display:flex; flex-direction: column; gap:20px">
              
              <div style="display:flex; flex-direction: column;">
                <div class="row-between">
                  <div class="muted-copy">
                    Designate groups, diets, subjects, and experiment ranges.
                  </div>
                </div>
              </div>

              <!-- session form -->
              <div>
                <fieldset class="builder-fieldset page-column" :disabled="!canContinueToConfigure">

              <div class="session-subsection">
                <div class="session-subsection__header">
                  <strong>Set Ranges and Filters</strong>
                </div>
  
                <div class="session-settings">
                  <div class="session-settings-row">
                    <div class="session-settings-group group-editor-card">
                      <label class="control-stack">
                        Session start hour
                        <input v-model="sessionEditor.hour_range[0]" type="number" step="1" min="0" />
                      </label>
      
                      <label class="control-stack">
                        Session end hour
                        <input v-model="sessionEditor.hour_range[1]" type="number" step="1" min="0" />
                      </label>
                    </div>

                    <div class="session-settings-group group-editor-card">
                      <label class="control-stack">
                        Light cycle start hour
                        <input v-model="sessionEditor.light_cycle_start" type="number" min="0" max="23" step="1" />
                      </label>
    
                      <label class="control-stack">
                        Dark cycle start hour
                        <input v-model="sessionEditor.dark_cycle_start" type="number" min="0" max="23" step="1" />
                      </label>
                    </div>
                    
                    <div class="session-settings-group group-editor-card">
                      <label class="control-stack">
                        Food cutoff (kcal/hr)
                        <input v-model="sessionEditor.food_cutoff" type="number" step="0.1" min="0" @input="handleFoodCutoffInput" />
                      </label>
                    </div>

                    <div
                      v-if="isGroupsAndDietsComplete"
                      class="upload-qc-check"
                      :class="{ 'upload-qc-check--pass': isFoodCutoffValid, 'upload-qc-check--fail': !isFoodCutoffValid }"
                    >
                      <strong>Food Cutoff QC</strong>
                      <div>
                        {{ isFoodCutoffValid
                          ? `Passed: meets the minimum ${minimumFoodCutoffKcalPerHour} kcal/hr threshold.`
                          : `Failed: must be at least ${minimumFoodCutoffKcalPerHour} kcal/hr to meet 100 mg/min minimum.` }}
                          <span class="muted-copy">
                            Based on {{ foodCutoffReferenceKcalPerG }} kcal/g diet.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
  
              <div class="session-subsection">
                <div class="row-between session-subsection__header">
                  <div>
                    <strong>Set Groups and Diets</strong>
                    <div class="muted-copy">Designate the groups and diets in this session. You can set up to 4 groups, and add custom diets.</div>
                  </div>
                  <div class="button-row">
                    <button class="btn btn-outline-secondary btn-sm" @click="showCustomDietEditor = !showCustomDietEditor">
                      {{ showCustomDietEditor ? 'Close Diet Editor' : 'Add Custom Diet' }}
                    </button>
                    <button
                      class="btn btn-outline-secondary btn-sm"
                      :disabled="sessionEditor.groups.length >= maxGroups"
                      @click="addGroup"
                    >
                      Add Group
                    </button>
                  </div>
                </div>
  
                <div v-if="showCustomDietEditor">
                  <div class="custom-diet-editor">
                    <label class="control-stack">
                      Diet name
                      <input v-model="customDietDraft.name" type="text" placeholder="Enter diet name" />
                    </label>
                    <label class="control-stack">
                      Kcal/g
                      <input v-model="customDietDraft.kcal" type="number" step="0.01" placeholder="3.56" />
                    </label>
                    <div class="button-row custom-diet-editor__actions">
                      <button class="btn btn-primary btn-sm" :disabled="!canSaveCustomDiet" @click="saveCustomDiet">
                        Save Diet
                      </button>
                    </div>
                  </div>
                  <div class="muted-copy">Custom Diets will appear in the Diet dropdown in the Group cards.</div>
                </div>
  
                <div class="group-editor-grid">
                  <div v-for="(group, index) in sessionEditor.groups" :key="index" class="group-editor-card">
                    <div class="row-between group-editor-card__header">
                      <strong>Group {{ index + 1 }}</strong>
                      <a
                        v-if="index >= baseGroupCount"
                        role="button"
                        class="text-danger"
                        @click="removeGroup(index)"
                      >
                          Remove
                      </a>
                    </div>
  
                    <div class="row-between">
                      <label class="control-stack" style="width:80%">
                      Name
                      <input v-model="group.name" type="text" :placeholder="`Group ${index + 1}`" />
                    </label>
  
                      <label class="control-stack"  style="width:20%">
                      Color
                      <input v-model="group.color" type="color"/>
                    </label>
                    </div>
                    
  
                    <div class="row-between">
                      <label class="control-stack" style="width:80%">
                        Diet
                        <select v-model="group.diet_key" @change="applyGroupDietSelection(group)">
                          <option value="">Select Diet</option>
                          <option v-for="option in dietOptions" :key="option.id" :value="option.id">
                            {{ option.label }}
                          </option>
                        </select>
                      </label>
    
                      <label class="control-stack"  style="width:20%">
                        Kcal/g
                        <input :value="formatDietKcal(group.diet_kcal)" type="text" readonly />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
  
              <div class="session-subsection">
                <div class="row-between session-subsection__header">
                  <div>
                    <strong>Designate Subjects</strong>
                    <div class="muted-copy">Assign each subject to a group. Weights, mass change, and exclusions are optional.</div>
                  </div>
                  <div class="button-row">
                  </div>
                </div>
  
                <div class="table-wrap table-card">
                  <table class="data-table session-subject-table">
                    <colgroup>
                        <col style="width: 100px" />
                        <col :span="sessionEditor.groups.length" style="width: 150px" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th></th>
                        <th class="txt-center" :colspan="sessionEditor.groups.length">
                          Groups
                          <div class="bold sub-copy">Required</div>
                          <div class="sub-copy">Assign each subject to a group</div>
                        </th>
                      </tr>
                      <tr>
                        <th class="txt-center">Subject ID</th>
                        <th class="txt-center" v-for="(group, index) in sessionEditor.groups" :key="`${group.name}-${index}`" :style="`border-color:${group.color}`">
                          {{ normalizedGroupName(group, index) }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <template v-if="sessionEditor.subjects.length">
                        <tr v-for="subject in sessionEditor.subjects" :key="subject.subject">
                          <td class="txt-center">{{ subject.subject }}</td>
                          <td v-for="(_, groupIndex) in sessionEditor.groups" :key="`${subject.subject}-${groupIndex}`" class="session-radio-cell txt-center">
                            <input v-model.number="subject.groupIndex" type="radio" :name="`subject-${subject.subject}`" :value="groupIndex" :style="`accent-color:${sessionEditor.groups[groupIndex].color}`"/>
                          </td>
                        </tr>
                      </template>
                      <template v-else>
                        <tr>
                          <td class="txt-center">1</td>
                          <td><input type="radio" :name="`subject-1`" :value="0" :style="`accent-color:${sessionEditor.groups[0].color}`"/></td>
                          <td><input type="radio" :name="`subject-1`" :value="1" :style="`accent-color:${sessionEditor.groups[1].color}`"/></td>
                        </tr>
                        <tr>
                          <td class="txt-center">2</td>
                          <td><input type="radio" :name="`subject-2`" :value="0" :style="`accent-color:${sessionEditor.groups[0].color}`"/></td>
                          <td><input type="radio" :name="`subject-2`" :value="1" :style="`accent-color:${sessionEditor.groups[1].color}`"/></td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
                  <div class="relative">
                    <table class="data-table session-subject-table">
                      <colgroup>
                      </colgroup>
                      <thead>
                        <tr>
                          <th class="txt-center relative session-subject-header" :colspan="3">
                            <div class="session-subject-header-title-with-button">
                              Weights
                              <button
                                class="btn btn-outline-secondary btn-sm session-table-option-btn"
                                data-tooltip="Upload weights data from template"
                                @click="openTemplateUploadModal('weights')"
                              >
                                <i class="bi bi-upload"></i>
                              </button>
                            </div>
                            <div class="bold sub-copy">Optional</div> 
                            <div class="sub-copy">Weights from calorimeter will be used otherwise.</div>
                          </th>
                        </tr>
                        <tr>
                          <th>Total Mass (g)</th>
                          <th>Lean Mass (g)</th>
                          <th>Fat Mass (g)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="subject in sessionEditor.subjects" :key="subject.subject">
                          <td><input v-model="subject.total_mass" type="number" step="0.1" /></td>
                          <td><input v-model="subject.lean_mass" type="number" step="0.1" /></td>
                          <td><input v-model="subject.fat_mass" type="number" step="0.1" /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div class="relative">
                    <table class="data-table session-subject-table">
                      <colgroup>
                      </colgroup>
                      <thead>
                        <tr>
                          <th class="txt-center relative session-subject-header" :colspan="1">
                            <div class="session-subject-header-title-with-button">
                              Mass Change
                              <button
                                class="btn btn-outline-secondary btn-sm session-table-option-btn"
                                data-tooltip="Upload mass change data from template"
                                @click="openTemplateUploadModal('massChange')"
                              >
                                <i class="bi bi-upload"></i>
                              </button>
                            </div>
                            <div class="bold sub-copy">Optional</div>
                            <div class="sub-copy">Subject mass change.</div>
                          </th>
                        </tr>
                        <tr>
                          <th>Mass Change (g)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="subject in sessionEditor.subjects" :key="subject.subject">
                          <td><input v-model="subject.mass_change" type="number" step="0.1" /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div class="relative">
                    <table class="data-table session-subject-table">
                      <colgroup>
                      </colgroup>
                      <thead>
                        <tr>
                          <th class="txt-center relative session-subject-header" :colspan="2">
                            Exclusions
                            <div class="bold sub-copy">Optional</div>
                            <div class="sub-copy">Exclude subject ID's starting at hour.</div>
                          </th>
                        </tr>
                        <tr>
                          <th>Exclusion Hour</th>
                          <th>Exclusion Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="subject in sessionEditor.subjects" :key="subject.subject">
                          <td><input v-model="subject.exc_hour" type="number" step="0.1" /></td>
                          <td><input v-model="subject.exc_reason" type="text" /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
                </fieldset>
              </div>
            </div>


            </section>

            <section v-if="builderAnalysisLoading || shouldShowBuilderPlots" class="session-step page-column">
              <div v-if="builderAnalysisLoading" class="analysis-loading-bar">
                <BSpinner small />
                <span>Loading analysis data...</span>
              </div>
              <div v-else>
                <div style="display: flex; flex-direction: column; gap: 20px;">
                  <div>
                    <strong>Analysis</strong>
                    <div class="muted-copy">CalR analytical plots based on your calorimetry data. </div>
                  </div>
                  <AnalysisPlotsPanel
                    context="builderAnalysis"
                    default-view-mode="single"
                    :analysis-data="builderAnalysisData"
                    :session-metadata="builderSessionMetadata"
                    :max-hour="builderMaxHour"
                    :group-colors="builderGroupColors"
                    :analysis-options="builderAnalysisOptions"
                  />
                </div>
              </div>
            </section>

          </div>

        </div>

        <div class="page-column" v-else>
          <div class="row-between">
            <h2 class="section-title">Your Experiments ({{ experimentCount }})</h2>
            <div class="button-row">
              <BButton v-if="!store.account.userCreatingNew" variant="info" @click="startCreateExperiment">
                + New
              </BButton>
            </div>
          </div>
          <div v-if="store.loaders.getUserFiles" class="empty-state">
            <BSpinner small />
          </div>
    
          <div v-else-if="store.account.userFiles.length">
            <BTable
              class="account-experiments-table"
              :items="store.account.userFiles"
              :fields="userFilesFields"
              :tbody-tr-class="getUserFileRowClass"
              responsive
              small
              hover
              striped
            >
              <template #cell(name)="slot">
                {{ slot.item.name || slot.item.title || slot.item.id }}
              </template>
      
              <template #cell(description)="slot">
                {{ slot.item.description || '' }}
              </template>

              <template #cell(state)="slot">
                <div class="experiment-state-dots">
                  <span class="state-dot-wrap" data-tooltip="Calorimetry data">
                    <span
                      class="experiment-state-dot"
                      :class="slot.item.files?.find(f => f.file_type === 'standard') ? 'experiment-state-dot--complete' : ''"
                    ></span>
                  </span>
                  <span class="state-dot-wrap" data-tooltip="Session configuration">
                    <span
                      class="experiment-state-dot"
                      :class="slot.item.statusLoading ? 'experiment-state-dot--loading' : isExperimentReadyForAnalysis(slot.item.statusInfo) ? 'experiment-state-dot--complete' : ''"
                    ></span>
                  </span>
                  <span class="state-dot-wrap" data-tooltip="Metadata">
                    <span
                      class="experiment-state-dot"
                      :class="slot.item.statusLoading ? 'experiment-state-dot--loading' : slot.item.statusInfo?.key === 'ready_public' ? 'experiment-state-dot--complete' : ''"
                    ></span>
                  </span>
                </div>
              </template>

              <template #cell(status)="slot">
                <BBadge :variant="slot.item.statusInfo?.variant || 'secondary'" style="display:flex; align-items: center; width:fit-content">
                  <BSpinner v-if="slot.item.statusLoading" small style="margin-right: 0.35rem;" />
                  {{ slot.item.statusInfo?.label || 'Incomplete' }}
                </BBadge>
              </template>
      
              <template #cell(public)="slot">
                <BBadge
                  :variant="slot.item.public ? 'success' : 'secondary'"
                  class="badge-toggle"
                  @click="openContributeDialog(slot.item)"
                >
                  {{ slot.item.public ? 'Yes' : 'No' }}
                </BBadge>
              </template>

              <template #cell(shared)="slot">
                <BBadge
                  :variant="slot.item.shared ? 'success' : 'secondary'"
                  class="badge-toggle"
                  :class="{ 'badge-toggle--disabled': !isExperimentReadyForAnalysis(slot.item.statusInfo) }"
                  @click="openShareDialog(slot.item)"
                >
                  {{ slot.item.shareSaving ? '...' : (slot.item.shared ? 'Yes' : 'No') }}
                </BBadge>
              </template>
      
              <template #cell(uploaded_at)="slot">
                {{ formatDate(slot.item.uploaded_at) }}
              </template>
      
              <template #cell(actions)="slot">
                <div class="account-experiments-table__actions">
                  <span style="display:inline-flex; align-items:center; gap:0.35rem; min-width:4.5rem;">
                    <BSpinner v-if="slot.item.loading" small />
                    <span v-if="slot.item.loading" class="muted-copy">{{ formatLoadingProgress(slot.item.loadingProgress) }}</span>
                  </span>
                  <BButton size="sm" variant="outline-secondary" @click="editExperiment(slot.item)">
                    View/Edit
                  </BButton>
                  <BButton size="sm" variant="outline-danger" @click="removeExperiment(slot.item)">
                    Delete
                  </BButton>
                </div>
              </template>
            </BTable>
          </div>

          <div v-else class="empty-state">You have no experiments yet.</div>
        </div>
        <!--
        <div v-if="store.auth.token && store.account.userCreatingNew" class="builder-overlay">
          <div class="builder-overlay__backdrop"></div>
          
        </div>
        -->

      </template>
    </section>
  </div>

  <div v-if="confirmDialog.visible" class="confirm-dialog-backdrop" @click.self="cancelConfirmDialog">
    <div class="confirm-dialog">
      <div class="confirm-dialog__header">
        <strong>{{ confirmDialog.title }}</strong>
      </div>
      <div class="confirm-dialog__body">
        {{ confirmDialog.message }}
      </div>
      <div class="button-row confirm-dialog__actions">
        <BButton variant="outline-secondary" @click="cancelConfirmDialog">
          {{ confirmDialog.cancelLabel }}
        </BButton>
        <BButton :variant="confirmDialog.confirmVariant" @click="approveConfirmDialog">
          {{ confirmDialog.confirmLabel }}
        </BButton>
      </div>
    </div>
  </div>

  <div v-if="templateUploadDialog.visible" class="confirm-dialog-backdrop" @click.self="closeTemplateUploadModal">
    <div class="confirm-dialog">
      <div class="confirm-dialog__header row-between">
        <strong>{{ templateUploadDialog.title }}</strong>
        <button class="btn btn-outline-secondary btn-sm" @click="closeTemplateUploadModal">
          Close
        </button>
      </div>
      <div class="confirm-dialog__body">
        <div
          class="dropzone dropzone--compact"
          :class="{ dragover: templateUploadDialog.dragover }"
          @click="openTemplateUploadFileDialog"
          @dragover.prevent="templateUploadDialog.dragover = true"
          @dragleave="templateUploadDialog.dragover = false"
          @drop.prevent="handleTemplateUploadDrop"
        >
          <div>
            Drop a CSV template here, or click to select one.
          </div>
        </div>
        <input
          ref="templateUploadInput"
          type="file"
          accept=".csv,text/csv"
          hidden
          @change="handleTemplateUploadFileSelect"
        />
        <div v-if="templateUploadDialog.fileName" class="muted-copy">
          Selected file: {{ templateUploadDialog.fileName }}
        </div>
        <div v-if="templateUploadDialog.message" class="message-text">
          {{ templateUploadDialog.message }}
        </div>
      </div>
      <div class="button-row confirm-dialog__actions">
        <BButton variant="outline-secondary" @click="downloadTemplate(templateUploadDialog.type)">
          Download Template
        </BButton>
        <BButton variant="outline-secondary" @click="closeTemplateUploadModal">
          Done
        </BButton>
      </div>
    </div>
  </div>

  <div v-if="shareDialog.visible" class="confirm-dialog-backdrop" @click.self="closeShareDialog">
    <div class="confirm-dialog share-dialog">
      <div class="confirm-dialog__header row-between">
        <strong>Share Dataset</strong>
        <button class="btn btn-outline-secondary btn-sm" @click="closeShareDialog">
          Close
        </button>
      </div>
      <div class="confirm-dialog__body share-dialog__body">
        <div class="share-dialog__dataset">
          <strong>{{ shareDialog.file?.name || shareDialog.file?.title || shareDialog.file?.id }}</strong>
        </div>
        <div class="muted-copy">Anyone with this link can see.</div>
        <label class="share-dialog__toggle">
          <span>Sharing</span>
          <input
            :checked="Boolean(shareDialog.file?.shared)"
            type="checkbox"
            :disabled="shareDialog.saving"
            @change="toggleShareDialogSharing($event.target.checked)"
          />
        </label>
        <label class="control-stack">
          Share URL
          <input :value="shareDialog.url" readonly />
        </label>
        <div v-if="shareDialog.message" class="message-text">
          {{ shareDialog.message }}
        </div>
      </div>
      <div class="button-row confirm-dialog__actions">
        <BButton variant="outline-secondary" :disabled="shareDialog.saving" @click="closeShareDialog">
          Done
        </BButton>
        <BButton variant="primary" :disabled="shareDialog.saving || !shareDialog.file" @click="copyShareUrl">
          <BSpinner v-if="shareDialog.saving" small />
          <span v-else>Copy Share URL</span>
        </BButton>
      </div>
    </div>
  </div>

  <div v-if="contributeDialog.visible" class="confirm-dialog-backdrop" @click.self="closeContributeDialog">
    <div class="confirm-dialog share-dialog">
      <div class="confirm-dialog__header row-between">
        <strong>Contribute Dataset</strong>
        <button class="btn btn-outline-secondary btn-sm" @click="closeContributeDialog">
          Close
        </button>
      </div>
      <div class="confirm-dialog__body share-dialog__body">
        <div class="share-dialog__dataset">
          <strong>{{ contributeDialog.file?.name || contributeDialog.file?.title || contributeDialog.file?.id }}</strong>
        </div>
        <div class="muted-copy">Public datasets are visible in the CalR community repository.</div>
        <label class="share-dialog__toggle">
          <span>Contribute to public repository</span>
          <input
            :checked="Boolean(contributeDialog.file?.public)"
            type="checkbox"
            :disabled="contributeDialog.saving"
            @change="toggleContributeDialogPublic($event.target.checked)"
          />
        </label>
        <div v-if="contributeDialog.message" class="message-text">
          {{ contributeDialog.message }}
        </div>
      </div>
      <div class="button-row confirm-dialog__actions">
        <BButton variant="outline-secondary" :disabled="contributeDialog.saving" @click="closeContributeDialog">
          Done
        </BButton>
      </div>
    </div>
  </div>
</template>

<script>
import { appStore } from '../store/appStore'
import MetadataFieldInput from '../components/MetadataFieldInput.vue'
import AnalysisPlotsPanel from '../components/AnalysisPlotsPanel.vue'
import experimentMetadataConfig from '../config/experimentMetadata.json'
import {
  convertInstrumentFiles,
  deleteExperiment,
  createUser,
  fetchDataFile,
  fetchEnrichedSession,
  fetchSessionConfig,
  fetchSessionFile,
  fetchUserFiles,
  login,
  updateCalrFile,
  updateExperimentMetadata,
  updateExperimentPublicStatus,
  updateExperimentSharedStatus,
  updateSessionFile,
  uploadCalrFile,
  uploadSessionFile,
} from '../services/registryService'
import {
  parseCsv,
} from '../utils/csv'
import { formatDate, formatFileSize } from '../utils/format'
import {
  clearProcessCaches,
  DEFAULT_GROUP_COLORS,
  ensureEnviroLight,
  ensureExpMinute,
  getSessionCycleStartsFromRows,
  inferSessionPayloadFromCalrData,
  mergeSessionCsvIntoPayload,
  normalizeSessionPayload,
} from '../utils/process'
import { normalizeEnrichedAnalysisData } from '../utils/prep-for-analysis'
import { BButton } from 'bootstrap-vue-next'

const numericalColumns = [
  'vo2', 'vco2', 'ee', 'ee.acc', 'rer', 'feed', 'feed.acc', 'drink', 'drink.acc',
  'xytot', 'xyamb', 'pedmeter', 'allmeter', 'wheel', 'wheel.acc', 'C13', 'enviro.temp',
  'subject.mass', 'body.temp', 'enviro.sound',
]

const PRESET_DIETS = [
  { id: 'ld-5008',              name: 'LabDiet 5008 3.56kcal/g',                            kcal: 3.56 },
  { id: 'ld-5053',              name: 'LabDiet 5053 3.43kcal/g',                            kcal: 3.43 },
  { id: 'ld-5058',              name: 'LabDiet 5058 3.76kcal/g',                            kcal: 3.76 },
  { id: 'rd-60-fat',            name: 'ResearchDiet 60 kcal% Fat 5.21kcal/g',               kcal: 5.21 },
  { id: 'rd-45-fat',            name: 'ResearchDiet 45 kcal% Fat 4.7kcal/g',                kcal: 4.7 },
  { id: 'rd-10-fat-35-sucrose', name: 'ResearchDiet 10 kcal% Fat 35% sucrose 3.82kcal/g',   kcal: 3.82 },
  { id: 'rd-10-fat-17-sucrose', name: 'ResearchDiet 10 kcal% Fat 17% sucrose 3.82kcal/g',   kcal: 3.82 },
  { id: 'rd-10-fat-7-sucrose',  name: 'ResearchDiet 10 kcal% Fat 7% sucrose 3.82kcal/g',    kcal: 3.82 },
  { id: 'rd-10-fat-0-sucrose',  name: 'ResearchDiet 10 kcal% Fat no sucrose 3.82kcal/g',    kcal: 3.82 },
  { id: 'sf04-27',              name: 'Specialty Feeds SF04-027 Fat 23% 4.06kcal/g',        kcal: 4.06 },
]


const FOOD_CUTOFF_MIN_MG_PER_MIN = 100
const DEFAULT_FOOD_CUTOFF_KCAL_PER_G = PRESET_DIETS[0].kcal
const EXPERIMENT_METADATA_SECTIONS = experimentMetadataConfig.sections
const EXPERIMENT_METADATA_FIELDS = EXPERIMENT_METADATA_SECTIONS.flatMap((section) => section.fields)

function roundToTwo(value) {
  return Math.round(value * 100) / 100
}

function convertFoodCutoffMgPerMinToKcalPerHour(mgPerMin, kcalPerG = DEFAULT_FOOD_CUTOFF_KCAL_PER_G) {
  return roundToTwo((Number(mgPerMin) / 1000) * 60 * Number(kcalPerG))
}

function hasConfiguredCycleRange(lightCycleStart, darkCycleStart) {
  const light = Number(lightCycleStart)
  const dark = Number(darkCycleStart)

  if (!Number.isFinite(light) || !Number.isFinite(dark)) {
    return false
  }

  return !(light === 0 && dark === 0)
}

function normalizeSystemToUploadFormat(systemValue) {
  const normalizedValue = `${systemValue || ''}`.trim().toLowerCase()

  if (normalizedValue === 'clams') {
    return 'oxymax'
  }

  if (normalizedValue === 'tse') {
    return 'tse'
  }

  if (normalizedValue === 'sable') {
    return 'sable'
  }

  return ''
}

function createEmptyMetadataDraft() {
  return EXPERIMENT_METADATA_FIELDS.reduce((draft, field) => {
    draft[field.key] = ''
    return draft
  }, {})
}

function createIncompleteSessionEditor(basePayload = {}) {
  const sessionEditor = normalizeSessionPayload(basePayload)

  sessionEditor.groups = sessionEditor.groups.map((group, index) => ({
    ...group,
    name: `${group?.name || `Group ${index + 1}`}`.trim(),
    diet_name: '',
    diet_kcal: null,
    diet_key: '',
  }))
  sessionEditor.light_cycle_start = 0
  sessionEditor.dark_cycle_start = 0
  sessionEditor.food_cutoff = 0

  return sessionEditor
}

function hasNonEmptyValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (typeof value === 'string') {
    return Boolean(value.trim())
  }

  return value !== null && value !== undefined && value !== ''
}

function getRequiredPublicMetadataFields() {
  return EXPERIMENT_METADATA_FIELDS.filter((field) => field.requiredForPublic)
}

function normalizeMetadataObject(value) {
  if (!value) {
    return {}
  }

  if (typeof value === 'string') {
    try {
      return normalizeMetadataObject(JSON.parse(value))
    } catch (error) {
      return {}
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value
  }

  return {}
}

function getStatusMetadataValue(source = {}, key) {
  const metadata = normalizeMetadataObject(
    source?.metadata ?? source?.submission_metadata ?? source?.metadata_json,
  )

  if (key === 'experiment_id') {
    return metadata[key] ?? source?.[key] ?? source?.submission_id ?? source?.id ?? ''
  }

  return metadata[key] ?? source?.[key]
}

function hasRequiredPublicMetadata(source = {}) {
  return getRequiredPublicMetadataFields().every((field) => hasNonEmptyValue(getStatusMetadataValue(source, field.key)))
}

function isSessionReadyForAnalysis(sessionPayload = {}) {
  const normalized = normalizeSessionPayload(sessionPayload)
  const groups = normalized.groups || []
  const subjects = normalized.subjects || []

  const groupsComplete = groups.length > 0 && groups.every((group, index) => (
    Boolean(`${group?.name || `Group ${index + 1}`}`.trim())
    && Boolean(group?.color)
    && group?.diet_kcal !== null
    && group?.diet_kcal !== undefined
    && group?.diet_kcal !== ''
    && Boolean(group?.diet_name?.trim())
  ))

  if (!groupsComplete || !subjects.length) {
    return false
  }

  const assignedGroups = new Set(
    subjects
      .map((subject) => Number(subject.groupIndex))
      .filter((index) => Number.isInteger(index) && index >= 0 && index < groups.length),
  )

  const subjectsComplete = groups.every((_, index) => assignedGroups.has(index))
  const rangesComplete = hasConfiguredCycleRange(normalized.light_cycle_start, normalized.dark_cycle_start)

  return subjectsComplete && rangesComplete
}

function buildExperimentStatus({ hasConvertedData, sessionPayload, metadata }) {
  if (!hasConvertedData) {
    return {
      key: 'incomplete',
      label: 'Incomplete',
      variant: 'secondary',
    }
  }

  if (hasRequiredPublicMetadata(metadata) && isSessionReadyForAnalysis(sessionPayload)) {
    return {
      key: 'ready_public',
      label: 'Ready for Public',
      variant: 'success',
    }
  }

  if (isSessionReadyForAnalysis(sessionPayload)) {
    return {
      key: 'ready_analysis',
      label: 'Ready for Analysis',
      variant: 'primary',
    }
  }

  return {
    key: 'draft',
    label: 'Draft',
    variant: 'warning',
  }
}

function summarizeCalrColumnQc(rows, columnName, validator) {
  const invalidRows = []

  rows.forEach((row, index) => {
    const value = Number(row?.[columnName])
    if (!Number.isFinite(value) || !validator(value)) {
      invalidRows.push(index + 1)
    }
  })

  return {
    checkedRowCount: rows.length,
    invalidCount: invalidRows.length,
    invalidRows,
    passed: rows.length > 0 && invalidRows.length === 0,
  }
}

export default {
  name: 'AccountView',
  components: {
    MetadataFieldInput,
    AnalysisPlotsPanel,
  },
  data() {
    return {
      store: appStore,
      maxGroups: 4,
      baseGroupCount: 2,
      metadataSections: EXPERIMENT_METADATA_SECTIONS,
      metadataFields: EXPERIMENT_METADATA_FIELDS,
      userFilesFields: [
        'name',
        'description',
        'uploaded_at',
        { key: 'state', label: 'State' },
        'status',
        'public',
        { key: 'shared', label: 'Share' },
        { key: 'actions', label: 'Actions', class: 'txt-right' },
      ],
      sessionEditor: createIncompleteSessionEditor(),
      presetDietOptions: PRESET_DIETS,
      showMetadataEditor: false,
      calrPreviewPage: 1,
      calrPreviewPageSize: 10,
      activeQcKey: '',
      qcFailureCursor: {
        energyExpenditure: 0,
        foodIntake: 0,
      },
      customDietOptions: [],
      showCustomDietEditor: false,
      customDietDraft: {
        name: '',
        kcal: '',
      },
      experimentDraft: {
        name: '',
        description: '',
        public: false,
      },
      editingExperimentFile: null,
      editingStandardFileEntry: null,
      editingSessionFileEntry: null,
      editingExperimentId: null,
      editingSessionId: null,
      editingOriginalConvertedCsv: '',
      metadataDraft: createEmptyMetadataDraft(),
      latestCreatedExperimentId: null,
      userFilesStatusRequestId: 0,
      saveMessage: '',
      foodCutoffManuallyEdited: false,
      sessionDragover: false,
      sessionImportName: '',
      sessionImportFormatError: false,
      sessionImportMessage: '',
      showCalrPreview: false,
      showSessionEditor: false,
      templateUploadDialog: {
        visible: false,
        type: '',
        title: '',
        dragover: false,
        fileName: '',
        message: '',
      },
      shareDialog: {
        visible: false,
        file: null,
        url: '',
        saving: false,
        message: '',
      },
      contributeDialog: {
        visible: false,
        file: null,
        saving: false,
        message: '',
      },
      confirmDialog: {
        visible: false,
        title: '',
        message: '',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        confirmVariant: 'primary',
        resolve: null,
      },
      builderGroupColors: {},
      builderAnalysisLoading: false,
      builderAnalysisRequestId: 0,
      builderAnalysisOptions: {
        removeOutliers: false,
      },
    }
  },
  computed: {
    hasConvertedData() {
      return Boolean(this.store.upload.convertedCSV)
    },
    dietOptions() {
      return [...this.presetDietOptions, ...this.customDietOptions].map((diet) => ({
        ...diet,
        label: diet.name,
      }))
    },
    canSaveCustomDiet() {
      return Boolean(this.customDietDraft.name.trim()) && this.customDietDraft.kcal !== ''
    },
    isEditingExperiment() {
      return this.editingExperimentId !== null
    },
    showEditingCalrDownload() {
      return this.isEditingExperiment && Boolean(this.editingExperimentFile) && Boolean(this.editingStandardFileEntry)
    },
    showEditingSessionDownload() {
      return this.isEditingExperiment && Boolean(this.editingExperimentFile) && Boolean(this.editingSessionFileEntry)
    },
    hasSavedCalrFile() {
      return this.showEditingCalrDownload
    },
    hasSavedSessionFile() {
      return this.showEditingSessionDownload && isSessionReadyForAnalysis(this.buildSessionPayload())
    },
    hasCompletePublicMetadata() {
      return hasRequiredPublicMetadata(this.buildMetadataPayload())
    },
    hasExperimentName() {
      return Boolean(this.experimentDraft.name.trim())
    },
    hasExperimentDescription() {
      return Boolean(this.experimentDraft.description.trim())
    },
    hasCalorimetryData() {
      return this.hasConvertedData
    },
    hasSessionConfiguration() {
      return isSessionReadyForAnalysis(this.buildSessionPayload())
    },
    shouldShowSessionEditor() {
      return this.showSessionEditor
    },
    highlightedUploadSystemFormat() {
      if (this.store.upload.detectedFileFormat) {
        return this.store.upload.detectedFileFormat
      }

      return this.showEditingCalrDownload ? normalizeSystemToUploadFormat(this.metadataDraft.system) : ''
    },
    canContinueToConfigure() {
      return this.hasConvertedData
    },
    totalCalrHours() {
      let minMinute = Infinity
      let maxMinute = -Infinity

      this.calrPreviewSourceRows.forEach((row) => {
        const minute = Number(row?.['exp.minute'])
        if (!Number.isFinite(minute)) {
          return
        }

        if (minute < minMinute) {
          minMinute = minute
        }

        if (minute > maxMinute) {
          maxMinute = minute
        }
      })

      if (!Number.isFinite(minMinute) || !Number.isFinite(maxMinute)) {
        return 'NA'
      }

      return Math.max(0, Math.round(((maxMinute - minMinute) / 60) * 100) / 100)
    },
    isSessionImportEnabled() {
      return this.canContinueToConfigure
    },
    isGroupsAndDietsComplete() {
      return this.sessionEditor.groups.length > 0 && this.sessionEditor.groups.every((group, index) => (
        Boolean(this.normalizedGroupName(group, index))
        && Boolean(group.color)
        && Boolean(group.diet_key)
        && Boolean(group.diet_name?.trim())
      ))
    },
    isSubjectsComplete() {
      if (!this.hasConvertedData || !this.sessionEditor.groups.length || !this.sessionEditor.subjects.length) {
        return false
      }

      const assignedGroups = new Set(
        this.sessionEditor.subjects
          .map((subject) => Number(subject.groupIndex))
          .filter((index) => Number.isInteger(index) && index >= 0 && index < this.sessionEditor.groups.length),
      )

      return this.sessionEditor.groups.every((_, index) => assignedGroups.has(index))
    },
    isRangesComplete() {
      return hasConfiguredCycleRange(this.sessionEditor.light_cycle_start, this.sessionEditor.dark_cycle_start)
    },
    foodCutoffReferenceKcalPerG() {
      if (!this.isGroupsAndDietsComplete) {
        return 0
      }

      const selectedDietCalories = this.sessionEditor.groups
        .map((group) => Number(group?.diet_kcal))
        .filter((value) => Number.isFinite(value) && value > 0)

      return selectedDietCalories.length
        ? Math.max(...selectedDietCalories)
        : 0
    },
    minimumFoodCutoffKcalPerHour() {
      if (!this.isGroupsAndDietsComplete) {
        return 0
      }

      return convertFoodCutoffMgPerMinToKcalPerHour(FOOD_CUTOFF_MIN_MG_PER_MIN, this.foodCutoffReferenceKcalPerG)
    },
    isFoodCutoffValid() {
      const cutoff = Number(this.sessionEditor.food_cutoff)
      return Number.isFinite(cutoff) && cutoff >= this.minimumFoodCutoffKcalPerHour
    },
    calrPreviewSourceRows() {
      return Array.isArray(this.store.upload.convertedJSON) ? this.store.upload.convertedJSON : []
    },
    energyExpenditureQc() {
      return summarizeCalrColumnQc(this.calrPreviewSourceRows, 'rer', (value) => value > 0.6 && value < 1.5)
    },
    foodIntakeQc() {
      return summarizeCalrColumnQc(this.calrPreviewSourceRows, 'feed', (value) => value >= 0)
    },
    highlightedPreviewRow() {
      const qc = this.getQcSummaryByKey(this.activeQcKey)
      if (!qc || !qc.invalidCount) {
        return null
      }

      return this.currentQcInvalidRow(this.activeQcKey)
    },
    calrPreviewPageCount() {
      return Math.max(1, Math.ceil(this.calrPreviewSourceRows.length / this.calrPreviewPageSize))
    },
    calrPreviewRows() {
      const previewFields = this.calrPreviewFields
      const startIndex = (this.calrPreviewPage - 1) * this.calrPreviewPageSize
      const pageRows = this.calrPreviewSourceRows.slice(startIndex, startIndex + this.calrPreviewPageSize)

      return pageRows.map((row, rowOffset) => previewFields.reduce((sanitizedRow, field) => {
        sanitizedRow[field.key] = row?.[field.label] ?? ''
        sanitizedRow._rowIndex = startIndex + rowOffset + 1
        return sanitizedRow
      }, {}))
    },
    calrPreviewFields() {
      const firstRow = this.calrPreviewSourceRows[0]

      return firstRow
        ? Object.keys(firstRow).map((key, index) => ({
            key: this.getCalrPreviewFieldKey(key, index),
            label: key,
          }))
        : []
    },
    calrPreviewRangeStart() {
      if (!this.calrPreviewSourceRows.length) {
        return 0
      }

      return (this.calrPreviewPage - 1) * this.calrPreviewPageSize + 1
    },
    calrPreviewRangeEnd() {
      return Math.min(this.calrPreviewPage * this.calrPreviewPageSize, this.calrPreviewSourceRows.length)
    },
    canContinueToReview() {
      return this.isGroupsAndDietsComplete && this.isSubjectsComplete && this.isRangesComplete
    },
    canSaveExperiment() {
      return this.hasConvertedData
        && Boolean(this.experimentDraft.name.trim())
        && Boolean(this.experimentDraft.description.trim())
    },
    saveRequirementChecklist() {
      return [
        { label: 'Name', complete: Boolean(this.experimentDraft.name.trim()) },
        { label: 'Description', complete: Boolean(this.experimentDraft.description.trim()) },
        { label: 'Calorimetry data', complete: this.hasConvertedData },
      ]
    },
    shareRequirementChecklist() {
      return [
        ...this.saveRequirementChecklist,
        { label: 'Session data', complete: isSessionReadyForAnalysis(this.buildSessionPayload()) },
      ]
    },
    contributeRequirementChecklist() {
      return [
        { label: 'Full metadata', complete: hasRequiredPublicMetadata(this.buildMetadataPayload()) },
        { label: 'Calorimetry data', complete: this.hasConvertedData },
        { label: 'Session data', complete: isSessionReadyForAnalysis(this.buildSessionPayload()) },
      ]
    },
    currentDraftStatus() {
      return buildExperimentStatus({
        hasConvertedData: this.hasConvertedData,
        sessionPayload: this.buildSessionPayload(),
        metadata: this.buildMetadataPayload(),
      })
    },
    latestCreatedExperiment() {
      return this.store.account.userFiles.find((file) => file.id === this.latestCreatedExperimentId) || null
    },
    builderExperimentRecord() {
      const builderExperimentId = this.isEditingExperiment
        ? this.editingExperimentId
        : this.latestCreatedExperimentId

      if (!builderExperimentId) {
        return null
      }

      return this.store.account.userFiles.find((file) => file.id === builderExperimentId) || null
    },
    builderExperimentIsPublic() {
      return Boolean(this.builderExperimentRecord?.public)
    },
    builderExperimentIsShared() {
      return Boolean(this.builderExperimentRecord?.shared)
    },
    canShareFromBuilder() {
      return Boolean(this.builderExperimentRecord)
        && this.isExperimentReadyForAnalysis(this.currentDraftStatus)
    },
    canContributeFromBuilder() {
      return Boolean(this.builderExperimentRecord)
        && this.currentDraftStatus.key === 'ready_public'
        && !this.builderExperimentIsPublic
    },
    shareButtonClass() {
      if (this.builderExperimentIsShared) {
        return 'btn-success'
      }

      return this.canShareFromBuilder ? 'btn-secondary' : 'btn-outline-secondary'
    },
    contributeButtonClass() {
      if (this.builderExperimentIsPublic) {
        return 'btn-success'
      }

      return this.canContributeFromBuilder ? 'btn-secondary' : 'btn-outline-secondary'
    },
    experimentCount() {
      return this.store.account.userFiles.length
    },
    shouldShowBuilderPlots() {
      return Boolean(this.store.builderAnalysis.current && this.store.builderAnalysis.analysisData)
    },
    builderAnalysisData() {
      return this.store.builderAnalysis.analysisData
    },
    builderSessionMetadata() {
      return this.store.builderAnalysis.analysisData?.session || { groupNames: [], colors: [], dietNames: [], dietCal: [] }
    },
    builderMaxHour() {
      const rows = this.store.builderAnalysis.analysisData?.rows || []
      let maxHour = null
      rows.forEach((row) => {
        const hour = Number(row?.hour)
        if (Number.isFinite(hour)) {
          maxHour = maxHour === null ? hour : Math.max(maxHour, hour)
        }
      })
      return maxHour === null ? 24 : Math.ceil(maxHour)
    },
  },
  async mounted() {
    if (this.store.auth.token && !this.store.account.userFiles.length) {
      await this.loadUserFiles()
    }
  },
  watch: {
    'store.auth.token'(nextToken) {
      if (nextToken && !this.store.account.userFiles.length) {
        this.loadUserFiles()
      }
    },
    'store.upload.convertedCSV'() {
      this.calrPreviewPage = 1
      this.activeQcKey = ''
      this.qcFailureCursor.energyExpenditure = 0
      this.qcFailureCursor.foodIntake = 0
    },
    calrPreviewPageCount(nextPageCount) {
      if (this.calrPreviewPage > nextPageCount) {
        this.calrPreviewPage = nextPageCount
      }
    },
  },
  methods: {
    formatDate,
    formatFileSize,
    formatQcFailureCount(invalidCount, checkedRowCount) {
      const safeInvalidCount = Number.isFinite(invalidCount) ? invalidCount : 0
      const safeCheckedRowCount = Number.isFinite(checkedRowCount) ? checkedRowCount : 0
      const formattedInvalidCount = safeInvalidCount.toLocaleString()
      const formattedCheckedRowCount = safeCheckedRowCount.toLocaleString()

      if (!safeCheckedRowCount) {
        return `${formattedInvalidCount} of ${formattedCheckedRowCount}`
      }

      const percent = roundToTwo((safeInvalidCount / safeCheckedRowCount) * 100)
      return `${formattedInvalidCount} of ${formattedCheckedRowCount} (${percent}%)`
    },
    setAuthMode(mode) {
      if (this.store.auth.mode === mode) {
        return
      }

      this.store.auth.mode = mode
      this.store.auth.message = ''

      if (mode === 'create') {
        this.store.auth.username = ''
        this.store.auth.password = ''
      }
    },
    submitAuth() {
      if (this.store.auth.mode === 'create') {
        this.handleCreateAccount()
        return
      }

      this.handleLogin()
    },
    validateCredentials() {
      this.store.auth.message = ''

      if (!this.store.auth.username.trim()) {
        this.store.auth.message = 'Missing email'
        return false
      }

      if (!this.store.auth.password.trim()) {
        this.store.auth.message = 'Missing password'
        return false
      }

      return true
    },
    async handleLogin() {
      if (!this.validateCredentials()) {
        return
      }

      this.store.loaders.login = true

      try {
        const response = await login(this.store.auth.username.trim(), this.store.auth.password)
        this.store.auth.token = response.access
        this.store.auth.userInfo = response
        this.store.auth.message = ''
        await this.loadUserFiles()
      } catch (error) {
        this.store.auth.message = error.message || 'Login failed'
      } finally {
        this.store.loaders.login = false
      }
    },
    async handleCreateAccount() {
      if (!this.validateCredentials()) {
        return
      }

      this.store.loaders.createAccount = true

      try {
        await createUser(this.store.auth.username.trim(), this.store.auth.password)
        this.store.auth.mode = 'login'
        this.store.auth.message = 'Account created. Log in to continue.'
      } catch (error) {
        this.store.auth.message = error.message || 'Account creation failed'
      } finally {
        this.store.loaders.createAccount = false
      }
    },
    handleLogout() {
      this.store.auth.password = ''
      this.store.auth.message = ''
      this.store.auth.token = null
      this.store.auth.userInfo = null
      this.store.account.userCreatingNew = false
      this.store.account.userFiles = []
      this.store.auth.mode = 'login'
    },
    getUserFileRowClass(item) {
      if (!item) {
        return ''
      }

      return this.shareDialog.file?.id === item.id ? 'user-file-row--sharing' : ''
    },
    formatMetadataValue(value) {
      if (Array.isArray(value)) {
        return value.length ? value.join(', ') : 'NA'
      }

      return value === null || value === undefined || value === '' ? 'NA' : `${value}`
    },
    formatHourRange(range) {
      return `${Math.floor(Number(range[0]) || 0)} to ${Math.floor(Number(range[1]) || 0)}`
    },
    getQcSummaryByKey(qcKey) {
      if (qcKey === 'energyExpenditure') {
        return this.energyExpenditureQc
      }

      if (qcKey === 'foodIntake') {
        return this.foodIntakeQc
      }

      return null
    },
    currentQcInvalidRow(qcKey) {
      const qc = this.getQcSummaryByKey(qcKey)
      if (!qc?.invalidCount) {
        return null
      }

      const cursor = Math.min(this.qcFailureCursor[qcKey] || 0, qc.invalidRows.length - 1)
      return qc.invalidRows[cursor]
    },
    currentQcInvalidLabel(qcKey) {
      const qc = this.getQcSummaryByKey(qcKey)
      if (!qc?.invalidCount) {
        return ''
      }

      const cursor = Math.min(this.qcFailureCursor[qcKey] || 0, qc.invalidRows.length - 1)
      return `${cursor + 1} of ${qc.invalidCount}`
    },
    getFoodCutoffFromValue(value) {
      const numericValue = Number(value)
      return Number.isFinite(numericValue) ? numericValue : null
    },
    syncFoodCutoffDefault() {
      if (this.foodCutoffManuallyEdited) {
        return
      }

      this.sessionEditor.food_cutoff = this.isGroupsAndDietsComplete
        ? this.minimumFoodCutoffKcalPerHour
        : 0
    },
    initializeFoodCutoffState() {
      const cutoff = this.getFoodCutoffFromValue(this.sessionEditor.food_cutoff)

      if (!this.isGroupsAndDietsComplete) {
        this.foodCutoffManuallyEdited = false
        this.sessionEditor.food_cutoff = 0
        return
      }

      this.foodCutoffManuallyEdited = cutoff !== null
        && cutoff > 0
        && Math.abs(cutoff - this.minimumFoodCutoffKcalPerHour) > 0.01

      if (!this.foodCutoffManuallyEdited) {
        this.syncFoodCutoffDefault()
      }
    },
    handleFoodCutoffInput() {
      this.foodCutoffManuallyEdited = true
    },
    isQcActive(qcKey) {
      return this.activeQcKey === qcKey
    },
    showQcInTable(qcKey) {
      const qc = this.getQcSummaryByKey(qcKey)
      if (!qc?.invalidCount) {
        return
      }

      this.showCalrPreview = true
      this.qcFailureCursor[qcKey] = 0
      this.activeQcKey = qcKey
      this.goToCalrPreviewRow(qc.invalidRows[0])
    },
    clearQcTableFocus() {
      this.activeQcKey = ''
    },
    focusQcFailure(qcKey) {
      const targetRow = this.currentQcInvalidRow(qcKey)
      if (!targetRow) {
        return
      }

      this.showCalrPreview = true
      this.activeQcKey = qcKey
      this.goToCalrPreviewRow(targetRow)
    },
    stepQcFailure(qcKey, direction) {
      const qc = this.getQcSummaryByKey(qcKey)
      if (!qc?.invalidCount) {
        return
      }

      const currentCursor = this.qcFailureCursor[qcKey] || 0
      const nextCursor = (currentCursor + direction + qc.invalidRows.length) % qc.invalidRows.length
      this.qcFailureCursor[qcKey] = nextCursor
      this.focusQcFailure(qcKey)
    },
    formatDietKcal(value) {
      return value === null || value === '' || value === undefined ? '' : `${value}`
    },
    getCalrPreviewFieldKey(key, index) {
      return `field_${index}_${key.replace(/[^a-zA-Z0-9_]/g, '_')}`
    },
    goToCalrPreviewPage(page) {
      const safePage = Math.min(Math.max(Number(page) || 1, 1), this.calrPreviewPageCount)
      this.calrPreviewPage = safePage
    },
    goToCalrPreviewRow(rowNumber) {
      const numericRow = Number(rowNumber)
      if (!Number.isFinite(numericRow) || numericRow < 1) {
        return
      }

      const targetPage = Math.ceil(numericRow / this.calrPreviewPageSize)
      this.goToCalrPreviewPage(targetPage)
    },
    getCalrPreviewRowClass(item, type) {
      if (type !== 'row' || !item) {
        return ''
      }

      return item._rowIndex === this.highlightedPreviewRow ? 'preview-table__row--highlighted' : ''
    },
    getSystemForDetectedFormat(format) {
      if (format === 'oxymax') {
        return 'CLAMS'
      }

      if (format === 'tse') {
        return 'TSE'
      }

      if (format === 'sable') {
        return 'Sable'
      }

      return ''
    },
    floorHourRange(range = []) {
      return [
        Math.floor(Number(range[0]) || 0),
        Math.floor(Number(range[1]) || 0),
      ]
    },
    readMetadataValue(source, key) {
      return getStatusMetadataValue(source, key) ?? ''
    },
    normalizeConfiguredMetadataValue(field, value) {
      if (typeof value !== 'string' || !Array.isArray(field.options)) {
        return value
      }

      const trimmedValue = value.trim()
      if (!trimmedValue) {
        return ''
      }

      const matchingOption = field.options.find((option) => option.toLowerCase() === trimmedValue.toLowerCase())
      return matchingOption || value
    },
    resetMetadataDraft(source = null) {
      const nextDraft = createEmptyMetadataDraft()

      this.metadataFields.forEach((field) => {
        const value = this.readMetadataValue(source, field.key)
        nextDraft[field.key] = Array.isArray(value)
          ? [...value]
          : this.normalizeConfiguredMetadataValue(field, value)
      })

      this.metadataDraft = nextDraft
    },
    toggleMetadataDetails(file) {
      file._showDetails = !file._showDetails
    },
    toggleMetadataEditor() {
      this.showMetadataEditor = !this.showMetadataEditor
    },
    toggleCalrPreview() {
      this.showCalrPreview = !this.showCalrPreview
    },
    openSessionConfiguration() {
      this.showCalrPreview = false
      this.showSessionEditor = true
    },
    toggleSessionEditor() {
      this.showSessionEditor = !this.showSessionEditor
    },
    buildMetadataPayload() {
      const numberOrNull = (value) => (value === '' || value === null || value === undefined ? null : Number(value))
      const payload = {
        name: this.experimentDraft.name.trim() || null,
        description: this.experimentDraft.description.trim() || null,
      }

      this.metadataFields.forEach((field) => {
        const value = this.metadataDraft[field.key]

        if (field.type === 'number') {
          payload[field.key] = numberOrNull(value)
          return
        }

        if (typeof value === 'string') {
          payload[field.key] = value.trim() || null
          return
        }

        payload[field.key] = value || null
      })

      return payload
    },
    buildExperimentStatusInfo(hasConvertedData, sessionPayload, metadata) {
      return buildExperimentStatus({
        hasConvertedData,
        sessionPayload,
        metadata,
      })
    },
    buildShareUrl(submissionId) {
      if (!submissionId) {
        return ''
      }

      const resolvedRoute = this.$router.resolve({
        path: '/analysis',
        query: {
          share: submissionId,
        },
      })

      const shareHash = resolvedRoute.href.includes('#')
        ? resolvedRoute.href.slice(resolvedRoute.href.indexOf('#'))
        : `#${resolvedRoute.fullPath}`
      const currentBase = window.location.href.split('#')[0]

      return `${currentBase}${shareHash}`
    },
    buildLoadingStatusInfo(hasConvertedData, metadata) {
      if (!hasConvertedData) {
        return this.buildExperimentStatusInfo(hasConvertedData, {}, metadata)
      }

      return {
        key: 'loading',
        label: 'Checking...',
        variant: 'secondary',
      }
    },
    buildUserFileRecord(file) {
      const standard = file.files?.find((item) => item.file_type === 'standard')
      const session = file.files?.find((item) => item.file_type === 'session')
      const hasConvertedData = Boolean(standard)
      const hasSession = Boolean(session)

      return {
        ...file,
        loading: false,
        loadingProgress: null,
        shareSaving: false,
        statusLoading: hasSession,
        statusInfo: hasSession
          ? this.buildLoadingStatusInfo(hasConvertedData, file)
          : this.buildExperimentStatusInfo(hasConvertedData, {}, file),
      }
    },
    async hydrateUserFileStatuses(requestId, files) {
      await Promise.allSettled(files.map(async (file) => {
        const session = file.files?.find((item) => item.file_type === 'session')

        if (!session) {
          return
        }

        let sessionPayload = {}

        try {
          const [sessionConfig, sessionCsv] = await Promise.all([
            fetchSessionConfig(session.id, this.store.auth.token),
            fetchSessionFile(session.id, this.store.auth.token),
          ])
          sessionPayload = mergeSessionCsvIntoPayload(parseCsv(sessionCsv), sessionConfig)
        } catch (error) {
          sessionPayload = {}
        }

        if (requestId !== this.userFilesStatusRequestId) {
          return
        }

        const targetFile = this.store.account.userFiles.find((item) => item.id === file.id)
        if (!targetFile) {
          return
        }

        targetFile.statusInfo = this.buildExperimentStatusInfo(
          Boolean(file.files?.find((item) => item.file_type === 'standard')),
          sessionPayload,
          file,
        )
        targetFile.statusLoading = false
      }))
    },
    isExperimentReadyForAnalysis(statusInfo) {
      return statusInfo?.key === 'ready_analysis' || statusInfo?.key === 'ready_public'
    },
    normalizedGroupName(group, index) {
      return group.name.trim() || `Group ${index + 1}`
    },
    createCustomDietId() {
      return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    },
    findDietOptionById(id) {
      return this.dietOptions.find((option) => option.id === id) || null
    },
    findMatchingDietOption(group) {
      const normalizedName = (group.diet_name || '').trim().toLowerCase()
      const normalizedKcal = group.diet_kcal === null || group.diet_kcal === undefined || group.diet_kcal === ''
        ? null
        : Number(group.diet_kcal)

      return this.dietOptions.find((option) =>
        option.name.trim().toLowerCase() === normalizedName && Number(option.kcal) === normalizedKcal,
      ) || null
    },
    ensureDietOption(group, fallbackIndex = 0) {
      const match = this.findMatchingDietOption(group)
      if (match) {
        return match.id
      }

      if (!group.diet_name || group.diet_kcal === null || group.diet_kcal === undefined || group.diet_kcal === '') {
        return ''
      }

      const customOption = {
        id: this.createCustomDietId(),
        name: group.diet_name,
        kcal: Number(group.diet_kcal),
      }
      this.customDietOptions.push(customOption)
      return customOption.id
    },
    syncGroupDietSelections() {
      this.sessionEditor.groups.forEach((group, index) => {
        group.diet_key = this.ensureDietOption(group, index)
        this.applyGroupDietSelection(group, false)
      })

      this.syncFoodCutoffDefault()
    },
    applyGroupDietSelection(group, overwrite = true) {
      const selectedDiet = this.findDietOptionById(group.diet_key)
      if (!selectedDiet) {
        return
      }

      if (overwrite || !group.diet_name) {
        group.diet_name = selectedDiet.name
      }

      if (overwrite || group.diet_kcal === null || group.diet_kcal === undefined || group.diet_kcal === '') {
        group.diet_kcal = selectedDiet.kcal
      }

      this.syncFoodCutoffDefault()
    },
    saveCustomDiet() {
      if (!this.canSaveCustomDiet) {
        return
      }

      const existing = this.dietOptions.find((option) =>
        option.name.trim().toLowerCase() === this.customDietDraft.name.trim().toLowerCase()
        && Number(option.kcal) === Number(this.customDietDraft.kcal),
      )

      const selectedId = existing
        ? existing.id
        : (() => {
            const option = {
              id: this.createCustomDietId(),
              name: this.customDietDraft.name.trim(),
              kcal: Number(this.customDietDraft.kcal),
            }
            this.customDietOptions.push(option)
            return option.id
          })()

      const lastGroup = this.sessionEditor.groups[this.sessionEditor.groups.length - 1]
      if (lastGroup && !lastGroup.diet_name) {
        lastGroup.diet_key = selectedId
        this.applyGroupDietSelection(lastGroup)
      }

      this.customDietDraft = {
        name: '',
        kcal: '',
      }
      this.showCustomDietEditor = false
    },
    triggerCsvDownload(filename, text) {
      const blob = new Blob([text], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    },
    getTemplateConfig(type) {
      if (type === 'weights') {
        return {
          title: 'Weights Template',
          filename: 'weights_template.csv',
          headers: ['', 'Total.Mass', 'Lean.Mass', 'Fat.Mass'],
        }
      }

      return {
        title: 'Mass Change Template',
        filename: 'mass_change_template.csv',
        headers: ['', 'Mass.Change'],
      }
    },
    buildTemplateCsv(type) {
      const { headers } = this.getTemplateConfig(type)
      const subjectRows = this.sessionEditor.subjects.map((subject) => {
        if (type === 'weights') {
          return [subject.subject, '', '', '']
        }

        return [subject.subject, '']
      })

      return [headers, ...subjectRows]
        .map((row) => row.map((value) => `${value ?? ''}`).join(','))
        .join('\n')
    },
    downloadTemplate(type) {
      const { filename } = this.getTemplateConfig(type)
      this.triggerCsvDownload(filename, this.buildTemplateCsv(type))
    },
    openTemplateUploadModal(type) {
      const { title } = this.getTemplateConfig(type)
      this.templateUploadDialog.visible = true
      this.templateUploadDialog.type = type
      this.templateUploadDialog.title = `Upload ${title}`
      this.templateUploadDialog.dragover = false
      this.templateUploadDialog.fileName = ''
      this.templateUploadDialog.message = ''
    },
    closeTemplateUploadModal() {
      this.templateUploadDialog.visible = false
      this.templateUploadDialog.type = ''
      this.templateUploadDialog.title = ''
      this.templateUploadDialog.dragover = false
      this.templateUploadDialog.fileName = ''
      this.templateUploadDialog.message = ''

      if (this.$refs.templateUploadInput) {
        this.$refs.templateUploadInput.value = ''
      }
    },
    openShareDialog(file) {
      if (!this.isExperimentReadyForAnalysis(file.statusInfo)) {
        return
      }

      this.shareDialog.visible = true
      this.shareDialog.file = file
      this.shareDialog.url = this.buildShareUrl(file.id)
      this.shareDialog.saving = false
      this.shareDialog.message = ''
    },
    closeShareDialog() {
      this.shareDialog.visible = false
      this.shareDialog.file = null
      this.shareDialog.url = ''
      this.shareDialog.saving = false
      this.shareDialog.message = ''
    },
    openBuilderShareDialog() {
      if (!this.canShareFromBuilder || !this.builderExperimentRecord) {
        return
      }

      this.openShareDialog(this.builderExperimentRecord)
    },
    openContributeDialog(file) {
      this.contributeDialog.visible = true
      this.contributeDialog.file = file
      this.contributeDialog.saving = false
      this.contributeDialog.message = ''
    },
    openBuilderContributeDialog() {
      if ((!this.canContributeFromBuilder && !this.builderExperimentIsPublic) || !this.builderExperimentRecord) {
        return
      }

      this.openContributeDialog(this.builderExperimentRecord)
    },
    closeContributeDialog() {
      this.contributeDialog.visible = false
      this.contributeDialog.file = null
      this.contributeDialog.saving = false
      this.contributeDialog.message = ''
    },
    async toggleContributeDialogPublic(makePublic) {
      if (!this.contributeDialog.file) {
        return
      }

      this.contributeDialog.saving = true
      this.contributeDialog.message = ''

      try {
        const response = await updateExperimentPublicStatus(
          this.contributeDialog.file.id,
          makePublic,
          this.store.auth.token,
        )
        this.contributeDialog.file.public = response.public

        if (this.editingExperimentFile?.id === this.contributeDialog.file.id) {
          this.editingExperimentFile.public = response.public
        }
      } catch (error) {
        this.contributeDialog.message = error.message || 'Unable to update public status.'
      } finally {
        this.contributeDialog.saving = false
      }
    },
    async setExperimentShared(file, makeShared) {
      if (!file) {
        return
      }

      file.shareSaving = true
      if (this.shareDialog.file?.id === file.id) {
        this.shareDialog.saving = true
        this.shareDialog.message = ''
      }

      try {
        const response = await updateExperimentSharedStatus(file.id, makeShared, this.store.auth.token)
        file.shared = Boolean(response.shared)
        if (this.shareDialog.file?.id === file.id) {
          this.shareDialog.file = file
          this.shareDialog.url = this.buildShareUrl(file.id)
        }
      } catch (error) {
        if (this.shareDialog.file?.id === file.id) {
          this.shareDialog.message = error.message || 'Unable to update share status.'
        }
        throw error
      } finally {
        file.shareSaving = false
        if (this.shareDialog.file?.id === file.id) {
          this.shareDialog.saving = false
        }
      }
    },
    async toggleShareDialogSharing(makeShared) {
      if (!this.shareDialog.file) {
        return
      }

      try {
        await this.setExperimentShared(this.shareDialog.file, makeShared)
      } catch (error) {
        // Dialog message already set.
      }
    },
    async copyShareUrl() {
      if (!this.shareDialog.file) {
        return
      }

      try {
        if (!this.shareDialog.file.shared) {
          await this.setExperimentShared(this.shareDialog.file, true)
        }

        if (!navigator?.clipboard?.writeText) {
          throw new Error('Clipboard access is unavailable in this browser.')
        }

        await navigator.clipboard.writeText(this.shareDialog.url)
        this.shareDialog.message = 'Share URL copied.'
      } catch (error) {
        this.shareDialog.message = error.message || 'Unable to copy share URL.'
      }
    },
    openTemplateUploadFileDialog() {
      this.$refs.templateUploadInput?.click()
    },
    async handleTemplateUploadFileSelect(event) {
      const [file] = Array.from(event.target.files || [])
      await this.importTemplateFile(file)
    },
    async handleTemplateUploadDrop(event) {
      this.templateUploadDialog.dragover = false
      const [file] = Array.from(event.dataTransfer.files || [])
      await this.importTemplateFile(file)
    },
    resolveTemplateSubjectId(row) {
      const value = row?.[''] ?? row?.id ?? row?.subject ?? row?.Subject ?? row?.['Subject ID']
      return value === null || value === undefined ? '' : `${value}`.trim()
    },
    applyTemplateRows(type, rows) {
      const subjectsById = new Map(this.sessionEditor.subjects.map((subject) => [`${subject.subject}`, subject]))
      let matchedRows = 0

      rows.forEach((row) => {
        const subjectId = this.resolveTemplateSubjectId(row)
        const subject = subjectsById.get(subjectId)

        if (!subject) {
          return
        }

        matchedRows += 1

        if (type === 'weights') {
          subject.total_mass = row['Total.Mass'] === '' || row['Total.Mass'] == null ? null : row['Total.Mass']
          subject.lean_mass = row['Lean.Mass'] === '' || row['Lean.Mass'] == null ? null : row['Lean.Mass']
          subject.fat_mass = row['Fat.Mass'] === '' || row['Fat.Mass'] == null ? null : row['Fat.Mass']
          return
        }

        subject.mass_change = row['Mass.Change'] === '' || row['Mass.Change'] == null ? null : row['Mass.Change']
      })

      if (!matchedRows) {
        throw new Error('No matching subject IDs were found in the uploaded template.')
      }

      return matchedRows
    },
    async importTemplateFile(file) {
      if (!file || !this.templateUploadDialog.type) {
        return
      }

      try {
        const csvText = await file.text()
        const rows = parseCsv(csvText)
        const matchedRows = this.applyTemplateRows(this.templateUploadDialog.type, rows)
        this.templateUploadDialog.fileName = file.name
        this.templateUploadDialog.message = `Imported template values for ${matchedRows} subject${matchedRows === 1 ? '' : 's'}.`
      } catch (error) {
        this.templateUploadDialog.message = error.message || 'Unable to import template CSV.'
      } finally {
        this.templateUploadDialog.dragover = false
        if (this.$refs.templateUploadInput) {
          this.$refs.templateUploadInput.value = ''
        }
      }
    },
    openFileDialog() {
      this.$refs.fileInput?.click()
    },
    openSessionFileDialog() {
      if (!this.isSessionImportEnabled) {
        return
      }

      this.$refs.sessionFileInput?.click()
    },
    async handleFileSelect(event) {
      const files = Array.from(event.target.files || [])
      await this.processSelectedFiles(files)
    },
    async handleSessionFileSelect(event) {
      const [file] = Array.from(event.target.files || [])
      await this.importSessionFile(file)
    },
    async handleSessionFileDrop(event) {
      if (!this.isSessionImportEnabled) {
        return
      }

      this.sessionDragover = false
      const [file] = Array.from(event.dataTransfer.files || [])
      await this.importSessionFile(file)
    },
    async importSessionFile(file) {

      if (!file || !this.hasConvertedData) {
        return
      }

      try {
        const csvText = await file.text()
        const sessionHeaders = this.getSessionCsvHeaders(csvText)
        const groupColumns = sessionHeaders.filter((header) => /^group\d+$/i.test(header))
        const hasGroupNames = sessionHeaders.includes('group_names')

        this.sessionImportName = file.name

        if (groupColumns.length < 2 || !hasGroupNames) {
          this.sessionImportFormatError = true
          this.sessionImportMessage = ''
          return
        }

        const rows = parseCsv(csvText)
        this.sessionEditor = mergeSessionCsvIntoPayload(rows, this.sessionEditor)
        this.initializeFoodCutoffState()
        this.syncGroupDietSelections()
        this.sessionImportFormatError = false
        this.sessionImportMessage = 'Session CSV imported'
        this.showSessionEditor = true
      } catch (error) {
        this.sessionImportFormatError = false
        this.sessionImportMessage = error.message || 'Unable to load session CSV'
      } finally {
        this.sessionDragover = false
        if (this.$refs.sessionFileInput) {
          this.$refs.sessionFileInput.value = ''
        }
      }
    },
    async handleDrop(event) {
      this.store.upload.dragover = false
      const files = Array.from(event.dataTransfer.files || [])
      await this.processSelectedFiles(files)
    },
    async processSelectedFiles(files) {
      this.resetUploadSelection(false)
      this.store.upload.files = files
      this.saveMessage = ''
      this.sessionImportName = ''
      this.sessionImportMessage = ''

      if (!files.length) {
        return
      }

      try {
        const format = await this.detectFormat(files[0])
        this.store.upload.formatError = false
        this.store.upload.detectedFileFormat = format

        if (format === 'calr') {
          const csvText = await files[0].text()
          this.hydrateSessionEditorFromCalrCsv(csvText)
          this.store.upload.isCalrFormat = true
          this.store.upload.textResponse = ''
          return
        }

        this.store.upload.isCalrFormat = false
        this.store.upload.textResponse = ''
      } catch (error) {
        this.store.upload.formatError = true
        this.store.upload.detectedFileFormat = ''
        this.store.upload.isCalrFormat = false
        this.store.upload.textResponse = ''
      }
    },
    resetUploadSelection(clearInput = true) {
      this.store.upload.files = []
      this.store.upload.dragover = false
      this.store.upload.loading = false
      this.store.upload.textResponse = ''
      this.store.upload.formatError = false
      this.store.upload.isCalrFormat = false
      this.store.upload.detectedFileFormat = ''
      this.store.upload.convertedCSV = ''
      this.store.upload.convertedJSON = null
      this.calrPreviewPage = 1
      this.sessionEditor = createIncompleteSessionEditor()
      this.customDietOptions = []
      this.showCustomDietEditor = false
      this.customDietDraft = {
        name: '',
        kcal: '',
      }
      this.closeTemplateUploadModal()
      this.showMetadataEditor = false
      this.foodCutoffManuallyEdited = false
      this.sessionDragover = false
      this.sessionImportName = ''
      this.sessionImportFormatError = false
      this.sessionImportMessage = ''
      this.showCalrPreview = false
      this.showSessionEditor = this.isEditingExperiment
      if (clearInput && this.$refs.fileInput) {
        this.$refs.fileInput.value = ''
      }
      if (clearInput && this.$refs.sessionFileInput) {
        this.$refs.sessionFileInput.value = ''
      }
    },
    beginCalrReupload() {
      this.resetUploadSelection()
      this.editingStandardFileEntry = null
      this.editingSessionFileEntry = null
      this.editingSessionId = null
      this.activeQcKey = ''
      this.qcFailureCursor.energyExpenditure = 0
      this.qcFailureCursor.foodIntake = 0
    },
    beginSessionReupload() {
      this.editingSessionFileEntry = null
      this.sessionImportName = ''
      this.sessionImportFormatError = false
      this.sessionImportMessage = ''
      this.showSessionEditor = true
      if (this.$refs.sessionFileInput) {
        this.$refs.sessionFileInput.value = ''
      }
    },
    async loadBuilderAnalysisData(file) {
      const target = file || this.builderExperimentRecord
      if (!target) {
        return
      }

      const session = target.files?.find((item) => item.file_type === 'session')
      if (!session) {
        return
      }

      const requestId = this.builderAnalysisRequestId + 1
      this.builderAnalysisRequestId = requestId
      this.builderAnalysisLoading = true
      try {
        const [enrichedPayload, sessionConfig] = await Promise.all([
          fetchEnrichedSession(session.id, this.store.auth.token, target.public),
          fetchSessionConfig(session.id, this.store.auth.token, target.public),
        ])

        const currentBuilderTargetId = this.isEditingExperiment
          ? this.editingExperimentId
          : this.latestCreatedExperimentId

        if (
          requestId !== this.builderAnalysisRequestId
          || !this.store.account.userCreatingNew
          || currentBuilderTargetId !== target.id
        ) {
          return
        }

        const analysisData = normalizeEnrichedAnalysisData(enrichedPayload, {
          numericalColumns,
          sessionConfig,
        })

        this.store.builderAnalysis.current = target
        this.store.builderAnalysis.analysisData = analysisData

        if (this.store.builderAnalysis.analysisSessionId !== session.id) {
          this.store.builderAnalysis.analysisSessionId = session.id
          this.store.builderAnalysis.qcResults = null
          this.store.builderAnalysis.powerResults = null
          this.store.builderAnalysis.ancovaResults = null
          this.store.builderAnalysis.analysisErrors.qc = null
          this.store.builderAnalysis.analysisErrors.power = null
          this.store.builderAnalysis.analysisErrors.ancova = null
        }

        const fallbackPalette = ['#3B73C7', '#ED5F00', '#2E8B57', '#8B5CF6', '#B45309', '#D64550']
        const nextGroupColors = {}
        const session_ = analysisData.session
        session_.groupNames.forEach((groupName, index) => {
          nextGroupColors[groupName] = session_.colors[index] || fallbackPalette[index % fallbackPalette.length]
        })
        this.builderGroupColors = nextGroupColors
      } catch {
        // Analysis loading is best-effort; don't surface errors in the builder UI
      } finally {
        if (requestId === this.builderAnalysisRequestId) {
          this.builderAnalysisLoading = false
        }
      }
    },
    clearBuilderAnalysis() {
      this.builderAnalysisRequestId += 1
      this.builderAnalysisLoading = false
      this.store.builderAnalysis.current = null
      this.store.builderAnalysis.analysisData = null
      this.store.builderAnalysis.analysisSessionId = null
      this.store.builderAnalysis.qcResults = null
      this.store.builderAnalysis.powerResults = null
      this.store.builderAnalysis.ancovaResults = null
      this.store.builderAnalysis.analysisErrors.qc = null
      this.store.builderAnalysis.analysisErrors.power = null
      this.store.builderAnalysis.analysisErrors.ancova = null
      this.builderGroupColors = {}
    },
    clearSelectedFiles(clearInput = true) {
      this.resetUploadSelection(clearInput)
      this.editingExperimentFile = null
      this.editingStandardFileEntry = null
      this.editingSessionFileEntry = null
      this.editingExperimentId = null
      this.editingSessionId = null
      this.editingOriginalConvertedCsv = ''
      this.resetMetadataDraft()
      this.latestCreatedExperimentId = null
      this.clearBuilderAnalysis()
    },
    resetCreateFlow() {
      this.clearSelectedFiles()
      this.experimentDraft = {
        name: this.defaultExperimentName(),
        description: '',
        public: false,
      }
      this.resetMetadataDraft()
      this.saveMessage = ''
    },
    openConfirmDialog({
      title,
      message,
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      confirmVariant = 'primary',
    }) {
      return new Promise((resolve) => {
        this.confirmDialog = {
          visible: true,
          title,
          message,
          confirmLabel,
          cancelLabel,
          confirmVariant,
          resolve,
        }
      })
    },
    approveConfirmDialog() {
      const { resolve } = this.confirmDialog
      this.confirmDialog = {
        visible: false,
        title: '',
        message: '',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        confirmVariant: 'primary',
        resolve: null,
      }
      resolve?.(true)
    },
    cancelConfirmDialog() {
      const { resolve } = this.confirmDialog
      this.confirmDialog = {
        visible: false,
        title: '',
        message: '',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        confirmVariant: 'primary',
        resolve: null,
      }
      resolve?.(false)
    },
    async confirmBuilderReplacement(targetModeLabel) {
      if (!this.store.account.userCreatingNew) {
        return true
      }

      const currentModeLabel = this.isEditingExperiment
        ? `editing ${this.experimentDraft.name.trim() || 'this experiment'}`
        : 'creating a new experiment'

      return this.openConfirmDialog({
        title: 'Discard Unsaved Changes?',
        message: `You are currently ${currentModeLabel}. Discard those unsaved changes and continue to ${targetModeLabel}?`,
        confirmLabel: 'Discard and Continue',
        cancelLabel: 'Keep Current Draft',
        confirmVariant: 'danger',
      })
    },
    async startCreateExperiment() {
      if (this.store.account.userCreatingNew && !this.isEditingExperiment) {
        this.showMetadataEditor = false
        return
      }

      if (!await this.confirmBuilderReplacement('a new experiment')) {
        return
      }

      this.store.account.userCreatingNew = true
      this.resetCreateFlow()
      this.showMetadataEditor = false
    },
    cancelCreateExperiment() {
      this.store.account.userCreatingNew = false
      this.resetCreateFlow()
    },
    closeBuilderTab() {
      this.cancelCreateExperiment()
    },
    defaultExperimentName() {
      return ``
    },
    clearImportedSession() {
      if (!this.store.upload.convertedCSV) {
        return
      }

      this.sessionImportName = ''
      this.sessionImportFormatError = false
      this.sessionImportMessage = ''
      this.hydrateBuilder(this.store.upload.convertedCSV)
    },
    hydrateBuilder(csvText, sessionPayload = null) {
      const parsedRows = ensureExpMinute(parseCsv(csvText))
      this.store.upload.convertedCSV = csvText
      this.store.upload.convertedJSON = parsedRows
      this.sessionEditor = sessionPayload
        ? normalizeSessionPayload(sessionPayload)
        : createIncompleteSessionEditor(inferSessionPayloadFromCalrData(parsedRows))
      this.sessionEditor.hour_range = this.floorHourRange(this.sessionEditor.hour_range)
      this.initializeFoodCutoffState()
      this.syncGroupDietSelections()
    },
    hydrateSessionEditorFromCalrCsv(csvText) {
      this.hydrateBuilder(csvText)

      if (!this.experimentDraft.name.trim()) {
        this.experimentDraft.name = this.defaultExperimentName()
      }
    },
    async convertSelectedFiles() {
      if (!this.store.upload.files.length) {
        return
      }

      this.store.loaders.convertFile = true
      this.saveMessage = ''

      try {
        const csvText = await convertInstrumentFiles(this.store.upload.files)
        this.hydrateSessionEditorFromCalrCsv(csvText)
        if (!this.isEditingExperiment) {
          const detectedSystem = this.getSystemForDetectedFormat(this.store.upload.detectedFileFormat)
          if (detectedSystem) {
            this.metadataDraft.system = detectedSystem
          }
        }
        this.store.upload.textResponse = ''
      } catch (error) {
        this.store.upload.textResponse = error.message || 'Conversion failed.'
      } finally {
        this.store.loaders.convertFile = false
      }
    },
    addGroup() {
      if (this.sessionEditor.groups.length >= this.maxGroups) {
        return
      }

      const nextIndex = this.sessionEditor.groups.length
      this.sessionEditor.groups.push({
        name: `Group ${nextIndex + 1}`,
        diet_name: '',
        diet_kcal: null,
        diet_key: '',
        color: DEFAULT_GROUP_COLORS[nextIndex % DEFAULT_GROUP_COLORS.length],
      })
    },
    removeGroup(index) {
      if (this.sessionEditor.groups.length <= 2) {
        return
      }

      this.sessionEditor.groups.splice(index, 1)
      this.sessionEditor.subjects.forEach((subject) => {
        if (subject.groupIndex === index) {
          subject.groupIndex = 0
        } else if (subject.groupIndex > index) {
          subject.groupIndex -= 1
        }
      })
    },
    buildSessionPayloadFromEditor(sessionEditor = this.sessionEditor) {
      const toNumberOrNull = (value) => (value === '' || value === null || value === undefined ? null : Number(value))
      const normalizedEditor = sessionEditor || createIncompleteSessionEditor()
      const usedNames = new Set()
      const groups = normalizedEditor.groups.map((group, index) => {
        const baseName = group.name.trim() || `Group ${index + 1}`
        let name = baseName
        let suffix = 2

        while (usedNames.has(name)) {
          name = `${baseName} ${suffix}`
          suffix += 1
        }

        usedNames.add(name)

        return {
          name,
          diet_name: group.diet_name?.trim() || '',
          diet_kcal: toNumberOrNull(group.diet_kcal),
          color: group.color || DEFAULT_GROUP_COLORS[index % DEFAULT_GROUP_COLORS.length],
        }
      })

      return {
        groups: groups.map(({ color, ...group }) => group),
        subjects: normalizedEditor.subjects.map((subject) => ({
          subject: subject.subject,
          groupIndex: Math.min(Math.max(Number(subject.groupIndex) || 0, 0), groups.length - 1),
          total_mass: toNumberOrNull(subject.total_mass),
          lean_mass: toNumberOrNull(subject.lean_mass),
          fat_mass: toNumberOrNull(subject.fat_mass),
          mass_change: toNumberOrNull(subject.mass_change),
          exc_hour: toNumberOrNull(subject.exc_hour),
          exc_reason: subject.exc_reason?.trim() || '',
        })),
        light_cycle_start: toNumberOrNull(normalizedEditor.light_cycle_start),
        dark_cycle_start: toNumberOrNull(normalizedEditor.dark_cycle_start),
        hour_range: [
          Math.floor(Number(normalizedEditor.hour_range?.[0]) || 0),
          Math.floor(Number(normalizedEditor.hour_range?.[1]) || 0),
        ],
        food_cutoff: Number(normalizedEditor.food_cutoff || 0),
        remove_outliers: Boolean(normalizedEditor.remove_outliers),
        group_colors: groups.reduce((accumulator, group) => {
          accumulator[group.name] = group.color
          return accumulator
        }, {}),
      }
    },
    buildSessionPayload() {
      return this.buildSessionPayloadFromEditor(this.sessionEditor)
    },
    buildDefaultSessionPayloadFromCsv(csvText) {
      const parsedRows = ensureExpMinute(parseCsv(csvText))
      return this.buildSessionPayloadFromEditor(createIncompleteSessionEditor(inferSessionPayloadFromCalrData(parsedRows)))
    },
    buildSessionPayloadForApi(sessionPayload = this.buildSessionPayload(), baselineSessionPayload = null) {
      return {
        ...sessionPayload,
        light_cycle_start: sessionPayload.light_cycle_start ?? 0,
        dark_cycle_start: sessionPayload.dark_cycle_start ?? 0,
      }
    },
    hasMeaningfulSessionData(sessionPayload = this.buildSessionPayload(), baselineSessionPayload = null) {
      const baselinePayload = baselineSessionPayload || this.buildDefaultSessionPayloadFromCsv(this.store.upload.convertedCSV)
      return JSON.stringify(sessionPayload) !== JSON.stringify(baselinePayload)
    },
    buildDraftRestoreComparisonPayload(sessionPayload = {}, baselineSessionPayload = {}) {
      return {
        ...sessionPayload,
        food_cutoff: sessionPayload.food_cutoff === 0 ? baselineSessionPayload.food_cutoff : sessionPayload.food_cutoff,
      }
    },
    hasMeaningfulDraftSessionDataForRestore(sessionPayload = {}, baselineSessionPayload = {}) {
      const normalizedSessionPayload = this.buildDraftRestoreComparisonPayload(sessionPayload, baselineSessionPayload)
      const normalizedBaselinePayload = this.buildDraftRestoreComparisonPayload(baselineSessionPayload, baselineSessionPayload)
      return JSON.stringify(normalizedSessionPayload) !== JSON.stringify(normalizedBaselinePayload)
    },
    async saveExperiment() {
      if (!this.store.upload.convertedCSV || !this.canSaveExperiment) {
        return null
      }

      this.store.loaders.uploadExperiment = true
      this.saveMessage = ''

      try {
        const sessionPayload = this.buildSessionPayload()
        const apiSessionPayload = this.buildSessionPayloadForApi(sessionPayload)
        const shouldPersistSession = this.isExperimentReadyForAnalysis(this.currentDraftStatus)
          || this.hasMeaningfulSessionData(sessionPayload)
        const shouldReplaceCalrFile = this.isEditingExperiment
          && Boolean(this.editingOriginalConvertedCsv)
          && this.store.upload.convertedCSV !== this.editingOriginalConvertedCsv

        if (this.isEditingExperiment) {
          if (shouldReplaceCalrFile) {
            await updateCalrFile(
              this.editingExperimentId,
              this.store.upload.convertedCSV,
              this.store.auth.token,
            )
            this.editingOriginalConvertedCsv = this.store.upload.convertedCSV
          }

          if (this.editingSessionId) {
            await updateSessionFile(
              this.editingSessionId,
              this.editingExperimentId,
              apiSessionPayload,
              this.store.auth.token,
            )
            if (!this.editingSessionFileEntry) {
              this.editingSessionFileEntry = {
                id: this.editingSessionId,
                file_type: 'session',
              }
            }
          } else if (shouldPersistSession) {
            const uploadedSession = await uploadSessionFile(this.editingExperimentId, apiSessionPayload, this.store.auth.token)
            if (uploadedSession?.id) {
              this.editingSessionId = uploadedSession.id
              this.editingSessionFileEntry = {
                id: uploadedSession.id,
                file_type: 'session',
                ...uploadedSession,
              }
            }
          }

          await updateExperimentMetadata(
            this.editingExperimentId,
            this.buildMetadataPayload(),
            this.store.auth.token,
          )
          this.showSessionEditor = false
          this.showCalrPreview = false
          await this.loadUserFiles()
          this.saveMessage = 'Experiment updated.'
          const updatedFile = this.store.account.userFiles.find((f) => f.id === this.editingExperimentId)
          if (updatedFile) {
            const updatedSession = updatedFile.files?.find((f) => f.file_type === 'session')
            if (updatedSession && !this.editingSessionFileEntry) {
              this.editingSessionFileEntry = updatedSession
              this.showSessionEditor = false
            }
            if (this.isExperimentReadyForAnalysis(this.currentDraftStatus)) {
              this.builderAnalysisLoading = true
              this.$nextTick(() => this.loadBuilderAnalysisData(updatedFile))
            }
          }
          return this.editingExperimentId
        }

        const uploadedExperiment = await uploadCalrFile(
          this.store.upload.convertedCSV,
          this.experimentDraft.name.trim(),
          this.experimentDraft.description.trim(),
          this.store.auth.token,
          this.experimentDraft.public,
        )

        if (shouldPersistSession) {
          await uploadSessionFile(uploadedExperiment.submission_id, apiSessionPayload, this.store.auth.token)
        }

        await updateExperimentMetadata(
          uploadedExperiment.submission_id,
          this.buildMetadataPayload(),
          this.store.auth.token,
        )
        this.showSessionEditor = false
        this.showCalrPreview = false
        await this.loadUserFiles()
        this.saveMessage = 'Experiment saved.'
        const newFile = this.store.account.userFiles.find((f) => f.id === uploadedExperiment.submission_id)
        if (newFile) {
          this.transitionToEditModeFromSave(newFile)
        }
        return uploadedExperiment.submission_id
      } catch (error) {
        this.saveMessage = error.message || 'Experiment save failed.'
        return null
      } finally {
        this.store.loaders.uploadExperiment = false
      }
    },
    async loadUserFiles() {
      this.store.loaders.getUserFiles = true
      const requestId = this.userFilesStatusRequestId + 1
      this.userFilesStatusRequestId = requestId

      try {
        const files = await fetchUserFiles(this.store.auth.token)
        const filesWithStatus = files.map((file) => this.buildUserFileRecord(file))

        if (requestId !== this.userFilesStatusRequestId) {
          return
        }

        this.store.account.userFiles = filesWithStatus
        this.hydrateUserFileStatuses(requestId, files)
      } finally {
        if (requestId === this.userFilesStatusRequestId) {
          this.store.loaders.getUserFiles = false
        }
      }
    },
    async editExperiment(file, { skipConfirm = false } = {}) {
      const standard = file.files.find((item) => item.file_type === 'standard')
      const session = file.files.find((item) => item.file_type === 'session')

      if (!standard) {
        return
      }

      if (!skipConfirm && this.store.account.userCreatingNew) {
        const targetLabel = `editing ${file.name || file.title || 'this experiment'}`
        if (!await this.confirmBuilderReplacement(targetLabel)) {
          return
        }
      }

      file.loading = true
      this.clearBuilderAnalysis()

      try {
        const dataCsv = await fetchDataFile(standard.id, this.store.auth.token, file.public)
        const defaultSessionPayload = this.buildDefaultSessionPayloadFromCsv(dataCsv)
        let mergedSessionConfig = null
        let shouldUseSavedSession = false

        if (session) {
          const [sessionConfig, sessionCsv] = await Promise.all([
            fetchSessionConfig(session.id, this.store.auth.token, file.public),
            fetchSessionFile(session.id, this.store.auth.token, file.public),
          ])
          mergedSessionConfig = mergeSessionCsvIntoPayload(parseCsv(sessionCsv), sessionConfig)
          const persistedSessionPayload = this.buildSessionPayloadFromEditor(normalizeSessionPayload(mergedSessionConfig))
          shouldUseSavedSession = this.isExperimentReadyForAnalysis(file.statusInfo)
            || this.hasMeaningfulDraftSessionDataForRestore(persistedSessionPayload, defaultSessionPayload)
        }

        this.store.account.userCreatingNew = true
        this.showMetadataEditor = false
        this.editingExperimentFile = file
        this.editingStandardFileEntry = standard
        this.editingSessionFileEntry = shouldUseSavedSession ? session : null
        this.editingExperimentId = file.id
        this.editingSessionId = shouldUseSavedSession ? session?.id || null : null
        this.editingOriginalConvertedCsv = dataCsv
        this.latestCreatedExperimentId = null
        this.sessionImportName = ''
        this.sessionImportMessage = ''
        this.saveMessage = ''
        this.showSessionEditor = false
        this.experimentDraft = {
          name: file.name || '',
          description: file.description || '',
          public: Boolean(file.public),
        }
        this.resetMetadataDraft(file)
        this.hydrateBuilder(dataCsv, mergedSessionConfig)

        if (this.isExperimentReadyForAnalysis(file.statusInfo)) {
          this.loadBuilderAnalysisData(file)
        }
      } finally {
        file.loading = false
      }
    },
    transitionToEditModeFromSave(file) {
      const standard = file.files.find((item) => item.file_type === 'standard')
      const session = file.files.find((item) => item.file_type === 'session')
      if (!standard) return

      // Switch page to edit mode immediately — no awaits
      this.store.account.userCreatingNew = true
      this.showMetadataEditor = false
      this.editingExperimentFile = file
      this.editingStandardFileEntry = standard
      this.editingSessionFileEntry = session || null
      this.editingSessionId = session?.id || null
      this.editingExperimentId = file.id
      this.latestCreatedExperimentId = null
      this.sessionImportName = ''
      this.sessionImportMessage = ''
      this.saveMessage = ''
      this.showSessionEditor = false
      this.experimentDraft = {
        name: file.name || '',
        description: file.description || '',
        public: Boolean(file.public),
      }
      this.clearBuilderAnalysis()
      this.resetMetadataDraft(file)
      if (session) {
        this.builderAnalysisLoading = true
      }

      // Load session config from backend + trigger analysis in background
      this.loadExperimentDataAfterSave(file, standard, session)
    },
    async loadExperimentDataAfterSave(file, standard, session) {
      file.loading = true
      let analysisTriggered = false
      try {
        const dataCsv = this.store.upload.convertedCSV
        let mergedSessionConfig = null

        if (session) {
          const [sessionConfig, sessionCsv] = await Promise.all([
            fetchSessionConfig(session.id, this.store.auth.token, file.public),
            fetchSessionFile(session.id, this.store.auth.token, file.public),
          ])
          mergedSessionConfig = mergeSessionCsvIntoPayload(parseCsv(sessionCsv), sessionConfig)
        }

        this.editingOriginalConvertedCsv = dataCsv
        this.hydrateBuilder(dataCsv, mergedSessionConfig)

        if (this.isExperimentReadyForAnalysis(this.currentDraftStatus)) {
          analysisTriggered = true
          this.loadBuilderAnalysisData(file)
        }
      } finally {
        file.loading = false
        if (!analysisTriggered) {
          this.builderAnalysisLoading = false
        }
      }
    },
    async downloadExperimentFile(experiment, entry) {
      if (entry.file_type !== 'session' && entry.file_type !== 'standard') {
        return
      }

      const content = entry.file_type === 'session'
        ? await fetchSessionFile(entry.id, this.store.auth.token, experiment.public)
        : await fetchDataFile(entry.id, this.store.auth.token, experiment.public)

      this.triggerCsvDownload(entry.file_name || `${experiment.id}_${entry.file_type}.csv`, content)
    },
    async downloadEditingStandardFile() {
      if (!this.editingExperimentFile || !this.editingStandardFileEntry) {
        return
      }

      await this.downloadExperimentFile(this.editingExperimentFile, this.editingStandardFileEntry)
    },
    async downloadCurrentCalrFile() {
      if (this.showEditingCalrDownload) {
        await this.downloadEditingStandardFile()
        return
      }

      if (!this.store.upload.convertedCSV) {
        return
      }

      const baseName = this.experimentDraft.name.trim() || this.defaultExperimentName()
      const safeBaseName = baseName.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '') || 'calr_experiment'
      this.triggerCsvDownload(`${safeBaseName}.csv`, this.store.upload.convertedCSV)
    },
    async downloadEditingSessionFile() {
      if (!this.editingExperimentFile || !this.editingSessionFileEntry) {
        return
      }

      await this.downloadExperimentFile(this.editingExperimentFile, this.editingSessionFileEntry)
    },
    async openExperiment(file) {
      const session = file.files.find((item) => item.file_type === 'session')

      if (!session) {
        return
      }

      file.loading = true
      file.loadingProgress = 0

      try {
        clearProcessCaches()
        const [enrichedPayload, sessionConfig] = await Promise.all([
          fetchEnrichedSession(session.id, this.store.auth.token, file.public, {
            onProgress: (progress) => {
              const safeProgress = Number.isFinite(progress) ? progress : 0
              file.loadingProgress = Math.max(5, Math.min(95, Math.round(safeProgress * 0.9 + 5)))
            },
          }),
          fetchSessionConfig(session.id, this.store.auth.token, file.public).then((result) => {
            file.loadingProgress = Math.max(Number(file.loadingProgress) || 0, 10)
            return result
          }),
        ])

        const analysisData = normalizeEnrichedAnalysisData(enrichedPayload, {
          numericalColumns,
          sessionConfig,
        })

        this.store.experiment.current = file
        this.store.experiment.detailRows = analysisData.rows
        this.store.experiment.analysisData = analysisData
        if (this.store.experiment.analysisSessionId !== session.id) {
          this.store.experiment.analysisSessionId = session.id
          this.store.experiment.qcResults = null
          this.store.experiment.powerResults = null
          this.store.experiment.ancovaResults = null
          this.store.experiment.analysisErrors.qc = null
          this.store.experiment.analysisErrors.power = null
          this.store.experiment.analysisErrors.ancova = null
        }
        file.loadingProgress = 100
        this.$router.push('/analysis')
      } finally {
        file.loading = false
        file.loadingProgress = null
      }
    },
    formatLoadingProgress(progress) {
      const numericProgress = Number(progress)

      if (!Number.isFinite(numericProgress) || numericProgress <= 0) {
        return 'Loading...'
      }

      return `${Math.min(100, Math.round(numericProgress))}%`
    },
    async toggleExperimentPublic(file) {
      const response = await updateExperimentPublicStatus(file.id, !file.public, this.store.auth.token)
      file.public = response.public
    },
    async removeExperiment(file) {
      const confirmed = await this.openConfirmDialog({
        title: 'Delete Experiment?',
        message: `Delete ${file.name || file.title || 'this experiment'}? This action cannot be undone.`,
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        confirmVariant: 'danger',
      })

      if (!confirmed) {
        return
      }

      await deleteExperiment(file.id, this.store.auth.token)
      this.store.account.userFiles = this.store.account.userFiles.filter((item) => item.id !== file.id)
    },
    async detectFormat(file) {
      const chunk = file.slice(0, 10240)
      const text = await chunk.text()
      const lines = text.split(/\r?\n/).slice(0, 5)
      const firstLine = lines[0] || ''

      if (/oxymax/i.test(firstLine)) {
        return 'oxymax'
      }

      if (lines.some((line) => /TSE/.test(line))) {
        return 'tse'
      }

      if (/Date_Time_\d/i.test(firstLine)) {
        return 'sable'
      }

      if (/cage/i.test(firstLine) || (/subject\.id/i.test(firstLine) && /exp\.minute/i.test(firstLine))) {
        return 'calr'
      }

      throw new Error(`Unable to detect format from ${file.name}.`)
    },
    getSessionCsvHeaders(csvText) {
      const firstNonEmptyLine = `${csvText || ''}`
        .split(/\r?\n/)
        .find((line) => line.trim())

      if (!firstNonEmptyLine) {
        return []
      }

      return firstNonEmptyLine
        .split(',')
        .map((header) => header.trim().replace(/^"|"$/g, '').toLowerCase())
        .filter(Boolean)
    },
  },
}
</script>
