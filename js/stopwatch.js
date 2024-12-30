import { db } from "./firebase-config.js"; // Firebase 설정 파일
import {
  ref,
  get,
  set,
} from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";

// 타이머 관련 변수
let startTime;
let elapsedTime = 0;
let timerInterval;
let model,
  isCameraOn = false,
  isPersonDetected = false;

const timerDisplay = document.getElementById("timer-display");
const startButton = document.getElementById("start-button");
const stopButton = document.getElementById("stop-button");
const logButton = document.getElementById("log-button");
const cameraButton = document.getElementById("camera-button");
const cameraFeed = document.getElementById("camera-feed");

// 밀리초를 HH:MM:SS 형식으로 변환
function formatTime(timeInMilliseconds) {
  const totalSeconds = Math.floor(timeInMilliseconds / 1000); // 밀리초를 초 단위로 변환

  const hours = Math.floor(totalSeconds / 3600); // 시간을 계산
  const minutes = Math.floor((totalSeconds % 3600) / 60); // 분 계산
  const seconds = totalSeconds % 60; // 초 계산

  // 시, 분, 초를 두 자릿수로 맞추기 위해 String로 변환 후 2자리로 패딩
  const formattedTime = `${String(hours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // Debugging log: formatted time 확인
  console.log("Formatted time in formatTime():", formattedTime);

  return formattedTime;
}

// 타이머 시작
function startTimer() {
  if (!timerInterval) {
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(() => {
      elapsedTime = Date.now() - startTime;
      timerDisplay.textContent = formatTime(elapsedTime);
    }, 1000);

    startButton.disabled = true;
    stopButton.disabled = false;
    logButton.disabled = true;
  }
}

// 타이머 정지
function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;

  startButton.disabled = false;
  stopButton.disabled = true;
  logButton.disabled = false;
}

// 타이머 리셋
function resetTimer() {
  timerDisplay.textContent = "00:00:00";
  elapsedTime = 0;
  clearInterval(timerInterval);

  startButton.disabled = false;
  stopButton.disabled = true;
  logButton.disabled = true;
}

// 타이머 기록
logButton.addEventListener("click", async () => {
  const todayDate = getTodayDate();
  const timeRef = ref(db, `time/${todayDate}`);
  const snapshot = await get(timeRef);
  let newTime = elapsedTime;

  if (snapshot.exists()) {
    const existingTime = timeStringToMilliseconds(snapshot.val().time);
    newTime += existingTime;
  }

  await set(timeRef, { time: formatTime(newTime) });
  resetTimer();
});

// 날짜 형식 함수
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, "0");
  const day = today.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeStringToMilliseconds(timeString) {
  const [hours, minutes, seconds] = timeString.split(":").map(Number);
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

// 카메라 버튼 클릭 이벤트
cameraButton.addEventListener("click", async () => {
  if (!isCameraOn) {
    await startCamera();
    cameraButton.textContent = "카메라 끄기";
    isCameraOn = true;

    console.log("Coco-SSD 모델 로드 중...");
    model = await cocoSsd.load(); // Coco-SSD 모델 로드
    console.log("Coco-SSD 모델 로드 완료");
    detectPerson();
  } else {
    stopCamera();
    cameraButton.textContent = "카메라 켜기";
    isCameraOn = false;
  }
});

// Firebase에 시간을 기록하는 함수
async function saveTimeRecord() {
  const todayDate = getTodayDate(); // 오늘 날짜 구하기
  const timeRef = ref(db, `time/${todayDate}`); // time/{오늘날짜} 경로 지정

  // 기존 기록된 시간 가져오기
  const snapshot = await get(timeRef);

  let newTime = elapsedTime; // 새로 기록할 시간 (현재 타이머 시간)
  if (snapshot.exists()) {
    // 기존에 기록된 시간이 있으면 그 시간을 더함
    const existingTime = snapshot.val().time;
    newTime += timeStringToMilliseconds(existingTime); // 기존 시간과 새 시간을 더함
  }

  // 기록할 시간 포맷
  const formattedTime = formatTime(newTime);

  // Debugging log: 저장할 시간 값 확인
  console.log("Saving formatted time to Firebase: ", formattedTime);

  // Firebase에 저장
  await set(timeRef, {
    time: formattedTime, // 기록된 시간 (HH:MM:SS 형식)
  });

  console.log(`Time recorded for ${todayDate}: ${formattedTime}`);
}

// 초기화
resetTimer();

// 이벤트 리스너 추가 (startButton 클릭 시 startTimer 실행)
startButton.addEventListener("click", startTimer);

// 이벤트 리스너 추가 (stopButton 클릭 시 stopTimer 실행)
stopButton.addEventListener("click", stopTimer);

// 카메라 시작
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  cameraFeed.srcObject = stream;
  cameraFeed.style.display = "block";
}

// 카메라 중지
function stopCamera() {
  const stream = cameraFeed.srcObject;
  if (stream) {
    const tracks = stream.getTracks();
    tracks.forEach((track) => track.stop());
  }
  cameraFeed.srcObject = null; // 비디오 소스 제거
  cameraFeed.style.backgroundColor = "#d3d3d3"; // 기본 회색 화면 설정

  stopTimer();
}

// 사람 인식
async function detectPerson() {
  if (!isCameraOn || !model) return;

  const predictions = await model.detect(cameraFeed);
  const personDetected = predictions.some(
    (prediction) => prediction.class === "person"
  );

  if (personDetected && !isPersonDetected) {
    startTimer();
    isPersonDetected = true;
  } else if (!personDetected && isPersonDetected) {
    stopTimer();
    isPersonDetected = false;
  }

  requestAnimationFrame(detectPerson);
}
