import "./App.css";
import GameContainer from "./GameContainer";
import { DevEnvironmentBadge } from "./components/DevEnvironmentBadge";

const App = () => {
  return (
    <div id="app-container">
      <DevEnvironmentBadge />
      <GameContainer />
    </div>
  );
};

export default App;
