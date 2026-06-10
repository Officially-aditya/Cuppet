import { useState } from "react";
import { ChevronLeft, Mail, ShieldAlert, Layers, ArrowRight, Signal, Wifi, Battery } from "lucide-react";
import { Screen } from "../types";

interface ForgotPasswordScreenProps {
  onNavigate: (screen: Screen) => void;
}

type Method = "email" | "gauth" | "2fa";

export default function ForgotPasswordScreen({ onNavigate }: ForgotPasswordScreenProps) {
  const [selectedMethod, setSelectedMethod] = useState<Method>("2fa");
  const [resetCompleted, setResetCompleted] = useState(false);

  const handleReset = () => {
    setResetCompleted(true);
    setTimeout(() => {
      onNavigate(Screen.SignIn);
    }, 2500);
  };

  return (
    <main className="w-full min-h-screen bg-[#f9f9f7] relative flex flex-col no-scrollbar mx-auto sm:max-w-[480px]">
      {/* Top Status Bar mock from Screen 8 */}
      <div className="w-full h-12 flex justify-between items-center px-6 pt-2 z-10 bg-transparent select-none">
        <div className="text-[15px] font-semibold text-[#333333] tracking-tight">9:31</div>
        <div className="flex items-center gap-1.5 text-[#333333]">
          <Signal className="w-4 h-4" />
          <Wifi className="w-4 h-4" />
          <Battery className="w-5 h-5" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col px-6 pt-4 pb-8 overflow-y-auto">
        {/* Header Section */}
        <header className="flex items-center justify-between mb-8">
          <button
            onClick={() => onNavigate(Screen.SignIn)}
            aria-label="Go back"
            className="w-10 h-10 rounded-xl bg-[#f4f2ee] flex items-center justify-center text-[#333333] hover:bg-gray-200 transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 text-[#333333]" />
          </button>
          
          <img
            alt="Sydney Logo"
            className="h-8 object-contain"
            src="https://lh3.googleusercontent.com/aida/AP1WRLtR8thV_XENrbbJDaS-y7sBjGCdaNGhXBN8yWIT2_adjYOA8sTKLzGtga98G5_2bKlVpBjDE1UWn905WNvoA05TKJhoK_nq5NvZtKGakgl60h83oLONp1mU_WwHCQZO__kRIE0I9PSr_xWKpcf6vFcyJXiGhIyvsPmY4b7nAsZnKpmatW5WILy1AHxjsyY3yN7_2sO-BVKmxOv5kZZaLampPoY6hxcy8AZYywj1IIBh1LuhU9soZH2d1Yzm"
          />
          <div className="w-10"></div>
        </header>

        {resetCompleted ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 bg-primary-soft text-primary rounded-full flex items-center justify-center animate-bounce">
              <Mail className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-[#333333]">Check your inbox!</h2>
            <p className="text-sm text-[#666666] max-w-xs">
              We have dispatched password recovery instructions to your verified contacts list. Redirecting to login...
            </p>
          </div>
        ) : (
          <>
            {/* Titles Section */}
            <section className="mb-8">
              <h1 className="text-[28px] font-bold text-[#333333] leading-tight mb-3 font-inter">
                Forgot Password
              </h1>
              <p className="text-[15px] text-[#666666] leading-relaxed pr-4 font-inter">
                Select contact details where you want to reset your password.
              </p>
            </section>

            {/* Options List */}
            <section className="flex flex-col gap-4 mb-auto">
              {/* Option 1: Email */}
              <div
                onClick={() => setSelectedMethod("email")}
                className={`flex items-center p-4 rounded-2xl border cursor-pointer transition-all duration-300 hover:shadow-sm ${
                  selectedMethod === "email"
                    ? "bg-[#e8f2ef] border-[#1d7a5c] shadow-sm animate-pulse-gentle"
                    : "bg-[#f4f2ee] border-transparent hover:bg-gray-200"
                }`}
              >
                <div className="flex-1 pr-4">
                  <h3 className="text-[15px] font-semibold text-[#333333] mb-1 font-inter">Send via Email</h3>
                  <p className="text-[13px] text-[#666666] leading-snug font-inter">
                    Seamlessly reset your password via email.
                  </p>
                </div>
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center shrink-0 overflow-hidden relative ${
                  selectedMethod === "email" ? "bg-white border border-[#e8f2ef]" : "bg-gray-200"
                }`}>
                  <Mail className={`w-6 h-6 ${selectedMethod === "email" ? "text-[#1d7a5c]" : "text-gray-500"}`} />
                </div>
              </div>

              {/* Option 2: Google Auth */}
              <div
                onClick={() => setSelectedMethod("gauth")}
                className={`flex items-center p-4 rounded-2xl border cursor-pointer transition-all duration-300 hover:shadow-sm ${
                  selectedMethod === "gauth"
                    ? "bg-[#e8f2ef] border-[#1d7a5c] shadow-sm animate-pulse-gentle"
                    : "bg-[#f4f2ee] border-transparent hover:bg-gray-200"
                }`}
              >
                <div className="flex-1 pr-4">
                  <h3 className="text-[15px] font-semibold text-[#333333] mb-1 font-inter">Send via Google Auth</h3>
                  <p className="text-[13px] text-[#666666] leading-snug font-inter">
                    Seamlessly reset your password via gAuth.
                  </p>
                </div>
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center shrink-0 overflow-hidden relative ${
                  selectedMethod === "gauth" ? "bg-white border border-[#e8f2ef]" : "bg-gray-200"
                }`}>
                  <ShieldAlert className={`w-6 h-6 ${selectedMethod === "gauth" ? "text-[#1d7a5c]" : "text-gray-500"}`} />
                </div>
              </div>

              {/* Option 3: 2FA (Selected State in Screen 8 layout) */}
              <div
                onClick={() => setSelectedMethod("2fa")}
                className={`flex items-center p-4 rounded-2xl border cursor-pointer transition-all duration-300 hover:shadow-sm ${
                  selectedMethod === "2fa"
                    ? "bg-[#e8f2ef] border-[#1d7a5c] shadow-sm"
                    : "bg-[#f4f2ee] border-transparent hover:bg-gray-200"
                }`}
              >
                <div className="flex-1 pr-4">
                  <h3 className="text-[15px] font-semibold text-[#333333] mb-1 font-inter">Send via 2FA</h3>
                  <p className="text-[13px] text-[#666666] leading-snug font-inter">
                    Seamlessly reset your password via 2FA.
                  </p>
                </div>
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center shrink-0 overflow-hidden relative ${
                  selectedMethod === "2fa" ? "bg-white border border-[#e8f2ef]" : "bg-gray-200"
                }`}>
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <Layers className={`w-6 h-6 ${selectedMethod === "2fa" ? "text-[#1d7a5c]" : "text-gray-500"}`} />
                  </div>
                </div>
              </div>
            </section>

            {/* Bottom Action Button */}
            <div className="mt-8 pt-4">
              <button
                onClick={handleReset}
                className="w-full h-14 bg-[#1d7a5c] text-white rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 hover:bg-[#145c45] shadow-lg shadow-[#1d7a5c]/20 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] cursor-pointer"
                type="button"
              >
                Reset Password
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Visual Home Indicator bar */}
      <div className="w-full h-8 flex justify-center items-end pb-2 bg-transparent select-none">
        <div className="w-[134px] h-[5px] bg-gray-900 rounded-full"></div>
      </div>
    </main>
  );
}
