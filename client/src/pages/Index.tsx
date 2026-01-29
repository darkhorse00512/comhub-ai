import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Phone, Mic, MessageSquare, Shield, ArrowRight, Zap, Globe, Clock, Play, Sparkles, Users, TrendingUp, BookOpen } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen gradient-hero overflow-hidden">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/10 rounded-full blur-[200px]" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[400px] bg-accent/10 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <Phone className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">VoiceAI</span>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="/dashboard/tutorial" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Tutorial
              </Link>
            </Button>
            {loading ? (
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            ) : user ? (
              <Button variant="gradient" asChild>
                <Link to="/dashboard">
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button variant="gradient" asChild>
                  <Link to="/auth">
                    Get Started
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10">
        <section className="container mx-auto px-4 py-20 lg:py-32">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left Column - Content */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="text-center lg:text-left"
              >
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm mb-6"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                  <span className="text-xs font-semibold text-primary tracking-wide uppercase">
                    Next-Gen AI Technology
                  </span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-[1.1] tracking-tight"
                >
                  <span className="text-foreground block">Transform Your</span>
                  <span className="text-gradient block animate-gradient">Voice Experience</span>
                  <span className="text-foreground block">with AI</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed"
                >
                  Experience seamless, intelligent voice conversations powered by cutting-edge AI.
                  Connect naturally, communicate effortlessly, and unlock new possibilities in real-time.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="flex flex-col sm:flex-row items-center lg:items-start gap-4 mb-12"
                >
                  <Button
                    variant="gradient"
                    size="xl"
                    className="group relative overflow-hidden shadow-[0_0_40px_hsl(199,89%,48%,0.3)] hover:shadow-[0_0_60px_hsl(199,89%,48%,0.5)] transition-all duration-300"
                    asChild
                  >
                    <Link to="/auth">
                      <span className="relative z-10 flex items-center gap-2">
                        Get Started Free
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </span>
                      <motion.div
                        className="absolute inset-0 gradient-primary opacity-0 group-hover:opacity-100 transition-opacity"
                        initial={false}
                        whileHover={{ scale: 1.05 }}
                      />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="xl"
                    className="group border-2 hover:bg-primary/10 hover:border-primary/50 transition-all duration-300"
                    asChild
                  >
                    <Link to="/dashboard/tutorial">
                      <BookOpen className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      Learn How It Works
                    </Link>
                  </Button>
                </motion.div>

                {/* Stats */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="grid grid-cols-3 gap-6 pt-8 border-t border-border/30"
                >
                  {[
                    { value: "10K+", label: "Active Users", icon: Users },
                    { value: "99.9%", label: "Uptime", icon: TrendingUp },
                    { value: "24/7", label: "Support", icon: Clock },
                  ].map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                      className="text-center lg:text-left"
                    >
                      <div className="flex items-center justify-center lg:justify-start gap-2 mb-1">
                        <stat.icon className="w-4 h-4 text-primary" />
                        <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>

              {/* Right Column - Hero Visual */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="relative flex items-center justify-center"
              >
                <div className="relative w-full max-w-lg aspect-square">
                  {/* Outer glow effect */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-3xl animate-pulse" />

                  {/* Animated rings */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full border border-primary/20"
                  />
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-8 rounded-full border border-primary/30"
                  />
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-16 rounded-full border border-accent/30"
                  />

                  {/* Floating particles */}
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 rounded-full bg-primary/60"
                      style={{
                        top: `${20 + i * 15}%`,
                        left: `${15 + (i % 3) * 35}%`,
                      }}
                      animate={{
                        y: [0, -20, 0],
                        opacity: [0.4, 0.8, 0.4],
                        scale: [1, 1.2, 1],
                      }}
                      transition={{
                        duration: 3 + i * 0.5,
                        repeat: Infinity,
                        delay: i * 0.3,
                        ease: "easeInOut",
                      }}
                    />
                  ))}

                  {/* Center orb with enhanced design */}
                  <motion.div
                    animate={{
                      y: [0, -15, 0],
                      scale: [1, 1.02, 1],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="absolute inset-20 rounded-full gradient-primary shadow-[0_0_60px_hsl(199,89%,48%,0.4)]"
                  >
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                      >
                        <Phone className="w-16 h-16 md:w-20 md:h-20 text-primary-foreground drop-shadow-lg" />
                      </motion.div>
                    </div>

                    {/* Inner glow */}
                    <div className="absolute inset-4 rounded-full bg-primary/30 blur-xl" />
                  </motion.div>

                  {/* Decorative elements */}
                  <motion.div
                    className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-accent/20 blur-2xl"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <motion.div
                    className="absolute -bottom-4 -left-4 w-32 h-32 rounded-full bg-primary/20 blur-2xl"
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.2, 0.4, 0.2],
                    }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 1,
                    }}
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Why Choose VoiceAI?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Cutting-edge technology meets intuitive design for an unparalleled
              communication experience.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Mic,
                title: "Voice Recognition",
                description: "Crystal-clear audio processing with advanced noise cancellation",
              },
              {
                icon: MessageSquare,
                title: "Real-time Chat",
                description: "Instant AI responses with natural language understanding",
              },
              {
                icon: Globe,
                title: "Global Access",
                description: "Connect from anywhere with our worldwide infrastructure",
              },
              {
                icon: Shield,
                title: "Enterprise Security",
                description: "End-to-end encryption with SOC 2 compliance",
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="glass-hover rounded-2xl p-6 text-center"
              >
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
                  <feature.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass rounded-3xl p-12 lg:p-16 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 gradient-glow opacity-50" />
            <div className="relative z-10">
              <Clock className="w-12 h-12 text-primary mx-auto mb-6" />
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                Ready to Transform Your Communication?
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                Join thousands of users who are already experiencing the future
                of voice AI technology.
              </p>
              <Button variant="gradient" size="xl" asChild>
                <Link to="/auth">
                  Get Started for Free
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/30">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                  <Phone className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-foreground">VoiceAI</span>
              </div>
              <Link to="/dashboard/tutorial" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Tutorial
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 VoiceAI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
