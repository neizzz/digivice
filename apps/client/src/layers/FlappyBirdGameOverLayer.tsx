import type React from "react";

export interface FlappyBirdGameOverLayerProps {
  score: number;
  bestScore: number;
  onRestart: () => void;
  onExit: () => void;
}

const FlappyBirdGameOverLayer: React.FC<FlappyBirdGameOverLayerProps> = ({
  onRestart,
  onExit,
}) => {
  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/50">
      <div className="flex w-full max-w-[22rem] flex-col items-center gap-5 px-4 text-center text-white">
        <div className="text-[2.25rem] font-bold tracking-[0.12em] uppercase drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]">
          Game Over
        </div>
        <div className="flex justify-center gap-[15px]">
          <button
            type="button"
            onClick={onExit}
            className="text-[1.5rem] bg-component-negative text-white border-2 border-[#222] px-[15px] py-0.5 cursor-pointer uppercase shadow-[2px_2px_0_#222] relative top-0 left-0 transition-all duration-50"
          >
            Exit
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="text-[1.5rem] bg-component-positive text-white border-2 border-[#222] px-[15px] py-0.5 cursor-pointer uppercase shadow-[2px_2px_0_#222]"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlappyBirdGameOverLayer;
