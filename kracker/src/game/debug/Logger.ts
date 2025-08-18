// src/game/debug/Logger.ts
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

export enum LogCategory {
  GAME = "GAME",
  SCENE = "SCENE",
  PLAYER = "PLAYER",
  MAP = "MAP",
  SHADOW = "SHADOW",
  INPUT = "INPUT",
  UI = "UI",
  CAMERA = "CAMERA",
  PHYSICS = "PHYSICS",
  PARTICLE = "PARTICLE",
  PERFORMANCE = "PERF",
}

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
}

export class Logger {
  private static instance: Logger;
  private logHistory: LogEntry[] = [];
  private maxHistorySize = 1000;

  // 디버그 설정 (나중에 DebugConfig에서 가져올 예정)
  private enabledCategories: Set<LogCategory> = new Set(
    Object.values(LogCategory)
  );
  private currentLogLevel: LogLevel = LogLevel.INFO;
  private isDebugMode: boolean = true; // 개발 중에는 true

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  // 로그 레벨 및 카테고리 설정
  setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
    this.info(LogCategory.GAME, `Log level changed to: ${LogLevel[level]}`);
  }

  setDebugMode(enabled: boolean): void {
    this.isDebugMode = enabled;
    console.log(`🐛 Debug mode: ${enabled ? "ON" : "OFF"}`);
  }

  enableCategory(category: LogCategory): void {
    this.enabledCategories.add(category);
  }

  disableCategory(category: LogCategory): void {
    this.enabledCategories.delete(category);
  }

  toggleCategory(category: LogCategory): boolean {
    if (this.enabledCategories.has(category)) {
      this.disableCategory(category);
      return false;
    } else {
      this.enableCategory(category);
      return true;
    }
  }

  // 로깅 메서드들
  error(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.ERROR, category, message, data);
  }

  warn(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  info(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  debug(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  trace(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.TRACE, category, message, data);
  }

  // 메인 로깅 함수
  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: any
  ): void {
    // 디버그 모드가 꺼져있으면 ERROR만 출력
    if (!this.isDebugMode && level > LogLevel.ERROR) {
      return;
    }

    // 현재 로그 레벨보다 높은 레벨은 필터링
    if (level > this.currentLogLevel) {
      return;
    }

    // 비활성화된 카테고리는 필터링
    if (!this.enabledCategories.has(category)) {
      return;
    }

    const timestamp = Date.now();
    const logEntry: LogEntry = {
      timestamp,
      level,
      category,
      message,
      data,
    };

    // 히스토리에 저장
    this.addToHistory(logEntry);

    // 콘솔에 출력
    this.outputToConsole(logEntry);
  }

  private addToHistory(entry: LogEntry): void {
    this.logHistory.push(entry);

    // 히스토리 크기 제한
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }
  }

  private outputToConsole(entry: LogEntry): void {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const levelName = LogLevel[entry.level];
    const categoryName = entry.category;

    // 색상 설정
    const colors = this.getLogColors(entry.level);
    const prefix = `%c[${time}] %c${levelName} %c[${categoryName}]%c`;

    if (entry.data !== undefined) {
      console.log(
        prefix + ` ${entry.message}`,
        colors.time,
        colors.level,
        colors.category,
        colors.message,
        entry.data
      );
    } else {
      console.log(
        prefix + ` ${entry.message}`,
        colors.time,
        colors.level,
        colors.category,
        colors.message
      );
    }
  }

  private getLogColors(level: LogLevel) {
    const baseColors = {
      time: "color: #666; font-size: 11px;",
      message: "color: #333;",
    };

    switch (level) {
      case LogLevel.ERROR:
        return {
          ...baseColors,
          level:
            "color: #fff; background: #e74c3c; padding: 2px 4px; border-radius: 2px; font-weight: bold;",
          category: "color: #e74c3c; font-weight: bold;",
        };
      case LogLevel.WARN:
        return {
          ...baseColors,
          level:
            "color: #fff; background: #f39c12; padding: 2px 4px; border-radius: 2px; font-weight: bold;",
          category: "color: #f39c12; font-weight: bold;",
        };
      case LogLevel.INFO:
        return {
          ...baseColors,
          level:
            "color: #fff; background: #3498db; padding: 2px 4px; border-radius: 2px; font-weight: bold;",
          category: "color: #3498db; font-weight: bold;",
        };
      case LogLevel.DEBUG:
        return {
          ...baseColors,
          level:
            "color: #fff; background: #2ecc71; padding: 2px 4px; border-radius: 2px; font-weight: bold;",
          category: "color: #2ecc71; font-weight: bold;",
        };
      case LogLevel.TRACE:
        return {
          ...baseColors,
          level:
            "color: #fff; background: #9b59b6; padding: 2px 4px; border-radius: 2px; font-weight: bold;",
          category: "color: #9b59b6; font-weight: bold;",
        };
      default:
        return {
          ...baseColors,
          level: "color: #333;",
          category: "color: #333;",
        };
    }
  }

  // 유틸리티 메서드들
  getHistory(): LogEntry[] {
    return [...this.logHistory];
  }

  clearHistory(): void {
    this.logHistory = [];
    this.info(LogCategory.GAME, "Log history cleared");
  }

  getStats(): {
    total: number;
    byLevel: Record<string, number>;
    byCategory: Record<string, number>;
  } {
    const stats = {
      total: this.logHistory.length,
      byLevel: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
    };

    this.logHistory.forEach((entry) => {
      const levelName = LogLevel[entry.level];
      const categoryName = entry.category;

      stats.byLevel[levelName] = (stats.byLevel[levelName] || 0) + 1;
      stats.byCategory[categoryName] =
        (stats.byCategory[categoryName] || 0) + 1;
    });

    return stats;
  }

  // 편의 메서드들
  logPlayerAction(action: string, data?: any): void {
    this.debug(LogCategory.PLAYER, `Player action: ${action}`, data);
  }

  logMapEvent(event: string, data?: any): void {
    this.info(LogCategory.MAP, `Map event: ${event}`, data);
  }

  logPerformance(operation: string, duration: number): void {
    const level = duration > 16 ? LogLevel.WARN : LogLevel.TRACE; // 16ms = 60fps
    this.log(
      level,
      LogCategory.PERFORMANCE,
      `${operation}: ${duration.toFixed(2)}ms`
    );
  }
}

// 전역 로거 인스턴스 생성
export const logger = Logger.getInstance();

// 편의 함수들 (기존 console.log 쉽게 교체하기 위해)
export const log = {
  error: (category: LogCategory, message: string, data?: any) =>
    logger.error(category, message, data),
  warn: (category: LogCategory, message: string, data?: any) =>
    logger.warn(category, message, data),
  info: (category: LogCategory, message: string, data?: any) =>
    logger.info(category, message, data),
  debug: (category: LogCategory, message: string, data?: any) =>
    logger.debug(category, message, data),
  trace: (category: LogCategory, message: string, data?: any) =>
    logger.trace(category, message, data),
};
