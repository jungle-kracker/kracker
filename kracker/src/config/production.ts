// 프로덕션 환경 설정
export const PRODUCTION_CONFIG = {
  API_URL: process.env.REACT_APP_API_URL || "http://your-ec2-public-ip",
  SOCKET_URL: process.env.REACT_APP_SOCKET_URL || "http://your-ec2-public-ip",
  PORT: 4000,
};
