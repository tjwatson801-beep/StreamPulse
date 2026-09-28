import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

class ErrorBoundary extends React.Component<React.PropsWithChildren, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() { return this.state.error ? <main className="crash"><h1>StreamPulse could not start</h1><p>{this.state.error.message}</p><button onClick={() => location.reload()}>Reload</button></main> : this.props.children; }
}
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
