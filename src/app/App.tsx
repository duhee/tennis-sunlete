import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { AppDataProvider } from './context/AppDataContext.js';
import { router } from './routes.js';

function App() {
  return (
    <AuthProvider>
      <AppDataProvider>
        <RouterProvider router={router} />
      </AppDataProvider>
    </AuthProvider>
  );
}

export default App;
