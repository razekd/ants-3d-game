import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Display from "./pages/Display";
import Controller from "./pages/Controller";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <div className="flex flex-col items-center justify-center h-screen">
              <h1 className="text-2xl mb-4">Game Hub</h1>
              <Link className="text-blue-500" to="/display">
                Go to Display
              </Link>
              <Link className="text-green-500 mt-2" to="/controller">
                Go to Controller
              </Link>
            </div>
          }
        />
        <Route path="/display" element={<Display />} />
        <Route path="/controller" element={<Controller />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
