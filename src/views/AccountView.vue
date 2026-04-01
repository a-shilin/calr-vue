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
            <BButton v-else variant="outline-secondary" @click="cancelCreateExperiment">
              Close Builder
            </BButton>
          </div>
        </div>

        <div class="page-column">
          <strong>Your experiments</strong>

          <div v-if="store.loaders.getUserFiles" class="empty-state">
            <BSpinner small />
          </div>

          <BTable
            v-else-if="store.account.userFiles.length"
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
              <BButton size="sm" variant="link" @click="openExperiment(slot.item)">
                <BSpinner v-if="slot.item.loading" small />
                <span v-else>Analysis</span>
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

          <div v-else class="empty-state">You have no experiments yet.</div>
        </div>
      </template>
    </section>

    <section v-if="store.auth.token && store.account.userCreatingNew" class="panel panel--spaced">
      <div class="row-between">
        <div>
          <strong>Create New Experiment</strong>
        </div>
        <div class="button-row">
          <BButton variant="outline-secondary" @click="resetCreateFlow">Reset</BButton>
        </div>
      </div>

      <div class="session-builder">
        <section class="session-step">
          <strong>1. Upload Data</strong>
          <div class="session-uploads">
            <div>
              <div class="muted-copy">
                Convert instrument CSV files into CalR format. Or upload your CalR-standard CSV directly.
              </div>
              <div class="session-uploads-convert">
                <div class="session-uploads-intruments">
                  <div class="session-uploads-intrument" :class="{'detected': store.upload.detectedFileFormat==='sable'}">SABLE</div>
                  <div class="session-uploads-intrument" :class="{'detected': store.upload.detectedFileFormat==='oxymax'}">CLAMS</div>
                  <div class="session-uploads-intrument" :class="{'detected': store.upload.detectedFileFormat==='tse'}">TSE</div>
                </div>
                <div class="session-uploads-arrow">➧</div>
                <div class="session-uploads-intrument" style="background: #eee;" :class="{'detected-calr': store.upload.detectedFileFormat==='calr' || store.upload.convertedJSON}">CalR</div>
              </div>
            </div>
            <!-- session data upload dropzone -->
            <div class="session-import-row col-center">
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

              <div v-if="hasConvertedData" class="upload-summary-grid">
                <div>
                  <strong>Subjects</strong>
                  <div>{{ sessionEditor.subjects.length }}</div>
                </div>
                <div>
                  <strong>Hours</strong>
                  <div>{{ formatHourRange(sessionEditor.hour_range) }}</div>
                </div>
              </div>
            </div>

            <!-- session metadata upload dropzone -->
            <div v-if="hasConvertedData && store.upload.isCalrFormat" class="session-import-row col-between">
              <div class="session-import-drop">
                <div>
                  <strong v-if="!sessionImportName">Have an existing session CSV?</strong>
                  <strong v-else>Session settings loaded</strong>
                </div>
                <div
                  class="dropzone"
                  :class="{ dragover: sessionDragover, 'detected-calr': sessionImportName }"
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
                <div v-if="!sessionImportName">
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

              <div v-if="sessionImportName" class="upload-summary-grid">
                <div>
                  <strong>Groups</strong>
                  <div>{{ sessionEditor.groups.length }}</div>
                </div>
              </div>
              <!--
              <div v-if="sessionImportMessage" class="message-text">
                {{ sessionImportMessage }}
              </div>
              -->
            </div>
          </div>
        </section>

        <template v-if="hasConvertedData">
          <section class="session-step">
            <div class="row-between session-step__header">
              <div>
                <strong>2. Configure Session</strong>
              </div>
            </div>

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
                  <div class="muted-copy">Assign each subject to a group. Weights and exclusions are optional.</div>
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
                    <tr v-for="subject in sessionEditor.subjects" :key="subject.subject">
                      <td class="txt-center">{{ subject.subject }}</td>
                      <td v-for="(_, groupIndex) in sessionEditor.groups" :key="`${subject.subject}-${groupIndex}`" class="session-radio-cell txt-center">
                        <input v-model.number="subject.groupIndex" type="radio" :name="`subject-${subject.subject}`" :value="groupIndex" :style="`accent-color:${sessionEditor.groups[groupIndex].color}`"/>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div class="relative">
                  <table class="data-table session-subject-table">
                    <colgroup>
                    </colgroup>
                    <thead>
                      <tr>
                        <th class="txt-center relative" :colspan="3">
                          Weights (optional)
                          <div class="sub-copy">Weights from calorimeter will be used unless specified here</div>
                          <button class="btn btn-outline-secondary btn-sm session-table-option-btn" @click="showWeightColumns = !showWeightColumns">
                            {{ showWeightColumns ? 'Hide' : 'Show' }}
                          </button>
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
                  <div class="session-table-overlay" v-if="!showWeightColumns">

                  </div>
                </div>
                <div class="relative">
                  <table class="data-table session-subject-table">
                    <colgroup>
                    </colgroup>
                    <thead>
                      <tr>
                        <th class="txt-center relative" :colspan="2">
                          Exclusions (optional)
                          <div class="sub-copy">Exclude subject ID's starting at hour</div>
                          <button class="btn btn-outline-secondary btn-sm session-table-option-btn" @click="showExclusionColumns = !showExclusionColumns">
                            {{ showExclusionColumns ? 'Hide' : 'Show' }}
                          </button>
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
                  <div class="session-table-overlay" v-if="!showExclusionColumns">

                  </div>
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
                    <input v-model="sessionEditor.hour_range[0]" type="number" step="0.1" min="0" />
                  </label>
  
                  <label class="control-stack">
                    Session end hour
                    <input v-model="sessionEditor.hour_range[1]" type="number" step="0.1" min="0" />
                  </label>
                </div>
                <div class="session-settings-grid">
                  <label class="control-stack">
                    Food cutoff
                    <input v-model="sessionEditor.food_cutoff" type="number" step="0.1" min="0" />
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
          </section>

          <section class="session-step">
            <strong>{{ isEditingExperiment ? '3. Review Experiment' : '3. Save Experiment' }}</strong>
            <div class="metadata-section">
              <label class="control-stack">
                Experiment name
                <input v-model="experimentDraft.name" type="text" placeholder="Experiment name" />
              </label>

              <label class="control-stack">
                Description
                <textarea v-model="experimentDraft.description" rows="3" placeholder="Short experiment description"></textarea>
              </label>
            </div>

            <div class="metadata-section">
              <div class="metadata-columns">
                <section v-for="section in metadataSections" :key="section.title" class="metadata-section">
                  <strong>{{ section.title }}</strong>
                  <label v-for="field in section.fields" :key="field.key" class="control-stack">
                    {{ field.label }}
                    <select
                      v-if="field.key === 'sex'"
                      v-model="metadataDraft[field.key]"
                    >
                      <option value="">Select sex</option>
                      <option v-for="option in sexOptions" :key="option" :value="option">{{ option }}</option>
                    </select>
                    <select
                      v-else-if="field.key === 'system'"
                      v-model="metadataDraft[field.key]"
                    >
                      <option value="">Select system</option>
                      <option v-for="option in systemOptions" :key="option" :value="option">{{ option }}</option>
                    </select>
                    <input
                      v-else-if="['litter', 'age', 'quality_score'].includes(field.key)"
                      v-model="metadataDraft[field.key]"
                      type="number"
                      step="1"
                    />
                    <input
                      v-else-if="field.key === 'temperature'"
                      v-model="metadataDraft[field.key]"
                      type="number"
                      step="0.1"
                    />
                    <input
                      v-else
                      v-model="metadataDraft[field.key]"
                      type="text"
                      :placeholder="field.key === 'species' ? 'Mouse' : field.key === 'tissue' ? 'Whole Body' : ''"
                    />
                  </label>
                </section>
              </div>
              <label class="checkbox-row session-settings-grid__checkbox">
                <input v-model="experimentDraft.public" type="checkbox" :disabled="isEditingExperiment" />
                Make public
              </label>
            </div>

            <div class="button-row">
              <button
                class="btn btn-primary"
                :disabled="store.loaders.uploadExperiment || !experimentDraft.name.trim()"
                @click="saveExperiment"
              >
                <BSpinner v-if="store.loaders.uploadExperiment" small />
                <span v-else>{{ isEditingExperiment ? 'Save Changes' : 'Save Experiment' }}</span>
              </button>

              <BButton
                v-if="latestCreatedExperiment && !isEditingExperiment"
                variant="success"
                @click="openExperiment(latestCreatedExperiment)"
              >
                Open in Analysis
              </BButton>
            </div>

            <div v-if="saveMessage" class="message-text">{{ saveMessage }}</div>
          </section>
        </template>
      </div>
    </section>
  </div>
