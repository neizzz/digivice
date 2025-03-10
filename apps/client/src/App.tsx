import React from "react";
import "./App.css";
import GameContainer from "./GameContainer";

const App: React.FC = () => {
  return (
    <div id="app-container">
      {/* GameContainer 컴포넌트로 게임 관리를 위임 */}
      <GameContainer />
    </div>
  );
};

export default App;
