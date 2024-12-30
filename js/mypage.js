// Firebase Realtime Database 모듈을 가져옵니다
import { db } from "./firebase-config.js"; // db는 firebase-config.js에서 가져옵니다
import {
  ref,
  get,
} from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";

const API_KEY = "";

// DOMContentLoaded 이벤트에서 Firebase 데이터 가져오기 및 화면에 표시
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Firebase에서 프로필 정보 불러오기
    const userRef = ref(db, "profiles/user1");
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      const data = snapshot.val();
      const username = data.username || "USER";
      const statusMessage = data.statusMessage || "오늘도 좋은 하루 보내세요.";

      // DOM 요소 업데이트
      const usernameElement = document.getElementById("username");
      const statusMessageElement = document.getElementById("status-message");
      const profilePicElement = document.getElementById("profile-pic");

      if (usernameElement) {
        usernameElement.textContent = `${username}님,`;
      } else {
        console.warn("Username element not found.");
      }

      if (statusMessageElement) {
        statusMessageElement.textContent = statusMessage;
      } else {
        console.warn("Status message element not found.");
      }

      if (profilePicElement) {
        if (data.profilePic) {
          profilePicElement.style.backgroundImage = `url(${data.profilePic})`;
        } else {
          profilePicElement.style.backgroundImage = "none";
          profilePicElement.style.backgroundColor = "#cccccc"; // 기본 회색 배경
        }
      } else {
        console.warn("Profile pic element not found.");
      }
    } else {
      console.log("프로필 정보가 없습니다.");
    }

    // 오늘 날짜를 기준으로 해당 월의 일정을 불러오기
    await getTasksForMonth();

    // 오늘과 어제의 집중 시간을 가져오기
    const todayDate = getTodayDate();
    const yesterdayDate = getYesterdayDate();

    // 집중 시간 가져오기
    await getFocusTime(todayDate, yesterdayDate);
  } catch (error) {
    console.error("Error during initialization:", error);
  }
});

// 오늘에 해당하는 날짜를 YYYY-MM-DD 형식으로 구하기
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, "0");
  const day = today.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 어제의 날짜를 YYYY-MM-DD 형식으로 구하기
function getYesterdayDate() {
  const today = new Date();
  today.setDate(today.getDate() - 1); // 하루 빼기
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, "0");
  const day = today.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Firebase에서 집중 시간을 가져와서 화면에 표시
async function getFocusTime(todayDate, yesterdayDate) {
  const todayRef = ref(db, `time/${todayDate}`);
  const yesterdayRef = ref(db, `time/${yesterdayDate}`);

  const snapshotToday = await get(todayRef);
  const snapshotYesterday = await get(yesterdayRef);

  let todayFocusTime = 0; // 오늘의 집중 시간
  let yesterdayFocusTime = 0; // 어제의 집중 시간

  // 오늘의 시간 처리
  if (snapshotToday.exists()) {
    const todayTime = snapshotToday.val().time;
    todayFocusTime = timeStringToSeconds(todayTime); // HH:MM:SS -> 초로 변환
  } else {
    todayFocusTime = 0; // 오늘 데이터가 없으면 00:00:00
  }

  // 어제의 시간 처리
  if (snapshotYesterday.exists()) {
    const yesterdayTime = snapshotYesterday.val().time;
    yesterdayFocusTime = timeStringToSeconds(yesterdayTime); // HH:MM:SS -> 초로 변환
  } else {
    yesterdayFocusTime = 0; // 어제 데이터가 없으면 00:00:00
  }

  // 화면에 오늘과 어제의 시간 표시 (HH시 MM분 SS초)
  const todayHours = Math.floor(todayFocusTime / 3600);
  const todayMinutes = Math.floor((todayFocusTime % 3600) / 60);
  const todaySeconds = todayFocusTime % 60;

  const yesterdayHours = Math.floor(yesterdayFocusTime / 3600);
  const yesterdayMinutes = Math.floor((yesterdayFocusTime % 3600) / 60);
  const yesterdaySeconds = yesterdayFocusTime % 60;

  document.getElementById("today-hours").textContent = todayHours
    .toString()
    .padStart(2, "0");
  document.getElementById("today-minutes").textContent = todayMinutes
    .toString()
    .padStart(2, "0");
  document.getElementById("today-seconds").textContent = todaySeconds
    .toString()
    .padStart(2, "0");

  document.getElementById("yesterday-hours").textContent = yesterdayHours
    .toString()
    .padStart(2, "0");
  document.getElementById("yesterday-minutes").textContent = yesterdayMinutes
    .toString()
    .padStart(2, "0");
  document.getElementById("yesterday-seconds").textContent = yesterdaySeconds
    .toString()
    .padStart(2, "0");

  // 바 그래프 업데이트
  updateBarGraph(todayFocusTime, yesterdayFocusTime);
}

