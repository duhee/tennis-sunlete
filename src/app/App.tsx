import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { AppDataProvider } from './context/AppDataContext.js';
import { router } from './routes.js';

function App() {
  return (
    <AppDataProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </AppDataProvider>
  );
}

export default App;
