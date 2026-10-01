export const getCurrentTime = () => {
  return new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getRandomDelay = () => {
  return Math.floor(Math.random() * 400) + 800;
};