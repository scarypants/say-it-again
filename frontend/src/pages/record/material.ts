// 발표 자료는 PDF·PPT만 받는다
export const MATERIAL_ACCEPT =
  ".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";

export const isMaterialFile = (file: File) => /\.(pdf|pptx?)$/i.test(file.name);

export const isPdf = (file: File) =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
