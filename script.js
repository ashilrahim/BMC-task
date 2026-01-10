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

function createRecording() {
  const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
  const audioURL = URL.createObjectURL(audioBlob);

  const li = document.createElement("li");

  const audio = document.createElement("audio");
  audio.src = audioURL;
  audio.controls = true;

  activeAudios.push(audio);

  const label = document.createElement("span");
  label.textContent = timerEl.textContent;

  li.appendChild(audio);
  li.appendChild(label);
  recordingsList.appendChild(li);
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

recordingsList.appendChild(li);
recordingsList.parentElement.scrollTo({
  top: recordingsList.parentElement.scrollHeight,
  behavior: "smooth"
});
