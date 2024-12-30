import { db } from "./firebase-config.js";
import {
  ref,
  set,
  get,
} from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";

// Flatpickr 설정: 날짜 선택 시 주간 표시 및 이벤트 로드
const calendarPicker = document.getElementById("calendarPicker");
const calendarBody = document.querySelector(".calendar-body");
const timeLabelsColumn = document.querySelector(".time-labels");
const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const modal = document.getElementById("eventModal");
const closeButton = document.querySelector(".close-button");
const eventForm = document.getElementById("eventForm");
const deleteEventButton = document.getElementById("deleteEventButton");

let isDragging = false;
let currentColumn = null;
let dragMode = null;
let selectedStartTime = null;
let selectedEndTime = null;
let selectedSlots = [];
let currentEventId = null;
let hasDragged = false;
let currentWeekKey = null; // 현재 선택된 주간의 키
let selectedEventData = {
  title: "",
  details: "",
  color: "#8F8F8F",
  startTime: "",
  endTime: "",
  date: "",
};


function generateEventId() {
  return `event-${Math.random().toString(36).substr(2, 9)}`;
}

function getWeekRangeUTC(date) {
  console.log("Input Date (Original):", date.toISOString());

  // 로컬 시간 -> UTC로 변환
  const startOfWeek = new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds()
    )
  );
  console.log("Converted to UTC (startOfWeek):", startOfWeek.toISOString());

  // 주 시작일 계산
  const dayOfWeek = startOfWeek.getUTCDay(); // 일요일은 0, 월요일은 1, ...
  console.log("Day of Week (UTC):", dayOfWeek);

  // 현재 주의 일요일로 이동
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - dayOfWeek); // 현재 주의 일요일로 이동
  console.log("Adjusted Start of Week (UTC):", startOfWeek.toISOString());

  // UTC 시간대에서 자정으로 초기화
  startOfWeek.setUTCHours(0, 0, 0, 0);
  console.log("Start of Week (UTC - Final):", startOfWeek.toISOString());

  // 주 끝날 계산 (토요일로 설정)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6); // 토요일로 이동
  endOfWeek.setUTCHours(23, 59, 59, 999);
  console.log("End of Week (UTC):", endOfWeek.toISOString());

  return {
    startOfWeek,
    endOfWeek,
  };
}

