import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import splashBg from "@/assets/splash-bg.mp4.asset.json";

const Welcome = () => {
  const nav = useNavigate();
  return (
    <div className="relative min-h-screen flex flex-col bg-background overflow-hidden">
      <video
        src={splashBg.url}
        autoPlay loop muted playsInline aria-hidden
        className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/70 to-background pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col px-6 pt-16 pb-10 max-w-md w-full mx-auto">
        <div className="flex-1 flex flex-col justify-end">
          <h1 className="text-4xl font-black leading-tight tracking-tight text-foreground">
            Find Your Next Mission
          </h1>
          <p className="mt-4 text-base text-muted-foreground leading-relaxed">
            Book tactical training courses near you — firearms, combatives,
            executive protection, and more.
          </p>

          <div className="mt-8 space-y-3">
            <Button
              size="lg"
              className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base"
              onClick={() => nav("/welcome/quiz")}
            >
              Get Started
            </Button>
            <button
              onClick={() => nav("/student?guest=1")}
              className="w-full h-12 text-sm font-semibold text-muted-foreground hover:text-foreground story-link"
            >
              Browse Courses First
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
