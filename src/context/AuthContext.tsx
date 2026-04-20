import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type UserRole = "admin" | "safety_officer" | "manager";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("auth_user");
    const token = localStorage.getItem("auth_token");
    
    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("auth_user");
        localStorage.removeItem("auth_token");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string, role: UserRole) => {
    setIsLoading(true);
    try {
      // Validate against admin credentials
      const adminCredentials: Record<string, { password: string; name: string }> = {
        "admin@safeguard.io": { password: "Admin@123", name: "Admin User" },
        "john.smith@safeguard.io": { password: "SafeGuard123", name: "John Smith" },
        "jane.doe@safeguard.io": { password: "Monitor456", name: "Jane Doe" },
      };

      const credentials = adminCredentials[email];
      if (!credentials || credentials.password !== password) {
        throw new Error("Invalid email or password");
      }

      // Create user object
      const newUser: User = {
        id: `user_${Date.now()}`,
        email,
        name: credentials.name,
        role: role || "admin",
      };

      // Store in localStorage
      const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("auth_user", JSON.stringify(newUser));
      localStorage.setItem("auth_token", token);
      localStorage.setItem("auth_role", role);

      setUser(newUser);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_role");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
