import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = "Page not found · TacLink";
    console.warn("404:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 grid place-items-center">
          <Compass className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-5xl font-black tracking-tight">404</h1>
          <p className="text-muted-foreground">
            We couldn't find the page you're looking for.
          </p>
          <p className="text-xs text-muted-foreground/70 break-all">
            {location.pathname}
          </p>
        </div>
        <Button asChild className="w-full h-12 font-bold">
          <Link to="/">
            <Home className="mr-2 h-4 w-4" />
            Back to TacLink
          </Link>
        </Button>
      </div>
    </main>
  );
};

export default NotFound;
