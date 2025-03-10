import React from "react";
import styled from "styled-components";
import ControlButton, { ControlButtonType } from "./ControlButton";

interface ControlButtonsProps {
  onCancelClick?: () => void; // 왼쪽 버튼을 Cancel 기능으로 변경
  onNextClick?: () => void; // onRightClick에서 onNextClick으로 변경
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
  onCancelClick,
  onNextClick, // onRightClick에서 onNextClick으로 변경
  onSelectClick,
}) => {
  return (
    <ButtonContainer>
      {/* 왼쪽 버튼 - Cancel 기능 */}
      <ControlButton
        buttonType={ControlButtonType.GRAY}
        onClick={onCancelClick}
      />

      {/* 가운데 선택 버튼 */}
      <ControlButton
        buttonType={ControlButtonType.ORANGE}
        onClick={onSelectClick}
      />

      {/* 오른쪽 버튼 - Next 기능 */}
      <ControlButton
        buttonType={ControlButtonType.GREEN}
        onClick={onNextClick} // onRightClick에서 onNextClick으로 변경
      />
    </ButtonContainer>
  );
};

export default ControlButtons;
