// backend/middleware/verifyUser.js
const { createClient } = require("@supabase/supabase-js");

let supabase;
try {
  // createClient will throw if SUPABASE_URL is missing; guard it so importing this module won't crash the server
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  } else {
    console.warn('⚠️ Supabase env not configured: SUPABASE_URL or SUPABASE_ANON_KEY missing');
    supabase = null;
  }
} catch (e) {
  console.warn('⚠️ Failed to initialize Supabase client in middleware:', e.message);
  supabase = null;
}

const verifyUser = async (req, res, next) => {
  try {
    if (!supabase) return res.status(500).json({ success: false, message: 'Supabase not configured on server' });

    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ success: false, message: "No token provided" });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ success: false, message: "Invalid token" });

    req.user = data.user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ success: false, message: "Authentication failed" });
  }
};

module.exports = verifyUser;
