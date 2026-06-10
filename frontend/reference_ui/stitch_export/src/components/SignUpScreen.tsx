import React, { useState } from "react";
import { Mail, Lock, KeyRound, AlertTriangle, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Screen } from "../types";

interface SignUpScreenProps {
  onNavigate: (screen: Screen) => void;
  onSetEmail: (email: string) => void;
}

export default function SignUpScreen({ onNavigate, onSetEmail }: SignUpScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("mypassword123");
  const [confirmPassword, setConfirmPassword] = useState("mypasword_different_123");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordsMismatch = password !== confirmPassword;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordsMismatch) {
      return;
    }
    if (email.trim()) {
      onSetEmail(email.trim());
      onNavigate(Screen.Inbox);
    }
  };

  return (
    <div id="signup-container" className="w-full min-h-screen bg-[#fcfbf8] flex flex-col pt-12 pb-8 px-6 relative mx-auto max-w-md">
      {/* Header Section */}
      <header id="signup-header" className="flex flex-col items-center mt-8 mb-8">
        <div className="h-16 mb-6">
          <img
            id="signup-logo"
            alt="Sydney Logo"
            className="h-full w-auto object-contain"
            src="https://lh3.googleusercontent.com/aida/AP1WRLtR8thV_XENrbbJDaS-y7sBjGCdaNGhXBN8yWIT2_adjYOA8sTKLzGtga98G5_2bKlVpBjDE1UWn905WNvoA05TKJhoK_nq5NvZtKGakgl60h83oLONp1mU_WwHCQZO__kRIE0I9PSr_xWKpcf6vFcyJXiGhIyvsPmY4b7nAsZnKpmatW5WILy1AHxjsyY3yN7_2sO-BVKmxOv5kZZaLampPoY6hxcy8AZYywj1IIBh1LuhU9soZH2d1Yzm"
          />
        </div>
        <h1 className="text-3xl font-bold text-[#333333] mb-2 text-center font-inter">Sign Up For Free.</h1>
        <p className="text-[#666666] text-sm text-center font-inter">Join us for less than 1 minute, with no cost.</p>
      </header>

      {/* Form Section */}
      <main id="signup-main" className="flex-grow flex flex-col">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div className="space-y-1">
            <label htmlFor="signup-email" className="block text-xs font-semibold text-[#333333] ml-1">
              Email Address
            </label>
            <div className="bg-[#f4f2ee] flex items-center px-4 py-3 rounded-xl border border-transparent focus-within:bg-white focus-within:border-[#2e7d32] focus-within:ring-1 focus-within:ring-[#2e7d32] transition-colors">
              <Mail className="w-5 h-5 text-gray-500 mr-3 shrink-0" />
              <input
                id="signup-email"
                type="email"
                required
                className="bg-transparent border-none p-0 focus:ring-0 w-full text-sm text-[#333333] placeholder-gray-400 outline-none"
                placeholder="Enter your email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1">
            <label htmlFor="signup-password" className="block text-xs font-semibold text-[#333333] ml-1">
              Password
            </label>
            <div className="bg-[#f4f2ee] flex items-center px-4 py-3 rounded-xl border border-transparent focus-within:bg-white focus-within:border-[#2e7d32] focus-within:ring-1 focus-within:ring-[#2e7d32] transition-colors">
              <Lock className="w-5 h-5 text-gray-500 mr-3 shrink-0" />
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                required
                className="bg-transparent border-none p-0 focus:ring-0 w-full text-sm text-[#333333] placeholder-gray-400 outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 focus:outline-none ml-2 cursor-pointer"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Password Confirmation Field (Demonstrating error state from spec design) */}
          <div className="space-y-1">
            <label htmlFor="signup-confirm" className="block text-xs font-semibold text-[#333333] ml-1">
              Password Confirmation
            </label>
            <div
              className={`flex items-center px-4 py-3 rounded-xl border transition-colors ${
                passwordsMismatch
                  ? "bg-white border-[#f44336] focus-within:ring-1 focus-within:ring-[#f44336]"
                  : "bg-[#f4f2ee] border-transparent focus-within:bg-white focus-within:border-[#2e7d32] focus-within:ring-1 focus-within:ring-[#2e7d32]"
              }`}
            >
              <KeyRound className="w-5 h-5 text-gray-500 mr-3 shrink-0" />
              <input
                id="signup-confirm"
                type={showConfirmPassword ? "text" : "password"}
                required
                className="bg-transparent border-none p-0 focus:ring-0 w-full text-sm text-[#333333] placeholder-gray-400 outline-none"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 focus:outline-none ml-2 cursor-pointer"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Validation Error Message Container fitting screen 3 mock exactly */}
            {passwordsMismatch && (
              <div className="bg-[#fdeded] border border-[#f44336] rounded-lg p-3 mt-2 flex items-center text-[#d32f2f] text-xs font-semibold animate-pulse">
                <AlertTriangle className="w-4 h-4 mr-2 shrink-0" />
                <span>ERROR: Passwords do not match!</span>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={passwordsMismatch}
              className={`w-full font-semibold py-4 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md ${
                passwordsMismatch
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-[#2e7d32] hover:bg-[#1b5e20] text-white active:scale-[0.98] cursor-pointer"
              }`}
            >
              Sign Up
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </div>
        </form>
      </main>

      {/* Footer Section */}
      <footer id="signup-footer" className="mt-auto pt-6 text-center">
        <p className="text-sm text-[#666666] font-medium font-inter">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => onNavigate(Screen.SignIn)}
            className="text-[#2e7d32] hover:underline font-semibold cursor-pointer text-base ml-1"
          >
            Sign In.
          </button>
        </p>
        {/* Home Indicator */}
        <div className="w-32 h-1.5 bg-gray-300 rounded-full mx-auto mt-8"></div>
      </footer>
    </div>
  );
}