document.addEventListener("DOMContentLoaded", function () {

  flatpickr(calendarPicker, {
    dateFormat: "Y-m-d",
    onChange: function (selectedDates) {
      if (selectedDates.length > 0) {
        const selectedDate = selectedDates[0];

        // selectedDate의 날짜를 두 날 증가 (UTC 기준으로)
        const nextDay = new Date(selectedDate); // selectedDate를 복사
        nextDay.setUTCDate(selectedDate.getUTCDate() + 1); // UTC 날짜를 2일 증가

        // 날짜 포맷 맞추기 (ISO 8601 형식에서 YYYY-MM-DD만 추출)
        const selectedDateFormatted1 = selectedDate.toISOString().slice(0, 10); // "YYYY-MM-DD"
        const nextDayFormatted = nextDay.toISOString().slice(0, 10); // "YYYY-MM-DD"

        // selectedDate의 날짜를 두 날 증가 (UTC 기준으로)
        const prevDay = new Date(selectedDate); // selectedDate를 복사
        prevDay.setUTCDate(selectedDate.getUTCDate() + 1); // UTC 날짜를 2일 증가

        // 날짜 포맷 맞추기 (ISO 8601 형식에서 YYYY-MM-DD만 추출)
        const selectedDateFormatted2 = selectedDate.toISOString().slice(0, 10); // "YYYY-MM-DD"
        const prevDayFormatted = prevDay.toISOString().slice(0, 10); // "YYYY-MM-DD"

        highlightWeek(nextDay); // 주간 강조 표시
        updateSlotDates(prevDay); // 슬롯에 날짜를 직접 추가
        loadTasksForWeek(selectedDate); // 해당 주의 이벤트 로드

        // 새로운 슬롯에 드래그 이벤트 다시 바인딩
      bindSlotEvents(); // 아래에서 정의
      console.log("Time slots updated and events rebound.");
      }
    },
  });

  function loadTasksForWeek(selectedDate = new Date()) {
    const { startOfWeek, endOfWeek } = getWeekRangeUTC(selectedDate);

    const tasksRef = ref(db, "tasks");
    get(tasksRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const allTasks = snapshot.val();

          console.log("전체 태스크:", allTasks); // 불러온 데이터 확인

          // 주간 범위 내 태스크 필터링
          const weeklyTasks = Object.entries(allTasks)
            .flatMap(([date, tasks]) => {
              return Object.values(tasks).map((task) => ({
                ...task,
                date, // 날짜 정보 포함
              }));
            })
            .filter((task) => {
              const taskDate = new Date(task.date);
              return taskDate >= startOfWeek && taskDate <= endOfWeek;
            });

          console.log("주간 태스크:", weeklyTasks); // 필터링된 태스크 확인

          // 캘린더 렌더링
          renderTasksToCalendar(weeklyTasks);
        } else {
          console.log("이번 주에 사용할 태스크가 없습니다.");
          renderTasksToCalendar([]);
        }
      })
      .catch((error) => {
        console.error("태스크 불러오기 에러:", error);
      });
  }

  // 주간 태스크를 렌더링하는 함수
  function renderTasksToCalendar(tasks) {
    // 캘린더의 모든 날짜 칸을 먼저 초기화 (기존 일정 삭제)
    const allDayColumns = document.querySelectorAll(
      ".calendar-body .day-column"
    );
    allDayColumns.forEach((dayColumn) => {
      dayColumn.querySelectorAll(".time-part").forEach((slot) => {
        slot.classList.remove("event-slot", "selected");
        slot.style.backgroundColor = "";
        slot.textContent = "";
        delete slot.dataset.eventId;
        delete slot.dataset.title;
        delete slot.dataset.details;
        delete slot.dataset.color;
      });
    });

    deleteEventButton.addEventListener("click", function () {
      if (selectedSlots.length > 0) {
        const eventDate = selectedSlots[0].dataset.date;
        const eventIdToDelete = selectedSlots[0].dataset.eventId;

        if (!eventDate || !eventIdToDelete) {
          console.error("Event date or ID not found for deletion");
          alert("삭제할 이벤트가 선택되지 않았습니다.");
          return;
        }

        // Firebase에서 삭제
        deleteEventFromFirebase(eventDate, eventIdToDelete);
        selectedSlots.forEach(resetSlot);
        selectedSlots = [];
        currentEventId = null;
        closeModal();
      }
    });

    if (closeButton) {
      closeButton.addEventListener("click", function () {
        closeModal(true);
      });
    }

    window.addEventListener("click", function (event) {
      if (event.target === modal) {
        closeModal(true);
      }
    });

    // 시간 슬롯 드래그
    document.querySelectorAll(".day-column").forEach((dayColumn) => {
      dayColumn.addEventListener("mousedown", (e) => {
        if (e.target.classList.contains("event-slot")) {
          currentEventId = e.target.dataset.eventId;
          selectedStartTime = e.target.dataset.time;
          selectedEndTime = e.target.dataset.time;

          document.getElementById("eventTitle").value =
            e.target.dataset.title || "";
          document.getElementById("eventDetails").value =
            e.target.dataset.details || "";
          document.getElementById("eventColor").value =
            e.target.dataset.color || "#8F8F8FFF";

          selectedSlots = Array.from(
            document.querySelectorAll(`[data-event-id="${currentEventId}"]`)
          );
          modal.style.display = "flex";
          return;
        }

        if (
          e.target.classList.contains("time-part") &&
          !e.target.dataset.eventId
        ) {
          isDragging = true;
          currentColumn = dayColumn;
          dragMode = e.target.classList.contains("selected") ? "remove" : "add";
          toggleSlot(e.target, dragMode);

          selectedStartTime = e.target.dataset.time;
          selectedSlots = [e.target];
          hasDragged = false;
        }
      });

      dayColumn.addEventListener("mousemove", (e) => {
        if (isDragging && e.currentTarget === currentColumn) {
          const target = document.elementFromPoint(e.clientX, e.clientY);

          if (target && target.classList.contains("time-part")) {
            if (target.classList.contains("event-slot")) {
              alert("이미 이벤트가 설정된 시간대입니다.");
              isDragging = false;

              selectedSlots.forEach((slot) => {
                slot.classList.remove("selected");
                slot.style.backgroundColor = "";
              });
              selectedSlots = [];
              return;
            }

            if (!selectedSlots.includes(target)) {
              toggleSlot(target, dragMode);
              selectedSlots.push(target);
              hasDragged = true;
            }
          }
        }
      });
    });

    document.addEventListener("mouseup", () => {
      // 드래그가 활성화되어 있고 선택된 슬롯이 있을 때만 실행
      if (isDragging && selectedSlots.length > 0) {
        // 드래그된 슬롯들 확인
        console.log("Selected Slots during drag:", selectedSlots);
    
        // 첫 번째 슬롯의 시간을 시작 시간으로 설정
        const firstSlot = selectedSlots[0];
        selectedStartTime = firstSlot?.dataset?.time;
        const date = firstSlot?.dataset?.date; // 날짜 정보 가져오기
    
        // 마지막 슬롯의 시간을 종료 시간으로 설정
        const lastSlot = selectedSlots[selectedSlots.length - 1];
        selectedEndTime = addMinutesToTime(lastSlot?.dataset?.time, 15);
    
        // 로그 확인
        console.log("Start Time:", selectedStartTime);
        console.log("End Time:", selectedEndTime);
    
        // 유효성 검사
        if (!selectedStartTime || !selectedEndTime || !date) {
          console.error("Invalid data during drag:", {
            selectedStartTime,
            selectedEndTime,
            date,
          });
          return;
        }
    
        // 드래그된 슬롯에 dataset 설정
        selectedSlots.forEach((slot, index) => {
          slot.dataset.index = index; // 슬롯의 인덱스 설정
          slot.dataset.date = date; // 동일한 날짜 설정
          console.log("Slot Updated:", {
            index,
            time: slot.dataset.time,
            date: slot.dataset.date,
          });
        });
    
        // 모달 열기
        openModal();
        document.getElementById("eventStartTime").textContent = selectedStartTime;
        document.getElementById("eventEndTime").textContent = selectedEndTime;
    
        // 드래그 상태 초기화
        hasDragged = false;
      }
    
      isDragging = false;
      currentColumn = null;
      dragMode = null;
    });
    

    // 새로운 태스크를 캘린더에 렌더링
    tasks.forEach((task) => {
      const dayColumn = document.querySelector(
        `.day-column[data-date="${task.date}"]`
      );
      if (dayColumn) {
        const slots = Array.from(dayColumn.querySelectorAll(".time-part"));
        slots.forEach((slot) => {
          const slotTime = slot.dataset.time;

          const startTimeInMinutes = timeToMinutes(task.startTime);
          const endTimeInMinutes = timeToMinutes(task.endTime);
          const slotTimeInMinutes = timeToMinutes(slotTime);

          if (
            slotTimeInMinutes >= startTimeInMinutes &&
            slotTimeInMinutes < endTimeInMinutes
          ) {
            slot.classList.add("event-slot");
            slot.style.backgroundColor = task.color; // 색상 업데이트
            slot.dataset.eventId = task.id;
            slot.dataset.title = task.title;
            slot.dataset.details = task.details;
            slot.textContent =
              slot.dataset.time === task.startTime ? task.title : ""; // 제목 추가
          }
        });
      }
    });
  }

  function updateSlotDates(selectedDate) {
    // 선택된 날짜를 UTC 기준으로 변환
    const startOfWeek = new Date(
      Date.UTC(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      )
    );

    // 주간 시작일 계산 (일요일로 이동)
    const dayOfWeek = startOfWeek.getUTCDay(); // 일요일은 0
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - dayOfWeek); // 일요일로 이동

    // 각 요일에 해당하는 슬롯을 업데이트
    const dayColumns = document.querySelectorAll(".calendar-body .day-column");
    dayColumns.forEach((dayColumn, index) => {
      // 각 요일의 날짜 계산 (UTC 기준)
      const currentDate = new Date(startOfWeek);
      currentDate.setUTCDate(startOfWeek.getUTCDate() + index); // 요일 계산 (UTC 기준)

      // YYYY-MM-DD 형식으로 변환
      const formattedDate = currentDate.toISOString().split("T")[0]; // "YYYY-MM-DD"

      // 각 슬롯에 해당 날짜 설정
      const timeParts = dayColumn.querySelectorAll(".time-part");
      timeParts.forEach((timePart) => {
        timePart.dataset.date = formattedDate; // 데이터 속성 업데이트
      });

      // 디버깅 로그
      console.log(`Updated slots for ${formattedDate}`);
    });
  }

  // 시간 라벨 생성
  for (let hour = 0; hour < 24; hour++) {
    const timeLabelDiv = document.createElement("div");
    timeLabelDiv.classList.add("time-label");
    timeLabelDiv.textContent = `${hour.toString().padStart(2, "0")}:00`;
    timeLabelsColumn.appendChild(timeLabelDiv);
  }

  // 주간 키 생성: 주간의 시작일(일요일 기준)을 반환
  function getWeekKey(date) {
    console.log("Input Date (Original):", date.toISOString()); // 입력 날짜 로그

    // 입력 날짜를 UTC 기준으로 변환
    const startOfWeek = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    console.log("Converted to UTC (startOfWeek):", startOfWeek.toISOString()); // UTC 변환 후 로그

    // 현재 날짜의 요일을 UTC 기준으로 구함
    const dayOfWeek = startOfWeek.getUTCDay(); // 일요일은 0, 월요일은 1, ...
    console.log("Day of Week (UTC):", dayOfWeek);

    // 현재 주의 일요일로 이동
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - dayOfWeek); // 현재 주의 일요일로 이동
    console.log("Adjusted Start of Week (UTC):", startOfWeek.toISOString());

    // UTC 시간대에서 자정으로 초기화
    startOfWeek.setUTCHours(0, 0, 0, 0);
    console.log("Start of Week (UTC - Final):", startOfWeek.toISOString());

    // 주간 시작일을 'YYYY-MM-DD' 형식으로 반환
    return startOfWeek.toISOString().split("T")[0];
  }

  // 각 요일에 시간 슬롯 생성 (daysOfWeek.forEach 부분 수정)
  daysOfWeek.forEach((day, dayIndex) => {
    const dayColumn = document.createElement("div");
    dayColumn.classList.add("day-column");
  
    // 오늘 날짜 기준으로 주차 계산하여 날짜 설정
    const baseDate = new Date();
    const dayDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    dayDate.setDate(dayDate.getDate() - dayDate.getDay() + dayIndex);
  
    for (let hour = 0; hour < 24; hour++) {
      const timeSlot = document.createElement("div");
      timeSlot.classList.add("time-slot");
  
      for (let i = 0; i < 4; i++) {
        const slotPart = document.createElement("div");
        slotPart.classList.add("time-part");
  
        // 시간 및 분 데이터 설정
        const slotTime = new Date(dayDate);
        slotTime.setHours(hour);
        slotTime.setMinutes(i * 15);
  
        slotPart.dataset.time = `${slotTime.getHours().toString().padStart(2, "0")}:${slotTime.getMinutes().toString().padStart(2, "0")}`;
        slotPart.dataset.date = slotTime.toISOString().split("T")[0];
  
        timeSlot.appendChild(slotPart);
      }
      dayColumn.appendChild(timeSlot);
    }
    calendarBody.appendChild(dayColumn);
  });
  

  // 모달 열기
  function openModal() {
    modal.style.display = "flex";

    if (selectedSlots.length > 0) {
      const selectedDateText =
        selectedSlots[0].dataset.date || "날짜가 선택되지 않았습니다.";
      document.getElementById(
        "selectedDate"
      ).textContent = `날짜: ${selectedDateText}`;

      const eventId = selectedSlots[0].dataset.eventId;
      const eventDate = selectedSlots[0].dataset.date;

      if (eventId) {
        // Firebase에서 해당 날짜와 eventId로 이벤트 데이터 불러오기
        findEventById(eventId, eventDate).then((event) => {
          if (event) {
            // 전역 변수에 이벤트 데이터 저장
            selectedEventData = {
              title: event.title || "",
              details: event.details || "",
              color: event.color || "#8F8F8F",
              startTime: event.startTime || "--:--",
              endTime: event.endTime || "--:--",
              date: event.date || "",
            };

            // UI에 반영
            document.getElementById("eventTitle").value =
              selectedEventData.title;
            document.getElementById("eventDetails").value =
              selectedEventData.details;
            document.getElementById("eventColor").value =
              selectedEventData.color;
            document.getElementById("eventStartTime").textContent =
              selectedEventData.startTime;
            document.getElementById("eventEndTime").textContent =
              selectedEventData.endTime;
          } else {
            console.error("이벤트를 불러오지 못했습니다.");
          }
        });
      } else {
        // 신규 이벤트
        selectedEventData = {
          title: "",
          details: "",
          color: "#8F8F8F",
          startTime: "--:--",
          endTime: "--:--",
          date: "",
        };

        // UI 초기화
        document.getElementById("eventTitle").value = selectedEventData.title;
        document.getElementById("eventDetails").value =
          selectedEventData.details;
        document.getElementById("eventColor").value = selectedEventData.color;
        document.getElementById("eventStartTime").textContent =
          selectedEventData.startTime;
        document.getElementById("eventEndTime").textContent =
          selectedEventData.endTime;
      }
    }
  }

  async function findEventById(eventId, date) {
    const tasksRef = ref(db, "tasks");

    try {
      // Firebase에서 데이터를 가져옵니다.
      const snapshot = await get(tasksRef);

      if (snapshot.exists()) {
        const allTasks = snapshot.val(); // 전체 태스크
        console.log("전체 태스크:", allTasks); // 전체 태스크 출력

        // 해당 날짜에 대한 태스크를 찾습니다.
        const tasksForDate = allTasks[date];
        console.log("선택된 날짜의 태스크:", tasksForDate); // 특정 날짜의 태스크 출력

        // 날짜에 해당하는 태스크가 있는지 확인
        if (!tasksForDate) {
          console.error(`해당 날짜 (${date})에 대한 태스크가 없습니다.`);
          return null;
        }

        // `tasksForDate`가 배열인지 객체인지 확인
        if (Array.isArray(tasksForDate)) {
          console.log("배열 형태의 태스크 발견. find()로 이벤트를 찾습니다.");
          const event = tasksForDate.find((task) => task.id === eventId);
          console.log("find()로 찾은 이벤트:", event); // 찾은 이벤트 출력

          if (event) {
            return event; // 이벤트가 있으면 반환
          } else {
            console.error(`이벤트 ID (${eventId})를 찾을 수 없습니다.`);
          }
        } else if (tasksForDate && tasksForDate[eventId]) {
          // `tasksForDate`가 객체일 경우
          console.log(
            "객체 형태의 태스크 발견. eventId로 직접 이벤트를 찾습니다."
          );
          const event = tasksForDate[eventId];
          console.log("객체에서 찾은 이벤트:", event); // 찾은 이벤트 출력

          return event; // 이벤트가 있으면 반환
        } else {
          console.error(`이벤트 ID (${eventId})를 찾을 수 없습니다.`);
        }
      } else {
        console.error("Firebase에서 데이터를 찾을 수 없습니다.");
      }
    } catch (error) {
      console.error("Firebase에서 데이터를 가져오는 중 오류 발생:", error);
    }

    return null; // 데이터가 없거나 오류가 발생하면 null 반환
  }

  function closeModal(discardChanges = true) {
    modal.style.display = "none";

    if (discardChanges) {
      selectedSlots.forEach((slot) => {
        if (!slot.classList.contains("event-slot")) {
          slot.classList.remove("selected");
          slot.style.backgroundColor = "";
        }
      });
    }

    // Reset global state variables
    selectedSlots = [];
    selectedStartTime = null;
    selectedEndTime = null;
    currentEventId = null;
    hasDragged = false;
  }

  // 이벤트를 클릭했을 때 모달에 기존 정보 불러오기
  document.querySelectorAll(".day-column").forEach((dayColumn) => {
    dayColumn.addEventListener("mousedown", async (e) => {
      if (e.target.classList.contains("event-slot")) {
        if (isDragging) return;

        currentEventId = e.target.dataset.eventId;
        selectedStartTime = e.target.dataset.time;
        selectedEndTime = e.target.dataset.time;
        selectedDate = e.target.dataset.date; // 클릭한 슬롯의 날짜

        // 중복 호출 방지: 이미 이벤트 데이터를 가져온 경우 다시 요청하지 않음
        if (currentEventId && selectedStartTime) {
          const existingEvent = await findEventById(
            currentEventId,
            selectedDate
          );

          if (existingEvent) {
            // 기존 이벤트를 모달에 표시
            console.log("찾은 이벤트:", existingEvent);
            document.getElementById("eventTitle").value = existingEvent.title;
            document.getElementById("eventDetails").value =
              existingEvent.details;
            document.getElementById("eventColor").value = existingEvent.color;
            selectedStartTime = existingEvent.startTime;
            selectedEndTime = existingEvent.endTime;
            document.getElementById("eventStartTime").textContent =
              selectedStartTime;
            document.getElementById("eventEndTime").textContent =
              selectedEndTime;

            // 이벤트 타입에 따라 라디오 버튼 설정
            if (existingEvent.eventType === "recurring") {
              document.getElementById("recurringEvent").disabled = true;
              document.getElementById("temporaryEvent").disabled = true;
              document.getElementById("recurringEvent").checked = true;
              document.getElementById("repeatWeeksSection").style.display =
                "block"; // 반복 설정 보여주기
            } else {
              document.getElementById("recurringEvent").disabled = false;
              document.getElementById("temporaryEvent").disabled = false;
              document.getElementById("temporaryEvent").checked = true; // 임시 일정이 선택되도록 설정
              document.getElementById("repeatWeeksSection").style.display =
                "none"; // 반복 설정 숨기기
            }
          } else {
            console.error("이벤트를 찾을 수 없습니다.");
          }

          // 이미 이벤트를 찾았으면 모달 열기
          selectedSlots = Array.from(
            document.querySelectorAll(`[data-event-id="${currentEventId}"]`)
          );

          // 드래그된 슬롯에 인덱스 추가 및 제거
          selectedSlots.forEach((slot, index) => {
            // 기존 슬롯에 인덱스를 할당
            slot.dataset.index = index; // 인덱스를 설정
            console.log("슬롯 인덱스:", slot.dataset.index);

            // `dataset.date`에 `date` 값 설정
            slot.dataset.date = selectedDate; // 타임슬롯의 날짜를 설정
            slot.dataset.time = selectedStartTime; // 슬롯의 시간 설정
          });

          openModal();
        }
        return;
      }
    });
  });

  // 저장 버튼 클릭 시 실행되는 함수
  eventForm.addEventListener("submit", function (event) {
    event.preventDefault();

    // 입력값 받아오기
    const eventTitle = document.getElementById("eventTitle").value.trim();
    const eventDetails = document.getElementById("eventDetails").value.trim();
    const eventColor = document.getElementById("eventColor").value.trim();
    const eventDate = document
      .getElementById("selectedDate")
      .textContent.split(": ")[1];

    const eventType = document.querySelector(
      'input[name="eventType"]:checked'
    ).value; // 'recurring' or 'temporary'
    const repeatWeeks =
      parseInt(document.getElementById("repeatWeeks").value) || 1; // 반복 주 수 (기본값 1주)

    // 필수 필드 확인
    if (
      !eventTitle ||
      !eventDetails ||
      !eventColor ||
      !selectedStartTime ||
      !selectedEndTime ||
      !eventDate
    ) {
      console.error("Missing required fields:", {
        eventTitle,
        eventDetails,
        eventColor,
        selectedStartTime,
        selectedEndTime,
        eventDate,
      });
      alert("All fields must be filled out!");
      return;
    }

    // 기존 이벤트가 있을 경우, Firebase에서 업데이트
    if (currentEventId !== null) {
      updateTaskInFirebase(
        currentEventId,
        eventTitle,
        eventColor,
        eventDate,
        selectedStartTime,
        selectedEndTime,
        eventDetails,
        eventType
      );
    } else {
      // 새 이벤트 저장
      saveTaskToFirebase(
        eventTitle,
        eventColor,
        eventDate,
        selectedStartTime,
        selectedEndTime,
        eventDetails,
        eventType,
        repeatWeeks
      );
    }

    // 모달 닫기
    closeModal(false);

    setTimeout(function () {
      location.reload(); // 페이지 새로고침
    }, 300);
  });

  function updateTaskInFirebase(
    eventId,
    title,
    color,
    date,
    startTime,
    endTime,
    details,
    eventType
  ) {
    const tasksRef = ref(db, "tasks/" + date); // Firebase의 특정 날짜 경로

    get(tasksRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const tasksForDate = snapshot.val(); // 특정 날짜에 대한 이벤트 목록

          // 날짜에 해당하는 태스크가 배열 형태일 경우
          if (Array.isArray(tasksForDate)) {
            const eventToUpdate = tasksForDate.find(
              (task) => task.id === eventId
            );

            if (eventToUpdate) {
              // 업데이트할 이벤트 데이터를 설정
              eventToUpdate.title = title;
              eventToUpdate.color = color;
              eventToUpdate.startTime = startTime;
              eventToUpdate.endTime = endTime;
              eventToUpdate.details = details;
              eventToUpdate.eventType = eventType;

              // Firebase에 업데이트된 데이터 저장
              set(ref(db, `tasks/${date}`), tasksForDate)
                .then(() => {
                  console.log("이벤트가 성공적으로 업데이트되었습니다.");
                })
                .catch((error) => {
                  console.error("이벤트 업데이트 중 오류 발생:", error);
                });
            } else {
              console.error("수정할 이벤트를 찾을 수 없습니다.");
            }
          } else {
            console.error(
              `해당 날짜(${date})에 대한 이벤트 목록이 배열이 아닙니다.`
            );
          }
        } else {
          console.error("해당 날짜의 이벤트가 없습니다.");
        }
      })
      .catch((error) => {
        console.error("Firebase 데이터 가져오기 중 오류 발생:", error);
      });
  }

  // 주 반복 계산 함수 (선택된 날짜 포함)
  function getNextWeekDate(date, weekOffset) {
    const nextWeek = new Date(date); // 선택된 날짜로부터 시작

    // 현재 날짜를 포함하고, weekOffset 만큼 반복을 설정
    if (weekOffset > 0) {
      nextWeek.setDate(nextWeek.getDate() + 7 * weekOffset); // weekOffset만큼 반복 (예: 1주, 2주, 3주)
    }

    // 날짜를 YYYY-MM-DD 형식으로 반환
    const year = nextWeek.getFullYear();
    const month = String(nextWeek.getMonth() + 1).padStart(2, "0"); // 월은 0부터 시작하므로 +1
    const day = String(nextWeek.getDate()).padStart(2, "0"); // 날짜가 1자리일 경우 앞에 0을 추가

    return `${year}-${month}-${day}`; // YYYY-MM-DD 형식으로 변환하여 반환
  }

  // Firebase에 일정 저장 함수
  function saveTaskToFirebase(
    eventTitle,
    eventColor,
    eventDate,
    selectedStartTime,
    selectedEndTime,
    eventDetails,
    eventType,
    repeatWeeks
  ) {
    const eventId = generateEventId(); // 고유 ID 생성
  
    // 반복 일정인지 확인
    if (eventType === "recurring" && repeatWeeks > 0) {
      for (let weekOffset = 0; weekOffset < repeatWeeks; weekOffset++) {
        const targetDate = getNextWeekDate(eventDate, weekOffset); // 다음 주 날짜 계산
        const tasksRef = ref(db, `tasks/${targetDate}`);
  
        get(tasksRef)
          .then((snapshot) => {
            let tasks = snapshot.exists() ? snapshot.val() : [];
  
            // 새로운 태스크 추가
            tasks.push({
              id: `${eventId}-${weekOffset}`, // 각 주차별 고유 ID 생성
              title: eventTitle,
              color: eventColor,
              date: targetDate,
              startTime: selectedStartTime,
              endTime: selectedEndTime,
              details: eventDetails,
              type: eventType, // 반복 일정 정보 포함
            });
  
            // Firebase에 저장
            set(tasksRef, tasks)
              .then(() => {
                console.log(
                  `Task for ${targetDate} saved successfully (Week ${weekOffset + 1})`
                );
              })
              .catch((error) =>
                console.error("Error saving recurring task to Firebase:", error)
              );
          })
          .catch((error) =>
            console.error("Error reading Firebase data for recurring task:", error)
          );
      }
    } else {
      // 임시 일정 저장 로직
      const tasksRef = ref(db, `tasks/${eventDate}`);
      get(tasksRef)
        .then((snapshot) => {
          let tasks = snapshot.exists() ? snapshot.val() : [];
  
          // 새로운 태스크 추가
          tasks.push({
            id: eventId,
            title: eventTitle,
            color: eventColor,
            date: eventDate,
            startTime: selectedStartTime,
            endTime: selectedEndTime,
            details: eventDetails,
            type: eventType, // 정기/임시 구분
          });
  
          // Firebase에 저장
          set(tasksRef, tasks)
            .then(() => console.log("Task saved successfully"))
            .catch((error) =>
              console.error("Error saving task to Firebase:", error)
            );
        })
        .catch((error) => console.error("Error reading Firebase data:", error));
    }
  }
  

  // 주간 선택 및 초기 설정 (일요일 시작)
  function highlightWeek(selectedDate) {
    // 선택된 날짜를 UTC 기준으로 변환
    const startOfWeek = new Date(
      Date.UTC(
        selectedDate.getUTCFullYear(),
        selectedDate.getUTCMonth(),
        selectedDate.getUTCDate()
      )
    );

    const dayOfWeek = startOfWeek.getUTCDay(); // getUTCDay()는 0 (일요일) ~ 6 (토요일)
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - dayOfWeek); // 일요일로 설정

    // 캘린더 헤더 초기화
    const calendarHeader = document.querySelector(".calendar-header");
    calendarHeader.innerHTML = '<div class="time-label"></div>'; // time-label 초기화

    // 일요일부터 토요일까지 7일을 표시
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startOfWeek);
      dayDate.setUTCDate(startOfWeek.getUTCDate() + i); // 각 날짜를 설정

      const dayDiv = document.createElement("div");
      dayDiv.classList.add("day-label");

      // 날짜 포맷: 'Mon 1', 'Tue 2', ...
      dayDiv.textContent = dayDate.toLocaleDateString("en-US", {
        weekday: "short", // 요일 (Mon, Tue 등)
        day: "numeric", // 날짜 (1, 2, 3, ...)
      });

      calendarHeader.appendChild(dayDiv);
    }

    // 각 day-column에 해당 날짜를 data-date 속성으로 설정
    const calendarDays = document.querySelectorAll(
      ".calendar-body .day-column"
    );
    calendarDays.forEach((dayColumn, index) => {
      const dayDate = new Date(startOfWeek);
      dayDate.setUTCDate(startOfWeek.getUTCDate() + index);
      // 날짜를 YYYY-MM-DD 형식으로 설정
      dayColumn.dataset.date = dayDate.toISOString().split("T")[0]; // YYYY-MM-DD
    });
  }

  function deleteEventFromFirebase(eventDate, eventId) {
    const tasksRef = ref(db, `tasks/${eventDate}`);
    get(tasksRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const tasks = snapshot.val();

          // 해당 이벤트 ID에 해당하는 태스크를 제외한 새 배열로 필터링
          const filteredTasks = tasks.filter((task) => task.id !== eventId);

          // 필터링된 새로운 배열로 업데이트
          set(tasksRef, filteredTasks)
            .then(() => {
              console.log("Event deleted");

              // 해당 날짜를 포함하는 주간 일정 새로 고침
              loadTasksForWeek(eventDate); // 주간 일정을 새로 고침
            })
            .catch((error) => {
              console.error("Error deleting event from Firebase:", error);
            });
        } else {
          console.log("No tasks found for the selected date");
        }
      })
      .catch((error) => {
        console.error("Error reading Firebase data:", error);
      });
  }

  function initializeCalendar() {
    const today = new Date();
    currentWeekKey = getWeekKey(today);
    highlightWeek(today);
    updateSlotDates(today);
    loadTasksForWeek(today);
    console.log("Current week key:", currentWeekKey);
    console.log("Today's date:", today);
  }

  initializeCalendar();
});


