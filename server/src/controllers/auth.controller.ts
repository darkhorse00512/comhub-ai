import { Request, Response } from "express";
import getSupabaseClient, { Database } from "../config/supabase";
import AuthUtils from "../utils/auth";
import logger from "../utils/logger";

type UserRow = Database['public']['Tables']['users']['Row'];

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, supabaseUserId } = req.body;

      if (!email) {
        res.status(400).json({ error: "Email is required" });
        return;
      }

      const supabase = getSupabaseClient();

      const { data: existingUser } = await supabase
        .from("users")
        .select("id, is_admin")
        .eq("email", email)
        .single() as { data: UserRow | null };

      if (existingUser) {
        // User exists, return token for login
        const token = AuthUtils.generateToken({
          userId: existingUser.id,
          email: email,
          is_admin: existingUser.is_admin || false,
        });

        res.status(200).json({
          success: true,
          user: {
            id: existingUser.id,
            email: email,
            is_admin: existingUser.is_admin || false,
          },
          token,
        });
        return;
      }

      // Create new user
      const newUserData: any = {
        email,
      };

      // Use Supabase Auth user ID if provided
      if (supabaseUserId) {
        newUserData.id = supabaseUserId;
      }

      const { data: newUser, error } = await supabase
        .from("users")
        .insert(newUserData)
        .select()
        .single() as { data: UserRow | null; error: any };

      if (error || !newUser) {
        logger.error("Failed to create user:", error);
        res.status(500).json({
          error: "Registration failed",
          details: error?.message || "Unknown error",
        });
        return;
      }

      const token = AuthUtils.generateToken({
        userId: newUser.id,
        email: newUser.email,
        is_admin: false,
      });

      logger.info("User registered successfully", {
        userId: newUser.id,
        email,
      });

      res.status(201).json({
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          createdAt: newUser.created_at,
          is_admin: false,
        },
        token,
      });
    } catch (error) {
      logger.error("Registration failed:", error);
      res.status(500).json({
        error: "Registration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email: requestEmail, supabaseToken } = req.body;

      if (!requestEmail) {
        res.status(400).json({ error: "Email is required" });
        return;
      }

      let userEmail = requestEmail;
      const supabase = getSupabaseClient();

      // If Supabase token is provided, verify it and get user from Supabase Auth
      let supabaseUserId: string | null = null;
      if (supabaseToken) {
        try {
          // Create a client with the user's token to verify it
          const { createClient } = await import("@supabase/supabase-js");
          const userSupabase = createClient(
            process.env.SUPABASE_URL || "",
            process.env.SUPABASE_ANON_KEY || "",
            {
              global: {
                headers: {
                  Authorization: `Bearer ${supabaseToken}`,
                },
              },
            }
          );

          const {
            data: { user: supabaseUser },
            error: authError,
          } = await userSupabase.auth.getUser(supabaseToken);

          if (authError || !supabaseUser) {
            logger.warn("Invalid Supabase token provided", {
              error: authError?.message,
            });
          } else {
            supabaseUserId = supabaseUser.id;
            // Use the email from Supabase Auth if available
            if (supabaseUser.email) {
              userEmail = supabaseUser.email;
            }
          }
        } catch (error) {
          logger.warn("Failed to verify Supabase token:", error);
        }
      }

      // Try to find user in backend users table
      let { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", userEmail)
        .single() as { data: UserRow | null; error: any };

      // If user doesn't exist, create one
      if (error || !user) {
        const newUserData: any = {
          email: userEmail,
        };

        // Use Supabase Auth user ID if available
        if (supabaseUserId) {
          newUserData.id = supabaseUserId;
        }

        const { data: newUser, error: insertError } = await supabase
          .from("users")
          .insert(newUserData)
          .select()
          .single() as { data: UserRow | null; error: any };

        if (insertError || !newUser) {
          logger.error("Failed to create user:", insertError);
          res.status(500).json({
            error: "Failed to create user",
            details: insertError?.message || "Unknown error",
          });
          return;
        }

        user = newUser;
      }

      const token = AuthUtils.generateToken({
        userId: user.id,
        email: user.email,
        is_admin: user.is_admin || false,
      });

      logger.info("User logged in successfully", {
        userId: user.id,
        email: userEmail,
      });

      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
          is_admin: user.is_admin || false,
        },
        token,
      });
    } catch (error) {
      logger.error("Login failed:", error);
      res.status(500).json({
        error: "Login failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async verifyToken(req: Request, res: Response): Promise<void> {
    try {
      const token = AuthUtils.extractTokenFromHeader(req.headers.authorization);

      if (!token) {
        res.status(401).json({ error: "No token provided" });
        return;
      }

      const decoded = AuthUtils.verifyToken(token);

      res.status(200).json({
        success: true,
        user: {
          userId: decoded.userId,
          email: decoded.email,
          is_admin: decoded.is_admin || false,
        },
      });
    } catch (error) {
      logger.error("Token verification failed:", error);
      res.status(401).json({
        error: "Invalid token",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async deleteAccount(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const email = (req as any).user?.email;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const supabase = getSupabaseClient();

      // Delete user settings
      await supabase
        .from("user_settings")
        .delete()
        .eq("user_id", userId);

      // Delete user's agents
      await supabase
        .from("agents")
        .delete()
        .eq("user_id", userId);

      // Delete user's call sessions
      await supabase
        .from("call_sessions")
        .delete()
        .eq("user_id", userId);

      // Delete user from users table
      await supabase
        .from("users")
        .delete()
        .eq("id", userId);

      // Delete from Supabase Auth using admin API
      try {
        const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
        if (authDeleteError) {
          logger.warn("Failed to delete Supabase Auth user (may not have admin access):", authDeleteError);
        }
      } catch (authErr) {
        logger.warn("Supabase Auth admin deletion not available:", authErr);
      }

      logger.info("Account deleted successfully", { userId, email });

      res.status(200).json({
        success: true,
        message: "Account deleted successfully",
      });
    } catch (error) {
      logger.error("Failed to delete account:", error);
      res.status(500).json({
        error: "Failed to delete account",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const supabase = getSupabaseClient();

      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single() as { data: UserRow | null; error: any };

      if (error || !user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
          is_admin: user.is_admin || false,
        },
      });
    } catch (error) {
      logger.error("Failed to get profile:", error);
      res.status(500).json({
        error: "Failed to get profile",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export const authController = new AuthController();
export default authController;