// HH:MM:SS 형식을 초로 변환
function timeStringToSeconds(timeString) {
  const [hours, minutes, seconds] = timeString.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

// 바 그래프 업데이트 함수
function updateBarGraph(todayFocusTime, yesterdayFocusTime) {
  const todayBar = document.querySelector(".today-bar");
  const yesterdayBar = document.querySelector(".yesterday-bar");

  const maxFocusTime = 86400; // 하루 최대 시간 (24시간 * 60분 * 60초 = 86400초)

  // 오늘과 어제의 집중 시간을 비율로 계산해서 바 그래프 길이 설정
  todayBar.style.width = `${(todayFocusTime / maxFocusTime) * 100}%`;
  yesterdayBar.style.width = `${(yesterdayFocusTime / maxFocusTime) * 100}%`;
}

// 월별 작업 가져오기
const getTasksForMonth = async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
  
    // 해당 월의 첫째 날과 마지막 날 계산
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = getLastDayOfMonth(year, month);
  
    const startOfMonth = formatDate(firstDayOfMonth); // "YYYY-MM-DD" 형식
    const endOfMonth = formatDate(lastDayOfMonth);   // "YYYY-MM-DD" 형식
  
    console.log("Start of Month:", startOfMonth);
    console.log("End of Month:", endOfMonth);
  
    const tasksRef = ref(db, "tasks");
    const snapshot = await get(tasksRef);
  
    if (snapshot.exists()) {
      const tasks = snapshot.val();
      console.log("Tasks Retrieved:", tasks);
  
      const filteredTasks = filterTasksByDateRange(tasks, startOfMonth, endOfMonth);
      console.log("Filtered Tasks (Detailed):", JSON.stringify(filteredTasks, null, 2));
  
      displayTasksOnCalendar(filteredTasks); // 필터링된 작업을 캘린더에 표시
    } else {
      console.log("이 달의 작업이 없습니다.");
    }
  };
  

// 날짜 범위로 작업 필터링
const filterTasksByDateRange = (tasks, start, end) => {
  const filteredTasks = {};
  for (const date in tasks) {
    if (date >= start && date <= end) {
      filteredTasks[date] = tasks[date];
    }
  }
  return filteredTasks;
};

const getLastDayOfMonth = (year, month) => {
    return new Date(year, month + 1, 0); // 다음 달의 0번째 날
  };
  

// 월별 캘린더에 작업 표시하기
const displayTasksOnCalendar = (tasks) => {
  const calendarElement = document.getElementById("calendar");
  calendarElement.innerHTML = ""; // 기존 내용을 초기화

  let taskContent = "";
  for (let date in tasks) {
    taskContent += `
            <div class="task-item">
                <strong>${date}:</strong> ${tasks[date]
      .map((task) => task.title)
      .join(", ")}
            </div>`;
  }

  if (!taskContent) {
    taskContent = "<p>이번 달에 일정이 없습니다.</p>";
  }

  calendarElement.innerHTML = taskContent;

  // 새로 추가된 내용으로 스크롤 가능 여부 확인
  calendarElement.style.overflowY = "auto"; // 동적으로도 스크롤 활성화 보장
};

// 날짜별 작업 표시하기
const displayTasksForDate = (date) => {
  const taskRef = ref(db, `tasks/${date}`);
  get(taskRef).then((snapshot) => {
    if (snapshot.exists()) {
      const tasks = snapshot.val();
      let taskList = "";
      for (const index in tasks) {
        taskList += `<li>${tasks[index].title}</li>`;
      }
      document.getElementById("task-list").innerHTML = `<ul>${taskList}</ul>`;
    } else {
      document.getElementById("task-list").innerHTML =
        "이 날짜에 대한 작업이 없습니다.";
    }
  });
};

