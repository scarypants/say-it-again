import { useRef, useState } from "react";

type Props = { word: string; edited: boolean; onCommit: (value: string) => void };

// 대본의 단어 한 칸. 누르면 그 자리에서 고친다 (Enter·바깥 누르기 = 저장, Esc = 취소)
export default function EditableWord({ word, edited, onCommit }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(word);
  const doneRef = useRef(false);

  // Enter와 blur가 둘 다 와도 한 번만 저장
  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    setEditing(false);
    onCommit(value);
  }

  if (editing)
    return (
      <>
        <input
          autoFocus
          value={value}
          size={Math.max(2, value.length + 1)}
          aria-label={`'${word}' 고치기`}
          className="input input-sm h-8 max-w-full px-1.5 align-baseline text-[1.0625rem]"
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={finish}
          onKeyDown={(e) => {
            if (e.key === "Enter") finish();
            if (e.key === "Escape") {
              doneRef.current = true;
              setValue(word);
              setEditing(false);
            }
          }}
        />{" "}
      </>
    );

  return (
    <>
      <button
        type="button"
        className={`rounded-selector px-0.5 hover:bg-base-200 ${
          edited ? "underline decoration-accent decoration-2 underline-offset-4" : ""
        }`}
        title={edited ? "고친 단어" : "눌러서 고치기"}
        onClick={() => {
          setValue(word);
          doneRef.current = false;
          setEditing(true);
        }}
      >
        {word}
      </button>{" "}
    </>
  );
}
