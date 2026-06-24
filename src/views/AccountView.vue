<template>
  <div class="page-column">
    <section class="panel panel--spaced">
      <div v-if="!store.auth.token" class="login-layout">
        <div class="login-form">
          <strong>Login</strong>
          <div class="field-grid">
            <label class="field-grid__label">Username</label>
            <input v-model="store.auth.username" type="text" @keyup.enter="handleLogin" />
            <label class="field-grid__label">Password</label>
            <input v-model="store.auth.password" type="password" @keyup.enter="handleLogin" />
          </div>
          <button class="btn btn-primary" :disabled="store.loaders.login" @click="handleLogin">
            <BSpinner v-if="store.loaders.login" small />
            <span v-else>Login</span>
          </button>
          <div class="message-text">{{ store.auth.message }}</div>
        </div>

        <div class="login-copy">
          <strong>CalR Accounts</strong>
          <p>
            Login or create an account to upload, standardize and analyze your own data, and optionally
            contribute it to the public CalR community repository.
          </p>
        </div>
      </div>

      <template v-else>
        <div class="row-between">
          <div>
            Logged in as <strong>{{ store.auth.userInfo?.user?.username }}</strong>
          </div>
          <div class="button-row">
            <BButton v-if="!store.account.userCreatingNew" variant="info" @click="startCreateExperiment">
              Create New Experiment
            </BButton>
          </div>
        </div>

        <div class="page-column" style="padding: 0 10px">
          <div>
            <h5 class="bold">Your Experiments ({{ experimentCount }})</h5>
          </div>
          <div v-if="store.loaders.getUserFiles" class="empty-state">
            <BSpinner small />
          </div>
    
          <div v-else-if="store.account.userFiles.length">
            <BTable
              :items="store.account.userFiles"
              :fields="userFilesFields"
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

              <template #cell(status)="slot">
                <BBadge :variant="slot.item.statusInfo?.variant || 'secondary'">
                  {{ slot.item.statusInfo?.label || 'Incomplete' }}
                </BBadge>
              </template>
      
              <template #cell(public)="slot">
                <BBadge
                  :variant="slot.item.public ? 'success' : 'secondary'"
                  class="badge-toggle"
                  @click="toggleExperimentPublic(slot.item)"
                >
                  {{ slot.item.public ? 'Yes' : 'No' }}
                </BBadge>
              </template>
      
              <template #cell(uploaded_at)="slot">
                {{ formatDate(slot.item.uploaded_at) }}
              </template>
      
              <template #cell(actions)="slot">
                <span style="display:inline-flex; align-items:center; gap:0.35rem; min-width:4.5rem;">
                  <BSpinner v-if="slot.item.loading" small />
                  <span v-if="slot.item.loading" class="muted-copy">{{ formatLoadingProgress(slot.item.loadingProgress) }}</span>
                </span>
                <BButton
                  v-if="isExperimentReadyForAnalysis(slot.item.statusInfo)"
                  size="sm"
                  variant="link"
                  @click="openExperiment(slot.item)"
                >
                  Analysis
                </BButton>
                <BButton size="sm" variant="link" @click="toggleMetadataDetails(slot.item)">
                  {{ slot.item._showDetails ? 'Hide Info' : 'Info' }}
                </BButton>
                <BButton size="sm" variant="link" @click="editExperiment(slot.item)">
                  Edit
                </BButton>
                <BButton size="sm" variant="link" class="text-danger" @click="removeExperiment(slot.item)">
                  Delete
                </BButton>
              </template>
      
              <template #row-details="slot">
                <div class="metadata-card">
                  <div class="metadata-card__header">
                    <strong>Experiment Metadata</strong>
                  </div>
                  <div class="metadata-columns">
                    <section v-for="section in metadataSections" :key="section.title" class="metadata-section">
                      <strong>{{ section.title }}</strong>
                      <div class="metadata-grid metadata-grid--display">
                        <div v-for="field in section.fields" :key="field.key" class="metadata-display-field">
                          <span class="metadata-display-field__label">{{ field.label }}</span>
                          <span>{{ formatMetadataValue(slot.item.metadata?.[field.key] ?? slot.item[field.key]) }}</span>
                        </div>
                      </div>
                    </section>
                  </div>
                  <div class="metadata-card__files">
                    <strong>Files</strong>
                    <div class="metadata-file-list">
                      <div v-for="file in slot.item.files" :key="file.id" class="file-pill">
                        <BBadge variant="primary">{{ file.file_type }}</BBadge>
                        <span>{{ file.file_name }} ({{ formatFileSize(file.file_size) }})</span>
                        <BButton
                          v-if="file.file_type === 'session' || file.file_type === 'standard'"
                          size="sm"
                          variant="link"
                          @click="downloadExperimentFile(slot.item, file)"
                        >
                          Download
                        </BButton>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </BTable>
          </div>

          <div v-else class="empty-state">You have no experiments yet.</div>
        </div>

        <div v-if="store.auth.token && store.account.userCreatingNew" class="builder-overlay">
          <div class="builder-overlay__backdrop"></div>
          <div class="builder-modal">
            <div class="builder-modal__header row-between">
              <div>
                <h5 class="bold">{{ isEditingExperiment ? 'Edit Experiment' : 'Create New Experiment' }}</h5>
                <div class="muted-copy">
                  {{ isEditingExperiment ? 'Update an existing experiment and session configuration.' : 'Upload, configure, and save a new experiment.' }}
                </div>
                <div class="muted-copy">
                  Status: <strong>{{ currentDraftStatus.label }}</strong>
                </div>
              </div>
              <div class="button-row" style="align-items: center;">
                <div v-if="saveMessage" class="message-text row-end">{{ saveMessage }}</div>
                <button
                  class="btn btn-primary"
                  :disabled="store.loaders.uploadExperiment || !canSaveExperiment"
                  @click="saveExperiment"
                >
                  <BSpinner v-if="store.loaders.uploadExperiment" small />
                  <span v-else>{{ isEditingExperiment ? 'Save Changes' : 'Save Experiment' }}</span>
                </button>
                <BButton
                  v-if="latestCreatedExperiment && !isEditingExperiment && isExperimentReadyForAnalysis(latestCreatedExperiment.statusInfo)"
                  variant="success"
                  @click="openExperiment(latestCreatedExperiment)"
                >
                  Open in Analysis
                </BButton>
                <BButton v-if="store.account.userCreatingNew" variant="outline-secondary" @click="closeBuilderTab">
                  Close
                </BButton>
              </div>
            </div>
            
            <div class="session-builder builder-modal__body">
              <div class="builder-core-fields">
                <label class="control-stack builder-core-fields__name">
                  Experiment name
                  <input v-model="experimentDraft.name" type="text" placeholder="Experiment name" />
                </label>
  
                <label class="control-stack builder-core-fields__description">
                  Description
                  <textarea
                    v-model="experimentDraft.description"
                    rows="1"
                    placeholder="Short experiment description"
                  ></textarea>
                </label>
              </div>
              <div class="card-tabs session-builder-tabs">
                <button class="card-tab" :class="{ active: activeBuilderStep === 'upload' }" @click="goToBuilderStep('upload')">
                  1. Upload Data
                </button>
                <button class="card-tab" :class="{ active: activeBuilderStep === 'configure' }" @click="goToBuilderStep('configure')">
                  2. Configure Session
                </button>
                <button class="card-tab" :class="{ active: activeBuilderStep === 'review' }" @click="goToBuilderStep('review')">
                  3. Add Metadata
                </button>
              </div>

              <section v-if="activeBuilderStep === 'upload'" class="session-step page-column">
              <div class="muted-copy">
                Convert instrument CSV files into CalR format. Or upload your CalR-standard CSV directly.
              </div>
              <div class="session-uploads">
                <div style="display:flex; flex-direction:column; gap:20px;">
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
                  class="session-import-download"
                >
                <BButton variant="outline-secondary" @click="beginCalrReupload">
                    Re-upload
                  </BButton>
                  <BButton variant="outline-secondary" @click="downloadEditingStandardFile">
                    Download CalR
                  </BButton>
                </div>


                <div v-else class="session-import-row col-center">
                  <div v-if="store.upload.detectedFileFormat" class="message-text">
                    <strong>Detected format:</strong> {{ store.upload.detectedFileFormat }}
                  </div>
                  
                  
                  <div
                    class="dropzone"
                    :class="{ 
                      dragover: store.upload.dragover, 
                      'detected': store.upload.detectedFileFormat.trim() && store.upload.detectedFileFormat!=='calr', 
                      'detected-calr': store.upload.detectedFileFormat==='calr' || store.upload.convertedJSON 
                    }"
                    @click="openFileDialog"
                    @dragover.prevent="store.upload.dragover = true"
                    @dragleave="store.upload.dragover = false"
                    @drop.prevent="handleDrop"
                  >
                    <div v-if="!store.upload.files.length">
                      Drag and drop CSV files here, or click to select.
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
        
                  <div v-if="store.upload.files.length" class="row-end" style="gap:5px;">
                    <button class="btn btn-outline-secondary btn-sm" @click="clearSelectedFiles">
                      Clear
                    </button>
                    <button
                      v-if="!store.upload.isCalrFormat"
                      class="btn btn-sm"
                      :class="{'btn-primary': !store.upload.convertedJSON, 'btn-success': store.upload.convertedJSON}"
                      :disabled="store.loaders.convertFile || store.upload.convertedJSON"
                      @click="convertSelectedFiles"
                    >
                      <BSpinner v-if="store.loaders.convertFile" small />
                      <span v-else-if="store.upload.convertedJSON">Converted</span>
                      <span v-else>Convert</span>
                    </button>
                  </div>
                  
                  <!--
                  <div v-if="store.upload.textResponse" class="message-text">
                    {{ store.upload.textResponse }}
                  </div>
                  -->
    
                </div>
              </div>
    
              <!--
              <div v-if="canContinueToConfigure" class="row-end">
                <BButton variant="primary" @click="goToBuilderStep('configure')">
                  Continue to Configure
                </BButton>
              </div>
              -->
              <div v-if="hasConvertedData" class="upload-preview-layout">
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
                        : `Failed: ${energyExpenditureQc.invalidCount} RER value(s) fell outside 0.6-1.5 or were missing.` }}
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
                        : `Failed: ${foodIntakeQc.invalidCount} feed value(s) were negative or missing.` }}
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
              </section>

              <section v-else-if="activeBuilderStep === 'configure'" class="session-step">
                <div v-if="!canContinueToConfigure" class="alert alert-warning" role="alert"">
                  Upload or convert a CalR file to configure a session.
                </div>

                <div class="muted-copy">
                  Designate groups, diets, subjects, and experiment ranges.
                </div>
                <div class="session-uploads">
                <div>
                  <div class="session-uploads-convert">
                      <div class="session-uploads-session">
                      <div>Session</div>
                      <div class="session-uploads-intruments">
                        <div class="session-uploads-intrument" :class="{ 'detected-calr': isGroupsAndDietsComplete }">Groups & Diets</div>
                        <div class="session-uploads-intrument" :class="{ 'detected-calr': isSubjectsComplete }">Subjects</div>
                        <div class="session-uploads-intrument" :class="{ 'detected-calr': isRangesComplete }">Ranges</div>
                      </div>
                    </div>
                  </div>
                  <!--
                  <div class="session-diagram">
                    <img :src="sessionDiagramImage" alt="Session configuration reference diagram" />
                  </div>
                  -->
                </div>
    
                <!-- session metadata upload dropzone -->
                <div class="session-import-row col-between" :class="{ 'session-import-row--disabled': !isSessionImportEnabled }">
                  <div class="session-import-drop">
                    <strong v-if="!showEditingSessionDownload && !sessionImportName">Have an existing session CSV?</strong>
                    <div
                      v-if="showEditingSessionDownload"
                      class="session-import-download detected-calr"
                    >
                      <BButton variant="outline-secondary" @click="downloadEditingSessionFile">
                        Download Session
                      </BButton>
                    </div>
                    <div
                      v-else
                      class="dropzone"
                      :class="{ dragover: sessionDragover, 'detected-calr': sessionImportName, 'dropzone--disabled': !isSessionImportEnabled }"
                      @click="openSessionFileDialog"
                      @dragover.prevent="sessionDragover = true"
                      @dragleave="sessionDragover = false"
                      @drop.prevent="handleSessionFileDrop"
                    >
                      <div v-if="!sessionImportName">
                        Drag and drop a session CSV here, or click to select.
                      </div>
                      <div v-else class="dropzone-files">
                        <strong>1 file(s) selected</strong>
                        <div>{{ sessionImportName }}</div>
                      </div>  
                    </div>
                    <div v-if="!showEditingSessionDownload && !sessionImportName">
                      Otherwise you can configure your session below.
                    </div>
                    <div v-if="sessionImportName" class="row-end">
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
    
                  <div v-if="sessionImportName || showEditingSessionDownload" class="upload-session-grid">
                    <div>
                      <strong>Groups</strong>
                      <div>{{ sessionEditor.groups.length }}</div>
                    </div>
                    <div>
                      <strong>Light Start</strong>
                      <div>{{ !isRangesComplete ? 'NA' : sessionEditor.light_cycle_start }}</div>
                    </div>
                    <div>
                      <strong>Dark Start</strong>
                      <div>{{ !isRangesComplete ? 'NA' : sessionEditor.dark_cycle_start }}</div>
                    </div>
                    <div>
                      <strong>Session Hours</strong>
                      <div>{{ formatHourRange(sessionEditor.hour_range) }}</div>
                    </div>
                  </div>
                  <!--
                  <div v-if="sessionImportMessage" class="message-text">
                    {{ sessionImportMessage }}
                  </div>
                  -->
                </div>
              </div>

                <div>
                  <fieldset class="builder-fieldset page-column" :disabled="!canContinueToConfigure">
    
                <div class="session-subsection">
                  <div class="row-between session-subsection__header">
                    <div>
                      <strong>a. Set Groups and Diets</strong>
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
                        <button
                          v-if="index >= baseGroupCount"
                          class="btn btn-link btn-sm text-danger"
                          @click="removeGroup(index)"
                        >
                          Remove
                        </button>
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
                      <strong>b. Designate Subjects</strong>
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
    
                <div class="session-subsection">
                  <div class="session-subsection__header">
                    <strong>c. Set Ranges and Filters</strong>
                  </div>
    
                  <div class="session-settings">
                    <div class="session-settings-grid">
                      <label class="control-stack">
                        Light cycle start hour
                        <input v-model="sessionEditor.light_cycle_start" type="number" min="0" max="23" step="1" />
                      </label>
    
                      <label class="control-stack">
                        Dark cycle start hour
                        <input v-model="sessionEditor.dark_cycle_start" type="number" min="0" max="23" step="1" />
                      </label>
                    </div>
                    <div class="session-settings-grid">
                      <label class="control-stack">
                        Session start hour
                        <input v-model="sessionEditor.hour_range[0]" type="number" step="1" min="0" />
                      </label>
      
                      <label class="control-stack">
                        Session end hour
                        <input v-model="sessionEditor.hour_range[1]" type="number" step="1" min="0" />
                      </label>
                    </div>
                    <div class="session-settings-grid">
                      <label class="control-stack">
                        Food cutoff (kcal/hr)
                        <input v-model="sessionEditor.food_cutoff" type="number" step="0.1" min="0" @input="handleFoodCutoffInput" />
                        <div class="muted-copy">
                          Minimum: {{ minimumFoodCutoffKcalPerHour }} kcal/hr
                          (100 mg/min using {{ foodCutoffReferenceKcalPerG }} kcal/g).
                        </div>
                        <div v-if="!isFoodCutoffValid" class="session-validation-message">
                          Food cutoff must be at least {{ minimumFoodCutoffKcalPerHour }} kcal/hr to meet the 100 mg/min minimum.
                        </div>
                      </label>
                    </div>
                    <div class="session-settings-grid">
                      <label class="checkbox-row session-settings-grid__checkbox">
                        <input v-model="sessionEditor.remove_outliers" type="checkbox" />
                        Remove outliers
                      </label>
                    </div>
                  </div>
                </div>
    
                <div class="session-step__footer">
                  <div v-if="!canContinueToReview" class="message-text row-end">
                    Session setup is still incomplete for analysis, but you can still continue and save this experiment as a draft.
                  </div>
                  <div class="row-end">
                    <BButton variant="primary" @click="goToBuilderStep('review')">
                      Continue to Metadata
                    </BButton>
                  </div>
                </div>
                  </fieldset>
                </div>
              </section>

              <section v-else class="session-step">
                <div v-if="!canContinueToReview" class="message-text">
                  This experiment can still be saved as a draft. Finish session setup later to make it ready for analysis.
                </div>
                <div>
                  <fieldset class="builder-fieldset page-column">
                <div class="metadata-section">
                  <div class="metadata-legend">
                    <span class="metadata-legend__item">
                      <span class="metadata-required-icon" aria-hidden="true"></span>
                      Required for public
                    </span>
                  </div>
                  <div class="metadata-columns">
                    <section v-for="section in metadataSections" :key="section.title" class="metadata-section">
                      <strong>{{ section.title }}</strong>
                      <label v-for="field in section.fields" :key="field.key" class="control-stack">
                        <span class="metadata-field-label">
                          {{ field.label }}
                          <span
                            v-if="field.requiredForPublic"
                            class="metadata-required-icon"
                            aria-label="Required for public"
                            title="Required for public"
                          ></span>
                        </span>
                        <MetadataFieldInput v-model="metadataDraft[field.key]" :field="field" />
                      </label>
                    </section>
                  </div>
                  <label class="checkbox-row session-settings-grid__checkbox">
                    <input v-model="experimentDraft.public" type="checkbox" :disabled="isEditingExperiment" />
                    Make public
                  </label>
                </div>
                  </fieldset>
                </div>
              </section>
            </div>
          </div>
        </div>

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
</template>

