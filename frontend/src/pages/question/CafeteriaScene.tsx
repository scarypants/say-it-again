// Part 2 사진 묘사용 장면: 학교 카페테리아. 묘사할 거리(사람·행동·물건·위치)가 충분하도록 그림
export default function CafeteriaScene() {
  return (
    <svg
      viewBox="0 0 320 200"
      className="h-full w-full"
      role="img"
      aria-label="학교 카페테리아. 왼쪽 계산대에서 직원이 커피를 건네고, 오른쪽 테이블에 학생 두 명이 노트북과 책을 펴고 앉아 있다. 창밖에 나무가 보이고 계산대 위에 메뉴판이 걸려 있다."
    >
      {/* 벽·바닥 */}
      <rect width="320" height="200" fill="#eef1f5" />
      <rect y="150" width="320" height="50" fill="#d9cfc1" />
      {/* 창문과 나무 */}
      <rect x="190" y="18" width="110" height="70" rx="3" fill="#cfe3f2" stroke="#9aa6b8" strokeWidth="2" />
      <line x1="245" y1="18" x2="245" y2="88" stroke="#9aa6b8" strokeWidth="2" />
      <circle cx="222" cy="58" r="16" fill="#7fb07f" />
      <rect x="220" y="66" width="4" height="22" fill="#8a6a4a" />
      <circle cx="275" cy="50" r="12" fill="#8cbd88" />
      {/* 메뉴판 */}
      <rect x="22" y="16" width="120" height="40" rx="3" fill="#2b3550" />
      <rect x="32" y="26" width="46" height="4" rx="2" fill="#e8ecf2" />
      <rect x="32" y="36" width="60" height="3" rx="1.5" fill="#9aa6b8" />
      <rect x="32" y="44" width="52" height="3" rx="1.5" fill="#9aa6b8" />
      <rect x="104" y="26" width="28" height="22" rx="2" fill="#e6b325" />
      {/* 계산대 */}
      <rect x="14" y="112" width="140" height="44" rx="3" fill="#a07c5a" />
      <rect x="14" y="108" width="140" height="8" rx="2" fill="#7d5d40" />
      <rect x="30" y="92" width="22" height="16" rx="2" fill="#4a5568" />
      <rect x="33" y="95" width="16" height="9" fill="#a3d3c2" />
      {/* 직원 (계산대 뒤, 커피를 건넴) */}
      <circle cx="88" cy="70" r="10" fill="#f0c9a5" />
      <path d="M78 66 q10 -12 20 0 v-4 q-10 -10 -20 0z" fill="#3b2f2f" />
      <rect x="76" y="80" width="24" height="28" rx="6" fill="#3d5a99" />
      <rect x="82" y="84" width="12" height="18" fill="#e8ecf2" />
      <line x1="100" y1="90" x2="114" y2="98" stroke="#f0c9a5" strokeWidth="5" strokeLinecap="round" />
      <rect x="112" y="92" width="8" height="10" rx="1.5" fill="#fff" stroke="#7d5d40" />
      {/* 손님 (계산대 앞, 컵을 받음) */}
      <circle cx="136" cy="96" r="9" fill="#d9a77f" />
      <path d="M127 93 q9 -11 18 0 v6 h-3 v-5 h-12 v5 h-3z" fill="#1f1f1f" />
      <rect x="126" y="105" width="20" height="34" rx="6" fill="#d4483b" />
      <rect x="128" y="139" width="7" height="14" fill="#2b3550" />
      <rect x="138" y="139" width="7" height="14" fill="#2b3550" />
      <line x1="127" y1="112" x2="120" y2="100" stroke="#d9a77f" strokeWidth="5" strokeLinecap="round" />
      {/* 테이블과 학생 두 명 */}
      <rect x="196" y="122" width="100" height="8" rx="2" fill="#7d5d40" />
      <rect x="242" y="130" width="6" height="26" fill="#7d5d40" />
      {/* 노트북 학생 (왼쪽) */}
      <circle cx="206" cy="96" r="9" fill="#f0c9a5" />
      <path d="M197 94 q9 -12 18 0 l-1 8 q-8 -6 -16 0z" fill="#6b4b2a" />
      <rect x="197" y="105" width="18" height="20" rx="5" fill="#2f8f5b" />
      <rect x="218" y="104" width="28" height="18" rx="2" fill="#4a5568" />
      <rect x="221" y="107" width="22" height="12" fill="#cfe3f2" />
      <rect x="214" y="120" width="36" height="3" fill="#2d3748" />
      {/* 책 읽는 학생 (오른쪽, 커피) */}
      <circle cx="284" cy="96" r="9" fill="#e1b48f" />
      <path d="M275 92 q9 -11 18 0 v3 h-18z" fill="#2b2b2b" />
      <rect x="275" y="105" width="18" height="20" rx="5" fill="#8a5cd6" />
      <path d="M258 114 l12 -4 l12 4 v8 l-12 -3 l-12 3z" fill="#fff" stroke="#9aa6b8" />
      <rect x="262" y="114" width="7" height="8" rx="1.5" fill="#fff" stroke="#7d5d40" />
      {/* 의자 */}
      <rect x="196" y="125" width="20" height="4" fill="#2b3550" />
      <rect x="274" y="125" width="20" height="4" fill="#2b3550" />
      {/* 화분 */}
      <rect x="166" y="132" width="16" height="18" rx="2" fill="#c9734f" />
      <path d="M174 132 q-12 -18 -4 -26 q4 10 4 26 q0 -16 8 -24 q4 12 -8 24z" fill="#5f9e63" />
    </svg>
  );
}
