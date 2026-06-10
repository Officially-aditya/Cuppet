import { useEffect } from "react";
import { motion } from "motion/react";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      id="splash-screen-container"
      className="fixed inset-0 w-full h-full bg-[#f9f9f7] flex flex-col items-center justify-center z-50 overflow-hidden"
    >
      <motion.div
        id="splash-animated-logo-wrapper"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{
          opacity: [0, 1, 1],
          scale: [0.85, 1, 1.02, 1],
        }}
        transition={{
          duration: 2.0,
          times: [0, 0.6, 0.8, 1],
          ease: "easeInOut",
        }}
        className="flex flex-col items-center justify-center"
      >
        <img
          id="splash-brand-logo-img"
          alt="Sydney Brand Logo"
          referrerPolicy="no-referrer"
          className="w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-sm select-none"
          src="https://lh3.googleusercontent.com/aida/AP1WRLtR8thV_XENrbbJDaS-y7sBjGCdaNGhXBN8yWIT2_adjYOA8sTKLzGtga98G5_2bKlVpBjDE1UWn905WNvoA05TKJhoK_nq5NvZtKGakgl60h83oLONp1mU_WwHCQZO__kRIE0I9PSr_xWKpcf6vFcyJXiGhIyvsPmY4b7nAsZnKpmatW5WILy1AHxjsyY3yN7_2sO-BVKmxOv5kZZaLampPoY6hxcy8AZYywj1IIBh1LuhU9soZH2d1Yzm"
        />
      </motion.div>
    </div>
  );
}
