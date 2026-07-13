import { useState, useEffect } from "react";
import { HeartbeatIcon as Heartbeat, EyeIcon as Eye, EyeSlashIcon as EyeSlash, LockKeyIcon as LockKey } from "@phosphor-icons/react";
import { setStoredAuth } from "../auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function formatLockout(seconds: number): string {
  if (seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m} minute${m > 1 ? "s" : ""}`;
  return `${s} second${s > 1 ? "s" : ""}`;
}

interface LoginScreenProps {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Countdown timer while locked out
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const id = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          setError("");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [lockoutRemaining]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || lockoutRemaining > 0) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        // Rate-limited: show a clear lockout message with countdown
        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get("Retry-After") ?? "0", 10) || 300;
          setLockoutRemaining(retryAfter);
          setError(`Too many failed attempts — locked out for ${formatLockout(retryAfter)}`);
          setPassword("");
          return;
        }

        const text = await res.text();
        let detail = "Wrong password";
        try {
          const data = JSON.parse(text);
          detail = data.detail || detail;
        } catch { /* not JSON, use text */ }
        setError(detail);
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

      <form onSubmit={handleSubmit} className={`w-full max-w-xs space-y-4 ${lockoutRemaining > 0 ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            disabled={lockoutRemaining > 0}
            className="w-full bg-surface border border-fg/10 rounded-xl px-4 py-3 pr-10 text-sm text-fg outline-none placeholder:text-fg/30 focus:border-accent/50 transition-colors disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={lockoutRemaining > 0}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-fg/30 hover:text-fg/60 disabled:opacity-30"
          >
            {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {lockoutRemaining > 0 && (
          <p className="text-amber-400 text-sm text-center flex items-center justify-center gap-1.5">
            <LockKey size={16} weight="fill" />
            Locked out — {formatLockout(lockoutRemaining)} remaining
          </p>
        )}

        {error && !lockoutRemaining && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !password.trim() || lockoutRemaining > 0}
          className="w-full bg-accent text-on-accent rounded-xl py-3 font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {loading ? "Checking..." : lockoutRemaining > 0 ? "Locked out" : "Unlock"}
        </button>
      </form>
      <p className="text-[10px] text-fg/15 mt-8">v1.2.0</p>
    </div>
  );
}