</template>

<script>
import { appStore } from '../store/appStore'
import {
  convertInstrumentFiles,
  deleteExperiment,
  fetchDataFile,
  fetchSessionConfig,
  fetchSessionFile,
  fetchUserFiles,
  login,
  updateExperimentMetadata,
  updateExperimentPublicStatus,
  updateSessionFile,
  uploadCalrFile,
  uploadSessionFile,
} from '../services/registryService'
import {
  DEFAULT_GROUP_COLORS,
  ensureEnviroLight,
  ensureExpMinute,
  getSessionCycleStartsFromRows,
  inferSessionPayloadFromCalrData,
  mergeSessionCsvIntoPayload,
  normalizeSessionPayload,
  parseCsv,
  preprocessDetail,
} from '../utils/csv'
import { formatDate, formatFileSize } from '../utils/format'

const numericalColumns = [
  'vo2', 'vco2', 'ee', 'ee.acc', 'rer', 'feed', 'feed.acc', 'drink', 'drink.acc',
  'xytot', 'xyamb', 'pedmeter', 'allmeter', 'wheel', 'wheel.acc', 'C13', 'enviro.temp',
  'subject.mass', 'body.temp', 'enviro.sound',
]

const DEFAULT_DESCRIPTION = 'Vehicle vs Treatment'
const PRESET_DIETS = [
  { id: 'labdiet-5008', name: 'LabDiet 5008', kcal: 3.56 },
  { id: 'rd-60-fat', name: 'Research Diet 60 kcal% Fat', kcal: 5.21 },
]
const SEX_OPTIONS = ['male', 'female', 'both', 'other']
const SYSTEM_OPTIONS = ['CLAMS', 'TSE', 'Sable', 'Other']
const METADATA_SECTIONS = [
  {
    title: 'Study Setup',
    fields: [
      { key: 'experiment_id', label: 'Experiment ID' },
      { key: 'investigator', label: 'Investigator' },
      { key: 'location', label: 'Location' },
      { key: 'system', label: 'System' },
      { key: 'pmid', label: 'PMID' },
      { key: 'quality_score', label: 'Quality Score' },
    ],
  },
  {
    title: 'Biology',
    fields: [
      { key: 'species', label: 'Species' },
      { key: 'tissue', label: 'Tissue' },
      { key: 'treatment', label: 'Treatment' },
      { key: 'strain', label: 'Strain' },
      { key: 'genetic_background', label: 'Genetic Background' },
      { key: 'sex', label: 'Sex' },
      { key: 'age', label: 'Age' },
      { key: 'litter', label: 'Litter Size' },
    ],
  },
  {
    title: 'Environment',
    fields: [
      { key: 'temperature', label: 'Ambient Temperature (°C)' },
      { key: 'bedding', label: 'Bedding' },
      { key: 'enrich', label: 'Enrichment' },
      { key: 'ee_calc', label: 'EE Calc. Method' },
    ],
  },
]

