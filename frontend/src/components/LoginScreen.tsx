import { useState } from "react";
import { Heartbeat, Eye, EyeSlash } from "@phosphor-icons/react";

const AUTH_KEY = "fitness_auth";

export function getStoredAuth(): string | null {
  return localStorage.getItem(AUTH_KEY);
}

export function setStoredAuth(token: string) {
  localStorage.setItem(AUTH_KEY, token);
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_KEY);
}

interface LoginScreenProps {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setError("Wrong password");
        setPassword("");
        return;
      }

      const data = await res.json();
      setStoredAuth(data.token);
      onLogin();
    } catch {
      setError("Could not reach server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mb-4">
        <Heartbeat size={32} className="text-accent" weight="fill" />
      </div>

      <h1 className="text-xl font-bold text-fg mb-1">FitnessTracker</h1>
      <p className="text-sm text-fg/40 mb-8">Enter your password to unlock</p>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full bg-surface border border-fg/10 rounded-xl px-4 py-3 pr-10 text-sm text-fg outline-none placeholder:text-fg/30 focus:border-accent/50 transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-fg/30 hover:text-fg/60"
          >
            {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !password.trim()}
          className="w-full bg-accent text-on-accent rounded-xl py-3 font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {loading ? "Checking..." : "Unlock"}
        </button>
      </form>
    </div>
  );
}