// 슬롯 드래그 이벤트를 추가하는 함수
function bindSlotEvents() {
  document.querySelectorAll(".time-part").forEach((slot) => {
    slot.addEventListener("mousedown", (e) => {
      isDragging = true;
      const mode = slot.classList.contains("selected") ? "remove" : "add";
      toggleSlot(slot, mode);
      selectedSlots = [slot];
      hasDragged = false;
    });

    slot.addEventListener("mouseover", (e) => {
      if (isDragging) {
        const mode = slot.classList.contains("selected") ? "remove" : "add";
        toggleSlot(slot, mode);
        if (!selectedSlots.includes(slot)) {
          selectedSlots.push(slot);
        }
      }
    });
  });


}


function toggleSlot(slotElement, mode) {
  if (slotElement.dataset.eventId) {
    console.log(`Cannot modify slot with event ID: ${slotElement.dataset.eventId}`);
    return;
  }

  // 상태 변경 조건 추가
  if (mode === "add" && !slotElement.classList.contains("selected")) {
    slotElement.classList.add("selected");
    slotElement.style.backgroundColor = "#C4C4C4FF";
    console.log(`Slot added: ${slotElement.dataset.time}`);
  } else if (mode === "remove" && slotElement.classList.contains("selected")) {
    slotElement.classList.remove("selected");
    slotElement.style.backgroundColor = "";
    console.log(`Slot removed: ${slotElement.dataset.time}`);
  }
}


