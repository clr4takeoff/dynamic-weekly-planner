// Firebase Realtime Database 모듈을 가져옵니다
import { db } from "./firebase-config.js"; // db는 firebase-config.js에서 가져옵니다
import {
  ref as dbRef,
  set,
  get,
  remove,
} from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";

// 프로필 저장을 위한 데이터 처리
const saveProfileButton = document.getElementById("save-profile");

// 프로필 사진 업로드
const profilePic = document.getElementById("profile-pic");
const profilePicUpload = document.getElementById("profile-pic-upload");

// 프로필 사진을 클릭하면 파일 선택 대화상자가 열리도록 설정
profilePic.addEventListener("click", () => {
  profilePicUpload.click();
});

// 파일 선택 후, Base64로 변환하여 미리보기로 표시
// 파일 업로드 핸들러
profilePicUpload.addEventListener("change", () => {
  const file = profilePicUpload.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      profilePic.style.backgroundImage = `url('${e.target.result}')`;
    };
    reader.readAsDataURL(file);
  } else {
    // 기본 회색 배경 유지
    profilePic.style.backgroundImage = "none";
    profilePic.style.backgroundColor = "#cccccc";
  }
});

// 프로필 저장
const usernameInput = document.getElementById("username");
const statusMessageInput = document.getElementById("status-message");

saveProfileButton.addEventListener("click", async () => {
  const username = usernameInput.value || "USER";
  const statusMessage =
    statusMessageInput.value || "오늘도 좋은 하루 보내세요.";

  // Base64로 변환된 프로필 사진을 Firebase에 저장
  const profilePicBase64 = profilePic.style.backgroundImage
    .replace(/^url\(["']?/, "")
    .replace(/["']?\)$/, "");

  // Firebase Realtime Database에 저장
  const userRef = dbRef(db, "profiles/user1");
  await set(userRef, {
    username: username,
    statusMessage: statusMessage,
    profilePic: profilePicBase64, // Base64로 인코딩된 이미지를 저장
  });

  alert("프로필이 저장되었습니다.");
});

// Firebase에서 프로필 정보 불러오기
document.addEventListener("DOMContentLoaded", async () => {
  const userRef = dbRef(db, "profiles/user1");
  const snapshot = await get(userRef);

  if (snapshot.exists()) {
    const data = snapshot.val();

    // Firebase에서 불러온 데이터를 입력 필드에 넣기
    if (data.username) usernameInput.value = data.username;
    if (data.statusMessage) statusMessageInput.value = data.statusMessage;

    // Base64로 저장된 프로필 사진을 미리보기로 설정
    if (data.profilePic) {
      profilePic.style.backgroundImage = `url(${data.profilePic})`;
    }
  } else {
    console.log("프로필 정보가 없습니다.");
  }
});

// 초기화 버튼: 데이터베이스의 모든 데이터 삭제
const resetDataButton = document.getElementById("reset-data");

resetDataButton.addEventListener("click", async () => {
  if (confirm("모든 데이터를 초기화하시겠습니까?")) {
    // Firebase에서 모든 데이터 삭제
    await remove(dbRef(db)); // 루트 레벨에서 모든 데이터 삭제

    // 화면 초기화
    document.body.style.backgroundColor = "#f0f0f0";
    usernameInput.value = "";
    statusMessageInput.value = "";
    profilePic.style.backgroundImage = "";

    alert("모든 데이터가 초기화되었습니다.");
  }
});