<script>
import { appStore } from '../store/appStore'
import MetadataFieldInput from '../components/MetadataFieldInput.vue'
import experimentMetadataSections from '../config/experimentMetadata.json'
import {
  convertInstrumentFiles,
  deleteExperiment,
  fetchDataFile,
  fetchEnrichedSession,
  fetchSessionConfig,
  fetchSessionFile,
  fetchUserFiles,
  login,
  updateCalrFile,
  updateExperimentMetadata,
  updateExperimentPublicStatus,
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
const EXPERIMENT_METADATA_SECTIONS = experimentMetadataSections
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
  sessionEditor.food_cutoff = convertFoodCutoffMgPerMinToKcalPerHour(FOOD_CUTOFF_MIN_MG_PER_MIN)

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

function getStatusMetadataValue(source = {}, key) {
  if (key === 'experiment_id') {
    return source?.metadata?.[key] ?? source?.[key] ?? source?.submission_id ?? source?.id ?? ''
  }

  return source?.metadata?.[key] ?? source?.[key]
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
  },
  data() {
    return {
      store: appStore,
      maxGroups: 4,
      baseGroupCount: 2,
      metadataSections: EXPERIMENT_METADATA_SECTIONS,
      metadataFields: EXPERIMENT_METADATA_FIELDS,
      userFilesFields: ['name', 'description', 'status', 'public', 'uploaded_at', {key: 'actions', label: 'Actions', class: 'txt-right'}],
      sessionEditor: createIncompleteSessionEditor(),
      presetDietOptions: PRESET_DIETS,
      activeBuilderStep: 'upload',
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
      saveMessage: '',
      foodCutoffManuallyEdited: false,
      sessionDragover: false,
      sessionImportName: '',
      sessionImportMessage: '',
      templateUploadDialog: {
        visible: false,
        type: '',
        title: '',
        dragover: false,
        fileName: '',
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
      const selectedDietCalories = this.sessionEditor.groups
        .map((group) => Number(group?.diet_kcal))
        .filter((value) => Number.isFinite(value) && value > 0)

      return selectedDietCalories.length
        ? Math.max(...selectedDietCalories)
        : DEFAULT_FOOD_CUTOFF_KCAL_PER_G
    },
    minimumFoodCutoffKcalPerHour() {
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
    experimentCount() {
      return this.store.account.userFiles.length
    },
  },
  async mounted() {
    if (this.store.auth.token && !this.store.account.userFiles.length) {
      await this.loadUserFiles()
    }
  },
  watch: {
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

      this.sessionEditor.food_cutoff = this.minimumFoodCutoffKcalPerHour
    },
    initializeFoodCutoffState() {
      const cutoff = this.getFoodCutoffFromValue(this.sessionEditor.food_cutoff)
      this.foodCutoffManuallyEdited = cutoff !== null && cutoff > 0

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
      return source?.metadata?.[key] ?? source?.[key] ?? ''
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
    goToBuilderStep(step) {
      this.activeBuilderStep = step
    },
    toggleMetadataDetails(file) {
      file._showDetails = !file._showDetails
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
        const rows = parseCsv(csvText)
        this.sessionEditor = mergeSessionCsvIntoPayload(rows, this.sessionEditor)
        this.initializeFoodCutoffState()
        this.syncGroupDietSelections()
        this.sessionImportName = file.name
        this.sessionImportMessage = 'Session CSV imported into the form.'
      } catch (error) {
        this.sessionImportMessage = error.message || 'Unable to load session CSV.'
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
        this.store.upload.detectedFileFormat = format

        if (format === 'calr') {
          const csvText = await files[0].text()
          this.hydrateSessionEditorFromCalrCsv(csvText)
          this.store.upload.isCalrFormat = true
          this.store.upload.textResponse = `CalR format detected for ${files[0].name}.`
          return
        }

        this.store.upload.isCalrFormat = false
        this.store.upload.textResponse = `Detected ${format.toUpperCase()} instrument data. Convert to CalR to continue.`
      } catch (error) {
        this.store.upload.textResponse = error.message || 'Unable to detect file format.'
      }
    },
    resetUploadSelection(clearInput = true) {
      this.store.upload.files = []
      this.store.upload.dragover = false
      this.store.upload.loading = false
      this.store.upload.textResponse = ''
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
      this.activeBuilderStep = 'upload'
      this.foodCutoffManuallyEdited = false
      this.sessionDragover = false
      this.sessionImportName = ''
      this.sessionImportMessage = ''
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
        this.activeBuilderStep = 'upload'
        return
      }

      if (!await this.confirmBuilderReplacement('a new experiment')) {
        return
      }

      this.store.account.userCreatingNew = true
      this.resetCreateFlow()
      this.activeBuilderStep = 'upload'
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
        this.store.upload.textResponse = `Converted ${this.store.upload.files.length} file(s) to CalR format.`
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
        return
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
          } else if (shouldPersistSession) {
            await uploadSessionFile(this.editingExperimentId, apiSessionPayload, this.store.auth.token)
          }

          await updateExperimentMetadata(
            this.editingExperimentId,
            this.buildMetadataPayload(),
            this.store.auth.token,
          )
          await this.loadUserFiles()
          this.saveMessage = 'Experiment updated.'
          return
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
        await this.loadUserFiles()
        this.latestCreatedExperimentId = uploadedExperiment.submission_id
        this.saveMessage = 'Experiment saved.'
      } catch (error) {
        this.saveMessage = error.message || 'Experiment save failed.'
      } finally {
        this.store.loaders.uploadExperiment = false
      }
    },
    async handleLogin() {
      this.store.auth.message = ''

      if (!this.store.auth.username.trim()) {
        this.store.auth.message = 'Missing username'
        return
      }

      if (!this.store.auth.password.trim()) {
        this.store.auth.message = 'Missing password'
        return
      }

      this.store.loaders.login = true

      try {
        const response = await login(this.store.auth.username, this.store.auth.password)
        this.store.auth.token = response.access
        this.store.auth.userInfo = response
        this.store.auth.message = 'Success'
        await this.loadUserFiles()
      } catch (error) {
        this.store.auth.message = 'Login failed'
      } finally {
        this.store.loaders.login = false
      }
    },
    async loadUserFiles() {
      this.store.loaders.getUserFiles = true

      try {
        const files = await fetchUserFiles(this.store.auth.token)
        const filesWithStatus = await Promise.all(files.map(async (file) => {
          const standard = file.files?.find((item) => item.file_type === 'standard')
          const session = file.files?.find((item) => item.file_type === 'session')
          let sessionPayload = {}

          if (session) {
            try {
              sessionPayload = await fetchSessionConfig(session.id, this.store.auth.token)
            } catch (error) {
              sessionPayload = {}
            }
          }

          return {
            ...file,
            loading: false,
            loadingProgress: null,
            statusInfo: this.buildExperimentStatusInfo(
              Boolean(standard),
              sessionPayload,
              file.metadata || file,
            ),
          }
        }))

        this.store.account.userFiles = filesWithStatus
      } finally {
        this.store.loaders.getUserFiles = false
      }
    },
    async editExperiment(file) {
      const standard = file.files.find((item) => item.file_type === 'standard')
      const session = file.files.find((item) => item.file_type === 'session')

      if (!standard) {
        return
      }

      if (this.store.account.userCreatingNew) {
        const targetLabel = `editing ${file.name || file.title || 'this experiment'}`
        if (!await this.confirmBuilderReplacement(targetLabel)) {
          return
        }
      }

      file.loading = true

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
        this.activeBuilderStep = 'upload'
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
        this.experimentDraft = {
          name: file.name || '',
          description: file.description || '',
          public: Boolean(file.public),
        }
        this.resetMetadataDraft(file)
        this.hydrateBuilder(dataCsv, mergedSessionConfig)
      } finally {
        file.loading = false
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
  },
}
</script>