function addMinutesToTime(time, minutesToAdd) {
  const [hour, minute] = time.split(":").map(Number);
  let newMinute = minute + minutesToAdd;
  let newHour = hour;

  if (newMinute >= 60) {
    newHour += Math.floor(newMinute / 60);
    newMinute %= 60;
  }

  // 시간과 분을 두 자리로 맞추기
  return `${String(newHour).padStart(
    2,
    "0"
  )}:${String(newMinute).padStart(2, "0")}`;
}


// 시간 (HH:MM)을 분으로 변환
function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes; // 시간을 분으로 변환하여 반환
}

// 오늘 날짜를 표시하는 함수
function displayTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  // 날짜 부분을 굵고 크게 표시
  const formattedDate = `${year} / ${month} / ${day}`;

  // HTML에서 날짜를 표시할 요소 선택 후 텍스트 변경
  document.querySelector(".today-date").innerHTML = `
    <p>Today is</p>
    <p class="date-display">${formattedDate}</p>
  `;
}

// 페이지 로드 시 날짜 표시 함수 호출
document.addEventListener("DOMContentLoaded", displayTodayDate);

// 오늘 날짜 가져오는 함수
function getTodayDate() {
  const today = new Date();

  // 로컬 시간대 기준으로 오늘 날짜를 가져오고, 00:00:00으로 설정
  today.setHours(0, 0, 0, 0); // 시간, 분, 초, 밀리초를 0으로 설정

  // YYYY-MM-DD 형식으로 변환하여 반환
  return today.toLocaleDateString("en-CA"); // (예: "2024-11-29")
}

