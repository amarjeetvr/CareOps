import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import api from '../api';

export default function Inbox() {
  const { workspace } = useWorkspace();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [reply, setReply] = useState('');
  const [replyChannel, setReplyChannel] = useState('email');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace?.id) return;
    api.get(`/inbox?workspace_id=${workspace.id}`)
      .then(res => {
        setConversations(res.data.conversations);
        if (conversationId) {
          const conv = res.data.conversations.find(c => c.id === parseInt(conversationId));
          if (conv) selectConversation(conv);
        }
      })
      .finally(() => setLoading(false));
  }, [workspace, conversationId]);

  const selectConversation = async (conv) => {
    setSelectedConv(conv);
    navigate(`/inbox/${conv.id}`, { replace: true });
    const res = await api.get(`/inbox/${conv.id}/messages`);
    setMessages(res.data.messages);
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !selectedConv) return;
    try {
      await api.post(`/inbox/${selectedConv.id}/reply`, {
        body: reply, channel: replyChannel
      });
      setReply('');
      // Refresh messages
      const res = await api.get(`/inbox/${selectedConv.id}/messages`);
      setMessages(res.data.messages);
      // Refresh conversations list
      const convRes = await api.get(`/inbox?workspace_id=${workspace.id}`);
      setConversations(convRes.data.conversations);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send reply');
    }
  };

  if (loading) return <div className="page-loading">Loading inbox...</div>;

  return (
    <div className="page inbox-page">
      <div className="page-header">
        <h1>Inbox</h1>
      </div>

      <div className="inbox-layout">
        {/* Conversation List */}
        <div className="conv-list">
          {conversations.length === 0 ? (
            <p className="empty-text">No conversations yet</p>
          ) : conversations.map(conv => (
            <div
              key={conv.id}
              className={`conv-item ${selectedConv?.id === conv.id ? 'active' : ''} ${conv.status === 'open' ? 'unread' : ''}`}
              onClick={() => selectConversation(conv)}
            >
              <div className="conv-name">{conv.contact_name}</div>
              <div className="conv-preview">{conv.last_message?.substring(0, 50) || 'No messages'}</div>
              <div className="conv-meta">
                <span className={`badge badge-${conv.status}`}>{conv.status}</span>
                {conv.automation_paused && <span className="badge badge-paused">Auto paused</span>}
                <span className="conv-time">{new Date(conv.last_message_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Message Thread */}
        <div className="msg-thread">
          {!selectedConv ? (
            <div className="msg-empty">Select a conversation</div>
          ) : (
            <>
              <div className="msg-header">
                <h3>{selectedConv.contact_name}</h3>
                <span>{selectedConv.contact_email || selectedConv.contact_phone}</span>
              </div>
              <div className="msg-list">
                {messages.map(msg => (
                  <div key={msg.id} className={`msg-bubble ${msg.direction}`}>
                    <div className="msg-body">{msg.body}</div>
                    <div className="msg-info">
                      <span className="msg-channel">{msg.channel}</span>
                      <span className="msg-sender">{msg.sender_type === 'staff' ? msg.sender_name : msg.sender_type}</span>
                      <span className="msg-time">{new Date(msg.created_at).toLocaleString()}</span>
                      {msg.status === 'failed' && <span className="badge badge-danger">Failed</span>}
                    </div>
                  </div>
                ))}
              </div>
              <form className="msg-reply" onSubmit={handleReply}>
                <select value={replyChannel} onChange={e => setReplyChannel(e.target.value)}>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
                <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Type a reply..." />
                <button type="submit" className="btn btn-primary">Send</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
