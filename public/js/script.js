// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const hiddenFileInput = document.getElementById('hiddenFileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeFileBtn = document.getElementById('removeFile');
const convertBtn = document.getElementById('convertBtn');
const resetBtn = document.getElementById('resetBtn');
const buttonGroup = document.getElementById('buttonGroup');
const progressSection = document.getElementById('progressSection');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressStatus = document.getElementById('progressStatus');
const conversionComplete = document.getElementById('conversionComplete');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const downloadBtn = document.getElementById('downloadBtn');
const convertAnother = document.getElementById('convertAnother');
const tryAgain = document.getElementById('tryAgain');

let selectedFile = null;
let currentConversionId = null;
let statusCheckInterval = null;

// Upload Area Drag and Drop
uploadArea.addEventListener('click', () => {
  fileInput.click();
});

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFileSelect(files[0]);
  }
});

// File Input Change
fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFileSelect(e.target.files[0]);
  }
});

// Handle File Selection
function handleFileSelect(file) {
  // Validate file type
  if (!file.type.startsWith('video/')) {
    showError('Please select a valid video file (MP4)');
    return;
  }

  selectedFile = file;
  displayFileInfo(file);
  uploadArea.style.display = 'none';
  fileInfo.style.display = 'flex';
  convertBtn.disabled = false;
}

// Display File Information
function displayFileInfo(file) {
  fileName.textContent = file.name;
  fileSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
}

// Remove File
removeFileBtn.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  fileInfo.style.display = 'none';
  uploadArea.style.display = 'block';
  convertBtn.disabled = true;
  progressSection.style.display = 'none';
  progressBar.style.width = '0%';
  progressText.textContent = '0%';
});

// Convert Button
convertBtn.addEventListener('click', () => {
  if (!selectedFile) {
    showError('Please select a file first');
    return;
  }

  convertFile();
});

// Convert File
async function convertFile() {
  const formData = new FormData();
  formData.append('video', selectedFile);

  try {
    convertBtn.disabled = true;
    progressSection.style.display = 'block';
    progressStatus.textContent = 'Starting conversion...';

    const response = await fetch('/api/convert', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Conversion failed');
    }

    currentConversionId = data.conversionId;
    startStatusCheck();

  } catch (error) {
    showError(error.message);
    convertBtn.disabled = false;
    progressSection.style.display = 'none';
  }
}

// Check Conversion Status
function startStatusCheck() {
  statusCheckInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/status/${currentConversionId}`);
      const data = await response.json();

      if (response.ok) {
        updateProgress(data);

        if (data.status === 'completed') {
          clearInterval(statusCheckInterval);
          showCompletionScreen(data.outputFile);
        } else if (data.status === 'error') {
          clearInterval(statusCheckInterval);
          showError(data.error || 'Conversion failed');
          convertBtn.disabled = false;
          progressSection.style.display = 'none';
        }
      }
    } catch (error) {
      console.error('Status check error:', error);
    }
  }, 1000);
}

// Update Progress
function updateProgress(data) {
  const progress = data.progress || 0;
  progressBar.style.width = progress + '%';
  progressText.textContent = progress + '%';

  if (progress < 30) {
    progressStatus.textContent = 'Reading video file...';
  } else if (progress < 70) {
    progressStatus.textContent = 'Processing audio and extracting subtitles...';
  } else {
    progressStatus.textContent = 'Finalizing subtitle file...';
  }
}

// Show Completion Screen
function showCompletionScreen(outputFile) {
  progressSection.style.display = 'none';
  fileInfo.style.display = 'none';
  conversionComplete.style.display = 'block';
  buttonGroup.style.display = 'flex';

  downloadBtn.onclick = (e) => {
    e.preventDefault();
    window.location.href = `/api/download/${encodeURIComponent(outputFile)}`;
  };
}

// Show Error
function showError(message) {
  progressSection.style.display = 'none';
  fileInfo.style.display = 'none';
  errorMessage.style.display = 'block';
  errorText.textContent = message || 'An error occurred during conversion';
  buttonGroup.style.display = 'flex';
}

// Convert Another File
convertAnother.addEventListener('click', resetForm);
tryAgain.addEventListener('click', resetForm);

// Reset Form
function resetForm() {
  selectedFile = null;
  fileInput.value = '';
  currentConversionId = null;
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }

  // Reset UI
  uploadArea.style.display = 'block';
  fileInfo.style.display = 'none';
  progressSection.style.display = 'none';
  conversionComplete.style.display = 'none';
  errorMessage.style.display = 'none';
  buttonGroup.style.display = 'none';
  convertBtn.disabled = true;

  // Reset progress bar
  progressBar.style.width = '0%';
  progressText.textContent = '0%';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('MP4 to SRT Converter loaded');
});
