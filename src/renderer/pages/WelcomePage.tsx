import React from 'react'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Shield from 'lucide-react/dist/esm/icons/shield'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right'

export const WelcomePage: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-secondary/5 animate-gradient-shift" />

      {/* Floating orbs for visual interest */}
      <div className="absolute top-20 left-20 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-20 w-40 h-40 bg-secondary/10 rounded-full blur-3xl animate-float-delayed" />

      {/* Main content */}
      <div className="relative z-10 max-w-2xl space-y-8 animate-fade-in-up">
        {/* Hero icon with pulse animation */}
        <div className="flex justify-center">
          <div className="relative group">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500 animate-pulse-slow" />
            <div className="relative w-24 h-24 bg-linear-to-br from-primary/10 to-primary/5 rounded-3xl flex items-center justify-center transform transition-all duration-300 hover:scale-110 hover:rotate-3 animate-scale-in border border-primary/10 shadow-lg">
              <CheckCircle2 className="w-12 h-12 text-primary animate-draw-check" />
            </div>
          </div>
        </div>

        {/* Main heading with staggered animation */}
        <div className="space-y-3 animate-fade-in-up animation-delay-200">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight bg-linear-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
            Ready to Connect
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
            Select a device from the sidebar to start sharing files and messages instantly.
          </p>
        </div>

        {/* Feature cards with hover effects */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 animate-fade-in-up animation-delay-400">
          <div className="group p-4 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm hover:bg-card hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm mb-1">Lightning Fast</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Direct peer-to-peer transfer with no cloud storage
            </p>
          </div>

          <div className="group p-4 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm hover:bg-card hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default animation-delay-100">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm mb-1">Secure & Private</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              End-to-end encrypted connections for your data
            </p>
          </div>

          <div className="group p-4 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm hover:bg-card hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default animation-delay-200">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm mb-1">Easy to Use</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Simple, intuitive interface for seamless sharing
            </p>
          </div>
        </div>

        {/* Call to action hint with bounce animation */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground animate-fade-in animation-delay-600">
          <span>Get started by selecting a device</span>
          <ArrowRight className="w-4 h-4 animate-bounce-horizontal" />
        </div>
      </div>

      {/* Custom animations in style tag */}
      <style>{`
        @keyframes gradient-shift {
          0%, 100% { opacity: 0.3; transform: translate(0, 0) scale(1); }
          50% { opacity: 0.6; transform: translate(10px, 10px) scale(1.05); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-20px) translateX(10px); }
        }

        @keyframes float-delayed {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(20px) translateX(-10px); }
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }

        @keyframes draw-check {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes bounce-horizontal {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(5px); }
        }

        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scale-in {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .animate-gradient-shift { animation: gradient-shift 8s ease-in-out infinite; }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 8s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        .animate-draw-check { animation: draw-check 0.6s ease-out; }
        .animate-bounce-horizontal { animation: bounce-horizontal 2s ease-in-out infinite; }
        .animate-fade-in-up { animation: fade-in-up 0.6s ease-out; }
        .animate-fade-in { animation: fade-in 0.8s ease-out; }
        .animate-scale-in { animation: scale-in 0.5s ease-out; }

        .animation-delay-100 { animation-delay: 0.1s; }
        .animation-delay-200 { animation-delay: 0.2s; }
        .animation-delay-400 { animation-delay: 0.4s; }
        .animation-delay-600 { animation-delay: 0.6s; }

        /* Respect user's motion preferences */
        @media (prefers-reduced-motion: reduce) {
          .animate-gradient-shift,
          .animate-float,
          .animate-float-delayed,
          .animate-pulse-slow,
          .animate-draw-check,
          .animate-bounce-horizontal,
          .animate-fade-in-up,
          .animate-fade-in,
          .animate-scale-in {
            animation: none;
          }

          .hover\\:-translate-y-1:hover {
            transform: none;
          }
        }
      `}</style>
    </div>
  )
}
