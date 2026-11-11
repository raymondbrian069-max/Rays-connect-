
import React, { useEffect, useState } from "react";
import { supabase } from "./supabase.js";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      loadProfile();
    } else {
      setProfile(null);
    }
  }, [session]);

  async function loadProfile() {
    setLoading(true);
    setMessage("");

    const user = session.user;

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (data) {
      setProfile(data);
      setUsername(data.username || "");
      setFullName(data.full_name || "");
      setBio(data.bio || "");
      setAvatarUrl(data.avatar_url || "");
    } else {
      const initialUsername =
        user.user_metadata?.username ||
        `${user.email.split("@")[0]}_${user.id.slice(0, 5)}`;

      const { data: created, error: createError } = await supabase
        .from("user_profiles")
        .insert({
          id: user.id,
          username: initialUsername
        })
        .select()
        .single();

      if (createError) {
        setMessage(createError.message);
      } else {
        setProfile(created);
        setUsername(created.username);
      }
    }

    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: username.trim()
            },
            emailRedirectTo: window.location.origin
          }
        });

        if (error) throw error;

        setMessage(
          "Account created! Check your email to confirm your account."
        );
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (error) throw error;
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please choose an image file.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Please choose an image smaller than 5 MB.");
      e.target.value = "";
      return;
    }

    setLoading(true);
    setMessage("Uploading your photo...");

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath =
        `${session.user.id}/${Date.now()}-${safeName}`;

      const { data, error } = await supabase.storage
        .from("profile-photos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false
        });

      if (error) throw error;

      const { data: publicData } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(data.path);

      setAvatarUrl(publicData.publicUrl);
      setMessage("Photo uploaded! Tap Save Profile to finish.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("user_profiles")
      .update({
        username: username.trim(),
        full_name: fullName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl
      })
      .eq("id", session.user.id)
      .select()
      .single();

    if (error) {
      setMessage(error.message);
    } else {
      setProfile(data);
      setEditing(false);
      setMessage("Profile updated successfully!");
    }

    setLoading(false);
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
    }
  }

  if (session) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Rays<span>Connect</span></h1>
          <h2>My Profile</h2>

          {loading && <p>Please wait...</p>}

          {profile && !editing && (
            <>
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: "50%",
                    objectFit: "cover"
                  }}
                />
              ) : (
                <p>No profile photo yet.</p>
              )}

              <h2>{profile.full_name || profile.username}</h2>
              <p>@{profile.username}</p>
              <p>{profile.bio || "No bio added yet."}</p>
              <p>{session.user.email}</p>

              <button onClick={() => setEditing(true)}>
                Edit Profile
              </button>
            </>
          )}

          {editing && (
            <form onSubmit={saveProfile}>
              <h3>Update your profile</h3>

              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt="Profile preview"
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: "50%",
                    objectFit: "cover"
                  }}
                />
              )}

              <label>
                Choose profile photo
              </label>

              <input
                type="file"
                accept="image/*"
                onChange={uploadAvatar}
                disabled={loading}
              />

              <input
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                minLength={3}
              />

              <input
                placeholder="Full name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />

              <textarea
                placeholder="Write your bio"
                value={bio}
                onChange={e => setBio(e.target.value)}
              />

              <button type="submit" disabled={loading}>
                {loading ? "Please wait..." : "Save Profile"}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setEditing(false);
                  setMessage("");
                }}
              >
                Cancel
              </button>
            </form>
          )}

          {message && <p>{message}</p>}

          <button onClick={logout}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Rays<span>Connect</span></h1>
        <p>Your moments. Your people.</p>

        <h2>
          {mode === "signup" ? "Create Account" : "Welcome Back"}
        </h2>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <input
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              minLength={3}
            />
          )}

          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password (at least 8 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
          />

          <button type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "signup"
                ? "Create Account"
                : "Sign In"}
          </button>
        </form>

        {message && <p>{message}</p>}

        <p>
          {mode === "signup"
            ? "Already have an account?"
            : "New to Rays Connect?"}
          {" "}

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setMessage("");
            }}
          >
            {mode === "signup" ? "Sign In" : "Register"}
          </button>
        </p>
      </div>
    </div>
  );
            }
