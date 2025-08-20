import React from "react";
import styled from "styled-components";
import BgBase from "../../assets/images/titleBackground.svg";

interface AugmentCardProps {
  name: string;
  description: string;
  imageUrl?: string;
  onClick?: () => void;
  isSelected?: boolean;
}

const AugmentCard: React.FC<AugmentCardProps> = ({
  name,
  description,
  imageUrl,
  onClick,
  isSelected = false,
}) => {
  return (
    <CardContainer onClick={onClick} $isSelected={isSelected}>
      {/* 증강 이미지 영역 */}
      <ImageArea>
        {imageUrl ? (
          <AugmentImage src={imageUrl} alt={name} />
        ) : (
          <PlaceholderImage>
            <span>이미지</span>
          </PlaceholderImage>
        )}
      </ImageArea>
    </CardContainer>
  );
};

export default AugmentCard;

// Styled Components
const CardContainer = styled.div<{ $isSelected: boolean }>`
  width: 380px;
  height: 580px;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 30px;
  transform: ${({ $isSelected }) => ($isSelected ? "scale(1.05)" : "scale(1)")};
  box-shadow: ${({ $isSelected }) => 
    $isSelected 
      ? "0px 8px 20px rgba(106, 64, 169, 0.4)" 
      : "0px 4px 4px rgba(0, 0, 0, 0.25)"
  };
  
  &:hover {
    transform: scale(1.02);
    box-shadow: 0px 6px 15px rgba(0, 0, 0, 0.35);
  }
`;

const ImageArea = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const AugmentImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
`;

const PlaceholderImage = styled.div`
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.1);
  border: 2px dashed rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
`;

const AugmentName = styled.span`
  position: absolute;
  left: 23px;
  top: 220px;
  color: white;
  font-size: 40px;
  font-family: "Apple SD Gothic Neo", sans-serif;
  font-weight: 600;
  text-shadow: 0px 0px 2px rgba(106, 64, 169, 0.28);
  z-index: 3;
`;

const BottomSection = styled.div`
  position: absolute;
  width: 413px;
  height: 155px;
  left: 23px;
  top: 426px;
  background: rgba(224, 216, 216, 0.9);
  border-radius: 8px;
  z-index: 2;
`;

const DescriptionText = styled.div`
  position: absolute;
  left: 23px;
  top: 581px;
  width: 413px;
  height: 24px;
  background: rgba(224, 216, 216, 0.9);
  border-radius: 4px;
  padding: 20px;
  font-size: 16px;
  color: #333;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
`;
