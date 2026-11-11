
import React, { useEffect, useState } from "react";
import { supabase } from "./supabase.js";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [commentDrafts, setCommentDrafts] = useState({});

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
    } else {
      setProfile(null);
      setPosts([]);
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

    if (content.length > 1000) {
      setMessage("Your comment must be 1000 characters or fewer.");
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

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Rays<span>Connect</span></h1>
        <p>Your moments. Your people.</p>

        {message && <p>{message}</p>}

        <h2>My Profile</h2>

        {profile && !editing && (
          <>
            {profile.avatar_url && (
              <img
                src={profile.avatar_url}
                alt="Profile"
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: "50%",
                  objectFit: "cover"
                }}
              />
            )}

            <h3>{profile.full_name || profile.username}</h3>
            <p>@{profile.username}</p>
            <p>{profile.bio || "No bio added yet."}</p>
            <button onClick={() => setEditing(true)}>Edit Profile</button>
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
                  width: 100,
                  height: 100,
                  borderRadius: "50%",
                  objectFit: "cover"
                }}
              />
            )}

            <label>Choose profile photo</label>
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

            <button type="submit" disabled={loading}>Save Profile</button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={loading}
            >
              Cancel
            </button>
          </form>
        )}

        <hr />

        <h2>Home Feed</h2>

        <form onSubmit={createPost}>
          <textarea
            placeholder="What's happening?"
            value={postContent}
            onChange={e => setPostContent(e.target.value)}
            maxLength={2000}
            rows={4}
          />

          <label>Attach a photo</label>

          <input
            type="file"
            accept="image/*"
            onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;

              if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
                setMessage("Choose an image smaller than 5 MB.");
                e.target.value = "";
                return;
              }

              setPostImage(file);
              setMessage("Photo selected. Ready to publish.");
            }}
            disabled={loading}
          />

          {postImage && <p>Selected photo: {postImage.name}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Please wait..." : "Publish Post"}
          </button>
        </form>

        <button onClick={loadPosts}>Refresh Feed</button>

        <h3>Latest Posts</h3>

        {posts.length === 0 && <p>No posts yet. Be the first to post!</p>}

        {posts.map(post => (
          <div
            key={post.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 15,
              margin: "15px 0",
              textAlign: "left"
            }}
          >
            <strong>
              {post.author?.full_name ||
                post.author?.username ||
                "Rays Connect User"}
            </strong>

            {post.author?.username && <p>@{post.author.username}</p>}

            {post.content && (
              <p style={{ whiteSpace: "pre-wrap" }}>{post.content}</p>
            )}

            {post.image_url && (
              <img
                src={post.image_url}
                alt="Post"
                style={{
                  width: "100%",
                  maxHeight: 400,
                  objectFit: "contain",
                  borderRadius: 10,
                  marginTop: 10
                }}
              />
            )}

            <p>
              <small>{new Date(post.created_at).toLocaleString()}</small>
            </p>

            <button onClick={() => toggleLike(post)}>
              {post.likedByMe ? "❤️ Unlike" : "🤍 Like"}
            </button>

            <p>
              {post.likesCount} {post.likesCount === 1 ? "Like" : "Likes"}
            </p>

            <hr />

            <h4>Comments ({post.comments.length})</h4>

            {post.comments.map(comment => (
              <div
                key={comment.id}
                style={{
                  background: "#f5f5f5",
                  padding: 10,
                  borderRadius: 8,
                  margin: "8px 0"
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

                {comment.user_id === session.user.id && (
                  <div>
                    <button onClick={() => deleteComment(comment.id)}>
                      Delete Comment
                    </button>
                  </div>
                )}
              </div>
            ))}

            <form
              onSubmit={e => {
                e.preventDefault();
                addComment(post.id);
              }}
            >
              <textarea
                placeholder="Write a comment..."
                value={commentDrafts[post.id] || ""}
                onChange={e =>
                  setCommentDrafts(current => ({
                    ...current,
                    [post.id]: e.target.value
                  }))
                }
                maxLength={1000}
                rows={2}
              />

              <button type="submit" disabled={loading}>
                {loading ? "Please wait..." : "Add Comment"}
              </button>
            </form>

            {post.user_id === session.user.id && (
              <button onClick={() => deletePost(post.id)}>
                Delete Post
              </button>
            )}
          </div>
        ))}

        <hr />
        <button onClick={logout}>Sign Out</button>
      </div>
    </div>
  );
            }
               
