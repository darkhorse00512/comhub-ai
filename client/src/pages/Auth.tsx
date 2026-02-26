import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Mail, Lock, ArrowRight, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { otpApi } from "@/services/api";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";

type AuthView = "signin" | "signup" | "signup-otp" | "forgot" | "reset-otp" | "reset-success";

const emailSchema = z.string().email("Please enter a valid email");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const Auth = () => {
  const [view, setView] = useState<AuthView>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { signIn, signInWithGoogle, signUpComplete } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const startCooldown = useCallback(() => setResendCooldown(60), []);

  // Sign In handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const ev = emailSchema.safeParse(email);
    if (!ev.success) { toast({ title: "Validation Error", description: ev.error.errors[0].message, variant: "destructive" }); return; }
    const pv = passwordSchema.safeParse(password);
    if (!pv.success) { toast({ title: "Validation Error", description: pv.error.errors[0].message, variant: "destructive" }); return; }

    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
      } else {
        navigate("/dashboard");
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Signup step 1: send OTP
  const handleSignupSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const ev = emailSchema.safeParse(email);
    if (!ev.success) { toast({ title: "Validation Error", description: ev.error.errors[0].message, variant: "destructive" }); return; }
    const pv = passwordSchema.safeParse(password);
    if (!pv.success) { toast({ title: "Validation Error", description: pv.error.errors[0].message, variant: "destructive" }); return; }

    setLoading(true);
    try {
      const result = await otpApi.sendSignupOTP(email, password);
      if (!result.success) {
        toast({ title: "Sign up failed", description: result.error || "Failed to send code", variant: "destructive" });
      } else {
        setOtpCode("");
        setView("signup-otp");
        startCooldown();
        toast({ title: "Code sent!", description: "Check your email for the 6-digit verification code." });
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Signup step 2: verify OTP
  const handleSignupVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      toast({ title: "Validation Error", description: "Please enter the full 6-digit code", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const result = await otpApi.verifySignupOTP(email, otpCode, password);
      if (!result.success) {
        toast({ title: "Verification failed", description: result.error || "Invalid code", variant: "destructive" });
      } else if (result.token) {
        // Complete signup: store backend token + sign in via Supabase
        const { error } = await signUpComplete(email, password, result.token);
        if (error) {
          toast({ title: "Sign in failed", description: "Account created but auto sign-in failed. Please sign in manually.", variant: "destructive" });
          setView("signin");
        } else {
          navigate("/dashboard");
        }
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Resend signup OTP
  const handleResendSignupOTP = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      const result = await otpApi.sendSignupOTP(email, password);
      if (result.success) {
        startCooldown();
        setOtpCode("");
        toast({ title: "Code resent!", description: "Check your email for the new code." });
      } else {
        toast({ title: "Failed to resend", description: result.error, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  // Forgot password step 1: send reset OTP
  const handleForgotSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const ev = emailSchema.safeParse(email);
    if (!ev.success) { toast({ title: "Validation Error", description: ev.error.errors[0].message, variant: "destructive" }); return; }

    setLoading(true);
    try {
      await otpApi.sendResetOTP(email);
      setOtpCode("");
      setNewPassword("");
      setView("reset-otp");
      startCooldown();
      toast({ title: "Code sent!", description: "If an account exists, a reset code has been sent to your email." });
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Forgot password step 2: verify reset OTP + set new password
  const handleResetVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      toast({ title: "Validation Error", description: "Please enter the full 6-digit code", variant: "destructive" });
      return;
    }
    const pv = passwordSchema.safeParse(newPassword);
    if (!pv.success) { toast({ title: "Validation Error", description: pv.error.errors[0].message, variant: "destructive" }); return; }

    setLoading(true);
    try {
      const result = await otpApi.verifyResetOTP(email, otpCode, newPassword);
      if (!result.success) {
        toast({ title: "Reset failed", description: result.error || "Invalid code", variant: "destructive" });
      } else {
        setView("reset-success");
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Resend reset OTP
  const handleResendResetOTP = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      await otpApi.sendResetOTP(email);
      startCooldown();
      setOtpCode("");
      toast({ title: "Code resent!", description: "Check your email for the new code." });
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast({ title: "Google sign in failed", description: error.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to initiate Google sign in", variant: "destructive" });
    } finally {
      setGoogleLoading(false);
    }
  };

  const GoogleButton = () => (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="w-full h-12"
      disabled={loading || googleLoading}
      onClick={handleGoogleSignIn}
    >
      {googleLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <>
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </>
      )}
    </Button>
  );

  const Divider = () => (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-transparent px-2 text-muted-foreground backdrop-blur-sm">or</span>
      </div>
    </div>
  );

  const OTPInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="flex justify-center">
      <InputOTP maxLength={6} value={value} onChange={onChange}>
        <InputOTPGroup>
          <InputOTPSlot index={0} className="w-12 h-14 text-lg bg-secondary border-border" />
          <InputOTPSlot index={1} className="w-12 h-14 text-lg bg-secondary border-border" />
          <InputOTPSlot index={2} className="w-12 h-14 text-lg bg-secondary border-border" />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} className="w-12 h-14 text-lg bg-secondary border-border" />
          <InputOTPSlot index={4} className="w-12 h-14 text-lg bg-secondary border-border" />
          <InputOTPSlot index={5} className="w-12 h-14 text-lg bg-secondary border-border" />
        </InputOTPGroup>
      </InputOTP>
    </div>
  );

  const ResendLink = ({ onResend }: { onResend: () => void }) => (
    <div className="text-center text-sm text-muted-foreground">
      {resendCooldown > 0 ? (
        <span>Resend code in {resendCooldown}s</span>
      ) : (
        <button type="button" onClick={onResend} className="text-primary hover:underline" disabled={loading}>
          Resend code
        </button>
      )}
    </div>
  );

  const renderView = () => {
    switch (view) {
      // ─── SIGN IN ───
      case "signin":
        return (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">Welcome back</h1>
              <p className="text-muted-foreground">Sign in to access your AI assistant</p>
            </div>
            <form onSubmit={handleSignIn} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="you@example.com" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-12 bg-secondary border-border focus:border-primary" required />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-foreground">Password</Label>
                  <button type="button" onClick={() => { setView("forgot"); setPassword(""); }}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input id="password" type="password" placeholder="••••••••" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 h-12 bg-secondary border-border focus:border-primary" required />
                </div>
              </div>
              <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Sign in</span><ArrowRight className="w-5 h-5" /></>}
              </Button>
              <Divider />
              <GoogleButton />
            </form>
            <div className="mt-6 text-center">
              <button type="button" onClick={() => { setView("signup"); setPassword(""); }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Don't have an account? Sign up
              </button>
            </div>
          </div>
        );

      // ─── SIGN UP ───
      case "signup":
        return (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">Create an account</h1>
              <p className="text-muted-foreground">Start your journey with AI telephony</p>
            </div>
            <form onSubmit={handleSignupSendOTP} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="you@example.com" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-12 bg-secondary border-border focus:border-primary" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input id="password" type="password" placeholder="••••••••" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 h-12 bg-secondary border-border focus:border-primary" required />
                </div>
              </div>
              <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Create account</span><ArrowRight className="w-5 h-5" /></>}
              </Button>
              <Divider />
              <GoogleButton />
            </form>
            <div className="mt-6 text-center">
              <button type="button" onClick={() => { setView("signin"); setPassword(""); }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Already have an account? Sign in
              </button>
            </div>
          </div>
        );

      // ─── SIGNUP OTP VERIFICATION ───
      case "signup-otp":
        return (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">Verify your email</h1>
              <p className="text-muted-foreground">
                We sent a 6-digit code to <span className="text-foreground font-medium">{email}</span>
              </p>
            </div>
            <form onSubmit={handleSignupVerifyOTP} className="space-y-6">
              <OTPInput value={otpCode} onChange={setOtpCode} />
              <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading || otpCode.length !== 6}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Verify & Create Account</span><ArrowRight className="w-5 h-5" /></>}
              </Button>
              <ResendLink onResend={handleResendSignupOTP} />
            </form>
            <div className="mt-6 text-center">
              <button type="button" onClick={() => { setView("signup"); setOtpCode(""); }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back to sign up
              </button>
            </div>
          </div>
        );

      // ─── FORGOT PASSWORD ───
      case "forgot":
        return (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">Reset your password</h1>
              <p className="text-muted-foreground">Enter your email and we'll send you a reset code</p>
            </div>
            <form onSubmit={handleForgotSendOTP} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="you@example.com" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-12 bg-secondary border-border focus:border-primary" required />
                </div>
              </div>
              <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Send Reset Code</span><ArrowRight className="w-5 h-5" /></>}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <button type="button" onClick={() => setView("signin")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
            </div>
          </div>
        );

      // ─── RESET OTP + NEW PASSWORD ───
      case "reset-otp":
        return (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">Enter reset code</h1>
              <p className="text-muted-foreground">
                We sent a 6-digit code to <span className="text-foreground font-medium">{email}</span>
              </p>
            </div>
            <form onSubmit={handleResetVerifyOTP} className="space-y-6">
              <OTPInput value={otpCode} onChange={setOtpCode} />
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-foreground">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input id="newPassword" type="password" placeholder="••••••••" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-11 h-12 bg-secondary border-border focus:border-primary" required />
                </div>
              </div>
              <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading || otpCode.length !== 6}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Reset Password</span><ArrowRight className="w-5 h-5" /></>}
              </Button>
              <ResendLink onResend={handleResendResetOTP} />
            </form>
            <div className="mt-6 text-center">
              <button type="button" onClick={() => { setView("forgot"); setOtpCode(""); setNewPassword(""); }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            </div>
          </div>
        );

      // ─── RESET SUCCESS ───
      case "reset-success":
        return (
          <div className="text-center">
            <div className="mb-8">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Password reset!</h1>
              <p className="text-muted-foreground">Your password has been successfully reset. You can now sign in with your new password.</p>
            </div>
            <Button variant="gradient" size="lg" className="w-full"
              onClick={() => { setView("signin"); setPassword(""); setNewPassword(""); setOtpCode(""); }}>
              <span>Sign in</span>
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-auto pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[128px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <Phone className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">VoiceAI</span>
          </Link>
        </div>

        {/* Auth Card */}
        <div className="glass rounded-2xl p-8 shadow-elevated">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
