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
          <BButton v-if="!store.account.userCreatingNew" variant="info" @click="store.account.userCreatingNew = true">
            Create New Experiment
          </BButton>
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
            small
            hover
            striped
          >
            <template #cell(public)="slot">
              <BBadge
                :variant="slot.item.public ? 'success' : 'secondary'"
                class="badge-toggle"
                @click="toggleExperimentPublic(slot.item)"
              >
                {{ slot.item.public ? 'Yes' : 'No' }}
              </BBadge>
            </template>

            <template #cell(files)="slot">
              <div v-for="file in slot.item.files" :key="file.id" class="file-pill">
                <BBadge variant="primary">{{ file.file_type }}</BBadge>
                <span>{{ file.file_name }} ({{ formatFileSize(file.file_size) }})</span>
              </div>
            </template>

            <template #cell(uploaded_at)="slot">
              {{ formatDate(slot.item.uploaded_at) }}
            </template>

            <template #cell(actions)="slot">
              <BButton size="sm" variant="link" @click="openExperiment(slot.item)">
                <BSpinner v-if="slot.item.loading" small />
                <span v-else>Open</span>
              </BButton>
              <BButton size="sm" variant="link" class="text-danger" @click="removeExperiment(slot.item)">Delete</BButton>
            </template>
          </BTable>

          <div v-else class="empty-state">You have no experiments yet.</div>
        </div>
      </template>
    </section>
  </div>
</template>

<script>
import { appStore } from '../store/appStore'
import {
  deleteExperiment,
  fetchDataFile,
  fetchSessionFile,
  fetchUserFiles,
  login,
  updateExperimentPublicStatus,
} from '../services/registryService'
import { ensureEnviroLight, ensureExpMinute, parseCsv, preprocessDetail } from '../utils/csv'
import { formatDate, formatFileSize } from '../utils/format'

const numericalColumns = [
  'vo2', 'vco2', 'ee', 'ee.acc', 'rer', 'feed', 'feed.acc', 'drink', 'drink.acc',
  'xytot', 'xyamb', 'pedmeter', 'allmeter', 'wheel', 'wheel.acc', 'C13', 'enviro.temp',
  'subject.mass', 'body.temp', 'enviro.sound',
]

export default {
  name: 'AccountView',
  data() {
    return {
      store: appStore,
      userFilesFields: ['name', 'description', 'public', 'files', 'uploaded_at', 'actions'],
    }
  },
  methods: {
    formatDate,
    formatFileSize,
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
        const firstSessionRow = sessionRows[0] || {}
        if (firstSessionRow.light && !detailRows[0]?.['enviro.light']) {
          detailRows = ensureEnviroLight(detailRows, firstSessionRow.light, 24)
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
  },
}
</script>