// task-overview에 새로운 task 추가 함수
function addTaskToOverview(eventTitle, color) {
  const taskOverview = document.querySelector(".task-overview");

  // 동일한 색상의 task가 이미 있는지 확인
  let existingTask = Array.from(taskOverview.children).find(
    (task) => task.style.backgroundColor === color
  );

  if (existingTask) {
    existingTask.textContent = eventTitle; // 제목 업데이트
  } else {
    const newTask = document.createElement("div");
    newTask.classList.add("task");
    newTask.textContent = eventTitle;
    newTask.style.backgroundColor = color;
    newTask.style.color = "#fff";
    taskOverview.insertBefore(newTask, taskOverview.firstChild);
  }
}

// task-overview에서 일정 삭제 함수
function removeTaskFromOverview(color) {
  const taskOverview = document.querySelector(".task-overview");

  // task-overview에서 해당 색상과 관련된 태스크 요소를 찾고 삭제
  const taskToRemove = Array.from(taskOverview.children).find(
    (task) => task.style.backgroundColor === color
  );

  if (taskToRemove) {
    taskOverview.removeChild(taskToRemove); // 해당 task 삭제
  }
}

// firebase db에 일정 저장
function saveTaskToFirebase(
  eventTitle,
  color,
  eventDate,
  startTime,
  endTime,
  details = ""
) {
  const eventId = generateEventId(); // 고유 ID 생성
  const tasksRef = ref(db, `tasks/${eventDate}`);

  get(tasksRef)
    .then((snapshot) => {
      let tasks = snapshot.exists() ? snapshot.val() : [];

      // 새로운 태스크 추가
      tasks.push({
        id: eventId,
        title: eventTitle,
        color: color,
        date: eventDate,
        startTime: startTime,
        endTime: endTime,
        details: details,
      });

      // Firebase에 저장
      set(tasksRef, tasks)
        .then(() => {
          console.log("Task saved successfully");

          // 저장 후 3초 뒤에 페이지 새로 고침
          setTimeout(() => {
            location.reload(); // 페이지 새로 고침
          }, 1); // 0.001초 후
        })
        .catch((error) =>
          console.error("Error saving task to Firebase:", error)
        );
    })
    .catch((error) => console.error("Error reading Firebase data:", error));
}

