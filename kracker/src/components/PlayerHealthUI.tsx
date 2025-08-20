import React from "react";
import "./PlayerHealthUI.css";

interface Player {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  isLocalPlayer?: boolean;
}

interface PlayerHealthUIProps {
  players: Player[];
  className?: string;
}

const PlayerHealthUI: React.FC<PlayerHealthUIProps> = ({
  players,
  className = "",
}) => {
  const getHealthColor = (health: number, maxHealth: number) => {
    const ratio = health / maxHealth;
    if (ratio > 0.7) return "#00ff00"; // 초록색 (70% 이상)
    if (ratio > 0.3) return "#ffff00"; // 노란색 (30-70%)
    return "#ff0000"; // 빨간색 (30% 이하)
  };

  const getHealthBarWidth = (health: number, maxHealth: number) => {
    return Math.max(0, Math.min(100, (health / maxHealth) * 100));
  };

  return (
    <div className={`player-health-ui ${className}`}>
      <div className="health-container">
        {players.map((player) => (
          <div
            key={player.id}
            className={`health-item ${
              player.isLocalPlayer ? "local-player" : "remote-player"
            }`}
          >
            <div className="player-name">
              {player.name}
              {player.isLocalPlayer && (
                <span className="local-indicator">(나)</span>
              )}
            </div>
            <div className="health-bar-container">
              <div className="health-bar-background">
                <div
                  className="health-bar-fill"
                  style={{
                    width: `${getHealthBarWidth(
                      player.health,
                      player.maxHealth
                    )}%`,
                    backgroundColor: getHealthColor(
                      player.health,
                      player.maxHealth
                    ),
                  }}
                />
              </div>
              <div className="health-text">
                {player.health}/{player.maxHealth}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerHealthUI;
