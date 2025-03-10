import React from "react";
import styled from "styled-components";
import ControlButton, { ControlButtonType } from "./ControlButton";

interface ControlButtonsProps {
  onLeftClick?: () => void;
  onRightClick?: () => void;
  onSelectClick?: () => void;
}

const ButtonContainer = styled.div`
  display: flex;
  justify-content: space-between;
  width: 100%;
  max-width: 300px;
  margin: 0 auto;
`;

const ControlButtons: React.FC<ControlButtonsProps> = ({
  onLeftClick,
  onRightClick,
  onSelectClick,
}) => {
  return (
    <ButtonContainer>
      {/* 왼쪽 버튼 */}
      <ControlButton
        buttonType={ControlButtonType.GRAY}
        onClick={onLeftClick}
      />

      {/* 가운데 선택 버튼 */}
      <ControlButton
        buttonType={ControlButtonType.ORANGE}
        onClick={onSelectClick}
      />

      {/* 오른쪽 버튼 */}
      <ControlButton
        buttonType={ControlButtonType.GREEN}
        onClick={onRightClick}
      />
    </ButtonContainer>
  );
};

export default ControlButtons;
