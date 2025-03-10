import React from "react";
import styled from "styled-components";
import ControlButton from "./ControlButton";
import { ControlButtonType, ControlButtonStyleType } from "@digivice/game";

interface ControlButtonsProps {
  onButtonPress: (buttonType: ControlButtonType) => void;
}

const ControlButtonsContainer = styled.div`
  width: 80%;
  max-width: 300px;
  display: flex;
  justify-content: space-between;
  margin: 0 auto;
`;

const ControlButtons: React.FC<ControlButtonsProps> = ({ onButtonPress }) => {
  return (
    <ControlButtonsContainer>
      <ControlButton
        buttonStyleType={ControlButtonStyleType.GRAY}
        onClick={() => onButtonPress(ControlButtonType.LEFT)}
      />
      <ControlButton
        buttonStyleType={ControlButtonStyleType.ORANGE}
        onClick={() => onButtonPress(ControlButtonType.CENTER)}
      />
      <ControlButton
        buttonStyleType={ControlButtonStyleType.GREEN}
        onClick={() => onButtonPress(ControlButtonType.CENTER)}
      />
    </ControlButtonsContainer>
  );
};

export default ControlButtons;
