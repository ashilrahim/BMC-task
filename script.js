const recordBtn = document.getElementById("recordBtn");
const recordingsList = document.getElementById("recordingsList");
const timerEl = document.getElementById("timer");
const canvas = document.getElementById("waveform");
const ctx = canvas.getContext("2d");
const recordingsContainer = document.getElementById("recordingsContainer");

//    STATE VARIABLES

let mediaRecorder;
let audioChunks = [];
let isRecording = false;
const activeAudios = [];

// Timer
let secondsElapsed = 0;
let timerInterval;

// Audio + waveform
let audioContext;
let analyser;
let source;
let animationId;
let dataArray;
let smoothVolume = 0;
let phase = 0;

//    TIMER FUNCTIONS

function updateTimer() {
  secondsElapsed++;
  const minutes = String(Math.floor(secondsElapsed / 60)).padStart(2, "0");
  const seconds = String(secondsElapsed % 60).padStart(2, "0");
  timerEl.textContent = `${minutes}:${seconds}`;
}

//    RECORD BUTTON

recordBtn.addEventListener("click", async () => {
  if (!isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
});

//    START RECORDING

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // MediaRecorder
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    mediaRecorder.onstop = createRecording;
    mediaRecorder.start();

    // AudioContext for waveform
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    dataArray = new Uint8Array(analyser.frequencyBinCount);

    activeAudios.forEach((a) => {
      a.pause();
      a.currentTime = 0;
      a.controls = true;
    });
    // UI state
    recordingsContainer.classList.add("disabled");
    isRecording = true;
    recordBtn.classList.add("recording");
    recordBtn.textContent = "■ Stop";

    secondsElapsed = 0;
    timerEl.textContent = "00:00";
    timerInterval = setInterval(updateTimer, 1000);

    drawPillWave();
  } catch (err) {
    console.error("getUserMedia error:", err.name, err.message);
    alert(err.name);
  }
}

//    STOP RECORDING

function stopRecording() {
  mediaRecorder.stop();
  isRecording = false;

  activeAudios.forEach((a) => {
    a.controls = true;
  });

  recordBtn.classList.remove("recording");
  recordBtn.textContent = "● Record";
  recordingsContainer.classList.remove("disabled");

  clearInterval(timerInterval);

  cancelAnimationFrame(animationId);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (audioContext) audioContext.close();
}

//    CREATE RECORDING ITEM

async function createRecording() {
  const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
  const base64Audio = await blobToBase64(audioBlob);

  const recording = {
    id: Date.now(),
    audio: base64Audio,
    duration: timerEl.textContent,
    timestamp: new Date().toLocaleString(),
  };

  const recordings = getStoredRecordings();
  recordings.push(recording);
  saveStoredRecordings(recordings);

  renderRecording(recording);
}

// To render existing recordings on page load

function renderRecording(recording) {
  const li = document.createElement("li");
  li.dataset.id = recording.id;

  const audio = document.createElement("audio");
  audio.src = recording.audio;
  audio.controls = true;

  activeAudios.push(audio);

  const label = document.createElement("span");
  label.textContent = recording.duration;

  const deleteBtn = document.createElement("button");

  deleteBtn.className = "delete-btn";
  deleteBtn.innerHTML = deleteBtn.innerHTML = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6l-1 14H6L5 6"></path>
    <path d="M10 11v6"></path>
    <path d="M14 11v6"></path>
    <path d="M9 6V4h6v2"></path>
  </svg>
`;

  deleteBtn.addEventListener("click", () => {
    deleteRecording(recording.id);
  });

  li.appendChild(audio);
  li.appendChild(label);
  li.appendChild(deleteBtn);
  recordingsList.appendChild(li);

  // auto-scroll to newest
  recordingsList.parentElement.scrollTo({
    top: recordingsList.parentElement.scrollHeight,
    behavior: "smooth",
  });
}

function deleteRecording(id) {
  // Update localStorage
  const recordings = getStoredRecordings().filter((rec) => rec.id !== id);
  saveStoredRecordings(recordings);

  // Remove from UI
  const li = recordingsList.querySelector(`[data-id="${id}"]`);
  if (li) li.remove();
}

//    WAVEFORM HELPERS

function getVolume() {
  analyser.getByteFrequencyData(dataArray);
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  return sum / dataArray.length;
}

function smooth(target) {
  smoothVolume += (target - smoothVolume) * 0.1;
  return smoothVolume;
}

//    PILL WAVEFORM DRAW

function drawPillWave() {
  animationId = requestAnimationFrame(drawPillWave);

  const volume = smooth(getVolume());
  const amplitude = Math.min(volume / 2, canvas.height / 2.5);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#7eaafad4";

  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);

  for (let x = 0; x <= canvas.width; x++) {
    const y = canvas.height / 2 + Math.sin((x + phase) * 0.02) * amplitude;
    ctx.lineTo(x, y);
  }

  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();
  ctx.fill();

  phase += 2;
}

// localstorage

function getStoredRecordings() {
  return JSON.parse(localStorage.getItem("recordings")) || [];
}

function saveStoredRecordings(recordings) {
  localStorage.setItem("recordings", JSON.stringify(recordings));
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const recordings = getStoredRecordings();
  recordings.forEach(renderRecording);
});
