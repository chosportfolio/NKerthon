export type Language = "ko" | "en" | "zh";

export type LocalizedText = {
  ko: string;
  en: string;
  zh: string;
};

export type LinkButton = {
  text: LocalizedText;
  url: string;
};

export type Menu = {
  title: LocalizedText;
  icon: string;

  showInMenu: boolean;
  page: number;

  // 한국어, 영어, 중국어 키워드를 전부 여기에 넣음
  keywords: string[];

  userText: LocalizedText;
  botText: LocalizedText;
  description?: LocalizedText;

  buttons?: LinkButton[];
};

export type MessageButton = {
  text: string;
  url: string;
};

export type Message = {
  type: "text" | "link" | "menu";
  text: string;
  description?: string;
  buttons?: MessageButton[];

  isUser: boolean;
  time: string;
  isLoading?: boolean;
};