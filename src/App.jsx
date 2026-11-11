
import React, { useEffect, useState } from "react";
import { supabase } from "./supabase.js";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [postContent, setPostContent] = useState("");
  const [postImage, setPostImage] = useState(null);
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
      loadPosts();
      loadNotifications();
    } else {
      setProfile(null);
      setPosts([]);
      setNotifications([]);
      setShowNotifications(false);
    }
  }, [session]);

  async function loadProfile() {
    const user = session.user;

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      setMessage(error.message);
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
  }

  async function loadPosts() {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    const { data: likesData, error: likesError } = await supabase
      .from("likes")
      .select("post_id, user_id");

    if (likesError) {
      setMessage(likesError.message);
      return;
    }

    const { data: commentsData, error: commentsError } = await supabase
      .from("comments")
      .select("*")
      .order("created_at", { ascending: true });

    if (commentsError) {
      setMessage(commentsError.message);
      return;
    }

    const allComments = commentsData || [];

    const userIds = [
      ...new Set([
        ...data.map(post => post.user_id),
        ...allComments.map(comment => comment.user_id)
      ])
    ];

    let profiles = [];

    if (userIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", userIds);

      if (profileError) {
        setMessage(profileError.message);
        return;
      }

      profiles = profileData || [];
    }

    const allLikes = likesData || [];

    setPosts(
      data.map(post => {
        const postLikes = allLikes.filter(
          like => like.post_id === post.id
        );

        const postComments = allComments
          .filter(comment => comment.post_id === post.id)
          .map(comment => ({
            ...comment,
            author: profiles.find(p => p.id === comment.user_id)
          }));

        return {
          ...post,
          author: profiles.find(p => p.id === post.user_id),
          likesCount: postLikes.length,
          likedByMe: postLikes.some(
            like => like.user_id === session.user.id
          ),
          comments: postComments
        };
      })
    );
  }

  async function loadNotifications() {
    if (!session) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setMessage(error.message);
      return;
    }

    const items = data || [];
    const actorIds = [
      ...new Set(items.map(item => item.actor_id).filter(Boolean))
    ];

    let actorProfiles = [];

    if (actorIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("id, username, full_name")
        .in("id", actorIds);

      if (profileError) {
        setMessage(profileError.message);
        return;
      }

      actorProfiles = profileData || [];
    }

    setNotifications(
      items.map(item => ({
        ...item,
        actor: actorProfiles.find(person => person.id === item.actor_id)
      }))
    );
  }

  async function markNotificationRead(notificationId) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("recipient_id", session.user.id);

    if (error) {
      setMessage(error.message);
    } else {
      setNotifications(current =>
        current.map(item =>
          item.id === notificationId
            ? { ...item, is_read: true }
            : item
        )
      );
    }
  }

  async function markAllNotificationsRead() {
    const unreadIds = notifications
      .filter(item => !item.is_read)
      .map(item => item.id);

    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds)
      .eq("recipient_id", session.user.id);

    if (error) {
      setMessage(error.message);
    } else {
      setNotifications(current =>
        current.map(item => ({ ...item, is_read: true }))
      );
    }
  }

  async function toggleLike(post) {
    const previousPosts = posts;

    setPosts(current =>
      current.map(item =>
        item.id === post.id
          ? {
              ...item,
              likedByMe: !item.likedByMe,
              likesCount: item.likesCount + (item.likedByMe ? -1 : 1)
            }
          : item
      )
    );

    let error;

    if (post.likedByMe) {
      const result = await supabase
        .from("likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", session.user.id);

      error = result.error;
    } else {
      const result = await supabase
        .from("likes")
        .insert({
          post_id: post.id,
          user_id: session.user.id
        });

      error = result.error;
    }

    if (error) {
      setPosts(previousPosts);
      setMessage(error.message);
    } else {
      await loadPosts();
    }
  }

  async function addComment(postId) {
    const content = (commentDrafts[postId] || "").trim();

    if (!content) {
      setMessage("Write a comment first.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("comments")
      .insert({
        post_id: postId,
        user_id: session.user.id,
        content
      });

    if (error) {
      setMessage(error.message);
    } else {
      setCommentDrafts(current => ({
        ...current,
        [postId]: ""
      }));

      setMessage("Comment added successfully!");
      await loadPosts();
    }

    setLoading(false);
  }

  async function addReply(postId, parentCommentId) {
    const content = (replyDrafts[parentCommentId] || "").trim();

    if (!content) {
      setMessage("Write your reply first.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("comments")
      .insert({
        post_id: postId,
        user_id: session.user.id,
        content,
        parent_comment_id: parentCommentId
      });

    if (error) {
      setMessage(error.message);
    } else {
      setReplyDrafts(current => ({
        ...current,
        [parentCommentId]: ""
      }));

      setMessage("Reply added successfully!");
      await loadPosts();
    }

    setLoading(false);
  }

  async function deleteComment(commentId) {
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", session.user.id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Comment deleted.");
      await loadPosts();
    }
  }

  function renderComment(post, comment, depth = 0) {
    const replies = post.comments.filter(
      item => item.parent_comment_id === comment.id
    );

    return (
      <div
        key={comment.id}
        style={{
          background: "#f5f5f5",
          padding: 10,
          borderRadius: 8,
          margin: "8px 0",
          marginLeft: depth > 0 ? 18 : 0,
          borderLeft: depth > 0 ? "3px solid #888" : "none"
        }}
      >
        <strong>
          {comment.author?.full_name ||
            comment.author?.username ||
            "Rays Connect User"}
        </strong>

        {comment.author?.username && (
          <small> @{comment.author.username}</small>
        )}

        <p style={{ whiteSpace: "pre-wrap" }}>{comment.content}</p>

        <small>
          {new Date(comment.created_at).toLocaleString()}
        </small>

        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={() => {
              setReplyDrafts(current => ({
                ...current,
                [comment.id]: current[comment.id] || ""
              }));
            }}
          >
            Reply
          </button>

          {comment.user_id === session.user.id && (
            <button
              type="button"
              onClick={() => deleteComment(comment.id)}
            >
              Delete
            </button>
          )}
        </div>

        {Object.prototype.hasOwnProperty.call(replyDrafts, comment.id) && (
          <form
            onSubmit={e => {
              e.preventDefault();
              addReply(post.id, comment.id);
            }}
            style={{ marginTop: 8 }}
          >
            <textarea
              placeholder="Write your reply..."
              value={replyDrafts[comment.id]}
              onChange={e =>
                setReplyDrafts(current => ({
                  ...current,
                  [comment.id]: e.target.value
                }))
              }
              maxLength={1000}
              rows={2}
            />

            <button type="submit" disabled={loading}>
              Send Reply
            </button>

            <button
              type="button"
              onClick={() =>
                setReplyDrafts(current => {
                  const updated = { ...current };
                  delete updated[comment.id];
                  return updated;
                })
              }
            >
              Cancel
            </button>
          </form>
        )}

        {replies.map(reply =>
          renderComment(post, reply, depth + 1)
        )}
      </div>
    );
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
            data: { username: username.trim() },
            emailRedirectTo: window.location.origin
          }
        });

        if (error) throw error;

        setMessage("Account created! Check your email to confirm.");
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

    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setMessage("Choose an image smaller than 5 MB.");
      e.target.value = "";
      return;
    }

    setLoading(true);

    try {
      const filePath =
        `${session.user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      const { data, error } = await supabase.storage
        .from("profile-photos")
        .upload(filePath, file);

      if (error) throw error;

      const { data: publicData } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(data.path);

      setAvatarUrl(publicData.publicUrl);
      setMessage("Photo uploaded. Save your profile.");
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
      await loadPosts();
    }

    setLoading(false);
  }

  async function createPost(e) {
    e.preventDefault();

    if (!postContent.trim() && !postImage) {
      setMessage("Write something or choose a photo.");
      return;
    }

    setLoading(true);
    setMessage("Publishing your post...");

    try {
      let imageUrl = null;

      if (postImage) {
        const filePath =
          `posts/${session.user.id}/${Date.now()}-${postImage.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

        const { data, error } = await supabase.storage
          .from("profile-photos")
          .upload(filePath, postImage);

        if (error) throw error;

        const { data: publicData } = supabase.storage
          .from("profile-photos")
          .getPublicUrl(data.path);

        imageUrl = publicData.publicUrl;
      }

      const { error } = await supabase
        .from("posts")
        .insert({
          user_id: session.user.id,
          content: postContent.trim(),
          image_url: imageUrl
        });

      if (error) throw error;

      setPostContent("");
      setPostImage(null);
      setMessage("Your post has been published!");
      await loadPosts();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function deletePost(postId) {
    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", session.user.id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Post deleted.");
      await loadPosts();
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(error.message);
  }

  if (!session) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Rays<span>Connect</span></h1>
          <p>Your moments. Your people.</p>

          <h2>{mode === "signup" ? "Create Account" : "Welcome Back"}</h2>

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
              {loading ? "Please wait..." : mode === "signup" ? "Create Account" : "Sign In"}
            </button>
          </form>

          {message && <p>{message}</p>}

          <p>
            {mode === "signup" ? "Already have an account?" : "New to Rays Connect?"}
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

  const unreadCount = notifications.filter(item => !item.is_read).length;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Rays<span>Connect</span></h1>
        <p>Your moments. Your people.</p>

        {message && <p>{message}</p>}

        <div style={{ margin: "12px 0" }}>
          <button
            type="button"
            onClick={() => {
              setShowNotifications(current => !current);
              loadNotifications();
            }}
          >
            🔔 Notifications ({unreadCount})
          </button>

          <button
            type="button"
            onClick={loadNotifications}
          >
            Refresh Notifications
          </button>
        </div>

        {showNotifications && (
          <section
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
              textAlign: "left"
            }}
          >
            <h3>Your Notifications</h3>

            {notifications.length === 0 && (
              <p>No notifications yet.</p>
            )}

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsRead}
              >
                Mark All as Read
              </button>
            )}

            {notifications.map(item => (
              <div
                key={item.id}
                style={{
                  padding: 10,
                  borderBottom: "1px solid #eee",
                  background: item.is_read ? "#fff" : "#eef5ff"
                }}
              >
                <strong>
                  {item.actor?.full_name ||
                    item.actor?.username ||
                    "A user"}
                </strong>{" "}
                {item.message}

                <br />

                <small>
                  {new Date(item.created_at).toLocaleString()}
                </small>

                {!item.is_read && (
                  <div>
                    <button
                      type="button"
                      onClick={() => markNotificationRead(item.id)}
                    >
                      Mark as Read
                    </button>
         