// 페이지 로드 시 오늘 일정만 표시하는 함수
function loadTodayTasksFromFirebase() {
  const todayDate = getTodayDate();
  const tasksRef = ref(db, `tasks/${todayDate}`);
  get(tasksRef)
    .then((snapshot) => {
      if (snapshot.exists()) {
        const tasks = snapshot.val();
        tasks.forEach((task) => {
          addTaskToOverview(task.title, task.color);
        });
      } else {
        console.log("No tasks for today in Firebase.");
      }
    })
    .catch((error) => {
      console.error("Error loading today's tasks from Firebase:", error);
    });
}

// 페이지 로드 시 loadTodayTasks 호출
document.addEventListener("DOMContentLoaded", loadTodayTasksFromFirebase);

// Firebase 메모 저장 함수
function saveMemoToFirebase() {
  const memoText = document.getElementById("memoText").value; // 텍스트 영역에서 입력받은 값
  const memoRef = ref(db, "memo/"); // Firebase에서 "memo" 경로로 참조 설정

  // Firebase에 메모 텍스트 저장
  set(memoRef, memoText)
    .then(() => {
      console.log("Memo saved to Firebase");
      alert("메모가 성공적으로 저장되었습니다"); // 저장 완료 알림
    })
    .catch((error) => {
      console.error("Error saving memo to Firebase:", error);
    });
}

