import { createBrowserRouter, Navigate } from "react-router";
import { LoginPage } from "./pages/LoginPage";
import { UserDashboard } from "./pages/UserDashboard";
import { MasterPage } from "./pages/MasterPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SharedBracket } from "./pages/SharedBracket";
import { NotFound } from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: LoginPage,
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
    path: "/bracket/share",
    Component: SharedBracket,
  },
  {
    path: "*",
    Component: NotFound,
  },
]);
