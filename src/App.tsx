import { Routes, Route } from "react-router";
import Home from "./pages/Home";
import Marketplace from "./pages/Marketplace";
import Advisory from "./pages/Advisory";
import Prices from "./pages/Prices";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import PlantScan from "./pages/PlantScan";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/market" element={<Marketplace />} />
      <Route path="/advisory" element={<Advisory />} />
      <Route path="/prices" element={<Prices />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/login" element={<Login />} />
      <Route path="/scan" element={<PlantScan />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
