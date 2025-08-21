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

// 증강이름과 설명 없이 이미지만 출력해야 함
const AugmentCard: React.FC<AugmentCardProps> = ({
  name,
  description,
  imageUrl,
  onClick,
  isSelected = false,
}) => {
  return (
    <CardContainer onClick={onClick} $isSelected={isSelected}>
      <ImageArea>
        {imageUrl ? (
          <AugmentImage src={imageUrl} alt={name} onError={(e) => ((e.currentTarget.style.display = "none"))} />
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

const Overlay = styled.div`
  position: absolute;
  inset: auto 0 0 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.6));
  padding: 16px 20px 18px;
  color: #fff;
  display: grid;
  gap: 8px;
`;

const Title = styled.div`
  font-size: 24px;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
`;

const Desc = styled.div`
  font-size: 14px;
  line-height: 1.3;
  opacity: 0.9;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
