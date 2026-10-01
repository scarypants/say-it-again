// 발표 자료는 PDF만 받는다 (화면에 띄워 넘겨 보면서 녹음)
export const MATERIAL_ACCEPT = ".pdf,application/pdf";

export const isPdf = (file: File) =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
