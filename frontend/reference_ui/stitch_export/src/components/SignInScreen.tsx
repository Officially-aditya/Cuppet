import React, { useState } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Facebook, Chrome, Instagram } from "lucide-react";
import { Screen } from "../types";

interface SignInScreenProps {
  onNavigate: (screen: Screen) => void;
  onSetEmail: (email: string) => void;
}

export default function SignInScreen({ onNavigate, onSetEmail }: SignInScreenProps) {
  const [email, setEmail] = useState("elementary221b@gmail.com");
  const [password, setPassword] = useState("mypassword123");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      onSetEmail(email.trim());
      onNavigate(Screen.Inbox);
    }
  };

  return (
    <div id="signin-container" className="flex flex-col min-h-screen bg-[#f9f9f7] w-full max-w-md mx-auto relative px-6 pt-12 pb-12">
      {/* Header Section */}
      <header id="signin-header" className="flex flex-col items-center text-center mb-8">
        <div id="signin-logo-container" className="mb-6 flex justify-center items-center">
          <img
            id="signin-logo"
            alt="Sydney Logo"
            referrerPolicy="no-referrer"
            className="h-16 w-auto object-contain"
            src="https://lh3.googleusercontent.com/aida/AP1WRLtR8thV_XENrbbJDaS-y7sBjGCdaNGhXBN8yWIT2_adjYOA8sTKLzGtga98G5_2bKlVpBjDE1UWn905WNvoA05TKJhoK_nq5NvZtKGakgl60h83oLONp1mU_WwHCQZO__kRIE0I9PSr_xWKpcf6vFcyJXiGhIyvsPmY4b7nAsZnKpmatW5WILy1AHxjsyY3yN7_2sO-BVKmxOv5kZZaLampPoY6hxcy8AZYywj1IIBh1LuhU9soZH2d1Yzm"
          />
        </div>
        <h1 id="signin-heading" className="text-3xl font-bold text-[#1a1c1b] mb-2 font-inter">Let's Sign In.</h1>
        <p id="signin-description" className="text-sm text-[#6f7a73] px-4 font-inter">
          Delegate work through conversations with agents you trust.
        </p>
      </header>

      {/* Login Form */}
      <form id="signin-form" onSubmit={handleSubmit} className="space-y-5 mb-8">
        {/* Email Input */}
        <div id="signin-email-field" className="space-y-1">
          <label htmlFor="email" className="block text-xs font-semibold text-[#1a1c1b] ml-1">
            Email Address
          </label>
          <div className="bg-white flex items-center px-4 py-3 rounded-xl border border-[#bec9c2] focus-within:border-[#1d7a5c] focus-within:ring-1 focus-within:ring-[#1d7a5c] transition-colors">
            <Mail className="w-5 h-5 text-[#6f7a73] mr-3 shrink-0" />
            <input
              id="email"
              type="email"
              required
              className="bg-transparent border-none p-0 focus:ring-0 w-full text-sm text-[#1a1c1b] placeholder-[#6f7a73] outline-none"
              placeholder="elementary221b@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {/* Password Input */}
        <div id="signin-password-field" className="space-y-1">
          <label htmlFor="password" className="block text-xs font-semibold text-[#1a1c1b] ml-1">
            Password
          </label>
          <div className="bg-[#eeeeec] flex items-center px-4 py-3 rounded-xl border border-transparent focus-within:border-[#1d7a5c] focus-within:bg-white focus-within:ring-1 focus-within:ring-[#1d7a5c] transition-colors">
            <Lock className="w-5 h-5 text-[#6f7a73] mr-3 shrink-0" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              className="bg-transparent border-none p-0 focus:ring-0 w-full text-sm text-[#1a1c1b] placeholder-[#6f7a73] outline-none"
              placeholder="Enter your password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              id="toggle-password-btn"
              type="button"
              className="text-[#6f7a73] hover:text-[#1a1c1b] focus:outline-none ml-2 cursor-pointer"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            id="signin-submit-btn"
            type="submit"
            className="w-full bg-[#1d7a5c] hover:bg-[#176049] text-white font-semibold py-4 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md transform active:scale-[0.98] cursor-pointer"
          >
            Sign In
            <ArrowRight className="ml-2 w-5 h-5" />
          </button>
        </div>
      </form>

      {/* Social Login */}
      <div id="signin-social-login" className="mb-8">
        <div className="flex space-x-4">
          <button
            id="social-login-fb"
            type="button"
            className="flex-1 flex justify-center items-center py-4 bg-[#eeeeec] rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <Facebook className="h-5 w-5 text-[#1a1c1b]" />
          </button>
          <button
            id="social-login-chrome"
            type="button"
            className="flex-1 flex justify-center items-center py-4 bg-[#eeeeec] rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <Chrome className="h-5 w-5 text-[#1a1c1b]" />
          </button>
          <button
            id="social-login-insta"
            type="button"
            className="flex-1 flex justify-center items-center py-4 bg-[#eeeeec] rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <Instagram className="h-5 w-5 text-[#1a1c1b]" />
          </button>
        </div>
      </div>

      {/* Footer Links */}
      <footer id="signin-footer" className="mt-auto text-center flex flex-col space-y-3 pb-4">
        <p className="text-sm text-[#1a1c1b] font-medium font-inter">
          Don't have an account?{" "}
          <button
            id="link-to-signup"
            type="button"
            onClick={() => onNavigate(Screen.SignUp)}
            className="text-[#1d7a5c] hover:underline font-semibold cursor-pointer"
          >
            Sign Up.
          </button>
        </p>
        <button
          id="link-to-forgot-password"
          type="button"
          onClick={() => onNavigate(Screen.ForgotPassword)}
          className="text-sm text-[#1d7a5c] font-medium hover:underline cursor-pointer"
        >
          Forgot Password
        </button>
      </footer>
    </div>
  );
}
