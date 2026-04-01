import { reactive } from 'vue'

export const appStore = reactive({
  loaders: {
    login: false,
    getUserFiles: false,
    convertFile: false,
    uploadExperiment: false,
    loadExperiment: false,
    doQC: false,
    doAncova: false,
    doPower: false,
  },
  auth: {
    username: '',
    password: '',
    message: '',
    token: null,
    userInfo: null,
  },
  account: {
    userCreatingNew: false,
    userFiles: [],
    publicFiles: [],
  },
  upload: {
    files: [],
    dragover: false,
    loading: false,
    textResponse: '',
    isCalrFormat: false,
    detectedFileFormat: '',
    convertedCSV: '',
    convertedJSON: null,
  },
  sessionForm: {
    show: false,
    saved: null,
    cutoff: false,
    light_cycle_start: null,
    dark_cycle_start: null,
    food_cutoff: 0,
    subjects: {},
    groups: [],
    dietOptions: [
      { name: 'LabDiet 5008', kcal: 3.56 },
      { name: 'Research Diet 60 kcal% Fat', kcal: 5.21 },
    ],
    sessionDiets: [
      { name: '', kcal: '' },
      { name: '', kcal: '' },
    ],
  },
  experiment: {
    latestExperimentId: null,
    current: null,
    detailRows: [],
    sessionRows: [],
    analysisSessionId: null,
    qcResults: null,
    ancovaResults: null,
    powerResults: null,
  },
  community: {
    summaryRows: [],
    summaryLoaded: false,
  },
})
