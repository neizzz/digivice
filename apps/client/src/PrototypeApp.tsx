import { useEffect } from "react";
import { NfcMatchMakerAdapter } from "./adapter/NfcMatchMakerAdapter";

const matchMaker = new NfcMatchMakerAdapter();

const PrototypeApp = () => {
  useEffect(() => {
    matchMaker.test();
  }, []);

  return <div>PrototypeApp</div>;
};

export default PrototypeApp;