// Firebase에서 메모 로드 함수
function loadMemoFromFirebase() {
  const memoRef = ref(db, "memo/"); // Firebase에서 "memo" 경로로 참조 설정

  // Firebase에서 "memo" 데이터를 읽어오기
  get(memoRef)
    .then((snapshot) => {
      if (snapshot.exists()) {
        document.getElementById("memoText").value = snapshot.val(); // 로드한 메모를 텍스트영역에 표시
      } else {
        console.log("No memo available in Firebase.");
        document.getElementById("memoText").value = ""; // 메모가 없다면 텍스트영역 비우기
      }
    })
    .catch((error) => {
      console.error("Error loading memo", error);
    });
}

// 페이지 로드 시 메모를 자동으로 로드
document.addEventListener("DOMContentLoaded", function () {
  loadMemoFromFirebase(); // 페이지가 로드되면 자동으로 메모를 로드
});

// 메모 저장 버튼 클릭 시 메모 저장 함수 호출
document
  .getElementById("saveMemoButton")
  .addEventListener("click", function () {
    saveMemoToFirebase(); // 버튼 클릭 시 메모 저장
  });

// 슬롯 UI 초기화 함수
function resetSlot(slot) {
  slot.classList.remove("event-slot", "selected"); // 슬롯에서 클래스 제거
  slot.style.backgroundColor = ""; // 배경 색상 제거
  slot.textContent = ""; // 슬롯 텍스트 초기화
  delete slot.dataset.index;
  delete slot.dataset.date;
  function saveTaskToFirebase(
    eventTitle,
    color,
    eventDate,
    startTime,
    endTime
  ) {
    console.log("Saving task with:", {
      eventTitle,
      color,
      eventDate,
      startTime,
      endTime,
    });

    if (!eventTitle || !color || !eventDate || !startTime || !endTime) {
      console.error("Invalid data. All fields must be provided:", {
        eventTitle,
        color,
        eventDate,
        startTime,
        endTime,
      });
      alert("All fields are required to save the task!");
      return;
    }

    const tasksRef = ref(db, `tasks/${eventDate}`);
    get(tasksRef)
      .then((snapshot) => {
        let tasks = snapshot.exists() ? snapshot.val() : [];
        tasks.push({
          title: eventTitle,
          color,
          date: eventDate,
          startTime,
          endTime,
        });
        set(tasksRef, tasks)
          .then(() => console.log("Task saved successfully"))
          .catch((error) =>
            console.error("Error saving task to Firebase:", error)
          );
      })
      .catch((error) => console.error("Error reading Firebase data:", error));
  }

  delete slot.dataset.eventId;
  delete slot.dataset.title;
  delete slot.dataset.details;
  delete slot.dataset.color;
  slot.style.borderBottom = "1px solid #EBEBEBFF"; // 기본 테두리 스타일 복원
}