// 날짜를 "YYYY-MM-DD" 형식으로 변환
function formatDate(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Firebase에서 필요한 데이터만 가져오기 (최근 2개월 + 미래 2개월)
const fetchFirebaseData = async () => {
  const profileRef = ref(db, "profiles/user1"); // profiles 경로
  const tasksRef = ref(db, "tasks"); // tasks 경로
  const timeRef = ref(db, "time"); // time 경로
  const memoRef = ref(db, "memo"); // memo 경로

  // 프로필 데이터 가져오기
  const profileSnapshot = await get(profileRef);
  const tasksSnapshot = await get(tasksRef);
  const timeSnapshot = await get(timeRef);
  const memoSnapshot = await get(memoRef);

  const firebaseData = {
    memo: "",
    tasks: "",
    time: "",
    username: "",
  };

  // 프로필 데이터 처리
  if (profileSnapshot.exists()) {
    const data = profileSnapshot.val();
    const username = data.username || "USER";
    firebaseData.username = username; // username을 firebaseData에 추가
  } else {
    console.log("프로필 정보가 없습니다.");
  }

  // tasks 데이터 처리
  if (tasksSnapshot.exists()) {
    const tasks = tasksSnapshot.val();
    // tasks가 배열 또는 객체일 경우 JSON.stringify()로 문자열로 변환
    firebaseData.tasks = `최근 작업은: ${JSON.stringify(tasks)}`;
  } else {
    firebaseData.tasks = "작업 정보가 없습니다.";
  }

  // time 데이터 처리
  if (timeSnapshot.exists()) {
    const time = timeSnapshot.val();
    // time이 객체일 경우 시간 형식이 있다면 문자열로 변환
    firebaseData.time = `최근 집중 시간: ${JSON.stringify(time)}`;
  } else {
    firebaseData.time = "집중 시간 정보가 없습니다.";
  }

  // memo 데이터 처리
  if (memoSnapshot.exists()) {
    const memo = memoSnapshot.val();
    firebaseData.memo = `메모: ${JSON.stringify(memo)}`;
  } else {
    firebaseData.memo = "메모 정보가 없습니다.";
  }
  console.log("Firebase Data:", firebaseData); // firebaseData 객체 출력

  return firebaseData;
};

// AI 메시지를 요청하는 함수 (OpenAI API 호출)
const fetchAIMessage = async (firebaseData) => {
  document.getElementById("ai-message").textContent =
    "AI가 답변을 생성 중입니다. 조금만 기다려주세요...";
  try {
    console.log(firebaseData.username); // username이 DOM 요소일 경우, 해당 요소의 텍스트를 확인
    const username =
      firebaseData.username instanceof HTMLElement
        ? firebaseData.username.textContent || "USER"
        : firebaseData.username || "USER";

    console.log(username); // "profiletest" 또는 DOM 요소의 텍스트 내용
    const systemMessage = `
너는 내 비서이다. 따뜻하고 친절한 말투를 사용해야 한다. 내가 한 일들, 오늘의 작업, 그리고 집중한 시간을 잘 분석하여 좋은 조언을 제공해야 한다. 
너의 목표는 내가 한 일들을 평가하고, 앞으로 더 나은 계획을 세울 수 있도록 도움을 주는 것이다. 
내가 제공하는 정보들을 기반으로 사실에 근거한 피드백을 주고, 최근 경향도 반영하여 유용한 조언을 해줘. 
내 이름(같이 보낸 데이터에서 ${username}의 값) 을 그대로 언급하되, 지나치게 개인적인 감정을 표현하지 않도록 주의하고,
항상 분석적이고 객관적인 조언을 제공하라. 메모의 내용은 참고하지 않는다.

너는 내 계획과 집중에 대해 평가하고, 내가 더 효율적이고 성과를 높일 수 있도록 돕기 위한 조언을 주어야 한다. 
작업 내용을 그대로 언급하지 말고, 집중도나 시간 관리, 그리고 어떻게 더 나은 결과를 얻을 수 있는지에 대해 언급하라.
특히, 파이어베이스에 기록된 여러 가지 데이터 일부에 대한 정확한 이름 언급이 필요하다. '파이어베이스' 언급은 하지 말아라. 
정확히 6문장으로 구성되게 하라.

*문장은 토큰이 끝나기 전 종결되어야 하며, 온점이 없이 문장이 끝나지 않게 하고, 자연스럽게 흐르는 문장을 유지하라.* 
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: systemMessage.trim(), // 시스템 메시지에서 공백을 제거하여 명확하게 전달
          },
          {
            role: "user",
            content: firebaseData.memo,
          },
          {
            role: "user",
            content: firebaseData.tasks,
          },
          {
            role: "user",
            content: firebaseData.time,
          },
        ],
        max_tokens: 400,
        temperature: 0.4,
      }),
    });

    const data = await response.json();
    const aiMessage = data.choices[0].message.content.trim();

    // AI 메시지를 페이지에 표시
    document.getElementById("ai-message").textContent = aiMessage;
  } catch (error) {
    document.getElementById("ai-message").textContent =
      "AI 메시지를 가져오는 데 문제가 발생했습니다. 다시 시도해 주세요.";
    console.error("Error fetching AI message:", error);
  }
};

document
  .getElementById("get-ai-message-btn")
  .addEventListener("click", async () => {
    // Firebase에서 전체 데이터 가져오기
    const firebaseData = await fetchFirebaseData();
    if (firebaseData) {
      console.log(firebaseData); // 데이터가 잘 로드되었는지 콘솔에서 확인
      await fetchAIMessage(firebaseData); // AI에 전달할 데이터
    } else {
      console.error("Firebase 데이터가 없습니다.");
    }
  });
