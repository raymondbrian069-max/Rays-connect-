
import React, { useEffect, useState } from "react";
import { supabase } from "./supabase.js";

export default function App() {
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });

    return () => subscription.unsubscribe();
  }, []);

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
            data: { username: username.trim() },
            emailRedirectTo: window.location.origin
          }
        });

        if (error) throw error;

        setMessage("Account created! Check your email to confirm your account.");
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

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(error.message);
  }

  if (session) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Rays<span>Connect</span></h1>
          <h2>Welcome!</h2>
          <p>You are signed in as:</p>
          <p>{session.user.email}</p>
          <button onClick={logout}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Rays<span>Connect</span></h1>
        <p>Your moments. Your people.</p>

        <h2>{mode === "signup" ? "Create account" : "Welcome back"}</h2>

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
            {loading ? "Please wait..." :
              mode === "signup" ? "Create account" : "Sign in"}
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
            {mode === "signup" ? "Sign in" : "Register"}
          </button>
        </p>
      </div>
    </div>
  );
}
import React, { useState } from "react";
import {
  Home, Search, Film, MessageCircle,
  User, Heart, Plus, Send, Image, Bell
} from "lucide-react";

export default function App() {
  const [active, setActive] = useState("Home");
  const [liked, setLiked] = useState(false);

  return (
    <div className="app">
      <header className="topbar">
        <h1>Rays<span>Connect</span></h1>
        <Bell />
      </header>

      <nav className="menu">
        {[
          ["Home", Home],
          ["Explore", Search],
          ["Reels", Film],
          ["Messages", MessageCircle],
          ["Profile", User]
        ].map(([name, Icon]) => (
          <button
            key={name}
            className={active === name ? "selected" : ""}
            onClick={() => setActive(name)}
          >
            <Icon size={21} />
            <span>{name}</span>
          </button>
        ))}
      </nav>

      <main>
        <h2>{active}</h2>

        {active === "Home" && (
          <>
            <section className="stories">
              <div className="story add">
                <Plus />
                <small>Your story</small>
              </div>
              {["Brian", "Mary", "Kevin", "Faith"].map(name => (
                <div className="story" key={name}>
                  <div className="avatar">{name[0]}</div>
                  <small>{name}</small>
                </div>
              ))}
            </section>

            <article className="post">
              <div className="post-user">
                <div className="avatar">R</div>
                <strong>Rays Connect</strong>
              </div>
              <div className="post-image">
                <Image size={50} />
                <p>Your moments. Your people.</p>
              </div>
              <div className="actions">
                <button onClick={() => setLiked(!liked)}>
                  <Heart fill={liked ? "red" : "none"} />
                  {liked ? "Liked" : "Like"}
                </button>
                <button><MessageCircle /> Comment</button>
                <button><Send /> Share</button>
              </div>
              <p>Welcome to Rays Connect!</p>
            </article>
          </>
        )}

        {active === "Explore" && <p>Discover new people and posts.</p>}
        {active === "Reels" && <p>Your short videos will appear here.</p>}
        {active === "Messages" && <p>Your conversations will appear here.</p>}
        {active === "Profile" && <p>Welcome to your profile.</p>}
      </main>
    </div>
  );
        }