// 모달에서 이벤트 타입 선택 시 반복 주 입력 필드 표시/숨기기
document.querySelectorAll('input[name="eventType"]').forEach((radio) => {
  radio.addEventListener("change", function () {
    const repeatWeekSection = document.getElementById("repeatWeeksSection");
    if (document.getElementById("recurringEvent").checked) {
      repeatWeekSection.style.display = "none"; // recurring일 경우 주 반복 설정 숨기기
    }
  });
});

// 페이지 로드 시 초기 설정
document.addEventListener("DOMContentLoaded", function () {
  const repeatWeeksSection = document.getElementById("repeatWeeksSection");
  const recurringEvent = document.getElementById("recurringEvent");
  const temporaryEvent = document.getElementById("temporaryEvent");

  // 처음에 repeatWeeksSection 숨기기
  repeatWeeksSection.style.display = "none";

  // 이벤트 타입 선택 시 repeatWeeksSection 표시 여부 변경
  document.querySelectorAll('input[name="eventType"]').forEach((radio) => {
    radio.addEventListener("change", function () {
      // recurringEvent가 체크된 경우 repeatWeeksSection 보이기, 아니면 숨기기
      if (recurringEvent.checked) {
        repeatWeeksSection.style.display = "block"; // recurring을 선택한 경우 반복 주 선택 보이기
      } else {
        repeatWeeksSection.style.display = "none"; // temporary를 선택한 경우 숨기기
      }
    });
  });

  // **초기 상태 설정**: 이미 페이지 로드 시 `recurringEvent`가 체크된 상태인지 확인
  if (recurringEvent.checked) {
    repeatWeeksSection.style.display = "block"; // recurring일 경우 표시
  }
});

// 이벤트 타입 선택 시 repeatWeeksSection 표시 여부 변경
document.querySelectorAll('input[name="eventType"]').forEach((radio) => {
  radio.addEventListener("change", function () {
    const repeatWeekSection = document.getElementById("repeatWeeksSection");
    const recurringEvent = document.getElementById("recurringEvent");

    if (recurringEvent.checked) {
      repeatWeekSection.style.display = "block"; // recurring일 경우 주 반복 설정 필드 보이기
    } else {
      repeatWeekSection.style.display = "none"; // temporary일 경우 주 반복 설정 필드 숨기기
    }
  });
});