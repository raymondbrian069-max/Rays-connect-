import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase.js";

const BUCKET = "profile-photos";
const initials = (p) => (p?.full_name || p?.username || "R").slice(0,1).toUpperCase();
const displayName = (p) => p?.full_name || p?.username || "Rays Connect member";
const dateText = (value) => value ? new Date(value).toLocaleString() : "";

export default function App() {
  const [session,setSession] = useState(null);
  const [profile,setProfile] = useState(null);
  const [posts,setPosts] = useState([]);
  const [notifications,setNotifications] = useState([]);
  const [showNotifications,setShowNotifications] = useState(false);
  const [mode,setMode] = useState("login");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [username,setUsername] = useState("");
  const [fullName,setFullName] = useState("");
  const [bio,setBio] = useState("");
  const [avatarUrl,setAvatarUrl] = useState("");
  const [postContent,setPostContent] = useState("");
  const [postImage,setPostImage] = useState(null);
  const [commentDrafts,setCommentDrafts] = useState({});
  const [replyDrafts,setReplyDrafts] = useState({});
  const [replyOpen,setReplyOpen] = useState({});
  const [editing,setEditing] = useState(false);
  const [loading,setLoading] = useState(false);
  const [message,setMessage] = useState("");
  const [activeTab,setActiveTab] = useState("feed");

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async () => {
    if (!session?.user) return;
    const user=session.user;
    const {data,error}=await supabase.from("user_profiles").select("*").eq("id",user.id).maybeSingle();
    if(error){setMessage(error.message);return;}
    let row=data;
    if(!row){
      const fallback=(user.user_metadata?.username || user.email?.split("@")[0] || "member").replace(/[^a-zA-Z0-9_]/g,"").slice(0,20)+"_"+user.id.slice(0,5);
      const {data:created,error:createError}=await supabase.from("user_profiles").insert({id:user.id,username:fallback}).select().single();
      if(createError){setMessage(createError.message);return;}
      row=created;
    }
    setProfile(row);setUsername(row.username||"");setFullName(row.full_name||"");setBio(row.bio||"");setAvatarUrl(row.avatar_url||"");
  },[session]);

  const loadPosts = useCallback(async () => {
    if(!session?.user) return;
    const [postResult,likeResult,commentResult]=await Promise.all([
      supabase.from("posts").select("*").order("created_at",{ascending:false}).limit(100),
      supabase.from("likes").select("post_id,user_id"),
      supabase.from("comments").select("*").order("created_at",{ascending:true})
    ]);
    const error=postResult.error||likeResult.error||commentResult.error;
    if(error){setMessage(error.message);return;}
    const postRows=postResult.data||[], likes=likeResult.data||[], comments=commentResult.data||[];
    const ids=[...new Set([...postRows.map(x=>x.user_id),...comments.map(x=>x.user_id)].filter(Boolean))];
    let people=[];
    if(ids.length){const r=await supabase.from("user_profiles").select("id,username,full_name,avatar_url").in("id",ids);if(r.error){setMessage(r.error.message);return;}people=r.data||[];}
    setPosts(postRows.map(post=>({
      ...post,author:people.find(p=>p.id===post.user_id),
      likesCount:likes.filter(x=>x.post_id===post.id).length,
      likedByMe:likes.some(x=>x.post_id===post.id&&x.user_id===session.user.id),
      comments:comments.filter(x=>x.post_id===post.id).map(c=>({...c,author:people.find(p=>p.id===c.user_id)}))
    })));
  },[session]);

  const loadNotifications = useCallback(async () => {
    if(!session?.user) return;
    const {data,error}=await supabase.from("notifications").select("*").eq("recipient_id",session.user.id).order("created_at",{ascending:false}).limit(50);
    if(error){setMessage(error.message);return;}
    const rows=data||[], ids=[...new Set(rows.map(n=>n.actor_id).filter(Boolean))];
    let people=[];
    if(ids.length){const r=await supabase.from("user_profiles").select("id,username,full_name,avatar_url").in("id",ids);if(r.error){setMessage(r.error.message);return;}people=r.data||[];}
    setNotifications(rows.map(n=>({...n,actor:people.find(p=>p.id===n.actor_id)})));
  },[session]);

  useEffect(()=>{if(session){loadProfile();loadPosts();loadNotifications();}else{setProfile(null);setPosts([]);setNotifications([]);}},[session,loadProfile,loadPosts,loadNotifications]);

  useEffect(()=>{
    if(!session?.user) return;
    const channel=supabase.channel("rays-connect-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"posts"},loadPosts)
      .on("postgres_changes",{event:"*",schema:"public",table:"comments"},()=>{loadPosts();loadNotifications();})
      .on("postgres_changes",{event:"*",schema:"public",table:"likes"},()=>{loadPosts();loadNotifications();})
      .on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:"recipient_id=eq."+session.user.id},loadNotifications)
      .subscribe();
    return ()=>{supabase.removeChannel(channel);};
  },[session,loadPosts,loadNotifications]);

  async function handleAuth(e){
    e.preventDefault();setLoading(true);setMessage("");
    try{
      if(mode==="signup"){
        const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{username:username.trim()},emailRedirectTo:window.location.origin}});
        if(error) throw error;
        setMessage(data.session?"Account created successfully.":"Account created. Check your email to confirm, then sign in.");
        setMode("login");
      }else{
        const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
        if(error) throw error;
      }
    }catch(err){setMessage(err.message||"Authentication failed.");}finally{setLoading(false);}
  }

  async function logout(){const {error}=await supabase.auth.signOut();if(error)setMessage(error.message);}

  async function saveProfile(e){
    e.preventDefault();setLoading(true);setMessage("");
    const {data,error}=await supabase.from("user_profiles").upsert({id:session.user.id,username:username.trim(),full_name:fullName.trim(),bio:bio.trim(),avatar_url:avatarUrl},{onConflict:"id"}).select().single();
    if(error)setMessage(error.message);else{setProfile(data);setEditing(false);setMessage("Profile saved successfully.");await loadPosts();}
    setLoading(false);
  }

  async function uploadFile(file,folder){
    if(!file) return null;
    if(!file.type.startsWith("image/")||file.size>5*1024*1024) throw new Error("Choose an image smaller than 5 MB.");
    const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
    const path=folder+"/"+session.user.id+"/"+Date.now()+"-"+safe;
    const {data,error}=await supabase.storage.from(BUCKET).upload(path,file,{upsert:false});
    if(error) throw error;
    return supabase.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;
  }

  async function uploadAvatar(e){
    const file=e.target.files?.[0];if(!file)return;setLoading(true);
    try{setAvatarUrl(await uploadFile(file,"avatars"));setMessage("Photo uploaded. Save your profile to apply it.");}
    catch(err){setMessage(err.message);}finally{setLoading(false);e.target.value="";}
  }

  async function createPost(e){
    e.preventDefault();if(!postContent.trim()&&!postImage){setMessage("Write something or choose a photo.");return;}
    setLoading(true);setMessage("");
    try{
      const image_url=postImage?await uploadFile(postImage,"posts"):null;
      const {error}=await supabase.from("posts").insert({user_id:session.user.id,content:postContent.trim(),image_url});
      if(error)throw error;
      setPostContent("");setPostImage(null);setMessage("Your post has been published.");await loadPosts();
    }catch(err){setMessage(err.message);}finally{setLoading(false);}
  }

  async function deletePost(id){
    if(!window.confirm("Delete this post?"))return;
    const {error}=await supabase.from("posts").delete().eq("id",id).eq("user_id",session.user.id);
    if(error)setMessage(error.message);else{setMessage("Post deleted.");await loadPosts();}
  }

  async function toggleLike(post){
    const old=posts;setPosts(current=>current.map(p=>p.id===post.id?{...p,likedByMe:!p.likedByMe,likesCount:p.likesCount+(p.likedByMe?-1:1)}:p));
    const result=post.likedByMe
      ?await supabase.from("likes").delete().eq("post_id",post.id).eq("user_id",session.user.id)
      :await supabase.from("likes").insert({post_id:post.id,user_id:session.user.id});
    if(result.error){setPosts(old);setMessage(result.error.message);}else{await loadPosts();await loadNotifications();}
  }

  async function addComment(postId,parentId=null){
    const draftKey=parentId||postId;
    const content=(parentId?replyDrafts[draftKey]:commentDrafts[draftKey]||"").trim();
    if(!content){setMessage("Write a comment first.");return;}
    setLoading(true);
    const payload={post_id:postId,user_id:session.user.id,content,...(parentId?{parent_comment_id:parentId}:{})};
    const {error}=await supabase.from("comments").insert(payload);
    if(error)setMessage(error.message);else{
      if(parentId)setReplyDrafts(v=>({...v,[draftKey]:""}));else setCommentDrafts(v=>({...v,[draftKey]:""}));
      setMessage(parentId?"Reply added.":"Comment added.");await loadPosts();await loadNotifications();
    }
    setLoading(false);
  }

  async function deleteComment(id){
    if(!window.confirm("Delete this comment?"))return;
    const {error}=await supabase.from("comments").delete().eq("id",id).eq("user_id",session.user.id);
    if(error)setMessage(error.message);else{setMessage("Comment deleted.");await loadPosts();}
  }

  async function markRead(id){
    const {error}=await supabase.from("notifications").update({is_read:true}).eq("id",id).eq("recipient_id",session.user.id);
    if(error)setMessage(error.message);else setNotifications(v=>v.map(n=>n.id===id?{...n,is_read:true}:n));
  }
  async function markAllRead(){
    const ids=notifications.filter(n=>!n.is_read).map(n=>n.id);if(!ids.length)return;
    const {error}=await supabase.from("notifications").update({is_read:true}).in("id",ids).eq("recipient_id",session.user.id);
    if(error)setMessage(error.message);else setNotifications(v=>v.map(n=>({...n,is_read:true})));
  }

  const unread=useMemo(()=>notifications.filter(n=>!n.is_read).length,[notifications]);
  const commentTree=(post,parent=null)=>post.comments.filter(c=>(c.parent_comment_id||null)===parent);

  function Comment({post,comment,depth=0}){
    const children=commentTree(post,comment.id);
    return <div className="comment" style={{marginLeft:depth?18:0}}>
      <div className="comment-head"><b>{displayName(comment.author)}</b><small>@{comment.author?.username||"member"} · {dateText(comment.created_at)}</small></div>
      <p>{comment.content}</p>
      <div className="comment-actions">
        <button onClick={()=>setReplyOpen(v=>({...v,[comment.id]:!v[comment.id]}))}>Reply</button>
        {comment.user_id===session.user.id&&<button onClick={()=>deleteComment(comment.id)}>Delete</button>}
      </div>
      {replyOpen[comment.id]&&<div className="reply-box"><textarea rows="2" placeholder="Write a reply..." value={replyDrafts[comment.id]||""} onChange={e=>setReplyDrafts(v=>({...v,[comment.id]:e.target.value}))}/><button disabled={loading} onClick={()=>addComment(post.id,comment.id)}>Send reply</button></div>}
      {children.map(child=><Comment key={child.id} post={post} comment={child} depth={depth+1}/>)}
    </div>;
  }

  if(!session)return <div className="auth-page"><div className="auth-card"><div className="brand">Rays<span>Connect</span></div><p className="tagline">Your moments. Your people.</p><h2>{mode==="signup"?"Create your account":"Welcome back"}</h2><form onSubmit={handleAuth}>
    {mode==="signup"&&<input placeholder="Choose a username" value={username} onChange={e=>setUsername(e.target.value)} minLength="3" required/>}
    <input type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} required/>
    <input type="password" placeholder="Password (at least 8 characters)" value={password} onChange={e=>setPassword(e.target.value)} minLength="8" required/>
    <button className="primary" disabled={loading}>{loading?"Please wait...":mode==="signup"?"Create account":"Sign in"}</button>
  </form>{message&&<p className="notice">{message}</p>}<p className="switch-auth">{mode==="signup"?"Already registered?":"New to Rays Connect?"} <button className="link-button" onClick={()=>{setMode(mode==="signup"?"login":"signup");setMessage("");}}>{mode==="signup"?"Sign in":"Create account"}</button></p></div></div>;

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#" onClick={e=>{e.preventDefault();setActiveTab("feed");}}>Rays<span>Connect</span></a><div className="top-actions"><button className="icon-button" onClick={()=>{setShowNotifications(v=>!v);loadNotifications();}} aria-label="Notifications">♧ <span className="notification-label">Notifications</span>{unread>0&&<i>{unread}</i>}</button><button className="avatar small-avatar" onClick={()=>setActiveTab("profile")}>{profile?.avatar_url?<img src={profile.avatar_url} alt="Profile"/>:initials(profile)}</button><button className="logout" onClick={logout}>Sign out</button></div></header>
    {showNotifications&&<section className="notifications panel"><div className="section-heading"><h3>Notifications</h3><button className="link-button" onClick={markAllRead}>Mark all read</button></div>{!notifications.length?<p className="muted">You're all caught up.</p>:notifications.map(n=><button key={n.id} className={"notification "+(!n.is_read?"unread":"")} onClick={()=>markRead(n.id)}><b>{displayName(n.actor)}</b> {n.message||((n.type||"").includes("like")?"liked your post.":(n.type||"").includes("reply")?"replied to your comment.":"interacted with you.")}<small>{dateText(n.created_at)}</small></button>)}</section>}
    <nav className="tabs"><button className={activeTab==="feed"?"active":""} onClick={()=>setActiveTab("feed")}>⌂ Feed</button><button className={activeTab==="profile"?"active":""} onClick={()=>setActiveTab("profile")}>◎ My profile</button></nav>
    {message&&<div className="toast" role="status">{message}<button onClick={()=>setMessage("")}>×</button></div>}
    <main className="content">
      {activeTab==="profile"?<section className="panel profile-panel"><div className="profile-cover"/><div className="profile-avatar">{avatarUrl?<img src={avatarUrl} alt="Your profile"/>:initials(profile)}</div><h2>{displayName(profile)}</h2><p className="muted">@{profile?.username||"member"}</p><p>{profile?.bio||"No bio added yet."}</p><button className="primary" onClick={()=>setEditing(v=>!v)}>{editing?"Close editor":"Edit profile"}</button>
        {editing&&<form className="profile-form" onSubmit={saveProfile}><label>Profile photo<input type="file" accept="image/*" onChange={uploadAvatar}/></label>{avatarUrl&&<img className="avatar-preview" src={avatarUrl} alt="Preview"/>}<label>Username<input value={username} onChange={e=>setUsername(e.target.value)} minLength="3" required/></label><label>Full name<input value={fullName} onChange={e=>setFullName(e.target.value)}/></label><label>Bio<textarea rows="3" maxLength="300" value={bio} onChange={e=>setBio(e.target.value)}/></label><button className="primary" disabled={loading}>Save profile</button></form>}
        <div className="profile-stats"><b>{posts.filter(p=>p.user_id===session.user.id).length} <small>Posts</small></b><b>{profile?.username?"Active":"New"} <small>Account</small></b></div>
      </section>:<div className="feed-layout"><section className="feed-column"><form className="composer panel" onSubmit={createPost}><div className="composer-title"><div className="avatar">{initials(profile)}</div><b>Share something with your people</b></div><textarea rows="3" placeholder="What's happening?" maxLength="5000" value={postContent} onChange={e=>setPostContent(e.target.value)}/><div className="composer-footer"><label className="file-label">＋ Photo<input type="file" accept="image/*" onChange={e=>setPostImage(e.target.files?.[0]||null)}/></label><span className="muted">{postImage?.name||"Up to 5 MB"}</span><button className="primary" disabled={loading}>{loading?"Posting...":"Publish post"}</button></div></form>
      {!posts.length?<div className="panel empty"><h3>Your feed is ready</h3><p className="muted">Be the first to share a moment on Rays Connect.</p></div>:posts.map(post=><article className="post panel" key={post.id}><div className="post-header"><div className="avatar">{post.author?.avatar_url?<img src={post.author.avatar_url} alt=""/>:initials(post.author)}</div><div className="post-author"><b>{displayName(post.author)}</b><small>@{post.author?.username||"member"} · {dateText(post.created_at)}</small></div>{post.user_id===session.user.id&&<button className="more-button" onClick={()=>deletePost(post.id)}>Delete</button>}</div>{post.content&&<p className="post-content">{post.content}</p>}{post.image_url&&<img className="post-image" src={post.image_url} alt="Post attachment" loading="lazy"/>}<div className="post-actions"><button className={post.likedByMe?"liked":""} onClick={()=>toggleLike(post)}>{post.likedByMe?"♥":"♡"} {post.likesCount} Likes</button><span>☷ {post.comments.length} Comments</span></div><div className="comments">{commentTree(post).map(c=><Comment key={c.id} post={post} comment={c}/>)}</div><form className="comment-form" onSubmit={e=>{e.preventDefault();addComment(post.id);}}><input placeholder="Write a comment..." value={commentDrafts[post.id]||""} onChange={e=>setCommentDrafts(v=>({...v,[post.id]:e.target.value}))}/><button disabled={loading}>Send</button></form></article>)}</section><aside className="sidebar panel"><div className="sidebar-brand">Rays<span>Connect</span></div><p>Share moments, connect with people and keep up with your community.</p><hr/><b>Community guidelines</b><p className="muted">Be respectful. Share responsibly. Keep your account secure.</p><button className="secondary" onClick={()=>setActiveTab("profile")}>View your profile</button></aside></div>}
    </main><footer>© {new Date().getFullYear()} Rays Connect · Made to connect people.</footer>
  </div>;
}