export default {
  name: 'AccountView',
  data() {
    return {
      store: appStore,
      maxGroups: 4,
      baseGroupCount: 2,
      metadataSections: METADATA_SECTIONS,
      userFilesFields: ['name', 'description', 'public', 'uploaded_at', 'actions'],
      sessionEditor: normalizeSessionPayload(),
      presetDietOptions: PRESET_DIETS,
      sexOptions: SEX_OPTIONS,
      systemOptions: SYSTEM_OPTIONS,
      customDietOptions: [],
      showCustomDietEditor: false,
      customDietDraft: {
        name: '',
        kcal: '',
      },
      showWeightColumns: false,
      showExclusionColumns: false,
      experimentDraft: {
        name: '',
        description: DEFAULT_DESCRIPTION,
        public: false,
      },
      editingExperimentId: null,
      editingSessionId: null,
      metadataDraft: {
        species: '',
        tissue: '',
        litter: '',
        bedding: '',
        ee_calc: '',
        enrich: '',
        experiment_id: '',
        age: '',
        strain: '',
        genetic_background: '',
        sex: '',
        temperature: '',
        quality_score: '',
        system: '',
        location: '',
        pmid: '',
        investigator: '',
        treatment: '',
      },
      latestCreatedExperimentId: null,
      saveMessage: '',
      sessionDragover: false,
      sessionImportName: '',
      sessionImportMessage: '',
    }
  },
  computed: {
    hasConvertedData() {
      return Boolean(this.store.upload.convertedCSV)
    },
    dietOptions() {
      return [...this.presetDietOptions, ...this.customDietOptions].map((diet) => ({
        ...diet,
        label: `${diet.name} (${diet.kcal} kcal/g)`,
      }))
    },
    canSaveCustomDiet() {
      return Boolean(this.customDietDraft.name.trim()) && this.customDietDraft.kcal !== ''
    },
    isEditingExperiment() {
      return this.editingExperimentId !== null
    },
    latestCreatedExperiment() {
      return this.store.account.userFiles.find((file) => file.id === this.latestCreatedExperimentId) || null
    },
  },
  async mounted() {
    if (this.store.auth.token && !this.store.account.userFiles.length) {
      await this.loadUserFiles()
    }
  },
  methods: {
    formatDate,
    formatFileSize,
    formatMetadataValue(value) {
      return value === null || value === undefined || value === '' ? 'NA' : `${value}`
    },
    formatHourRange(range) {
      return `${Number(range[0]).toFixed(1)} to ${Number(range[1]).toFixed(1)}`
    },
    formatDietKcal(value) {
      return value === null || value === '' || value === undefined ? '' : `${value}`
    },
    readMetadataValue(source, key) {
      return source?.metadata?.[key] ?? source?.[key] ?? ''
    },
    resetMetadataDraft(source = null) {
      this.metadataDraft = {
        species: this.readMetadataValue(source, 'species'),
        tissue: this.readMetadataValue(source, 'tissue'),
        litter: this.readMetadataValue(source, 'litter'),
        bedding: this.readMetadataValue(source, 'bedding'),
        ee_calc: this.readMetadataValue(source, 'ee_calc'),
        enrich: this.readMetadataValue(source, 'enrich'),
        experiment_id: this.readMetadataValue(source, 'experiment_id'),
        age: this.readMetadataValue(source, 'age'),
        strain: this.readMetadataValue(source, 'strain'),
        genetic_background: this.readMetadataValue(source, 'genetic_background'),
        sex: this.readMetadataValue(source, 'sex'),
        temperature: this.readMetadataValue(source, 'temperature'),
        quality_score: this.readMetadataValue(source, 'quality_score'),
        system: this.readMetadataValue(source, 'system'),
        location: this.readMetadataValue(source, 'location'),
        pmid: this.readMetadataValue(source, 'pmid'),
        investigator: this.readMetadataValue(source, 'investigator'),
        treatment: this.readMetadataValue(source, 'treatment'),
      }
    },
    toggleMetadataDetails(file) {
      file._showDetails = !file._showDetails
    },
    buildMetadataPayload() {
      const numberOrNull = (value) => (value === '' || value === null || value === undefined ? null : Number(value))

      return {
        name: this.experimentDraft.name.trim() || null,
        description: this.experimentDraft.description.trim() || null,
        species: this.metadataDraft.species.trim() || null,
        tissue: this.metadataDraft.tissue.trim() || null,
        litter: numberOrNull(this.metadataDraft.litter),
        bedding: this.metadataDraft.bedding.trim() || null,
        ee_calc: this.metadataDraft.ee_calc.trim() || null,
        enrich: this.metadataDraft.enrich.trim() || null,
        experiment_id: this.metadataDraft.experiment_id.trim() || null,
        age: numberOrNull(this.metadataDraft.age),
        strain: this.metadataDraft.strain.trim() || null,
        genetic_background: this.metadataDraft.genetic_background.trim() || null,
        sex: this.metadataDraft.sex || null,
        temperature: numberOrNull(this.metadataDraft.temperature),
        quality_score: numberOrNull(this.metadataDraft.quality_score),
        system: this.metadataDraft.system || null,
        location: this.metadataDraft.location.trim() || null,
        pmid: this.metadataDraft.pmid.trim() || null,
        investigator: this.metadataDraft.investigator.trim() || null,
        treatment: this.metadataDraft.treatment.trim() || null,
      }
    },
    updateOptionalColumnVisibility() {
      this.showWeightColumns = this.sessionEditor.subjects.some((subject) =>
        subject.total_mass !== null
        || subject.lean_mass !== null
        || subject.fat_mass !== null,
      )
      this.showExclusionColumns = this.sessionEditor.subjects.some((subject) =>
        subject.exc_hour !== null
        || Boolean(subject.exc_reason),
      )
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
        return this.presetDietOptions[fallbackIndex]?.id || this.presetDietOptions[0]?.id || ''
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
        if (!group.diet_name && this.presetDietOptions[index]) {
          group.diet_name = this.presetDietOptions[index].name
          group.diet_kcal = this.presetDietOptions[index].kcal
        }

        group.diet_key = this.ensureDietOption(group, index)
        this.applyGroupDietSelection(group, false)
      })
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
    openFileDialog() {
      this.$refs.fileInput?.click()
    },
    openSessionFileDialog() {
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
        this.syncGroupDietSelections()
        this.updateOptionalColumnVisibility()
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
      this.clearSelectedFiles(false)
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
    clearSelectedFiles(clearInput = true) {
      this.store.upload.files = []
      this.store.upload.dragover = false
      this.store.upload.loading = false
      this.store.upload.textResponse = ''
      this.store.upload.isCalrFormat = false
      this.store.upload.detectedFileFormat = ''
      this.store.upload.convertedCSV = ''
      this.store.upload.convertedJSON = null
      this.sessionEditor = normalizeSessionPayload()
      this.customDietOptions = []
      this.showCustomDietEditor = false
      this.customDietDraft = {
        name: '',
        kcal: '',
      }
      this.showWeightColumns = false
      this.showExclusionColumns = false
      this.editingExperimentId = null
      this.editingSessionId = null
      this.resetMetadataDraft()
      this.latestCreatedExperimentId = null
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
    resetCreateFlow() {
      this.clearSelectedFiles()
      this.experimentDraft = {
        name: this.defaultExperimentName(),
        description: DEFAULT_DESCRIPTION,
        public: false,
      }
      this.resetMetadataDraft()
      this.saveMessage = ''
    },
    startCreateExperiment() {
      this.store.account.userCreatingNew = true
      this.resetCreateFlow()
    },
    cancelCreateExperiment() {
      this.store.account.userCreatingNew = false
      this.resetCreateFlow()
    },
    defaultExperimentName() {
      return `Experiment ${this.store.account.userFiles.length + 1}`
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
      this.sessionEditor = normalizeSessionPayload(sessionPayload || inferSessionPayloadFromCalrData(parsedRows))
      this.syncGroupDietSelections()
      this.updateOptionalColumnVisibility()
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
        diet_name: this.presetDietOptions[0]?.name || '',
        diet_kcal: this.presetDietOptions[0]?.kcal ?? null,
        diet_key: this.presetDietOptions[0]?.id || '',
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
    buildSessionPayload() {
      const toNumberOrNull = (value) => (value === '' || value === null || value === undefined ? null : Number(value))
      const usedNames = new Set()
      const groups = this.sessionEditor.groups.map((group, index) => {
        const baseName = this.normalizedGroupName(group, index)
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
        subjects: this.sessionEditor.subjects.map((subject) => ({
          subject: subject.subject,
          groupIndex: Math.min(Math.max(Number(subject.groupIndex) || 0, 0), groups.length - 1),
          total_mass: toNumberOrNull(subject.total_mass),
          lean_mass: toNumberOrNull(subject.lean_mass),
          fat_mass: toNumberOrNull(subject.fat_mass),
          exc_hour: toNumberOrNull(subject.exc_hour),
          exc_reason: subject.exc_reason?.trim() || '',
        })),
        light_cycle_start: Number(this.sessionEditor.light_cycle_start || 0),
        dark_cycle_start: Number(this.sessionEditor.dark_cycle_start || 0),
        hour_range: [
          Number(this.sessionEditor.hour_range[0] || 0),
          Number(this.sessionEditor.hour_range[1] || 0),
        ],
        food_cutoff: Number(this.sessionEditor.food_cutoff || 0),
        remove_outliers: Boolean(this.sessionEditor.remove_outliers),
        group_colors: groups.reduce((accumulator, group) => {
          accumulator[group.name] = group.color
          return accumulator
        }, {}),
      }
    },
    async saveExperiment() {
      if (!this.store.upload.convertedCSV || !this.experimentDraft.name.trim()) {
        return
      }

      this.store.loaders.uploadExperiment = true
      this.saveMessage = ''

      try {
        if (this.isEditingExperiment) {
          await updateSessionFile(
            this.editingSessionId,
            this.editingExperimentId,
            this.buildSessionPayload(),
            this.store.auth.token,
          )
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

        await uploadSessionFile(uploadedExperiment.submission_id, this.buildSessionPayload(), this.store.auth.token)
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
        this.store.account.userFiles = files.map((file) => ({ ...file, loading: false }))
      } finally {
        this.store.loaders.getUserFiles = false
      }
    },
    async editExperiment(file) {
      const session = file.files.find((item) => item.file_type === 'session')
      const standard = file.files.find((item) => item.file_type === 'standard')

      if (!session || !standard) {
        return
      }

      file.loading = true

      try {
        const [dataCsv, sessionConfig] = await Promise.all([
          fetchDataFile(standard.id, this.store.auth.token, file.public),
          fetchSessionConfig(session.id, this.store.auth.token, file.public),
        ])

        this.store.account.userCreatingNew = true
        this.editingExperimentId = file.id
        this.editingSessionId = session.id
        this.latestCreatedExperimentId = null
        this.sessionImportName = ''
        this.sessionImportMessage = ''
        this.saveMessage = 'Existing experiment loaded into the session form.'
        this.experimentDraft = {
          name: file.name || '',
          description: file.description || '',
          public: Boolean(file.public),
        }
        this.resetMetadataDraft(file)
        this.hydrateBuilder(dataCsv, sessionConfig)
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
    async openExperiment(file) {
      const session = file.files.find((item) => item.file_type === 'session')
      const standard = file.files.find((item) => item.file_type === 'standard')

      if (!session || !standard) {
        return
      }

      file.loading = true

      try {
        const [dataCsv, sessionCsv] = await Promise.all([
          fetchDataFile(standard.id, this.store.auth.token, file.public),
          fetchSessionFile(session.id, this.store.auth.token, file.public),
        ])

        let detailRows = parseCsv(dataCsv)
        detailRows = ensureExpMinute(detailRows)

        const sessionRows = parseCsv(sessionCsv)
        const cycleStarts = getSessionCycleStartsFromRows(sessionRows)
        if (!detailRows[0]?.['enviro.light']) {
          detailRows = ensureEnviroLight(detailRows, cycleStarts.lightCycleStart, cycleStarts.darkCycleStart)
        }

        this.store.experiment.current = file
        this.store.experiment.detailRows = preprocessDetail(detailRows, numericalColumns)
        this.store.experiment.sessionRows = sessionRows
        this.$router.push('/analysis')
      } finally {
        file.loading = false
      }
    },
    async toggleExperimentPublic(file) {
      const response = await updateExperimentPublicStatus(file.id, !file.public, this.store.auth.token)
      file.public = response.public
    },
    async removeExperiment(file) {
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
