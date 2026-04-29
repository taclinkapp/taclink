import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/MobileShell';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, MailCheck } from 'lucide-react';

const ForgotPassword = () => {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Forgot Password" back />
      <div className="max-w-md mx-auto px-6 py-6">
        {sent ? (
          <div className="tactical-card p-6 text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-primary/15 text-primary flex items-center justify-center mx-auto">
              <MailCheck className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-black">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              If an account exists for <span className="text-foreground font-semibold">{email}</span>,
              we've sent a link to reset your password.
            </p>
            <Button onClick={() => nav('/auth/signin')} className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
              Back to Sign In
            </Button>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground text-sm mb-6">
              Enter the email associated with your account and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-card border-border h-12 mt-1.5"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Reset Link'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
