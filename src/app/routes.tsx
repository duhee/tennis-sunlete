import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage.js";
import { UserDashboard } from "./pages/UserDashboard.js";
import { MasterPage } from "./pages/MasterPage.js";
import { ProfilePage } from "./pages/ProfilePage.js";
import { SharedBracket } from "./pages/SharedBracket.js";
import { NotFound } from "./pages/NotFound.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <UserDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/master",
    element: (
      <ProtectedRoute>
        <MasterPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile/:userId",
    element: (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/shared/:bracketId",
    element: <SharedBracket />,
  },
  {
    path: "/bracket/share",
    element: <SharedBracket />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);
