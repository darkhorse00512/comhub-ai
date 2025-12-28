import { Request, Response } from "express";
import getSupabaseClient from "../config/supabase";
import AuthUtils from "../utils/auth";
import logger from "../utils/logger";

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, supabaseUserId } = req.body;

      if (!email) {
        res.status(400).json({ error: "Email is required" });
        return;
      }

      const supabase = getSupabaseClient();

      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .single();

      if (existingUser) {
        // User exists, return token for login
        const token = AuthUtils.generateToken({
          userId: existingUser.id,
          email: email,
        });

        res.status(200).json({
          success: true,
          user: {
            id: existingUser.id,
            email: email,
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
        .single();

      if (error) {
        logger.error("Failed to create user:", error);
        res.status(500).json({
          error: "Registration failed",
          details: error.message,
        });
        return;
      }

      const token = AuthUtils.generateToken({
        userId: newUser.id,
        email: newUser.email,
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
        .single();

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
          .single();

        if (insertError) {
          logger.error("Failed to create user:", insertError);
          res.status(500).json({
            error: "Failed to create user",
            details: insertError.message,
          });
          return;
        }

        user = newUser;
      }

      const token = AuthUtils.generateToken({
        userId: user.id,
        email: user.email,
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
        .single();

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
