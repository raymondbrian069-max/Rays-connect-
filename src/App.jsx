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
