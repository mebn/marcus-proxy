import React from "react";
import { createRoot } from "react-dom/client";
import "@/src/style.css";
import Homeview from "@/src/views/Homeview";

const container = document.getElementById("root");

document.documentElement.classList.add("dark");

const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <Homeview />
  </React.StrictMode>,
);
